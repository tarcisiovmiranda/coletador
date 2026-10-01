import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { meusLeads } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { LeadList } from "@/components/lead-list";

export default async function ColetorHome() {
  const user = await requireUser();
  const leads = await prisma.lead.findMany({
    where: meusLeads(user),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nome: true,
      empresa: true,
      cargo: true,
      etapaKanban: true,
      audioKey: true,
      createdAt: true,
    },
  });

  return (
    <AppShell user={user} title="Meus leads">
      <Link href="/coletor/novo" className="btn btn-primary mb-4 w-full !min-h-16 !text-xl">
        + Novo lead
      </Link>
      <p className="mb-3 text-sm font-semibold text-slate-600">
        {leads.length} {leads.length === 1 ? "lead captado" : "leads captados"}
      </p>
      <LeadList leads={leads} vazio="Nenhum lead ainda. Toque em “Novo lead” para começar." />
    </AppShell>
  );
}
