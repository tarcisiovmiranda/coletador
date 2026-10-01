"use client";

import { useActionState, useRef, useState } from "react";
import { criarColaborador, type CriarState } from "./actions";

export function NovoColaboradorForm() {
  const [state, action, pending] = useActionState<CriarState, FormData>(criarColaborador, {});
  const [copiado, setCopiado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
    <section className="card">
      <h2 className="mb-3 text-lg font-bold text-slate-900">Novo colaborador</h2>

      {state.criado && (
        <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-center">
          <p className="text-base font-semibold text-emerald-900">
            Código de {state.criado.nome}
          </p>
          <p className="my-2 select-all text-4xl font-extrabold tracking-widest text-emerald-900">
            {state.criado.codigo}
          </p>
          <p className="mb-3 text-sm font-medium text-emerald-800">
            Anote agora: este código é exibido uma única vez e não pode ser recuperado.
          </p>
          <button
            type="button"
            onClick={() => copiar(state.criado!.codigo)}
            className="btn btn-primary w-full"
          >
            {copiado ? "Copiado!" : "Copiar código"}
          </button>
        </div>
      )}

      <form
        key={state.criado?.codigo ?? "form"}
        ref={formRef}
        action={action}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
          <input name="nome" required maxLength={80} autoComplete="off" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            WhatsApp (opcional)
          </span>
          <input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            placeholder="11 99999-9999"
            autoComplete="off"
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Perfil</span>
          <select name="perfil" defaultValue="COLETADOR" className="field">
            <option value="COLETADOR">Coletador</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {state.erro && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">
            {state.erro}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Criando…" : "Criar e gerar código"}
        </button>
      </form>
    </section>
  );
}
