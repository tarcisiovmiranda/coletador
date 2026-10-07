/**
 * Paleta fixa das etapas do kanban. O Tailwind só gera classes que aparecem escritas no código,
 * por isso a etapa guarda a CHAVE da cor e o admin escolhe entre estas opções.
 */
export const CORES_ETAPA = [
  { key: "slate", label: "Cinza", classes: "bg-slate-200 text-slate-800" },
  { key: "sky", label: "Azul", classes: "bg-sky-100 text-sky-800" },
  { key: "violet", label: "Roxo", classes: "bg-violet-100 text-violet-800" },
  { key: "amber", label: "Amarelo", classes: "bg-amber-100 text-amber-800" },
  { key: "emerald", label: "Verde", classes: "bg-emerald-100 text-emerald-800" },
  { key: "red", label: "Vermelho", classes: "bg-red-100 text-red-800" },
  { key: "rose", label: "Rosa", classes: "bg-rose-100 text-rose-800" },
  { key: "orange", label: "Laranja", classes: "bg-orange-100 text-orange-800" },
  { key: "teal", label: "Turquesa", classes: "bg-teal-100 text-teal-800" },
  { key: "indigo", label: "Índigo", classes: "bg-indigo-100 text-indigo-800" },
] as const;

export type CorEtapa = (typeof CORES_ETAPA)[number]["key"];
export const CORES_KEYS = CORES_ETAPA.map((c) => c.key) as [CorEtapa, ...CorEtapa[]];

export const corValida = (v: string): v is CorEtapa => (CORES_KEYS as string[]).includes(v);

/** Classes do selo da etapa; chave desconhecida cai no cinza em vez de quebrar a tela. */
export const classesCor = (key: string) => CORES_ETAPA.find((c) => c.key === key)?.classes ?? CORES_ETAPA[0].classes;

/**
 * Sobe ou desce uma etapa na lista de ids já ordenada. Devolve a nova ordem
 * (ou a mesma, se já estiver na ponta ou o id não existir).
 */
export function reordenar(ids: string[], id: string, direcao: "subir" | "descer"): string[] {
  const i = ids.indexOf(id);
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const novo = [...ids];
  [novo[i], novo[j]] = [novo[j], novo[i]];
  return novo;
}
