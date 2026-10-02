import { fmtCep, fmtCnpj, fmtCpf, fmtWhats } from "./leads";

export type Valores = {
  nome: string;
  nomeCredencial: string;
  cargo: string;
  empresa: string;
  inscricao: string;
  whatsapp: string;
  whatsappDdi: string;
  telefoneFixo: string;
  telefoneFixoDdi: string;
  email: string;
  cpf: string;
  sexo: string;
  dataNascimento: string; // yyyy-mm-dd
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  pais: string;
  uf: string;
  cidade: string;
  cnpj: string;
  observacoes: string;
};

export const VAZIO: Valores = {
  nome: "",
  nomeCredencial: "",
  cargo: "",
  empresa: "",
  inscricao: "",
  whatsapp: "",
  whatsappDdi: "55",
  telefoneFixo: "",
  telefoneFixoDdi: "55",
  email: "",
  cpf: "",
  sexo: "",
  dataNascimento: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  pais: "Brasil",
  uf: "",
  cidade: "",
  cnpj: "",
  observacoes: "",
};

/** Converte o que vem do banco para o que aparece nos campos (com máscara). */
export function valoresDoLead(l: {
  [K in keyof Valores]?: string | null;
} & { whatsappDdi?: string | null }): Valores {
  const v = (k: keyof Valores) => l[k] ?? VAZIO[k];
  const ddi = l.whatsappDdi || "55";
  const ddiFixo = l.telefoneFixoDdi || "55";
  return {
    ...VAZIO,
    nome: v("nome"),
    nomeCredencial: v("nomeCredencial"),
    cargo: v("cargo"),
    empresa: v("empresa"),
    inscricao: v("inscricao"),
    whatsapp: ddi === "55" ? fmtWhats(l.whatsapp ?? "") : (l.whatsapp ?? ""),
    whatsappDdi: ddi,
    telefoneFixo: ddiFixo === "55" ? fmtWhats(l.telefoneFixo ?? "") : (l.telefoneFixo ?? ""),
    telefoneFixoDdi: ddiFixo,
    email: v("email"),
    cpf: fmtCpf(l.cpf ?? ""),
    sexo: v("sexo"),
    dataNascimento: v("dataNascimento"),
    cep: (l.pais ?? "Brasil").toLowerCase() === "brasil" ? fmtCep(l.cep ?? "") : (l.cep ?? ""),
    endereco: v("endereco"),
    numero: v("numero"),
    complemento: v("complemento"),
    bairro: v("bairro"),
    pais: l.pais || "Brasil",
    uf: v("uf"),
    cidade: v("cidade"),
    cnpj: fmtCnpj(l.cnpj ?? ""),
    observacoes: v("observacoes"),
  };
}
