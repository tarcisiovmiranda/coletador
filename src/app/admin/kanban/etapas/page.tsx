import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { listarEtapas } from "@/lib/etapas";
import { AppShell } from "@/components/app-shell";
import { EditarEtapaForm, NovaEtapaForm } from "./etapa-form";
import { moverOrdemEtapa } from "./actions";

export default async function EtapasPage() {
  const admin = await requireAdmin();
  const etapas = await listarEtapas(admin.tenantId);
  const contagem = await prisma.lead.groupBy({ by: ["etapaId"], where: { tenantId: admin.tenantId }, _count: { _all: true } });
  const leadsPorEtapa = new Map(contagem.map((c) => [c.etapaId, c._count._all]));

  return (
    <AppShell user={admin} title="Etapas do kanban">
      <Link href="/admin/kanban" className="mb-4 inline-block text-sm font-bold text-brand-600">
        ← Voltar ao kanban
      </Link>
      <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-6">
          <NovaEtapaForm />
          <p className="mt-3 text-sm text-slate-500">
            A ordem daqui é a ordem das colunas no kanban. Todo lead novo entra na primeira etapa. Etapas não podem ser excluídas.
          </p>
        </div>

        <ul className="mt-6 space-y-3 lg:mt-0">
          {etapas.map((e, i) => {
            const n = leadsPorEtapa.get(e.id) ?? 0;
            return (
              <li key={e.id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`truncate rounded-full px-3 py-1 text-sm font-semibold ${e.classes}`}>{e.nome}</span>
                    {e.fechamento && (
                      <span className="shrink-0 text-xs font-semibold text-slate-500" title="O contrato aprovado move o lead para esta etapa">
                        etapa de fechamento
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {n} {n === 1 ? "lead" : "leads"}
                    </span>
                    <form action={moverOrdemEtapa}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="direcao" value="subir" />
                      <button type="submit" disabled={i === 0} aria-label={`Subir ${e.nome}`} className="btn btn-ghost !min-h-10 !px-3 disabled:opacity-40">
                        ↑
                      </button>
                    </form>
                    <form action={moverOrdemEtapa}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="direcao" value="descer" />
                      <button type="submit" disabled={i === etapas.length - 1} aria-label={`Descer ${e.nome}`} className="btn btn-ghost !min-h-10 !px-3 disabled:opacity-40">
                        ↓
                      </button>
                    </form>
                  </div>
                </div>
                <EditarEtapaForm id={e.id} nome={e.nome} cor={e.cor} />
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
