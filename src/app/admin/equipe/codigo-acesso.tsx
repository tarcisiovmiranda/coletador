"use client";

import { useState, useTransition } from "react";
import { gerarNovoCodigo, verCodigo, type CodigoState } from "./actions";

/** Código de acesso de um colaborador: o admin vê, copia e, se precisar, troca por um novo. */
export function CodigoAcesso({ id, nome, temCodigo }: { id: string; nome: string; temCodigo: boolean }) {
  const [estado, setEstado] = useState<CodigoState>({});
  const [salvo, setSalvo] = useState(temCodigo);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  function executar(acao: (id: string) => Promise<CodigoState>) {
    startTransition(async () => {
      const r = await acao(id);
      setEstado(r);
      if (r.codigo) setSalvo(true);
    });
  }

  function trocar() {
    if (!confirm(`Gerar um código novo para ${nome}? O código atual deixa de funcionar.`)) return;
    executar(gerarNovoCodigo);
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de clipboard: o código segue visível na tela */
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 px-3 py-2">
      <p className="text-sm font-semibold text-slate-700">
        Código de acesso:{" "}
        {!estado.codigo && (salvo ? <span className="text-slate-500">oculto</span> : <span className="text-amber-700">não disponível</span>)}
      </p>

      {estado.codigo && (
        <>
          <p className="my-2 select-all text-center text-3xl font-extrabold tracking-widest text-slate-900">
            {estado.codigo}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => copiar(estado.codigo!)} className="btn btn-primary flex-1">
              {copiado ? "Copiado!" : "Copiar código"}
            </button>
            <button type="button" onClick={() => setEstado({})} className="btn btn-ghost">
              Ocultar
            </button>
          </div>
        </>
      )}

      {!estado.codigo && (
        <p className="mt-1 text-sm text-slate-500">
          {salvo
            ? "Toque para ver e enviar ao colaborador."
            : "Criado antes do recurso existir e não pode ser exibido. Gere um novo para poder enviar."}
        </p>
      )}

      {estado.erro && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {estado.erro}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        {!estado.codigo && salvo && (
          <button type="button" disabled={pending} onClick={() => executar(verCodigo)} className="btn btn-ghost flex-1">
            {pending ? "Abrindo…" : "Ver código"}
          </button>
        )}
        <button type="button" disabled={pending} onClick={trocar} className="btn btn-ghost flex-1">
          {salvo ? "Gerar novo código" : "Gerar código"}
        </button>
      </div>
    </div>
  );
}
