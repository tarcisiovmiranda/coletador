"use client";

import { useActionState } from "react";
import type { PixTipo } from "@prisma/client";
import { salvarChavePix, type PixState } from "@/app/admin/pagamentos/actions";
import { PIX_TIPOS } from "@/lib/pix";

/** Chave Pix de um colaborador (só o admin altera). `atual` já vem mascarada. */
export function PixForm({ id, tipo, atual }: { id: string; tipo: PixTipo | null; atual: string | null }) {
  const [state, action, pending] = useActionState<PixState, FormData>(salvarChavePix, {});
  return (
    <details className="mt-3 rounded-xl border border-slate-200 px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        Chave Pix: {atual ? <span className="font-bold text-slate-900">{atual}</span> : <span className="text-amber-700">não cadastrada</span>}
      </summary>
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={id} />
        <select name="tipo" defaultValue={tipo ?? "CPF"} className="field">
          {PIX_TIPOS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <input name="chave" placeholder="Digite a chave Pix" autoComplete="off" required className="field" />
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
        <button type="submit" disabled={pending} className="btn btn-ghost w-full">
          {pending ? "Salvando…" : atual ? "Trocar chave" : "Salvar chave"}
        </button>
      </form>
    </details>
  );
}
