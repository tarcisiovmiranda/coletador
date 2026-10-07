"use client";

import { useActionState } from "react";
import { CORES_ETAPA } from "@/lib/etapas-cores";
import { criarEtapa, editarEtapa, type EtapaState } from "./actions";

function SeletorCor({ defaultValue }: { defaultValue: string }) {
  return (
    <select name="cor" defaultValue={defaultValue} aria-label="Cor da etapa" className="field">
      {CORES_ETAPA.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function Mensagens({ state }: { state: EtapaState }) {
  return (
    <>
      {state.erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.erro}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {state.ok}
        </p>
      )}
    </>
  );
}

export function NovaEtapaForm() {
  const [state, action, pending] = useActionState<EtapaState, FormData>(criarEtapa, {});
  return (
    <form action={action} key={state.ok ?? "novo"} className="card space-y-3">
      <h2 className="text-lg font-bold text-slate-900">Nova etapa</h2>
      <input name="nome" required maxLength={30} autoComplete="off" placeholder="Nome da etapa" className="field" />
      <SeletorCor defaultValue="sky" />
      <Mensagens state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Criando…" : "Criar etapa"}
      </button>
    </form>
  );
}

export function EditarEtapaForm({ id, nome, cor }: { id: string; nome: string; cor: string }) {
  const [state, action, pending] = useActionState<EtapaState, FormData>(editarEtapa, {});
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <input name="nome" defaultValue={nome} required maxLength={30} autoComplete="off" aria-label="Nome da etapa" className="field" />
        <SeletorCor defaultValue={cor} />
        <button type="submit" disabled={pending} className="btn btn-ghost">
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
      <Mensagens state={state} />
    </form>
  );
}
