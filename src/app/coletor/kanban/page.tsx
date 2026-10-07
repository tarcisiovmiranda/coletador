import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { meusLeads } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { listarEtapas } from "@/lib/etapas";
import { KanbanBoard } from "@/components/kanban-board";

export default async function ColetorKanban() {
  const user = await requireUser();
  const etapas = await listarEtapas(user.tenantId);
  const leads = await prisma.lead.findMany({
    where: meusLeads(user),
    orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, empresa: true, etapaId: true, createdAt: true },
  });
  return (
    <AppShell user={user} title="Kanban" largo>
      <KanbanBoard etapas={etapas} leads={leads} />
    </AppShell>
  );
}
