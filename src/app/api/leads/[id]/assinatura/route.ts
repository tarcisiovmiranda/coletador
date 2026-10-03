import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { escopoLead } from "@/lib/leads";
import { parseBRL } from "@/lib/dinheiro";
import { enviarAudio, storageConfigurado } from "@/lib/storage";
import { modeloVigente } from "@/lib/contrato-modelo";
import { FERRAMENTAS, preencher } from "@/lib/contrato-render";
import {
  ROTULO_FALTANTE,
  agora,
  dimensoesPng,
  entradaSchema,
  hashTexto,
  limiteDoDia,
  montarValores,
} from "@/lib/contrato-campos";
import { gerarPdfContrato } from "@/lib/contrato-pdf";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PNG = 200 * 1024;
const MIN_PNG = 600; // um toque solto gera PNG minúsculo: exige traço de verdade
const MAX_LARGURA = 1200;
const MAX_ALTURA = 600;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// 20 assinaturas / 10 min por usuário (em memória da instância: freio simples contra abuso)
const janela = new Map<string, number[]>();
function acimaDoLimite(userId: string) {
  const agoraMs = Date.now();
  const l = (janela.get(userId) ?? []).filter((t) => agoraMs - t < 10 * 60_000);
  l.push(agoraMs);
  janela.set(userId, l);
  return l.length > 20;
}

/** PNG de verdade, de tamanho de arquivo E de dimensões razoáveis (o PDF decodifica a imagem inteira). */
function decodificarPng(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
  if (bytes.byteLength > MAX_PNG || bytes.byteLength < MIN_PNG) return null;
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return null;
  const d = dimensoesPng(bytes);
  if (!d || d.w < 50 || d.h < 20 || d.w > MAX_LARGURA || d.h > MAX_ALTURA) return null;
  return bytes;
}

const fmtDoc = (d: string) =>
  d.length === 14
    ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

