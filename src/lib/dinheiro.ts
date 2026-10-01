/**
 * Dinheiro sempre em CENTAVOS inteiros. Nunca float: R$ 0,10 + R$ 0,20 tem que ser R$ 0,30.
 * Percentual em PONTOS-BASE inteiros (10,5% = 1050), para o cálculo ser exato.
 */

/** "R$ 1.234,56" | "1234,56" | "1500" (sem separador = reais inteiros) → centavos */
export function parseBRL(entrada: string): number | null {
  const s = entrada.trim();
  if (!s) return null;
  let cents: number;
  if (/[,]/.test(s) || /\./.test(s)) {
    // tem separador: "1.234,56", "1234,5" ou "1234.56"
    const limpo = s.replace(/[^\d,.]/g, "");
    const ultimo = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));
    const decimais = limpo.length - ultimo - 1;
    if (ultimo >= 0 && decimais >= 1 && decimais <= 2) {
      const inteiro = limpo.slice(0, ultimo).replace(/\D/g, "");
      const frac = limpo.slice(ultimo + 1).padEnd(2, "0");
      cents = Number(inteiro || "0") * 100 + Number(frac);
    } else {
      cents = Number(limpo.replace(/\D/g, "")) * 100; // "1.234" = mil duzentos e trinta e quatro reais
    }
  } else {
    cents = Number(s.replace(/\D/g, "")) * 100;
  }
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

/** Percentual "10", "10,5", "7.25" → pontos-base (1000, 1050, 725); inválido → null */
export function parsePercent(entrada: string): number | null {
  const s = entrada.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  return bps >= 0 && bps <= 10000 ? bps : null;
}

/** comissão = valor × percentual, arredondado ao centavo (meio para cima) */
export function calcComissao(valorCents: number, bps: number): number {
  return Math.floor((valorCents * bps + 5000) / 10000);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const fmtCents = (c: number) => brl.format(c / 100);

/** Decimal do Prisma (string/Decimal/number em reais) → centavos */
export function toCents(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return Math.round(Number(v.toString()) * 100);
}

/** centavos → string decimal para gravar em coluna Decimal ("1500.00") */
export const centsToDecimal = (c: number) => (c / 100).toFixed(2);

export const bpsToDecimal = (b: number) => (b / 100).toFixed(2);
export const fmtPercent = (v: { toString(): string } | number) =>
  `${Number(v.toString()).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Máscara de digitação (cliente): dígitos viram centavos → "R$ 1.234,56" */
export function maskBRL(v: string) {
  const d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  const c = Number(d.slice(0, 12));
  return fmtCents(c).replace(/ /g, " ");
}
