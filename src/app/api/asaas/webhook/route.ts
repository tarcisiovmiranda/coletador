import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consultarTransferencia } from "@/lib/asaas";
import { webhookAutenticado } from "@/lib/asaas-auth";
import { aplicarTransferencia } from "@/lib/pagamentos";

/**
 * Eventos de transferência do Asaas (TRANSFER_DONE, TRANSFER_FAILED, ...).
 * O Asaas pode enviar o mesmo evento mais de uma vez, e o payload não é a fonte da verdade:
 * usamos só o id da transferência e CONSULTAMOS o Asaas para saber o status real.
 */
export async function POST(req: Request) {
  const auth = webhookAutenticado(req);
  if (auth === "sem-config") return NextResponse.json({ erro: "Webhook não configurado." }, { status: 503 });
  if (auth === "negado") return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const corpo = (await req.json().catch(() => null)) as {
    event?: string;
    transfer?: { id?: string };
  } | null;
  const transferId = corpo?.transfer?.id;
  if (!corpo?.event?.startsWith("TRANSFER_") || !transferId || typeof transferId !== "string") {
    return NextResponse.json({ ok: true, ignorado: true }); // outros eventos: não é conosco
  }

  const pagamento = await prisma.pagamentoComissao.findUnique({
    where: { asaasTransferId: transferId },
    select: { id: true },
  });
  if (!pagamento) return NextResponse.json({ ok: true, ignorado: true }); // transferência que o app não criou

  try {
    await aplicarTransferencia(pagamento.id, await consultarTransferencia(transferId));
  } catch {
    // não conseguimos confirmar: 500 faz o Asaas tentar de novo mais tarde
    return NextResponse.json({ erro: "Não foi possível confirmar o status." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
