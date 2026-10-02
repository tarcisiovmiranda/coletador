import type { PixTipo } from "@prisma/client";
import { cnpjValido } from "./leads";

export const PIX_TIPOS: { key: PixTipo; label: string; dica: string }[] = [
  { key: "CPF", label: "CPF", dica: "000.000.000-00" },
  { key: "CNPJ", label: "CNPJ", dica: "00.000.000/0000-00" },
  { key: "EMAIL", label: "E-mail", dica: "nome@email.com" },
  { key: "PHONE", label: "Celular", dica: "(11) 99999-9999" },
  { key: "EVP", label: "Chave aleatória", dica: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
];

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida e padroniza a chave como o Pix espera: CPF/CNPJ só dígitos, celular +55…, e-mail minúsculo. */
export function normalizarChavePix(
  tipo: PixTipo,
  entrada: string,
): { ok: true; valor: string } | { ok: false; erro: string } {
  const bruto = entrada.trim();
  switch (tipo) {
    case "CPF": {
      const d = bruto.replace(/\D/g, "");
      return cpfValido(d) ? { ok: true, valor: d } : { ok: false, erro: "CPF inválido." };
    }
    case "CNPJ": {
      const d = bruto.replace(/\D/g, "");
      return cnpjValido(d) ? { ok: true, valor: d } : { ok: false, erro: "CNPJ inválido." };
    }
    case "EMAIL": {
      const e = bruto.toLowerCase();
      return EMAIL.test(e) && e.length <= 77 ? { ok: true, valor: e } : { ok: false, erro: "E-mail inválido." };
    }
    case "PHONE": {
      let d = bruto.replace(/\D/g, "");
      if (d.startsWith("55") && d.length > 11) d = d.slice(2);
      return d.length === 11 && d[2] === "9"
        ? { ok: true, valor: `+55${d}` }
        : { ok: false, erro: "Celular inválido. Use DDD + 9 dígitos." };
    }
    case "EVP": {
      const u = bruto.toLowerCase();
      return UUID.test(u) ? { ok: true, valor: u } : { ok: false, erro: "Chave aleatória inválida." };
    }
  }
}

/** Mostra só o suficiente para conferir, sem expor a chave inteira na tela. */
export function mascararChave(tipo: PixTipo, valor: string): string {
  switch (tipo) {
    case "CPF":
      return `•••.•••.${valor.slice(6, 9)}-${valor.slice(9)}`;
    case "CNPJ":
      return `••.•••.•••/${valor.slice(8, 12)}-${valor.slice(12)}`;
    case "EMAIL": {
      const [u, d] = valor.split("@");
      return `${u.slice(0, 2)}•••@${d}`;
    }
    case "PHONE":
      return `+55 (${valor.slice(3, 5)}) •••••-${valor.slice(-4)}`;
    case "EVP":
      return `${valor.slice(0, 8)}-••••-••••-••••-${valor.slice(-4)}`;
  }
}
