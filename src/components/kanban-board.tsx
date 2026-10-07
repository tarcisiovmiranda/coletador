import Link from "next/link";
import { moverEtapa } from "@/app/coletor/actions";
import type { EtapaView } from "@/lib/etapas";
import { fmtData } from "@/lib/leads";

export type CardLead = {
  id: string;
  nome: string;
  empresa: string | null;
  etapaId: string;
  createdAt: Date;
  colaborador?: string;
};

/** Kanban sem arrastar (uso em pé, com uma mão): cada card tem um seletor de etapa. */
export function KanbanBoard({ etapas, leads }: { etapas: EtapaView[]; leads: CardLead[] }) {
  return (
    // Colunas lado a lado, com barra de rolagem horizontal sempre visível no pé da tela;
    // cada coluna rola na vertical por dentro, então a barra não fica perdida no fim de uma lista longa.
    <div className="kanban-scroll -mx-4 flex h-[calc(100dvh-15rem)] min-h-96 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
      {etapas.map((e) => {
        const lista = leads.filter((l) => l.etapaId === e.id);
        return (
          <section key={e.id} className="flex w-[82vw] shrink-0 snap-center flex-col md:w-80 md:snap-align-none">
            <h2 className={`mb-2 flex shrink-0 items-center justify-between rounded-xl px-3 py-2 text-base font-bold ${e.classes}`}>
              {e.nome}
              <span className="rounded-full bg-white/70 px-2 text-sm">{lista.length}</span>
            </h2>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {lista.map((l) => (
                <li key={l.id} className="card !p-3">
                  <Link href={`/coletor/leads/${l.id}`} className="block">
                    <p className="truncate text-base font-bold text-slate-900">{l.nome}</p>
                    <p className="truncate text-sm text-slate-500">
                      {[l.empresa, l.colaborador].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-xs text-slate-400">{fmtData(l.createdAt)}</p>
                  </Link>
                  <form action={moverEtapa} className="mt-2 flex gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <select
                      name="etapa"
                      defaultValue={l.etapaId}
                      className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-slate-300 bg-white px-2 text-base"
                    >
                      {etapas.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-ghost !min-h-12 !px-4 !text-base">
                      Mover
                    </button>
                  </form>
                </li>
              ))}
              {lista.length === 0 && <li className="px-1 text-sm text-slate-400">Nenhum lead</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