/** Assina o contrato do lead. O texto final é montado AQUI, nunca recebido do navegador. */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!storageConfigurado()) return NextResponse.json({ erro: "Armazenamento não configurado." }, { status: 503 });
  if (acimaDoLimite(user.id)) {
    return NextResponse.json({ erro: "Muitas assinaturas seguidas. Aguarde alguns minutos." }, { status: 429 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...escopoLead(user) } });
  if (!lead) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }
  const r = entradaSchema.safeParse(corpo);
  if (!r.success) {
    const erros = r.error.issues.map((i) => ({ campo: String(i.path[0] ?? ""), mensagem: i.message }));
    return NextResponse.json({ erro: erros[0]?.mensagem ?? "Dados inválidos.", erros }, { status: 400 });
  }
  const e = r.data;

  const png = decodificarPng(e.assinaturaPng);
  if (!png) {
    return NextResponse.json(
      { erro: "Assinatura ausente ou muito simples. Desenhe a assinatura de novo.", erros: [{ campo: "assinaturaPng", mensagem: "Assinatura inválida." }] },
      { status: 400 },
    );
  }

  const quando = agora();
  const limiteDia = limiteDoDia(quando);
  const limite = limiteDia ?? e.limiteVidas;
  if (!limite) {
    return NextResponse.json(
      { erro: "Fora dos dias da feira: informe o limite de vidas.", erros: [{ campo: "limiteVidas", mensagem: "Informe o limite de vidas." }] },
      { status: 400 },
    );
  }
  const mensalidadeCents = parseBRL(e.mensalidade)!;

  // o que vai para o PDF tem de ser o que o cliente leu: modelo e limite do dia não podem ter mudado
  const modelo = await modeloVigente(user.tenantId);
  if (e.versaoModelo !== modelo.versao) {
    return NextResponse.json(
      { erro: "O texto do contrato foi atualizado enquanto você lia. Recarregue a página e leia de novo antes de assinar.", recarregar: true },
      { status: 409 },
    );
  }
  if (limiteDia !== null && e.limiteExibido !== limiteDia) {
    return NextResponse.json(
      { erro: "O dia mudou e o limite de vidas do contrato também. Recarregue a página e leia de novo antes de assinar.", recarregar: true },
      { status: 409 },
    );
  }

  const valores = montarValores(
    lead,
    { mensalidadeCents, plano: e.plano, vencimento: e.vencimento, medicoTrabalho: e.medicoTrabalho, limiteVidas: limite },
    user.nome,
    quando,
  );
  const { texto, faltantes } = preencher(modelo.corpo, valores, { todas: FERRAMENTAS, marcadas: e.ferramentas });
  if (faltantes.length) {
    const nomes = faltantes.map((f) => ROTULO_FALTANTE[f] ?? f).join(", ");
    return NextResponse.json({ erro: `Faltam dados do lead para o contrato: ${nomes}. Edite o lead e tente de novo.`, faltantes }, { status: 400 });
  }
  const hash = hashTexto(texto);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  const userAgent = (req.headers.get("user-agent") ?? "desconhecido").slice(0, 300);
  const sufixo = `${Date.now()}`;
  const base = `${user.tenantId}/${lead.id}/assinaturas/${sufixo}`;
  const assinaturaKey = `${base}-assinatura.png`;
  const pdfKey = `${base}-contrato.pdf`;

  try {
    // Uma trava por lead cobre "checar duplicado + gerar + gravar": dois pedidos simultâneos
    // (toque duplo, dois aparelhos) são atendidos um de cada vez, e o segundo vê o primeiro.
    const resultado = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assinatura:${lead.id}`}))`;

        // mesmo texto, mesmo signatário, nos últimos 60 s: devolve a assinatura já gravada
        const recente = await tx.assinaturaContrato.findFirst({
          where: {
            tenantId: user.tenantId,
            leadId: lead.id,
            hashSha256: hash,
            signatarioDocumento: e.signatarioDocumento,
            assinadoEm: { gte: new Date(quando.getTime() - 60_000) },
          },
          select: { id: true },
        });
        if (recente) return { id: recente.id, nova: false };

        const pdf = await gerarPdfContrato({
          titulo: modelo.titulo,
          textoFinal: texto,
          assinaturaPng: png,
          signatarioNome: e.signatarioNome,
          signatarioDocumento: fmtDoc(e.signatarioDocumento),
          contratadaNome: "CONFORMIDADE PJ SERVIÇOS LTDA",
          contratadaCnpj: "66.914.632/0001-79",
          evidencias: {
            assinadoEm:
              new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(quando) + " (Brasília)",
            ip,
            userAgent,
            hash,
            versao: modelo.versao,
            id: sufixo,
          },
        });
        await enviarAudio(assinaturaKey, png, "image/png");
        await enviarAudio(pdfKey, pdf, "application/pdf");

        const criada = await tx.assinaturaContrato.create({
          data: {
            tenantId: user.tenantId,
            leadId: lead.id,
            modeloId: modelo.id,
            colaboradorId: user.id,
            colaboradorNome: user.nome,
            textoFinal: texto,
            campos: {
              mensalidadeCents,
              plano: e.plano,
              vencimento: e.vencimento,
              medicoTrabalho: e.medicoTrabalho,
              ferramentas: e.ferramentas,
              limiteVidas: limite,
              limiteManual: limiteDia === null,
            },
            hashSha256: hash,
            assinaturaKey,
            pdfKey,
            signatarioNome: e.signatarioNome,
            signatarioDocumento: e.signatarioDocumento,
            ip,
            userAgent,
            assinadoEm: quando,
          },
          select: { id: true },
        });
        return { id: criada.id, nova: true };
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    return NextResponse.json({ id: resultado.id }, { status: resultado.nova ? 201 : 200 });
  } catch (err) {
    console.error("Assinatura: falha ao gerar/guardar", err);
    const tipo = err instanceof Error ? err.name : "desconhecido";
    return NextResponse.json({ erro: `Não foi possível gerar o contrato (${tipo}). Tente de novo.` }, { status: 502 });
  }
}
