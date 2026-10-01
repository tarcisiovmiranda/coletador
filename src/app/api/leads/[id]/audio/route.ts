import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { escopoLead } from "@/lib/leads";
import { enviarAudio, removerAudio, storageConfigurado, urlAudio } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 4 * 1024 * 1024; // limite do corpo de função da Vercel é 4,5 MB
const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
};

/** Envia/substitui o áudio do lead. Lead resolvido pelo escopo da sessão. */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!storageConfigurado()) {
    return NextResponse.json({ erro: "Armazenamento de áudio não configurado." }, { status: 503 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, ...escopoLead(user) },
    select: { id: true, tenantId: true, audioKey: true },
  });
  if (!lead) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT[mime];
  if (!ext) return NextResponse.json({ erro: "Formato de áudio não suportado." }, { status: 415 });

  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > MAX_BYTES) {
    return NextResponse.json({ erro: "Áudio grande demais." }, { status: 413 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return NextResponse.json({ erro: "Áudio vazio." }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ erro: "Áudio grande demais." }, { status: 413 });
  }

  const key = `${lead.tenantId}/${lead.id}/${Date.now()}.${ext}`;
  try {
    await enviarAudio(key, bytes, mime);
  } catch {
    return NextResponse.json({ erro: "Falha ao salvar o áudio." }, { status: 502 });
  }

  await prisma.lead.update({ where: { id: lead.id }, data: { audioKey: key, audioMime: mime } });
  if (lead.audioKey) removerAudio(lead.audioKey).catch(() => {});
  return NextResponse.json({ ok: true });
}

/** Redireciona para uma URL temporária assinada, após checar a permissão. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, ...escopoLead(user) },
    select: { audioKey: true, audioMime: true },
  });
  if (!lead?.audioKey) return NextResponse.json({ erro: "Sem áudio." }, { status: 404 });

  try {
    const url = await urlAudio(lead.audioKey, lead.audioMime);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ erro: "Áudio indisponível." }, { status: 503 });
  }
}
