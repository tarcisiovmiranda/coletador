"use client";

import { atualizar, remover } from "@/lib/outbox";
import { usePendentes } from "./use-pendentes";

const hora = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(t));

/** Leads salvos no aparelho que ainda não chegaram ao servidor. */
export function PendentesLista({ userId }: { userId: string }) {
  const { lista } = usePendentes(userId);
  if (lista.length === 0) return null;

  return (
    <section className="mb-4">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        No aparelho, aguardando envio
      </h2>
      <ul className="space-y-3">
        {lista.map((p) => (
          <li key={p.clientId} className="card border-dashed !border-brand-500">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-slate-900">{p.campos.nome}</p>
                <p className="truncate text-sm text-slate-500">{p.campos.empresa || "Sem empresa"}</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                {p.erro ? "Recusado" : p.serverId ? "Enviando áudio" : "Aguardando"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Salvo às {hora(p.criadoEm)}
              {p.audio ? " · 🎙️ com áudio" : ""}
            </p>
            {p.erro && (
              <div className="mt-2 space-y-2">
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{p.erro}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void atualizar(p.clientId, { erro: undefined })}
                    className="btn btn-ghost !min-h-11 !text-base"
                  >
                    Tentar de novo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Descartar o lead “${p.campos.nome}”? Isso não pode ser desfeito.`)) {
                        void remover(p.clientId);
                      }
                    }}
                    className="btn btn-danger !min-h-11 !text-base"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
