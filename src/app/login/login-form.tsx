"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <input
        name="codigo"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="XXXXX-XXXXX"
        required
        className="field text-center text-2xl font-bold uppercase tracking-widest"
      />
      {state.erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700">
          {state.erro}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
