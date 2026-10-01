import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { homePorPerfil } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? homePorPerfil(user.perfil) : "/login");
}
