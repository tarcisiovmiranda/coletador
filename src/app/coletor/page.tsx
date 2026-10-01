import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { meusLeads } from "@/lib/leads";
import { fmtCents, toCents } from "@/lib/dinheiro";
import { AppShell } from "@/components/app-shell";
import { LeadList } from "@/components/lead-list";
import { PendentesLista } from "@/components/pendentes-lista";

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

  const contratos = await prisma.contrato.findMany({
    where: { tenantId: user.tenantId, colaboradorId: user.id, status: { not: "CANCELADO" } },
    select: { status: true, comissaoValor: true },
  });
  let aprovada = 0;
  let pendente = 0;
  for (const c of contratos) {
    if (c.status === "APROVADO") aprovada += toCents(c.comissaoValor);
    else pendente += toCents(c.comissaoValor);
  }

  return (
    <AppShell user={user} title="Meus leads">
      <Link href="/coletor/novo" className="btn btn-primary mb-4 w-full !min-h-16 !text-xl">
        + Novo lead
      </Link>
      {contratos.length > 0 && (
        <div className="card mb-4 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xl font-extrabold text-emerald-700">{fmtCents(aprovada)}</p>
            <p className="text-xs font-semibold text-slate-500">Comissão aprovada</p>
          </div>
          <div>
            <p className="text-xl font-extrabold text-amber-700">{fmtCents(pendente)}</p>
            <p className="text-xs font-semibold text-slate-500">Aguardando aprovação</p>
          </div>
        </div>
      )}
      <PendentesLista userId={user.id} />
      <p className="mb-3 text-sm font-semibold text-slate-600">
        {leads.length} {leads.length === 1 ? "lead captado" : "leads captados"}
      </p>
      <LeadList leads={leads} vazio="Nenhum lead ainda. Toque em “Novo lead” para começar." />
    </AppShell>
  );
}
