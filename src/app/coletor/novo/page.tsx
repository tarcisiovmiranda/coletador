import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/lead-form";

export default async function NovoLead() {
  const user = await requireUser();
  return (
    <AppShell user={user} title="Novo lead">
      <div className="card">
        <LeadForm />
      </div>
    </AppShell>
  );
}
