"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { removerAudio } from "@/lib/storage";
import { CAMPOS_LEAD, escopoLead, validarLead } from "@/lib/leads";

export type LeadResult = { ok: true; id: string } | { ok: false; erro: string };

function lerCampos(formData: FormData) {
  return validarLead(Object.fromEntries(CAMPOS_LEAD().map((c) => [c, formData.get(c) ?? ""])));
}

export async function atualizarLead(id: string, formData: FormData): Promise<LeadResult> {
  const user = await requireUser();
  const v = lerCampos(formData);
  if (!v.ok) return { ok: false, erro: v.erros.map((e) => e.mensagem).join(" ") };

  const r = await prisma.lead.updateMany({
    where: { id, ...escopoLead(user) },
    data: v.data,
  });
  if (r.count === 0) return { ok: false, erro: "Lead não encontrado." };
  revalidatePath("/coletor");
  revalidatePath(`/coletor/leads/${id}`);
  return { ok: true, id };
}

const moverSchema = z.object({ id: z.string().min(1), etapa: z.string().min(1) });

export async function moverEtapa(formData: FormData) {
  const user = await requireUser();
  const parsed = moverSchema.safeParse({ id: formData.get("id"), etapa: formData.get("etapa") });
  if (!parsed.success) return;
  // a etapa precisa ser do mesmo tenant do usuário
  const etapa = await prisma.etapa.findFirst({ where: { id: parsed.data.etapa, tenantId: user.tenantId }, select: { id: true } });
  if (!etapa) return;
  await prisma.lead.updateMany({
    where: { id: parsed.data.id, ...escopoLead(user) },
    data: { etapaId: etapa.id },
  });
  revalidatePath("/coletor", "layout");
  revalidatePath("/admin", "layout");
}

const MAX_LOTE = 200;
const loteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_LOTE),
  etapaId: z.string().min(1),
});

export type MoverLoteResult = { ok: true; movidos: number } | { ok: false; erro: string };

/** Move vários leads de uma vez (arrastar no kanban ou barra de seleção). Mesmo escopo de moverEtapa. */
export async function moverLeads(ids: string[], etapaId: string): Promise<MoverLoteResult> {
  const user = await requireUser();
  const parsed = loteSchema.safeParse({ ids, etapaId });
  if (!parsed.success) return { ok: false, erro: `Selecione de 1 a ${MAX_LOTE} leads.` };

  // a etapa precisa ser do mesmo tenant do usuário
  const etapa = await prisma.etapa.findFirst({ where: { id: parsed.data.etapaId, tenantId: user.tenantId }, select: { id: true } });
  if (!etapa) return { ok: false, erro: "Etapa não encontrada." };

  // coletador só move os próprios leads; admin move qualquer um do tenant
  const r = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.ids }, ...escopoLead(user) },
    data: { etapaId: etapa.id },
  });
  if (r.count === 0) return { ok: false, erro: "Nenhum lead encontrado para mover." };
  revalidatePath("/coletor", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, movidos: r.count };
}

export type ExcluirResult = { ok: true } | { ok: false; erro: string };

/**
 * Exclui um lead (e o áudio). Só admin.
 * Lead com contrato pendente/aprovado não pode sair: cancele o contrato antes,
 * para não apagar histórico de comissão.
 */
export async function excluirLead(id: string): Promise<ExcluirResult> {
  const admin = await requireAdmin();
  const lead = await prisma.lead.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true, audioKey: true, contrato: { select: { id: true, status: true } }, _count: { select: { assinaturas: true } } },
  });
  if (!lead) return { ok: false, erro: "Lead não encontrado." };
  if (lead.contrato && lead.contrato.status !== "CANCELADO") {
    return { ok: false, erro: "Este lead tem contrato ativo. Cancele o contrato antes de excluir." };
  }
  if (lead._count.assinaturas > 0) {
    return { ok: false, erro: "Este lead tem contrato assinado, que fica guardado como comprovante. Ele não pode ser excluído." };
  }

  await prisma.$transaction([
    ...(lead.contrato ? [prisma.contrato.delete({ where: { id: lead.contrato.id } })] : []),
    prisma.lead.delete({ where: { id: lead.id } }),
  ]);
  if (lead.audioKey) await removerAudio(lead.audioKey).catch(() => {}); // melhor esforço

  revalidatePath("/coletor", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
