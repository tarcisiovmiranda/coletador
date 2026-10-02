const dig = (v: string) => v.replace(/\D/g, "");

/** 00.000.000/0000-00 (até 14 dígitos) */
export function maskCnpj(v: string) {
  const d = dig(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** (00) 00000-0000 ou (00) 0000-0000 (até 11 dígitos) */
export function maskWhats(v: string) {
  let d = dig(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // colou com +55
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 000.000.000-00 (até 11 dígitos) */
export function maskCpf(v: string) {
  const d = dig(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** 00000-000 (até 8 dígitos) */
export function maskCep(v: string) {
  const d = dig(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Só dígitos, até 3 (DDI) */
export const maskDdi = (v: string) => dig(v).slice(0, 3);
