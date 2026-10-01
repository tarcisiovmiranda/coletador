import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

export function homePorPerfil(perfil: SessionUser["perfil"]) {
  return perfil === "ADMIN" ? "/admin" : "/coletor";
}

/** Exige sessão válida. Use no topo de toda página/ação protegida. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige perfil ADMIN; coletador logado é mandado para a própria área. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.perfil !== "ADMIN") redirect(homePorPerfil(user.perfil));
  return user;
}
