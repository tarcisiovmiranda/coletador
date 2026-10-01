import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { ETAPA_KEYS, etapaInfo, fmtCnpj, fmtWhats } from "@/lib/leads";

// Evita injeção de fórmula ao abrir no Excel/Sheets (=, +, -, @, tab, CR no início).
function celula(v: string | null | undefined) {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const dataBRT = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  if (user.perfil !== "ADMIN") return new Response("Acesso negado.", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const etapa = ETAPA_KEYS.find((k) => k === sp.get("etapa"));
  const colaboradorId = sp.get("colaborador") ?? undefined;

  const leads = await prisma.lead.findMany({
    where: {
      tenantId: user.tenantId,
      ...(colaboradorId ? { colaboradorId } : {}),
      ...(etapa ? { etapaKanban: etapa } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { colaborador: { select: { nome: true } } },
  });

  const cab = ["Data", "Coletador", "Nome", "Cargo", "Empresa", "CNPJ", "WhatsApp", "Inscrição", "Etapa", "Áudio", "Observações"];
  const linhas = leads.map((l) =>
    [
      dataBRT(l.createdAt),
      l.colaborador.nome,
      l.nome,
      l.cargo,
      l.empresa,
      fmtCnpj(l.cnpj),
      fmtWhats(l.whatsapp),
      l.inscricao,
      etapaInfo(l.etapaKanban).label,
      l.audioKey ? "Sim" : "Não",
      l.observacoes,
    ]
      .map(celula)
      .join(";"),
  );

  // BOM + ';' para o Excel brasileiro abrir com acentos e colunas certas
  const csv = "﻿" + [cab.map(celula).join(";"), ...linhas].join("\r\n");
  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${hoje}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
