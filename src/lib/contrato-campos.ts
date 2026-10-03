import { createHash } from "node:crypto";
import { z } from "zod";
import { cnpjValido, cpfValido, fmtCep, fmtCnpj, fmtCpf, fmtWhats } from "./leads";
import { parseBRL } from "./dinheiro";
import { FERRAMENTAS } from "./contrato-render";

export { FERRAMENTAS };

/** Limite de vidas por dia da FISP 2026 (cláusula 2.1.2). Chave = dia em Brasília. */
const LIMITE_POR_DIA: Record<string, number> = {
  "2026-10-06": 1300,
  "2026-10-07": 1200,
  "2026-10-08": 1100,
};

/** Relógio do servidor. TESTE_AGORA só vale fora da Vercel (testes locais). */
export function agora(): Date {
  const t = process.env.TESTE_AGORA;
  if (t && !process.env.VERCEL) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function diaBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export function limiteDoDia(d: Date): number | null {
  return LIMITE_POR_DIA[diaBrasilia(d)] ?? null;
}

/** Largura/altura declaradas no cabeçalho do PNG (IHDR), sem decodificar a imagem. */
export function dimensoesPng(b: Uint8Array): { w: number; h: number } | null {
  if (b.byteLength < 24) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20) };
}

/** Nome amigável do dado do lead que falta no contrato. */
export const ROTULO_FALTANTE: Record<string, string> = {
  email: "e-mail",
  documento: "CPF ou CNPJ",
  endereco_completo: "endereço",
  whatsapp: "WhatsApp",
  empresa: "empresa",
  cargo: "cargo",
};

export const hashTexto =(texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");

const soDigitos = (v: string) => v.replace(/\D/g, "");

export const entradaSchema = z.object({
  // só dígitos com separadores (700 | 700,00 | 1.234,56 | 1234.56): "-700" ou "7a0" não passam
  mensalidade: z.string().refine((v) => {
    if (!/^(\d{1,3}(\.\d{3})+|\d+)([.,]\d{1,2})?$/.test(v.trim())) return false;
    const c = parseBRL(v);
    return c !== null && c >= 100 && c <= 10_000_000;
  }, "Informe uma mensalidade válida."),
  // o que o cliente LEU: o servidor recusa se o modelo ou o limite do dia mudaram desde então
  versaoModelo: z.number().int().min(1),
  limiteExibido: z.number().int().optional(),
  plano: z.string().trim().min(2, "Informe o plano.").max(120, "Plano muito longo."),
  vencimento: z.number().int("Dia de vencimento inválido.").min(1, "Dia de vencimento: 1 a 28.").max(28, "Dia de vencimento: 1 a 28."),
  medicoTrabalho: z.boolean(),
  ferramentas: z.array(z.enum(FERRAMENTAS)).min(1, "Marque ao menos uma ferramenta."),
  limiteVidas: z.number().int().min(1, "Limite de vidas inválido.").max(1_000_000, "Limite de vidas inválido.").optional(),
  signatarioNome: z.string().trim().min(3, "Informe o nome completo de quem assina.").max(120),
  signatarioDocumento: z
    .string()
    .transform(soDigitos)
    .refine((d) => cpfValido(d) || cnpjValido(d), "CPF ou CNPJ do signatário inválido."),
  assinaturaPng: z.string().max(400_000, "Assinatura grande demais."),
  aceite: z.literal(true, { message: "É preciso marcar “Li e concordo”." }),
});
export type EntradaAssinatura = z.infer<typeof entradaSchema>;

export type LeadParaContrato = {
  nome: string; cpf: string | null; cnpj: string | null; email: string | null;
  whatsapp: string | null; whatsappDdi: string; empresa: string | null; cargo: string | null;
  endereco: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null; pais: string | null;
};

export const docLead = (l: Pick<LeadParaContrato, "cpf" | "cnpj">) => l.cnpj || l.cpf || "";

const fmtDoc = (d: string) => (d.length === 14 ? fmtCnpj(d) : fmtCpf(d));

function enderecoCompleto(l: LeadParaContrato) {
  const rua = [l.endereco, l.numero].filter(Boolean).join(", ") + (l.complemento ? ` (${l.complemento})` : "");
  const cidade = [l.cidade, l.uf].filter(Boolean).join("/");
  const partes = [rua, l.bairro, cidade, l.cep ? `CEP ${fmtCep(l.cep)}` : "", l.pais && l.pais !== "Brasil" ? l.pais : ""];
  return partes.filter((p) => p && p.trim()).join(" - ");
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function montarValores(
  lead: LeadParaContrato,
  e: { mensalidadeCents: number; plano: string; vencimento: number; medicoTrabalho: boolean; limiteVidas: number },
  coletorNome: string,
  quando: Date,
): Record<string, string> {
  const doc = docLead(lead);
  return {
    nome: lead.nome,
    documento: doc ? fmtDoc(doc) : "",
    email: lead.email ?? "",
    whatsapp: fmtWhats(lead.whatsapp, lead.whatsappDdi),
    endereco_completo: enderecoCompleto(lead),
    empresa: lead.empresa ?? "",
    cargo: lead.cargo ?? "",
    coletor: coletorNome,
    data: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(quando),
    local: "São Paulo/SP",
    mensalidade: brl(e.mensalidadeCents),
    plano: e.plano,
    vencimento: String(e.vencimento),
    medico_trabalho: e.medicoTrabalho ? "contratado (+ R$ 200,00 por mês)" : "não contratado",
    limite_vidas: e.limiteVidas.toLocaleString("pt-BR"),
  };
}
