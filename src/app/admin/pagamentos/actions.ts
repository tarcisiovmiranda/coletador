"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PixTipo } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  AsaasIncerto,
  AsaasRecusou,
  asaasConfigurado,
  asaasEmProducao,
  consultarSaldoReais,
  consultarTransferencia,
  criarTransferenciaPix,
  limitePorPagamentoCents,
} from "@/lib/asaas";
import { aplicarTransferencia, liberarContratos } from "@/lib/pagamentos";
import { centsToDecimal, fmtCents, toCents } from "@/lib/dinheiro";
import { PIX_TIPOS, normalizarChavePix } from "@/lib/pix";

const revalidar = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/coletor", "layout");
};

// ---------------------------------------------------------------- chave Pix

export type PixState = { erro?: string; ok?: string };

const chaveSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(PIX_TIPOS.map((t) => t.key) as [PixTipo, ...PixTipo[]]),
  chave: z.string().max(100),
});

/** Só o admin cadastra a chave: o coletador não pode redirecionar a própria comissão. */
export async function salvarChavePix(_: PixState, formData: FormData): Promise<PixState> {
  const admin = await requireAdmin();
  const p = chaveSchema.safeParse({
    id: formData.get("id"),
    tipo: formData.get("tipo"),
    chave: formData.get("chave") ?? "",
  });
  if (!p.success) return { erro: "Escolha o tipo e informe a chave." };

  const n = normalizarChavePix(p.data.tipo, p.data.chave);
  if (!n.ok) return { erro: n.erro };

  const r = await prisma.colaborador.updateMany({
    where: { id: p.data.id, tenantId: admin.tenantId },
    data: { pixTipo: p.data.tipo, pixChave: n.valor },
  });
  if (r.count === 0) return { erro: "Colaborador não encontrado." };
  revalidar();
  return { ok: "Chave Pix salva." };
}

// ---------------------------------------------------------------- pagar

export type PagarResult = { ok: true; mensagem: string } | { ok: false; erro: string };

class SemSaldo extends Error {}
class Excede extends Error {
  constructor(readonly cents: number) {
    super("excede");
  }
}
class Conflito extends Error {}

/**
 * Paga por Pix toda a comissão APROVADA e ainda não paga de um coletador.
 * Proteções contra pagamento duplicado/errado:
 *  1. os contratos são "reservados" para este pagamento numa transação ANTES de falar com o Asaas
 *     (um segundo clique, ou outro admin, não encontra nada a pagar);
 *  2. se o Asaas recusar, os contratos voltam a ficar disponíveis; se o resultado for incerto
 *     (rede/timeout), ficam reservados e o admin confere no Asaas (nunca paga "no escuro");
 *  3. teto por pagamento e conferência de saldo.
 */
