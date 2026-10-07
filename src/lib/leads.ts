import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./session";

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

// ------------------------------------------------------------------ documentos

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

export function cpfValido(v: string) {
  if (!/^\d{11}$/.test(v) || /^(\d)\1+$/.test(v)) return false;
  const dv = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(v.slice(0, 9)) === Number(v[9]) && dv(v.slice(0, 10)) === Number(v[10]);
}

// ------------------------------------------------------------------ listas

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const SEXOS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"] as const;

export const PAISES = [
  "Brasil", "Argentina", "Bolívia", "Chile", "Colômbia", "Equador", "Paraguai", "Peru", "Uruguai", "Venezuela",
  "Estados Unidos", "México", "Canadá", "Portugal", "Espanha", "França", "Alemanha", "Itália", "Reino Unido",
  "China", "Japão", "Índia", "Angola", "Moçambique",
];

/** Campos que ficam na seção "Dados completos" do formulário (a abre sozinha se algum falhar). */
export const CAMPOS_COMPLETOS = [
  "cpf", "nomeCredencial", "sexo", "dataNascimento", "cep", "endereco", "numero", "complemento",
  "bairro", "pais", "uf", "cidade", "telefoneFixo", "telefoneFixoDdi",
] as const;

/** Ordem dos campos na tela: os erros são listados nesta ordem. */
export const ORDEM_TELA = [
  "nome", "empresa", "cargo", "whatsappDdi", "whatsapp", "email", "cnpj", "inscricao",
  "cpf", "nomeCredencial", "sexo", "dataNascimento", "cep", "endereco", "numero", "complemento",
  "bairro", "pais", "uf", "cidade", "telefoneFixoDdi", "telefoneFixo", "observacoes",
];

/** Nome de cada campo nas mensagens para o coletador. */
export const ROTULOS: Record<string, string> = {
  nome: "Nome completo",
  nomeCredencial: "Nome na credencial",
  cpf: "CPF",
  email: "E-mail",
  sexo: "Sexo",
  dataNascimento: "Data de nascimento",
  cep: "CEP",
  endereco: "Endereço",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  pais: "País",
  uf: "UF",
  cidade: "Cidade",
  whatsapp: "Telefone celular",
  whatsappDdi: "DDI do celular",
  telefoneFixo: "Telefone fixo",
  telefoneFixoDdi: "DDI do fixo",
  cnpj: "CNPJ",
  empresa: "Nome da empresa",
  cargo: "Cargo",
  inscricao: "Nº de inscrição",
  observacoes: "Observações",
};

export const CAMPOS_LEAD = () => Object.keys(ROTULOS);

// ------------------------------------------------------------------ validação

