import type { SessionUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";
import { NavTabs, type NavItem } from "./nav-tabs";
import { OfflineSync } from "./offline-sync";

const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/kanban", label: "Kanban" },
  { href: "/admin/contratos", label: "Contratos" },
  { href: "/admin/equipe", label: "Equipe" },
  { href: "/admin/config", label: "Config" },
  { href: "/coletor", label: "Meus leads" },
];

const NAV_COLETADOR: NavItem[] = [
  { href: "/coletor", label: "Meus leads" },
  { href: "/coletor/kanban", label: "Kanban" },
];

/**
 * Celular: cabeçalho fixo no topo + abas roláveis (coluna única).
 * Desktop (lg, 1024px+): menu lateral fixo + conteúdo mais largo.
 * `largo` abre mais espaço no desktop (kanban, tabelas).
 */
export function AppShell({
  user,
  title,
  children,
  largo = false,
}: {
  user: SessionUser;
  title: string;
  children: React.ReactNode;
  largo?: boolean;
}) {
  const itens = user.perfil === "ADMIN" ? NAV_ADMIN : NAV_COLETADOR;
  const perfil = user.perfil === "ADMIN" ? "Admin" : "Coletador";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Menu lateral: só no desktop */}
      <aside className="hidden border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:px-4 lg:py-6">
        <div className="px-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">FISP 2026 · C93B</p>
          <p className="text-2xl font-extrabold text-slate-900">Coletador</p>
        </div>
        <NavTabs items={itens} variante="lateral" />
        <div className="mt-auto space-y-3 border-t border-slate-200 px-3 pt-4">
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">{user.nome}</p>
            <p className="text-sm text-slate-500">{perfil}</p>
          </div>
          <div className="[&_button]:w-full">
            <LogoutButton userId={user.id} />
          </div>
        </div>
      </aside>

      <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-24 lg:max-w-none lg:px-10 lg:pb-12">
        <div className={`w-full lg:mx-0 ${largo ? "lg:max-w-7xl" : "lg:max-w-5xl"}`}>
          <header className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:mb-2 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-2 lg:pt-8 lg:backdrop-blur-none">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold text-slate-900 lg:text-3xl">{title}</h1>
              <p className="truncate text-sm text-slate-500 lg:hidden">
                {user.nome} · {perfil}
              </p>
            </div>
            <div className="lg:hidden">
              <LogoutButton userId={user.id} />
            </div>
          </header>
          <div className="lg:hidden">
            <NavTabs items={itens} />
          </div>
          <div className="lg:pt-4">
            <OfflineSync userId={user.id} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
