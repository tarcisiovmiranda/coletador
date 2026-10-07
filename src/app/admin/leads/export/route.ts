import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { intervaloCriacao } from "@/lib/datas";
import { fmtCep, fmtCnpj, fmtCpf, fmtNascimento, fmtWhats } from "@/lib/leads";

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
  const etapa = sp.get("etapa") ?? undefined;
  const colaboradorId = sp.get("colaborador") ?? undefined;
  const periodo = intervaloCriacao(sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
  if (!periodo.ok) return new Response(periodo.erro, { status: 400 });

  const leads = await prisma.lead.findMany({
    where: {
      tenantId: user.tenantId,
      ...(colaboradorId ? { colaboradorId } : {}),
      ...(etapa ? { etapaId: etapa } : {}),
      ...(periodo.where ? { createdAt: periodo.where } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { colaborador: { select: { nome: true } }, etapa: { select: { nome: true } } },
  });

  const cab = ["Data", "Coletador", "Nome", "Cargo", "Empresa", "CNPJ", "Celular (DDI)", "Celular", "Telefone fixo (DDI)", "Telefone fixo", "E-mail", "CPF", "Nome na credencial", "Sexo", "Nascimento", "CEP", "Endereço", "Número", "Complemento", "Bairro", "Cidade", "UF", "País", "Inscrição", "Etapa", "Áudio", "Observações"];
  const linhas = leads.map((l) =>
    [
      dataBRT(l.createdAt),
      l.colaborador.nome,
      l.nome,
      l.cargo,
      l.empresa,
      fmtCnpj(l.cnpj),
      l.whatsappDdi,
      fmtWhats(l.whatsapp, null),
      l.telefoneFixoDdi,
      fmtWhats(l.telefoneFixo, null),
      l.email,
      fmtCpf(l.cpf),
      l.nomeCredencial,
      l.sexo,
      fmtNascimento(l.dataNascimento),
      fmtCep(l.cep),
      l.endereco,
      l.numero,
      l.complemento,
      l.bairro,
      l.cidade,
      l.uf,
      l.pais,
      l.inscricao,
      l.etapa.nome,
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
