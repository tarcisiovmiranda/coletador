import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtData } from "@/lib/leads";
import { modeloVigente } from "@/lib/contrato-modelo";
import { AppShell } from "@/components/app-shell";
import { EditorModelo } from "./editor";

export default async function ModeloContratoPage() {
  const admin = await requireAdmin();
  const atual = await modeloVigente(admin.tenantId);
  const versoes = await prisma.modeloContrato.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: { versao: "desc" },
    select: { versao: true, criadoPorNome: true, createdAt: true, _count: { select: { assinaturas: true } } },
  });
  return (
    <AppShell user={admin} title="Modelo de contrato">
      <EditorModelo titulo={atual.titulo} corpo={atual.corpo} versao={atual.versao} />
      <section className="card mt-4 lg:max-w-xl">
        <h2 className="mb-2 text-lg font-bold text-slate-900">Versões</h2>
        <ul className="space-y-1 text-slate-700">
          {versoes.map((v) => (
            <li key={v.versao}>
              Versão {v.versao} · {v.criadoPorNome ?? "—"} · {fmtData(v.createdAt)} · {v._count.assinaturas} assinatura(s)
              {v.versao === atual.versao && <strong> (vigente)</strong>}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
