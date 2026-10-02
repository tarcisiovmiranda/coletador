import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { escopoLead } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/lead-form";

export default async function EditarLead({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...escopoLead(user) } });
  if (!lead) notFound();

  return (
    <AppShell user={user} title="Editar lead">
      <div className="card lg:max-w-3xl">
        <LeadForm
          leadId={lead.id}
          inicial={{
            nome: lead.nome,
            cargo: lead.cargo ?? "",
            empresa: lead.empresa ?? "",
            inscricao: lead.inscricao ?? "",
            whatsapp: lead.whatsapp ?? "",
            cnpj: lead.cnpj ?? "",
            observacoes: lead.observacoes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
