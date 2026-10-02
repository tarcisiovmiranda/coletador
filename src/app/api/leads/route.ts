import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { validarLead } from "@/lib/leads";

const envelope = z.object({
  clientId: z.string().uuid(),
  colaboradorId: z.string().min(1),
});

/**
 * Criação idempotente de lead (usada pela fila offline).
 * - clientId (gerado no aparelho) impede duplicata se o mesmo lead for reenviado;
 * - o lead SEMPRE pertence ao usuário da sessão; se o aparelho tentar enviar um lead
 *   gravado por outro colaborador, recusa (409) em vez de atribuir ao errado.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const env = envelope.safeParse(corpo);
  if (!env.success) return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  if (env.data.colaboradorId !== user.id) {
    return NextResponse.json(
      { erro: "Este lead foi gravado por outro colaborador. Entre com a conta dele para enviar." },
      { status: 409 },
    );
  }

  const campos = validarLead(corpo);
  if (!campos.ok) {
    return NextResponse.json({ erro: campos.erros.map((e) => e.mensagem).join(" "), erros: campos.erros }, { status: 400 });
  }

  const existente = () =>
    prisma.lead.findFirst({
      where: { tenantId: user.tenantId, clientId: env.data.clientId },
      select: { id: true, colaboradorId: true },
    });

  const ja = await existente();
  if (ja) {
    if (ja.colaboradorId !== user.id) return NextResponse.json({ erro: "Conflito." }, { status: 409 });
    return NextResponse.json({ ok: true, id: ja.id, existia: true });
  }

  try {
    // tenant, colaborador e data de criação vêm do servidor, nunca do aparelho
    const lead = await prisma.lead.create({
      data: {
        ...campos.data,
        tenantId: user.tenantId,
        colaboradorId: user.id,
        clientId: env.data.clientId,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: lead.id });
  } catch (e) {
    // dois envios simultâneos do mesmo lead: o segundo cai aqui, devolve o que já existe
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const r = await existente();
      if (r && r.colaboradorId === user.id) return NextResponse.json({ ok: true, id: r.id, existia: true });
    }
    throw e;
  }
}
