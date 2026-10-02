import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard } from "@/components/kanban-board";

export default async function AdminKanban() {
  const admin = await requireAdmin();
  const leads = await prisma.lead.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nome: true,
      empresa: true,
      etapaKanban: true,
      createdAt: true,
      colaborador: { select: { nome: true } },
    },
  });
  return (
    <AppShell user={admin} title="Kanban geral" largo>
      <KanbanBoard leads={leads.map((l) => ({ ...l, colaborador: l.colaborador.nome }))} />
    </AppShell>
  );
}
