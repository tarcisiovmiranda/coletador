import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { listarEtapas } from "@/lib/etapas";
import { KanbanBoard } from "@/components/kanban-board";

export default async function AdminKanban() {
  const admin = await requireAdmin();
  const etapas = await listarEtapas(admin.tenantId);
  const leads = await prisma.lead.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nome: true,
      empresa: true,
      etapaId: true,
      createdAt: true,
      colaborador: { select: { nome: true } },
    },
  });
  return (
    <AppShell user={admin} title="Kanban geral" largo>
      <Link href="/admin/kanban/etapas" className="btn btn-ghost mb-4 w-full sm:w-auto">
        Gerenciar etapas
      </Link>
      <KanbanBoard etapas={etapas} leads={leads.map((l) => ({ ...l, colaborador: l.colaborador.nome }))} />
    </AppShell>
  );
}
