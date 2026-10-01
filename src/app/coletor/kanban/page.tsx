import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { meusLeads } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard } from "@/components/kanban-board";

export default async function ColetorKanban() {
  const user = await requireUser();
  const leads = await prisma.lead.findMany({
    where: meusLeads(user),
    orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, empresa: true, etapaKanban: true, createdAt: true },
  });
  return (
    <AppShell user={user} title="Kanban">
      <KanbanBoard leads={leads} />
    </AppShell>
  );
}
