"use client";

import Link from "next/link";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { moverEtapa, moverLeads } from "@/app/coletor/actions";
import type { EtapaView } from "@/lib/etapas";
import { fmtData } from "@/lib/leads";
import { alternar, faixaSelecao } from "@/lib/selecao";

export type CardLead = {
  id: string;
  nome: string;
  empresa: string | null;
  etapaId: string;
  createdAt: Date;
  colaborador?: string;
};

/**
 * Kanban. No computador: arraste um card para outra coluna; Shift + clique marca uma faixa de cards,
 * Ctrl/Cmd + clique marca um a um, e arrastar um card marcado leva todos os marcados juntos.
 * No celular o arrastar não existe (limitação do navegador com toque): cada card tem o seletor de etapa.
 */
export function KanbanBoard({ etapas, leads }: { etapas: EtapaView[]; leads: CardLead[] }) {
  // a tela muda na hora; se o servidor recusar, volta ao estado real ao fim da transição
  const [lista, aplicarMover] = useOptimistic(leads, (atual, m: { ids: string[]; etapaId: string }) => {
    const alvo = new Set(m.ids);
    return atual.map((l) => (alvo.has(l.id) ? { ...l, etapaId: m.etapaId } : l));
  });
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [sobre, setSobre] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [destinoLote, setDestinoLote] = useState("");
  const [pendente, startTransition] = useTransition();
  const arrastando = useRef<string[]>([]);
  const ancora = useRef<string | null>(null);

  const porEtapa = useMemo(() => {
    const mapa = new Map<string, CardLead[]>(etapas.map((e) => [e.id, []]));
    for (const l of lista) mapa.get(l.etapaId)?.push(l);
    return mapa;
  }, [lista, etapas]);

  useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSel(new Set());
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  function enviar(ids: string[], etapaId: string) {
    const atual = new Map(lista.map((l) => [l.id, l.etapaId]));
    const alvo = ids.filter((id) => atual.has(id) && atual.get(id) !== etapaId);
    if (alvo.length === 0) return;
    setErro(null);
    setSel(new Set());
    setDestinoLote("");
    startTransition(async () => {
      aplicarMover({ ids: alvo, etapaId });
      const r = await moverLeads(alvo, etapaId);
      if (!r.ok) setErro(r.erro);
    });
  }

  function aoClicar(e: React.MouseEvent, id: string, idsDaColuna: string[]) {
    if (e.shiftKey) {
      e.preventDefault();
      const faixa = faixaSelecao(idsDaColuna, ancora.current, id);
      setSel((s) => new Set([...s, ...faixa]));
      if (!ancora.current || !idsDaColuna.includes(ancora.current)) ancora.current = id;
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSel((s) => alternar(s, id));
      ancora.current = id;
    }
  }

  return (
    <div>
      <p className="mb-2 hidden text-sm text-slate-500 md:block">
        Arraste os cards entre as colunas. Shift + clique marca vários; arrastar um card marcado leva todos juntos.
      </p>

      {erro && (
        <p role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">
          {erro}
          <button type="button" onClick={() => setErro(null)} className="text-sm font-bold underline">
            Fechar
          </button>
        </p>
      )}

      {sel.size > 0 && (
        <div
          role="region"
          aria-label="Leads selecionados"
          className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-brand-600 bg-white p-3 shadow-lg"
        >
          <span className="font-bold text-slate-900">
            {sel.size} {sel.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <select
            value={destinoLote}
            onChange={(e) => setDestinoLote(e.target.value)}
            aria-label="Mover os selecionados para"
            className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-slate-300 bg-white px-2 text-base sm:max-w-xs"
          >
            <option value="">Mover para…</option>
            {etapas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!destinoLote || pendente}
            onClick={() => enviar([...sel], destinoLote)}
            className="btn btn-primary !min-h-12"
          >
            Mover
          </button>
          <button type="button" onClick={() => setSel(new Set())} className="btn btn-ghost !min-h-12">
            Limpar
          </button>
        </div>
      )}

      {/* Colunas lado a lado, com barra de rolagem horizontal sempre visível no pé da tela;
          cada coluna rola na vertical por dentro, então a barra não fica perdida no fim de uma lista longa. */}
      <div className="kanban-scroll -mx-4 flex h-[calc(100dvh-15rem)] min-h-96 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:snap-none md:px-0">
        {etapas.map((e) => {
          const cards = porEtapa.get(e.id) ?? [];
          const idsDaColuna = cards.map((l) => l.id);
          return (
            <section
              key={e.id}
              onDragOver={(ev) => {
                if (arrastando.current.length === 0) return;
                ev.preventDefault();
                ev.dataTransfer.dropEffect = "move";
                setSobre(e.id);
              }}
              onDragLeave={(ev) => {
                if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSobre(null);
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                const ids = arrastando.current;
                arrastando.current = [];
                setSobre(null);
                enviar(ids, e.id);
              }}
              className={`flex w-[82vw] shrink-0 snap-center flex-col rounded-2xl md:w-80 md:snap-align-none ${
                sobre === e.id ? "bg-brand-50 ring-2 ring-brand-600 ring-offset-2" : ""
              }`}
            >
              <h2 className={`mb-2 flex shrink-0 items-center justify-between rounded-xl px-3 py-2 text-base font-bold ${e.classes}`}>
                {e.nome}
                <span className="rounded-full bg-white/70 px-2 text-sm">{cards.length}</span>
              </h2>
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-1">
                {cards.map((l) => (
                  <li
                    key={l.id}
                    draggable
                    onMouseDown={(ev) => {
                      if (ev.shiftKey) ev.preventDefault(); // Shift + clique não pode selecionar texto
                    }}
                    onDragStart={(ev) => {
                      const ids = sel.has(l.id) ? [...sel] : [l.id];
                      arrastando.current = ids;
                      ev.dataTransfer.effectAllowed = "move";
                      ev.dataTransfer.setData("text/plain", ids.join(","));
                    }}
                    onDragEnd={() => {
                      arrastando.current = [];
                      setSobre(null);
                    }}
                    className={`card !p-3 md:cursor-grab ${sel.has(l.id) ? "bg-brand-50 ring-2 ring-brand-600" : ""}`}
                  >
                    <Link
                      href={`/coletor/leads/${l.id}`}
                      draggable={false}
                      onClick={(ev) => aoClicar(ev, l.id, idsDaColuna)}
                      className="block"
                    >
                      <p className="truncate text-base font-bold text-slate-900">{l.nome}</p>
                      <p className="truncate text-sm text-slate-500">
                        {[l.empresa, l.colaborador].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-slate-400">{fmtData(l.createdAt)}</p>
                    </Link>
                    <form key={l.etapaId} action={moverEtapa} className="mt-2 flex gap-2">
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
                {cards.length === 0 && <li className="px-1 text-sm text-slate-400">Nenhum lead</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
