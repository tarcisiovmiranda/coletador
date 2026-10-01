"use client";

import { logout } from "@/app/login/actions";
import { usePendentes } from "./use-pendentes";

export function LogoutButton({ userId }: { userId: string }) {
  const { lista } = usePendentes(userId);
  return (
    <form
      action={logout}
      onSubmit={(e) => {
        if (
          lista.length > 0 &&
          !confirm(
            `Há ${lista.length} lead(s) salvo(s) neste aparelho que ainda não foram enviados. ` +
              "Eles continuam guardados e sobem quando você entrar de novo. Sair mesmo?",
          )
        ) {
          e.preventDefault();
          return;
        }
        // não deixa a cópia offline das telas para o próximo usuário do aparelho
        try {
          void caches.delete("coletador-pages-v1");
        } catch {
          /* sem Cache API */
        }
      }}
    >
      <button type="submit" className="btn btn-ghost !min-h-11 !px-4 !text-base">
        Sair
      </button>
    </form>
  );
}
