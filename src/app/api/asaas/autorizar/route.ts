import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { webhookAutenticado } from "@/lib/asaas-auth";
import { toCents } from "@/lib/dinheiro";

/**
 * "Validação de saque via webhook" do Asaas (opcional, ativada no painel do Asaas).
 * Antes de qualquer saque feito pela API, o Asaas pergunta aqui. Só APROVAMOS transferências
 * que o próprio app criou para um pagamento de comissão em andamento, com o mesmo valor.
 * Assim, mesmo que a chave da API vaze, ninguém consegue sacar por fora do app.
 * Qualquer dúvida => REFUSED (a operação é cancelada, nenhum dinheiro sai).
 */
const recusar = (motivo: string) => NextResponse.json({ status: "REFUSED", refuseReason: motivo });

export async function POST(req: Request) {
  const auth = webhookAutenticado(req);
  if (auth === "sem-config") return NextResponse.json({ erro: "Webhook não configurado." }, { status: 503 });
  if (auth === "negado") return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const corpo = (await req.json().catch(() => null)) as {
    type?: string;
    transfer?: { id?: string; value?: number };
  } | null;

  if (corpo?.type !== "TRANSFER") return recusar("O app só autoriza transferências de comissão.");
  const id = corpo.transfer?.id;
  const valor = corpo.transfer?.value;
  if (typeof id !== "string" || typeof valor !== "number") return recusar("Dados da transferência incompletos.");
  const cents = Math.round(valor * 100);

  // já vinculada (caso normal) ou, se a validação chegou antes de gravarmos o id, uma reserva
  // PROCESSANDO sem id com exatamente o mesmo valor
  const vinculado = await prisma.pagamentoComissao.findUnique({
    where: { asaasTransferId: id },
    select: { status: true, valor: true },
  });
  if (vinculado) {
    return vinculado.status === "PROCESSANDO" && toCents(vinculado.valor) === cents
      ? NextResponse.json({ status: "APPROVED" })
      : recusar("Pagamento não está em andamento ou o valor não confere.");
  }

  const reservas = await prisma.pagamentoComissao.findMany({
    where: { status: "PROCESSANDO", asaasTransferId: null },
    select: { valor: true },
  });
  const iguais = reservas.filter((r) => toCents(r.valor) === cents);
  return iguais.length === 1
    ? NextResponse.json({ status: "APPROVED" })
    : recusar("Transferência não originada por um pagamento de comissão do app.");
}
