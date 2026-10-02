"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { escopoLead } from "@/lib/leads";
import { PAGAMENTOS } from "@/lib/contratos";
import {
  bpsToDecimal,
  calcComissao,
  centsToDecimal,
  parseBRL,
  parsePercent,
} from "@/lib/dinheiro";

export type ContratoResult = { ok: true; id: string } | { ok: false; erro: string };

const schema = z.object({
  plano: z.string().trim().min(2, "Informe o plano.").max(120),
  pagamento: z.enum(PAGAMENTOS, { message: "Escolha a forma de pagamento." }),
  valor: z.string(),
});

const toBps = (pct: { toString(): string }) => Math.round(Number(pct.toString()) * 100);

function revalidar(leadId?: string) {
  revalidatePath("/coletor", "layout");
  revalidatePath("/admin", "layout");
  if (leadId) revalidatePath(`/coletor/leads/${leadId}`);
}

/**
 * Cria ou edita o contrato de um lead (1 por lead). Só enquanto PENDENTE.
 * A comissão é calculada aqui, no servidor, com o percentual atual do tenant.
 */
export async function salvarContrato(leadId: string, formData: FormData): Promise<ContratoResult> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    plano: formData.get("plano") ?? "",
    pagamento: formData.get("pagamento") ?? "",
    valor: String(formData.get("valor") ?? ""),
  });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  const valorCents = parseBRL(parsed.data.valor);
  if (!valorCents || valorCents <= 0) return { ok: false, erro: "Informe um valor maior que zero." };
  if (valorCents > 100_000_000_00) return { ok: false, erro: "Valor alto demais." };

  // lead resolvido pelo escopo da sessão: coletador só contrata lead próprio
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...escopoLead(user) },
    select: { id: true, colaboradorId: true, colaborador: { select: { nome: true } } },
  });
  if (!lead) return { ok: false, erro: "Lead não encontrado." };

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: user.tenantId },
    select: { comissaoPercentual: true },
  });
  const bps = toBps(tenant.comissaoPercentual);
  const comissaoCents = calcComissao(valorCents, bps);

  const dados = {
    plano: parsed.data.plano,
    pagamento: parsed.data.pagamento,
    valor: centsToDecimal(valorCents),
    comissaoPercentual: bpsToDecimal(bps),
    comissaoValor: centsToDecimal(comissaoCents),
  };

  const existente = await prisma.contrato.findUnique({
    where: { leadId },
    select: { id: true, status: true },
  });

  if (existente) {
    if (existente.status !== "PENDENTE") {
      return { ok: false, erro: "Contrato já decidido. Peça ao admin para reabrir." };
    }
    const r = await prisma.contrato.updateMany({
      where: { id: existente.id, tenantId: user.tenantId, status: "PENDENTE" },
      data: dados,
    });
    if (r.count === 0) return { ok: false, erro: "Contrato já decidido. Peça ao admin para reabrir." };
    revalidar(leadId);
    return { ok: true, id: existente.id };
  }

  try {
    const [contrato] = await prisma.$transaction([
      prisma.contrato.create({
        data: {
          ...dados,
          tenantId: user.tenantId,
          leadId,
          colaboradorId: lead.colaboradorId, // comissão é de quem captou o lead
          colaboradorNomeSnapshot: lead.colaborador.nome,
        },
        select: { id: true },
      }),
      prisma.lead.update({ where: { id: leadId }, data: { etapaKanban: "FECHADO" } }),
    ]);
    revalidar(leadId);
    return { ok: true, id: contrato.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, erro: "Este lead já tem contrato." };
    }
    throw e;
  }
}

const idSchema = z.string().min(1);

export async function aprovarContrato(formData: FormData) {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  await prisma.contrato.updateMany({
    where: { id: id.data, tenantId: admin.tenantId, status: "PENDENTE" },
    data: { status: "APROVADO", aprovadoPorNome: admin.nome, aprovadoEm: new Date() },
  });
  revalidar();
}

/** Admin cancela pendente ou aprovado; o coletador só cancela o próprio pendente. */
export async function cancelarContrato(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const where: Prisma.ContratoWhereInput =
    user.perfil === "ADMIN"
      ? // com a comissão já paga (ou em pagamento) não cancela: o dinheiro já saiu
        { id: id.data, tenantId: user.tenantId, status: { in: ["PENDENTE", "APROVADO"] }, pagamentoId: null }
      : { id: id.data, tenantId: user.tenantId, colaboradorId: user.id, status: "PENDENTE" };
  await prisma.contrato.updateMany({
    where,
    data: { status: "CANCELADO", aprovadoPorNome: null, aprovadoEm: null },
  });
  revalidar();
}

export async function reabrirContrato(formData: FormData) {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  await prisma.contrato.updateMany({
    where: { id: id.data, tenantId: admin.tenantId, status: "CANCELADO" },
    data: { status: "PENDENTE", aprovadoPorNome: null, aprovadoEm: null },
  });
  revalidar();
}

export type ConfigState = { erro?: string; ok?: string };

/** Percentual de comissão do tenant. Recalcula os contratos ainda pendentes. */
export async function salvarComissao(_: ConfigState, formData: FormData): Promise<ConfigState> {
  const admin = await requireAdmin();
  const bps = parsePercent(String(formData.get("percentual") ?? ""));
  if (bps === null) return { erro: "Informe um percentual entre 0 e 100 (ex.: 10 ou 7,5)." };

  const pendentes = await prisma.contrato.findMany({
    where: { tenantId: admin.tenantId, status: "PENDENTE" },
    select: { id: true, valor: true },
  });

  await prisma.$transaction([
    prisma.tenant.update({ where: { id: admin.tenantId }, data: { comissaoPercentual: bpsToDecimal(bps) } }),
    ...pendentes.map((c) =>
      prisma.contrato.update({
        where: { id: c.id },
        data: {
          comissaoPercentual: bpsToDecimal(bps),
          comissaoValor: centsToDecimal(calcComissao(Math.round(Number(c.valor.toString()) * 100), bps)),
        },
      }),
    ),
  ]);

  revalidar();
  revalidatePath("/admin/config");
  return {
    ok:
      pendentes.length > 0
        ? `Salvo. ${pendentes.length} contrato(s) pendente(s) recalculado(s). Aprovados não mudam.`
        : "Salvo. Vale para os próximos contratos.",
  };
}
