import { cnpjValido } from "./leads";

/** O que dá para tirar do conteúdo de um código de barras/QR de crachá. */
export type DadosCodigo = Partial<{
  nome: string;
  empresa: string;
  cargo: string;
  email: string;
  whatsapp: string;
  cnpj: string;
  inscricao: string;
  observacoes: string;
}>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const limpa = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const digitos = (s: string) => s.replace(/\D/g, "");

function fone(v: string): string | undefined {
  let d = digitos(v);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d.length >= 10 && d.length <= 11 ? d : undefined;
}

/** "Sobrenome;Nome" (vCard N:) ou "Sobrenome,Nome" (MECARD) → "Nome Sobrenome" */
function nomeDe(n: string, sep: string): string {
  const [sobrenome, ...resto] = n.split(sep).map((x) => x.trim());
  return limpa([...resto, sobrenome].filter(Boolean).join(" "), 120);
}

function compactar(d: DadosCodigo): DadosCodigo {
  return Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === "string" && v !== "")) as DadosCodigo;
}

function deVCard(raw: string): DadosCodigo {
  const linha = (chave: string) => {
    const m = raw.match(new RegExp(`^${chave}(?:;[^:\\r\\n]*)?:(.*)$`, "im"));
    return m ? m[1].trim() : "";
  };
  const fn = linha("FN");
  const n = linha("N");
  return compactar({
    nome: limpa(fn || (n ? nomeDe(n, ";") : ""), 120),
    empresa: limpa(linha("ORG").split(";")[0], 120),
    cargo: limpa(linha("TITLE"), 120),
    email: EMAIL.test(linha("EMAIL").toLowerCase()) ? linha("EMAIL").toLowerCase() : "",
    whatsapp: fone(linha("TEL")),
  });
}

function deMeCard(raw: string): DadosCodigo {
  const campos = new Map<string, string>();
  for (const parte of raw.replace(/^MECARD:/i, "").split(/;(?!;)/)) {
    const i = parte.indexOf(":");
    if (i > 0) campos.set(parte.slice(0, i).toUpperCase(), parte.slice(i + 1).trim());
  }
  const email = (campos.get("EMAIL") ?? "").toLowerCase();
  return compactar({
    nome: campos.get("N") ? nomeDe(campos.get("N")!, ",") : "",
    empresa: limpa(campos.get("ORG") ?? "", 120),
    email: EMAIL.test(email) ? email : "",
    whatsapp: fone(campos.get("TEL") ?? ""),
  });
}

const CHAVES: Record<string, keyof DadosCodigo> = {
  nome: "nome", name: "nome", fullname: "nome", visitante: "nome",
  empresa: "empresa", company: "empresa", org: "empresa", organizacao: "empresa", organization: "empresa",
  cargo: "cargo", title: "cargo", funcao: "cargo", jobtitle: "cargo",
  email: "email", mail: "email",
  telefone: "whatsapp", fone: "whatsapp", celular: "whatsapp", phone: "whatsapp", whatsapp: "whatsapp", tel: "whatsapp",
  cnpj: "cnpj",
  inscricao: "inscricao", id: "inscricao", codigo: "inscricao", code: "inscricao", ticket: "inscricao",
  credencial: "inscricao", registro: "inscricao", registration: "inscricao",
};
const chaveNorm = (k: string) => k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

function dePares(pares: Iterable<[string, string]>): DadosCodigo {
  const out: DadosCodigo = {};
  for (const [k, v] of pares) {
    const alvo = CHAVES[chaveNorm(k)];
    if (!alvo || typeof v !== "string" && typeof v !== "number") continue;
    const valor = String(v);
    if (alvo === "email") {
      const e = valor.trim().toLowerCase();
      if (EMAIL.test(e)) out.email = e;
    } else if (alvo === "whatsapp") {
      const f = fone(valor);
      if (f) out.whatsapp = f;
    } else if (alvo === "cnpj") {
      const c = digitos(valor);
      if (cnpjValido(c)) out.cnpj = c;
    } else out[alvo] = limpa(valor, alvo === "inscricao" ? 60 : 120);
  }
  return compactar(out);
}

/**
 * Interpreta o texto lido do código. Formatos reconhecidos: vCard, MECARD, JSON, URL com
 * parâmetro de identificação e texto simples. Código curto e sem espaços vira Nº de inscrição;
 * conteúdo longo que não dá para entender vai inteiro para Observações (nada se perde).
 */
export function interpretarCodigo(entrada: string): DadosCodigo {
  const raw = entrada.replace(/\u0000/g, "").trim();
  if (!raw) return {};

  if (/^BEGIN:VCARD/i.test(raw)) {
    const v = deVCard(raw);
    if (Object.keys(v).length) return v;
  }
  if (/^MECARD:/i.test(raw)) {
    const m = deMeCard(raw);
    if (Object.keys(m).length) return m;
  }
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const d = dePares(Object.entries(j).filter((e): e is [string, string] => ["string", "number"].includes(typeof e[1])));
      if (Object.keys(d).length) return d;
    } catch {
      /* não era JSON: cai no texto */
    }
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const d = dePares(u.searchParams.entries());
      if (Object.keys(d).length) return d;
      const ultimo = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
      if (ultimo && ultimo.length <= 40 && /^[\w.-]+$/.test(ultimo)) return { inscricao: ultimo };
    } catch {
      /* URL inválida: cai no texto */
    }
    return { observacoes: `Código do crachá: ${limpa(raw, 300)}` };
  }

  const simples = limpa(raw, 400);
  if (simples.length <= 40 && !/\s{2,}/.test(raw) && !/[;|\n]/.test(raw)) return { inscricao: simples.slice(0, 60) };
  return { observacoes: `Código do crachá: ${simples}` };
}
