import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { escopoLead } from "@/lib/leads";
import { urlAudio } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Redireciona para o PDF no R2 (URL de 5 min) depois de checar tenant + escopo do lead. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const ass = await prisma.assinaturaContrato.findFirst({
    where: { id, tenantId: user.tenantId, lead: escopoLead(user) },
    select: { pdfKey: true },
  });
  if (!ass) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  try {
    const url = await urlAudio(ass.pdfKey, "application/pdf");
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ erro: "PDF indisponível." }, { status: 503 });
  }
}
