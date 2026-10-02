import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { escopoLead, isoNascimento } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/lead-form";
import { valoresDoLead } from "@/lib/lead-valores";

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
          inicial={valoresDoLead({ ...lead, dataNascimento: isoNascimento(lead.dataNascimento) })}
        />
      </div>
    </AppShell>
  );
}
