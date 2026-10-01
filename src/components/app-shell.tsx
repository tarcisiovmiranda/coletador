import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/session";

export function AppShell({
  user,
  title,
  children,
}: {
  user: SessionUser;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-slate-900">{title}</h1>
          <p className="truncate text-sm text-slate-500">
            {user.nome} · {user.perfil === "ADMIN" ? "Admin" : "Coletador"}
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-ghost !min-h-11 !px-4 !text-base">
            Sair
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
