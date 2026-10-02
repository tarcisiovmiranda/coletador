import "server-only";
import { prisma } from "./db";
import type { TransferenciaAsaas } from "./asaas";

/** Devolve os contratos de um pagamento que não saiu: voltam a ficar "a pagar". */
export async function liberarContratos(pagamentoId: string) {
  await prisma.contrato.updateMany({ where: { pagamentoId }, data: { pagamentoId: null } });
}

/**
 * Aplica o estado REAL da transferência (sempre vindo de uma consulta ao Asaas) ao pagamento.
 * Idempotente: pode rodar várias vezes (webhooks chegam repetidos).
 * - CONCLUIDO é definitivo: nunca volta atrás.
 * - FAILED/CANCELLED libera os contratos para um novo pagamento.
 */
export async function aplicarTransferencia(pagamentoId: string, t: TransferenciaAsaas) {
  const atual = await prisma.pagamentoComissao.findUnique({
    where: { id: pagamentoId },
    select: { status: true },
  });
  if (!atual || atual.status === "CONCLUIDO") return;

  // Conflito raro: já demos como falha (contratos liberados) e o Asaas diz que concluiu.
  // Não marcamos como pago sozinhos, para não deixar os contratos disponíveis de novo: o admin confere.
  if (atual.status === "FALHOU" && t.status === "DONE") {
    await prisma.pagamentoComissao.update({
      where: { id: pagamentoId },
      data: {
        status: "VERIFICAR",
        asaasTransferId: t.id,
        erro: "Conflito: o Asaas informa transferência concluída, mas ela estava como falha. Confira no painel do Asaas antes de pagar de novo.",
      },
    });
    return;
  }

  if (t.status === "DONE") {
    await prisma.pagamentoComissao.update({
      where: { id: pagamentoId },
      data: {
        status: "CONCLUIDO",
        asaasTransferId: t.id,
        comprovanteUrl: t.transactionReceiptUrl ?? null,
        concluidoEm: new Date(),
        erro: null,
      },
    });
    return;
  }

  if (t.status === "FAILED" || t.status === "CANCELLED") {
    await prisma.$transaction([
      prisma.pagamentoComissao.update({
        where: { id: pagamentoId },
        data: {
          status: "FALHOU",
          asaasTransferId: t.id,
          erro: (t.failReason || (t.status === "CANCELLED" ? "Transferência cancelada." : "Transferência falhou.")).slice(0, 300),
        },
      }),
      prisma.contrato.updateMany({ where: { pagamentoId }, data: { pagamentoId: null } }),
    ]);
    return;
  }

  // PENDING / BANK_PROCESSING / BLOCKED: segue em andamento
  await prisma.pagamentoComissao.update({
    where: { id: pagamentoId },
    data: { status: "PROCESSANDO", asaasTransferId: t.id },
  });
}
