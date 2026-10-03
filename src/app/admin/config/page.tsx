import Link from "next/link";
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
      <Link href="/admin/config/contrato" className="card mt-4 block lg:max-w-xl">
        <h2 className="text-lg font-bold text-slate-900">Modelo de contrato</h2>
        <p className="text-sm text-slate-600">Editar o texto que o cliente assina no estande.</p>
      </Link>
    </AppShell>
  );
}
