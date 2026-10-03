/** Marcação do contrato → blocos (usados pela tela e pelo PDF) + preenchimento de variáveis. */

export type Trecho = { t: string; b: boolean };
export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "par"; trechos: Trecho[] }
  | { tipo: "item"; trechos: Trecho[] }
  | { tipo: "caixa"; titulo: string | null; pars: Trecho[][] }
  | { tipo: "check"; marcado: boolean; texto: string };

export const FERRAMENTAS = [
  "Diagnóstico NR-1",
  "Cadastro (quadro de pessoal)",
  "Levantamento de Riscos",
  "PGR",
  "PCMSO",
  "LTCAT",
  "Ergonomia",
  "CIPA",
  "Canal de Denúncias",
  "Comunicados",
] as const;

/** Variáveis aceitas no modelo. `ferramentas` é especial (linhas [x]/[ ]). */
export const VARIAVEIS = [
  "nome", "documento", "email", "whatsapp", "endereco_completo", "empresa", "cargo",
  "coletor", "data", "local",
  "mensalidade", "plano", "vencimento", "medico_trabalho", "limite_vidas",
  "ferramentas",
] as const;

const RE_VAR = /\{\{(\w+)\}\}/g;

export function trechos(s: string): Trecho[] {
  return s
    .split("**")
    .map((t, i) => ({ t, b: i % 2 === 1 }))
    .filter((x) => x.t !== "");
}

export function parseContrato(corpo: string): Bloco[] {
  const linhas = corpo.replace(/\r\n?/g, "\n").split("\n");
  const out: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const s = linhas[i].trim();
    if (!s) {
      i++;
      continue;
    }
    if (s.startsWith(">")) {
      const grupo: string[] = [];
      while (i < linhas.length && linhas[i].trim().startsWith(">")) {
        grupo.push(linhas[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const pars: string[] = [];
      let atual: string[] = [];
      for (const g of grupo) {
        if (g.trim() === "") {
          if (atual.length) pars.push(atual.join(" "));
          atual = [];
        } else atual.push(g.trim());
      }
      if (atual.length) pars.push(atual.join(" "));
      let titulo: string | null = null;
      if (pars[0]?.startsWith("### ")) titulo = pars.shift()!.slice(4).trim();
      out.push({ tipo: "caixa", titulo, pars: pars.map(trechos) });
      continue;
    }
    const check = /^\[( |x)\] (.+)$/.exec(s);
    if (check) out.push({ tipo: "check", marcado: check[1] === "x", texto: check[2].trim() });
    else if (s.startsWith("## ")) out.push({ tipo: "titulo", texto: s.slice(3).trim() });
    else if (s.startsWith("- ")) out.push({ tipo: "item", trechos: trechos(s.slice(2).trim()) });
    else out.push({ tipo: "par", trechos: trechos(s) });
    i++;
  }
  return out;
}

export function variaveisUsadas(corpo: string): string[] {
  return [...new Set([...corpo.matchAll(RE_VAR)].map((m) => m[1]))];
}

/** Tira o que quebraria a marcação: negrito, chaves e quebras de linha. */
export function limparValor(v: string): string {
  return v
    .replace(/\*+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(#+\s*|-\s+|>\s*|\[[ x]\]\s*)+/, "") // marcador de bloco no começo do valor
    .trim();
}

export function preencher(
  corpo: string,
  valores: Record<string, string | undefined>,
  ferramentas: { todas: readonly string[]; marcadas: readonly string[] } | null,
): { texto: string; faltantes: string[] } {
  const faltantes = new Set<string>();
  const texto = corpo.replace(RE_VAR, (m, nome: string) => {
    if (nome === "ferramentas") {
      if (!ferramentas) return m;
      return ferramentas.todas.map((f) => `[${ferramentas.marcadas.includes(f) ? "x" : " "}] ${f}`).join("\n");
    }
    const v = valores[nome];
    const limpo = v == null ? "" : limparValor(v);
    if (!limpo) {
      faltantes.add(nome);
      return m;
    }
    return limpo;
  });
  return { texto, faltantes: [...faltantes] };
}
