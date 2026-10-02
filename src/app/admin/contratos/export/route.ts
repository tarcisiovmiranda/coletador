import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { STATUS_CONTRATO } from "@/lib/contratos";
import { fmtPercent, toCents } from "@/lib/dinheiro";

function celula(v: string | null | undefined) {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

const dataBRT = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d) : "";

// valores numéricos em formato do Excel brasileiro: 1500,00 (sem símbolo, para somar)
const reais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  if (user.perfil !== "ADMIN") return new Response("Acesso negado.", { status: 403 });

  const contratos = await prisma.contrato.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
    include: {
      lead: { select: { nome: true, empresa: true, cnpj: true } },
      pagamentoComissao: { select: { status: true, concluidoEm: true } },
    },
  });

  const cab = ["Criado em", "Coletador", "Lead", "Empresa", "CNPJ", "Plano", "Valor (R$)", "Pagamento", "Status", "Comissão %", "Comissão (R$)", "Aprovado por", "Aprovado em", "Comissão paga (Pix)"];
  const linhas = contratos.map((c) =>
    [
      dataBRT(c.createdAt),
      c.colaboradorNomeSnapshot,
      c.lead.nome,
      c.lead.empresa,
      c.lead.cnpj,
      c.plano,
      reais(toCents(c.valor)),
      c.pagamento,
      STATUS_CONTRATO[c.status].label,
      fmtPercent(c.comissaoPercentual ?? 0),
      reais(toCents(c.comissaoValor)),
      c.aprovadoPorNome,
      dataBRT(c.aprovadoEm),
      c.pagamentoComissao?.status === "CONCLUIDO"
        ? `Paga em ${dataBRT(c.pagamentoComissao.concluidoEm)}`
        : c.pagamentoComissao && c.pagamentoComissao.status !== "FALHOU"
          ? "Em andamento"
          : "Não",
    ]
      .map(celula)
      .join(";"),
  );

  const csv = "﻿" + [cab.map(celula).join(";"), ...linhas].join("\r\n");
  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contratos-${hoje}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