const digitos = (v: string) => v.replace(/\D/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const vazioParaNulo = <T extends string>(v: T) => (v === "" ? null : v);

const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ehBrasil = (pais: string) => semAcento(pais) === "brasil";

function dataValida(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
  const hoje = new Date();
  return dt.getTime() <= hoje.getTime() && a >= 1900;
}

// campo ausente/nulo vira "" antes de validar: clientes simples enviam só o que têm
const bruto = z.preprocess((v) => (v == null ? "" : typeof v === "string" ? v : String(v)), z.string());
const opt = (max: number) => bruto.pipe(z.string().trim().max(max, `máximo de ${max} caracteres.`));

// Nenhum campo é obrigatório. Se vier preenchido, o formato é conferido (CPF, e-mail, datas…).
// As regras que dependem de outros campos (CEP/UF, telefones) vêm depois.
const camposSchema = z.object({
  nome: opt(120),
  nomeCredencial: opt(60),
  cpf: bruto
    .pipe(z.string().trim())
    .transform(digitos)
    .refine((v) => v === "" || cpfValido(v), "inválido."),
  email: bruto
    .pipe(z.string().trim().toLowerCase().max(120, "máximo de 120 caracteres."))
    .refine((v) => v === "" || EMAIL.test(v), "inválido."),
  sexo: bruto.pipe(z.string().trim()).refine((v) => v === "" || (SEXOS as readonly string[]).includes(v), "selecione uma opção."),
  dataNascimento: bruto.pipe(z.string().trim()).refine((v) => v === "" || dataValida(v), "inválida ou no futuro."),
  endereco: opt(200),
  numero: opt(20),
  complemento: opt(100),
  bairro: opt(100),
  pais: opt(60),
  cidade: opt(100),
  empresa: opt(120),
  cargo: opt(120),
  cnpj: bruto
    .pipe(z.string().trim())
    .transform(digitos)
    .refine((v) => v === "" || cnpjValido(v), "inválido."),
  inscricao: opt(60),
  observacoes: opt(2000),
  // dependem de outros campos: aqui só entram como texto
  cep: opt(20),
  uf: opt(30),
  whatsapp: opt(30),
  whatsappDdi: opt(8),
  telefoneFixo: opt(30),
  telefoneFixoDdi: opt(8),
});

/** Nome gravado quando o visitante não informa o nome (a coluna no banco é obrigatória). */
export const NOME_PADRAO = "Sem nome";

export type DadosLead = {
  nome: string;
  nomeCredencial: string | null;
  cpf: string | null;
  email: string | null;
  sexo: string | null;
  dataNascimento: Date | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  pais: string | null;
  uf: string | null;
  cidade: string | null;
  whatsapp: string | null;
  whatsappDdi: string;
  telefoneFixo: string | null;
  telefoneFixoDdi: string | null;
  empresa: string | null;
  cargo: string | null;
  cnpj: string | null;
  inscricao: string | null;
  observacoes: string | null;
};

export type ErroCampo = { campo: string; mensagem: string };
export type ResultadoLead = { ok: true; data: DadosLead } | { ok: false; erros: ErroCampo[] };

/**
 * Valida e padroniza os dados de um lead (formulário, edição e fila offline usam esta MESMA regra).
 * Nenhum campo é obrigatório; só é exigido que pelo menos um venha preenchido, e os que vierem
 * preenchidos precisam estar no formato certo. Devolve TODOS os problemas de uma vez.
 */
export function validarLead(entrada: unknown): ResultadoLead {
  const raw = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const erros: ErroCampo[] = [];
  const marcar = (campo: string, mensagem: string) => {
    if (!erros.some((e) => e.campo === campo)) erros.push({ campo, mensagem: `${ROTULOS[campo] ?? campo}: ${mensagem}` });
  };

  const r = camposSchema.safeParse(raw);
  if (!r.success) for (const i of r.error.issues) marcar(String(i.path[0]), i.message);
  const c = r.success ? r.data : null;

  const txt = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : raw[k] == null ? "" : String(raw[k]).trim());
  const pais = txt("pais");
  const br = ehBrasil(pais);

  // CEP e UF: no padrão brasileiro só quando o endereço é no Brasil e o campo foi preenchido
  let cep: string | null;
  let uf: string | null;
  if (br) {
    const d = digitos(txt("cep"));
    if (d !== "" && d.length !== 8) marcar("cep", "deve ter 8 dígitos.");
    cep = d || null;
    const u = txt("uf").toUpperCase();
    if (u !== "" && !(UFS as readonly string[]).includes(u)) marcar("uf", "estado inválido.");
    uf = u || null;
  } else {
    cep = txt("cep").slice(0, 20) || null;
    uf = txt("uf").toUpperCase().slice(0, 30) || null;
  }

  // telefones: o tamanho esperado depende do DDI
  const tel = (campoNum: string, campoDdi: string) => {
    const ddi = digitos(txt(campoDdi));
    const num = digitos(txt(campoNum));
    if (ddi && (ddi.length > 3 || ddi === "0")) marcar(campoDdi, "inválido.");
    if (num === "") return { num: null as string | null, ddi: ddi || null };
    const brasil = (ddi || "55") === "55";
    const okTam = brasil ? num.length >= 10 && num.length <= 11 : num.length >= 6 && num.length <= 15;
    if (!okTam) marcar(campoNum, brasil ? "use DDD + número (10 ou 11 dígitos)." : "número inválido.");
    return { num, ddi: ddi || "55" };
  };
  const cel = tel("whatsapp", "whatsappDdi");
  const fixo = tel("telefoneFixo", "telefoneFixoDdi");

  if (erros.length || !c) return { ok: false, erros };

  // sem nenhuma resposta não há o que salvar (os DDI sozinhos não contam)
  const algumPreenchido =
    Object.entries(c).some(([k, v]) => !["whatsappDdi", "telefoneFixoDdi"].includes(k) && v !== "") || cel.num || fixo.num;
  if (!algumPreenchido) return { ok: false, erros: [{ campo: "nome", mensagem: "Preencha pelo menos um campo." }] };

  let dataNascimento: Date | null = null;
  if (c.dataNascimento) {
    const [a, m, d] = c.dataNascimento.split("-").map(Number);
    dataNascimento = new Date(Date.UTC(a, m - 1, d));
  }
  return {
    ok: true,
    data: {
      nome: c.nome || NOME_PADRAO,
      nomeCredencial: vazioParaNulo(c.nomeCredencial),
      cpf: vazioParaNulo(c.cpf),
      email: vazioParaNulo(c.email),
      sexo: vazioParaNulo(c.sexo),
      dataNascimento,
      cep,
      endereco: vazioParaNulo(c.endereco),
      numero: vazioParaNulo(c.numero),
      complemento: vazioParaNulo(c.complemento),
      bairro: vazioParaNulo(c.bairro),
      pais: vazioParaNulo(c.pais),
      uf,
      cidade: vazioParaNulo(c.cidade),
      whatsapp: cel.num,
      whatsappDdi: cel.ddi ?? "55",
      telefoneFixo: fixo.num,
      telefoneFixoDdi: fixo.num ? fixo.ddi : null,
      empresa: vazioParaNulo(c.empresa),
      cargo: vazioParaNulo(c.cargo),
      cnpj: vazioParaNulo(c.cnpj),
      inscricao: vazioParaNulo(c.inscricao),
      observacoes: vazioParaNulo(c.observacoes),
    },
  };
}

// ------------------------------------------------------------------ exibição

export const fmtData = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/** Data de nascimento (coluna DATE, sem fuso): 1990-05-17 → 17/05/1990 */
export const fmtNascimento = (d: Date | null) =>
  d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "";

/** yyyy-mm-dd para o <input type="date"> */
export const isoNascimento = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function fmtCnpj(v: string | null) {
  if (!v || v.length !== 14) return v ?? "";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

export function fmtCpf(v: string | null) {
  if (!v || v.length !== 11) return v ?? "";
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}

export function fmtCep(v: string | null) {
  if (!v || !/^\d{8}$/.test(v)) return v ?? "";
  return `${v.slice(0, 5)}-${v.slice(5)}`;
}

/** Número com máscara brasileira quando DDI 55; outros países aparecem como "+DDI número". */
export function fmtWhats(v: string | null, ddi: string | null = "55") {
  if (!v) return "";
  if (ddi && ddi !== "55") return `+${ddi} ${v}`;
  const d = v.startsWith("55") && v.length > 11 ? v.slice(2) : v;
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10
      ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
      : v;
}

export const linkWhats = (v: string, ddi: string | null = "55") =>
  `https://wa.me/${(ddi || "55") === "55" ? (v.length <= 11 ? "55" + v : v) : (ddi || "") + v}`;
