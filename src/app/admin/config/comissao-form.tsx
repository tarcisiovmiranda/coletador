"use client";

import { useActionState } from "react";
import { salvarComissao, type ConfigState } from "@/app/coletor/contratos/actions";

export function ComissaoForm({ atual }: { atual: string }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(salvarComissao, {});
  return (
    <form action={action} className="card space-y-3 lg:max-w-xl">
      <h2 className="text-lg font-bold text-slate-900">Comissão dos coletadores</h2>
      <p className="text-sm text-slate-600">
        Percentual sobre o valor de cada contrato. Contratos já aprovados não mudam; os pendentes são
        recalculados ao salvar.
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Percentual (%)</span>
        <input
          key={atual}
          name="percentual"
          defaultValue={atual}
          inputMode="decimal"
          autoComplete="off"
          onFocus={(e) => e.currentTarget.select()}
          required
          className="field"
        />
      </label>
      {state.erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-700">
          {state.erro}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          {state.ok}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
