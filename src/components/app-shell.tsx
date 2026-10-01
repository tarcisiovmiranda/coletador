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
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-slate-900">{title}</h1>
          <p className="truncate text-sm text-slate-500">
            {user.nome} · {user.perfil === "ADMIN" ? "Admin" : "Coletador"}
          </p>
        </div>
        <LogoutButton userId={user.id} />
      </header>
      <NavTabs items={user.perfil === "ADMIN" ? NAV_ADMIN : NAV_COLETADOR} />
      <OfflineSync userId={user.id} />
      {children}
    </div>
  );
}
