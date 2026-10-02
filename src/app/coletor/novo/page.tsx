import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/lead-form";

export default async function NovoLead() {
  const user = await requireUser();
  return (
    <AppShell user={user} title="Novo lead">
      <div className="card lg:max-w-3xl">
        <LeadForm userId={user.id} />
      </div>
    </AppShell>
  );
}
