import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ComissaoForm } from "./comissao-form";

export default async function ConfigPage() {
  const admin = await requireAdmin();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: admin.tenantId },
    select: { comissaoPercentual: true },
  });
  const atual = Number(tenant.comissaoPercentual.toString()).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
  return (
    <AppShell user={admin} title="Configurações">
      <ComissaoForm atual={atual} />
    </AppShell>
  );
}
