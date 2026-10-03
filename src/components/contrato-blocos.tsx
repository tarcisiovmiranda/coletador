import type { Bloco, Trecho } from "@/lib/contrato-render";

function Tr({ ts }: { ts: Trecho[] }) {
  return (
    <>
      {ts.map((x, i) => (x.b ? <strong key={i}>{x.t}</strong> : <span key={i}>{x.t}</span>))}
    </>
  );
}

/** Desenha o contrato na tela (leitura do cliente e pré-visualização do admin). */
export function Blocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <div className="text-[15px] leading-relaxed text-slate-900">
      {blocos.map((b, i) => {
        if (b.tipo === "titulo") return <h3 key={i} className="mt-5 text-lg font-bold text-orange-700">{b.texto}</h3>;
        if (b.tipo === "par") return <p key={i} className="my-2"><Tr ts={b.trechos} /></p>;
        if (b.tipo === "item") return <ul key={i} className="ml-5 list-disc"><li><Tr ts={b.trechos} /></li></ul>;
        if (b.tipo === "check")
          return (
            <p key={i} className="my-1 flex items-center gap-2 text-sm font-semibold uppercase">
              <span
                aria-hidden
                className={`inline-flex h-4 w-4 items-center justify-center rounded border border-slate-900 text-[11px] text-white ${b.marcado ? "bg-slate-900" : "bg-white"}`}
              >
                {b.marcado ? "✓" : ""}
              </span>
              <span>{b.texto}</span>
            </p>
          );
        return (
          <div key={i} className="my-3 border-l-4 border-slate-900 bg-slate-100 p-3">
            {b.titulo && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-700">{b.titulo}</p>}
            {b.pars.map((p, j) => (
              <p key={j} className="my-1.5"><Tr ts={p} /></p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
