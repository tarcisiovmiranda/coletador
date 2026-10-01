/** Mostrado na hora ao trocar de tela, enquanto o servidor busca os dados. */
export function TelaCarregando() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4" aria-busy="true" aria-label="Carregando">
      <div className="-mx-4 mb-3 border-b border-slate-200 bg-white px-4 py-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-28 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mb-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 w-24 animate-pulse rounded-full bg-white" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>
    </div>
  );
}
