import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function ColetorHome() {
  const user = await requireUser();
  return (
    <AppShell user={user} title="Meus leads">
      <div className="card text-center">
        <p className="text-lg font-semibold text-slate-800">Olá, {user.nome}!</p>
        <p className="mt-1 text-slate-600">A captação de leads (com áudio) chega na Etapa 2.</p>
      </div>
    </AppShell>
  );
}
