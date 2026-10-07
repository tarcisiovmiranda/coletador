/** Fuso fixo de São Paulo (UTC-3, sem horário de verão desde 2019): os dias do filtro seguem o relógio do estande. */
const OFFSET_SP = "-03:00";

export type IntervaloCriacao =
  | { ok: true; where: { gte?: Date; lt?: Date } | undefined }
  | { ok: false; erro: string };

function diaSP(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00${OFFSET_SP}`);
  if (Number.isNaN(d.getTime())) return null;
  // rejeita 2026-02-31 e similares (o Date "rola" para o mês seguinte)
  const [a, m, dia] = v.split("-").map(Number);
  const conf = new Date(Date.UTC(a, m - 1, dia));
  if (conf.getUTCFullYear() !== a || conf.getUTCMonth() !== m - 1 || conf.getUTCDate() !== dia) return null;
  return d;
}

/**
 * Filtro de "criado em" por dia, inclusive nas duas pontas: de 00:00 do dia inicial até o fim do dia final
 * (implementado como `< 00:00 do dia seguinte`). Vazio = sem limite naquele lado.
 */
export function intervaloCriacao(de: string | undefined, ate: string | undefined): IntervaloCriacao {
  const deTxt = de?.trim() ?? "";
  const ateTxt = ate?.trim() ?? "";
  if (!deTxt && !ateTxt) return { ok: true, where: undefined };

  const inicio = deTxt ? diaSP(deTxt) : undefined;
  const fimDia = ateTxt ? diaSP(ateTxt) : undefined;
  if (inicio === null) return { ok: false, erro: "Data inicial inválida." };
  if (fimDia === null) return { ok: false, erro: "Data final inválida." };

  const fim = fimDia ? new Date(fimDia.getTime() + 24 * 60 * 60 * 1000) : undefined;
  if (inicio && fim && inicio.getTime() >= fim.getTime()) {
    return { ok: false, erro: "A data final é anterior à data inicial." };
  }
  return { ok: true, where: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lt: fim } : {}) } };
}
