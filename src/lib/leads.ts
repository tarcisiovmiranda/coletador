import { z } from "zod";
import type { EtapaKanban, Prisma } from "@prisma/client";
import type { SessionUser } from "./session";

export const ETAPAS: { key: EtapaKanban; label: string; cor: string }[] = [
  { key: "NOVO", label: "Novo", cor: "bg-slate-200 text-slate-800" },
  { key: "CONTATO", label: "Em contato", cor: "bg-sky-100 text-sky-800" },
  { key: "REUNIAO", label: "Reunião", cor: "bg-violet-100 text-violet-800" },
  { key: "PROPOSTA", label: "Proposta", cor: "bg-amber-100 text-amber-800" },
  { key: "FECHADO", label: "Fechado", cor: "bg-emerald-100 text-emerald-800" },
  { key: "PERDIDO", label: "Perdido", cor: "bg-red-100 text-red-800" },
];

export const etapaInfo = (k: EtapaKanban) => ETAPAS.find((e) => e.key === k)!;
export const ETAPA_KEYS = ETAPAS.map((e) => e.key) as [EtapaKanban, ...EtapaKanban[]];

/**
 * Filtro de isolamento: TODA consulta de lead por id passa por aqui.
 * Tenant e colaborador vêm sempre da sessão, nunca do cliente.
 * Admin enxerga o tenant inteiro; coletador só os próprios leads.
 */
export function escopoLead(user: SessionUser): Prisma.LeadWhereInput {
  return user.perfil === "ADMIN"
    ? { tenantId: user.tenantId }
    : { tenantId: user.tenantId, colaboradorId: user.id };
}

/** Só os leads do próprio usuário (tela "Meus leads"), mesmo para admin. */
export const meusLeads = (user: SessionUser): Prisma.LeadWhereInput => ({
  tenantId: user.tenantId,
  colaboradorId: user.id,
});

export function cnpjValido(v: string) {
  if (!/^\d{14}$/.test(v) || /^(\d)\1+$/.test(v)) return false;
  const calc = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const d of base) {
      soma += Number(d) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(v.slice(0, 12)) === Number(v[12]) && calc(v.slice(0, 13)) === Number(v[13]);
}

// campo ausente/nulo vira "" antes de validar: clientes simples enviam só o que têm
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v == null ? "" : v), schema);

const vazioParaNulo = (v: string) => (v === "" ? null : v);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const texto = (max: number) =>
  opcional(z.string().trim().max(max, `Máximo de ${max} caracteres.`).transform(vazioParaNulo));

export const leadSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120),
  cargo: texto(120),
  empresa: texto(120),
  inscricao: texto(60),
  whatsapp: opcional(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "WhatsApp inválido.")
      .transform(vazioParaNulo),
  ),
  email: opcional(
    z
      .string()
      .trim()
      .toLowerCase()
      .max(120, "E-mail longo demais.")
      .refine((v) => v === "" || EMAIL.test(v), "E-mail inválido.")
      .transform(vazioParaNulo),
  ),
  cnpj: opcional(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v === "" || cnpjValido(v), "CNPJ inválido.")
      .transform(vazioParaNulo),
  ),
  observacoes: texto(2000),
});

export const fmtData = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export function fmtCnpj(v: string | null) {
  if (!v || v.length !== 14) return v ?? "";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export function fmtWhats(v: string | null) {
  if (!v) return "";
  const d = v.startsWith("55") && v.length > 11 ? v.slice(2) : v;
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10
      ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : v;
}

export const linkWhats = (v: string) => `https://wa.me/${v.length <= 11 ? "55" + v : v}`;
