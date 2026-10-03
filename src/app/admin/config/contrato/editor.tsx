"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Blocos } from "@/components/contrato-blocos";
import { FERRAMENTAS, VARIAVEIS, parseContrato, preencher } from "@/lib/contrato-render";
import { salvarModelo, type ModeloState } from "./actions";

const EXEMPLO: Record<string, string> = {
  nome: "Maria da Silva", documento: "529.982.247-25", email: "maria@exemplo.com.br", whatsapp: "(12) 99999-1234",
  endereco_completo: "Rua das Flores, 100 - Centro - São Paulo/SP - CEP 01038-100", empresa: "Silva Ltda", cargo: "Sócia",
  coletor: "Coletor", data: "06/10/2026", local: "São Paulo/SP", mensalidade: "700,00", plano: "Completo",
  vencimento: "10", medico_trabalho: "não contratado", limite_vidas: "1.300",
};

export function EditorModelo({ titulo, corpo, versao }: { titulo: string; corpo: string; versao: number }) {
  const [state, action, pending] = useActionState<ModeloState, FormData>(salvarModelo, {});
  const [texto, setTexto] = useState(corpo);
  const [aba, setAba] = useState<"editar" | "ver">("editar");
  const area = useRef<HTMLTextAreaElement>(null);

  const blocos = useMemo(
    () => parseContrato(preencher(texto, EXEMPLO, { todas: FERRAMENTAS, marcadas: FERRAMENTAS }).texto),
    [texto],
  );

  function inserir(v: string) {
    const el = area.current;
    const marca = `{{${v}}}`;
    if (!el) return setTexto((t) => t + marca);
    const ini = el.selectionStart;
    const fim = el.selectionEnd;
    setTexto(texto.slice(0, ini) + marca + texto.slice(fim));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  }

  return (
    <form action={action} className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Texto do contrato</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">Versão vigente: {versao}</span>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Título</span>
          <input name="titulo" defaultValue={titulo} className="field" />
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={() => setAba("editar")} className={`btn ${aba === "editar" ? "btn-primary" : "btn-ghost"} flex-1`}>Editar</button>
          <button type="button" onClick={() => setAba("ver")} className={`btn ${aba === "ver" ? "btn-primary" : "btn-ghost"} flex-1`}>Pré-visualização</button>
        </div>

        {/* o textarea fica montado nas duas abas para o texto ir no envio */}
        <div className={aba === "editar" ? "" : "hidden"}>
          <textarea
            ref={area}
            name="corpo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            spellCheck={false}
            className="field h-[70vh] w-full font-mono text-sm leading-relaxed"
          />
          <p className="mt-2 text-sm text-slate-600">
            Marcação: <code>## Título</code> · <code>**negrito**</code> · <code>- item</code> · quadro destacado:{" "}
            <code>&gt; ### TÍTULO</code> e linhas com <code>&gt;</code> · Anexo I: <code>{"{{ferramentas}}"}</code>
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Variáveis (toque para inserir):</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {VARIAVEIS.map((v) => (
              <button key={v} type="button" onClick={() => inserir(v)} className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
        {aba === "ver" && (
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs text-slate-500">Pré-visualização com dados de exemplo.</p>
            <Blocos blocos={blocos} />
          </div>
        )}

        {state.erro && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">{state.erro}</p>}
        {state.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">{state.ok}</p>}
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Salvando…" : "Salvar nova versão"}
        </button>
      </div>
    </form>
  );
}
