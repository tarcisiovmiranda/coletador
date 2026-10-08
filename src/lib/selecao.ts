/**
 * Seleção em faixa (Shift + clique): devolve os ids de `ancora` até `alvo`, inclusive, na ordem da lista.
 * Se algum dos dois não estiver na lista (outra coluna, âncora removida), devolve só o alvo.
 */
export function faixaSelecao(ids: string[], ancora: string | null, alvo: string): string[] {
  const j = ids.indexOf(alvo);
  if (j < 0) return [];
  const i = ancora === null ? -1 : ids.indexOf(ancora);
  if (i < 0) return [alvo];
  return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
}

/** Alterna um id no conjunto sem mutar o original (Ctrl/Cmd + clique). */
export function alternar(sel: ReadonlySet<string>, id: string): Set<string> {
  const novo = new Set(sel);
  if (!novo.delete(id)) novo.add(id);
  return novo;
}
