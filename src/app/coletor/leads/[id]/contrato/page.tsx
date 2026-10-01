import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { escopoLead } from "@/lib/leads";
import { fmtCents, toCents } from "@/lib/dinheiro";
import { AppShell } from "@/components/app-shell";
import { ContratoForm } from "@/components/contrato-form";

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, ...escopoLead(user) },
    select: { id: true, nome: true, empresa: true, contrato: true },
  });
  if (!lead) notFound();

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: user.tenantId },
    select: { comissaoPercentual: true },
  });
  const bps = Math.round(Number(tenant.comissaoPercentual.toString()) * 100);

  const c = lead.contrato;
  const decidido = c && c.status !== "PENDENTE";

  return (
    <AppShell user={user} title={c ? "Editar contrato" : "Novo contrato"}>
      <p className="mb-3 text-slate-600">
        Lead: <span className="font-bold text-slate-900">{lead.nome}</span>
        {lead.empresa ? ` · ${lead.empresa}` : ""}
      </p>
      <div className="card">
        {decidido ? (
          <p className="font-medium text-slate-700">
            Este contrato já foi {c.status === "APROVADO" ? "aprovado" : "cancelado"} e não pode ser
            editado. Peça ao admin para reabrir.
          </p>
        ) : (
          <ContratoForm
            leadId={lead.id}
            percentualBps={bps}
            inicial={
              c
                ? { plano: c.plano, valor: fmtCents(toCents(c.valor)).replace(/ /g, " "), pagamento: c.pagamento }
                : undefined
            }
          />
        )}
      </div>
      <Link href={`/coletor/leads/${lead.id}`} className="btn btn-ghost mt-4 w-full">
        Voltar
      </Link>
    </AppShell>
  );
}