export async function pagarComissao(colaboradorId: string): Promise<PagarResult> {
  const admin = await requireAdmin();
  if (!asaasConfigurado()) return { ok: false, erro: "Pagamento por Pix não configurado (falta a chave do Asaas)." };

  const col = await prisma.colaborador.findFirst({
    where: { id: colaboradorId, tenantId: admin.tenantId },
    select: { id: true, nome: true, pixChave: true, pixTipo: true },
  });
  if (!col) return { ok: false, erro: "Colaborador não encontrado." };
  if (!col.pixChave || !col.pixTipo) {
    return { ok: false, erro: `Cadastre a chave Pix de ${col.nome} em Equipe antes de pagar.` };
  }
  const { pixChave, pixTipo } = col;

  // 1) reserva atômica
  let pagamento: { id: string; cents: number };
  try {
    pagamento = await prisma.$transaction(async (tx) => {
      const contratos = await tx.contrato.findMany({
        where: { tenantId: admin.tenantId, colaboradorId, status: "APROVADO", pagamentoId: null },
        select: { id: true, comissaoValor: true },
      });
      const cents = contratos.reduce((s, c) => s + toCents(c.comissaoValor), 0);
      if (contratos.length === 0 || cents <= 0) throw new SemSaldo();
      if (cents > limitePorPagamentoCents()) throw new Excede(cents);

      const p = await tx.pagamentoComissao.create({
        data: {
          tenantId: admin.tenantId,
          colaboradorId,
          colaboradorNomeSnapshot: col.nome,
          valor: centsToDecimal(cents),
          status: "PROCESSANDO",
          pixChave,
          pixTipo,
          criadoPorNome: admin.nome,
        },
        select: { id: true },
      });
      const r = await tx.contrato.updateMany({
        where: { id: { in: contratos.map((c) => c.id) }, pagamentoId: null, status: "APROVADO" },
        data: { pagamentoId: p.id },
      });
      if (r.count !== contratos.length) throw new Conflito(); // alguém mexeu ao mesmo tempo: desfaz tudo
      return { id: p.id, cents };
    });
  } catch (e) {
    if (e instanceof SemSaldo) return { ok: false, erro: "Não há comissão aprovada e pendente de pagamento para este coletador." };
    if (e instanceof Excede) {
      return {
        ok: false,
        erro: `O valor (${fmtCents(e.cents)}) passa do teto por pagamento (${fmtCents(limitePorPagamentoCents())}). Ajuste ASAAS_LIMITE_POR_PAGAMENTO se for intencional.`,
      };
    }
    if (e instanceof Conflito) return { ok: false, erro: "Os contratos mudaram durante o pagamento. Atualize a página e tente de novo." };
    throw e;
  }

  const valorReais = Number((pagamento.cents / 100).toFixed(2));

  // saldo (melhor esforço: se não der para consultar, segue)
  const saldo = await consultarSaldoReais();
  if (saldo !== null && saldo + 0.001 < valorReais) {
    await prisma.pagamentoComissao.update({
      where: { id: pagamento.id },
      data: { status: "FALHOU", erro: "Saldo insuficiente na conta Asaas." },
    });
    await liberarContratos(pagamento.id);
    revalidar();
    return { ok: false, erro: `Saldo insuficiente na conta Asaas (disponível ${fmtCents(Math.round(saldo * 100))}).` };
  }

  // 2) transferência
  try {
    const t = await criarTransferenciaPix({
      valorReais,
      chave: pixChave,
      tipo: pixTipo,
      descricao: `Comissão FISP 2026 - ${col.nome}`,
      referencia: pagamento.id,
    });
    await aplicarTransferencia(pagamento.id, t);
    revalidar();
    const amb = asaasEmProducao() ? "" : " (ambiente de TESTE: nenhum dinheiro real foi movido)";
    return {
      ok: true,
      mensagem:
        t.status === "DONE"
          ? `Pix de ${fmtCents(pagamento.cents)} enviado para ${col.nome}.${amb}`
          : `Pix de ${fmtCents(pagamento.cents)} para ${col.nome} em processamento. O status atualiza sozinho.${amb}`,
    };
  } catch (e) {
    if (e instanceof AsaasRecusou) {
      await prisma.pagamentoComissao.update({
        where: { id: pagamento.id },
        data: { status: "FALHOU", erro: e.message },
      });
      await liberarContratos(pagamento.id);
      revalidar();
      return { ok: false, erro: `O Asaas recusou o pagamento: ${e.message}` };
    }
    // incerto: não sabemos se saiu. Mantém reservado e pede conferência.
    await prisma.pagamentoComissao.update({
      where: { id: pagamento.id },
      data: {
        status: "VERIFICAR",
        erro: "Sem resposta confiável do Asaas. Confira no painel do Asaas se o Pix saiu antes de decidir.",
      },
    });
    revalidar();
    return {
      ok: false,
      erro: "Não consegui confirmar se o Pix saiu. NÃO pague de novo: confira no painel do Asaas e resolva em “Pagamentos de comissão”.",
    };
  }
}

// ---------------------------------------------------------------- acompanhar / resolver

const idSchema = z.string().min(1);

/** Consulta o Asaas e atualiza o pagamento (botão "Atualizar"). */
export async function atualizarPagamento(id: string): Promise<PagarResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, erro: "Pagamento inválido." };
  const p = await prisma.pagamentoComissao.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true, asaasTransferId: true, status: true },
  });
  if (!p) return { ok: false, erro: "Pagamento não encontrado." };
  if (!p.asaasTransferId) {
    return { ok: false, erro: "Este pagamento não tem número de transferência no Asaas. Use “Confirmar pago” ou “Liberar”." };
  }
  try {
    await aplicarTransferencia(p.id, await consultarTransferencia(p.asaasTransferId));
    revalidar();
    return { ok: true, mensagem: "Status atualizado." };
  } catch {
    return { ok: false, erro: "Não consegui consultar o Asaas agora. Tente de novo em instantes." };
  }
}

/**
 * Pagamento em "VERIFICAR" (resultado incerto): o admin decide depois de conferir no painel do Asaas.
 *  - "pago": o Pix saiu → marca como concluído;
 *  - "liberar": o Pix NÃO saiu → contratos voltam a ficar disponíveis.
 */
export async function resolverPagamento(id: string, decisao: "pago" | "liberar"): Promise<PagarResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, erro: "Pagamento inválido." };
  const p = await prisma.pagamentoComissao.findFirst({
    where: { id, tenantId: admin.tenantId, status: "VERIFICAR" },
    select: { id: true },
  });
  if (!p) return { ok: false, erro: "Só pagamentos em “Verificar” podem ser resolvidos assim." };

  if (decisao === "pago") {
    await prisma.pagamentoComissao.update({
      where: { id },
      data: { status: "CONCLUIDO", concluidoEm: new Date(), erro: `Confirmado manualmente por ${admin.nome}.` },
    });
  } else {
    await prisma.pagamentoComissao.update({
      where: { id },
      data: { status: "FALHOU", erro: `Liberado manualmente por ${admin.nome} (Pix não saiu).` },
    });
    await liberarContratos(id);
  }
  revalidar();
  return { ok: true, mensagem: decisao === "pago" ? "Marcado como pago." : "Contratos liberados para novo pagamento." };
}
