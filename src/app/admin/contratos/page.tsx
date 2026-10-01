import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { STATUS_CONTRATO } from "@/lib/contratos";
import { fmtCents, fmtPercent, toCents } from "@/lib/dinheiro";
import { fmtData } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { aprovarContrato, cancelarContrato, reabrirContrato } from "@/app/coletor/contratos/actions";

export default async function AdminContratos({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  const { status } = await searchParams;
  const filtro = (["PENDENTE", "APROVADO", "CANCELADO"] as const).find((s) => s === status);

  const where = { tenantId: admin.tenantId };
  const [contratos, todos, tenant] = await Promise.all([
    prisma.contrato.findMany({
      where: { ...where, ...(filtro ? { status: filtro } : {}) },
      orderBy: { createdAt: "desc" },
      include: { lead: { select: { id: true, nome: true, empresa: true } } },
    }),
    prisma.contrato.findMany({
      where,
      select: { colaboradorId: true, colaboradorNomeSnapshot: true, status: true, valor: true, comissaoValor: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: admin.tenantId }, select: { comissaoPercentual: true } }),
  ]);

  // totais por colaborador, em centavos inteiros
  const porColab = new Map<string, { nome: string; aprovado: number; pendente: number; vendas: number }>();
  for (const c of todos) {
    if (c.status === "CANCELADO") continue;
    const r = porColab.get(c.colaboradorId) ?? { nome: c.colaboradorNomeSnapshot, aprovado: 0, pendente: 0, vendas: 0 };
    if (c.status === "APROVADO") {
      r.aprovado += toCents(c.comissaoValor);
      r.vendas += toCents(c.valor);
    } else r.pendente += toCents(c.comissaoValor);
    porColab.set(c.colaboradorId, r);
  }
  const linhas = [...porColab.values()].sort((a, b) => b.aprovado - a.aprovado);
  const totalAprovado = linhas.reduce((s, r) => s + r.aprovado, 0);
  const totalVendas = linhas.reduce((s, r) => s + r.vendas, 0);
  const totalPendente = linhas.reduce((s, r) => s + r.pendente, 0);
  const pct = Number(tenant.comissaoPercentual.toString());

  return (
    <AppShell user={admin} title="Contratos">
      {pct === 0 && (
        <Link href="/admin/config" className="mb-4 block rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-800">
          O percentual de comissão está em 0%. Toque aqui para definir.
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={fmtCents(totalVendas)} rotulo="Vendas aprovadas" />
        <Kpi valor={fmtCents(totalAprovado)} rotulo="Comissão a pagar" />
        <Kpi valor={fmtCents(totalPendente)} rotulo="Comissão pendente" />
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold text-slate-900">Comissão por coletador</h2>
      <div className="card space-y-2">
        {linhas.length === 0 && <p className="text-slate-500">Nenhum contrato ainda.</p>}
        {linhas.map((r) => (
          <div key={r.nome} className="flex items-baseline justify-between gap-3">
            <span className="truncate font-semibold text-slate-800">{r.nome}</span>
            <span className="shrink-0 text-right text-sm">
              <span className="font-bold text-slate-900">{fmtCents(r.aprovado)}</span>
              {r.pendente > 0 && <span className="text-amber-700"> +{fmtCents(r.pendente)} pend.</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto">
          <Chip href="/admin/contratos" ativo={!filtro} texto="Todos" />
          <Chip href="/admin/contratos?status=PENDENTE" ativo={filtro === "PENDENTE"} texto="Pendentes" />
          <Chip href="/admin/contratos?status=APROVADO" ativo={filtro === "APROVADO"} texto="Aprovados" />
          <Chip href="/admin/contratos?status=CANCELADO" ativo={filtro === "CANCELADO"} texto="Cancelados" />
        </div>
        <a href="/admin/contratos/export" className="shrink-0 text-sm font-bold text-brand-600">
          CSV
        </a>
      </div>

      <ul className="space-y-3">
        {contratos.length === 0 && <li className="card text-center text-slate-500">Nenhum contrato aqui.</li>}
        {contratos.map((c) => {
          const st = STATUS_CONTRATO[c.status];
          return (
            <li key={c.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/coletor/leads/${c.lead.id}`} className="block truncate text-lg font-bold text-slate-900">
                    {c.lead.nome}
                  </Link>
                  <p className="truncate text-sm text-slate-500">
                    {[c.lead.empresa, c.colaboradorNomeSnapshot].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${st.cor}`}>{st.label}</span>
              </div>
              <p className="text-slate-800">
                {c.plano} · <span className="font-bold">{fmtCents(toCents(c.valor))}</span> · {c.pagamento}
              </p>
              <p className="text-sm text-slate-600">
                Comissão ({fmtPercent(c.comissaoPercentual ?? 0)}):{" "}
                <span className="font-bold">{fmtCents(toCents(c.comissaoValor))}</span> · criado em {fmtData(c.createdAt)}
              </p>
              {c.aprovadoEm && (
                <p className="text-xs text-slate-500">
                  Aprovado por {c.aprovadoPorNome} em {fmtData(c.aprovadoEm)}
                </p>
              )}
              <div className="grid gap-2 pt-1">
                {c.status === "PENDENTE" && <Acao action={aprovarContrato} id={c.id} texto="Aprovar" classe="btn-primary" />}
                {c.status !== "CANCELADO" && <Acao action={cancelarContrato} id={c.id} texto="Cancelar" classe="btn-danger" />}
                {c.status === "CANCELADO" && <Acao action={reabrirContrato} id={c.id} texto="Reabrir" classe="btn-ghost" />}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}

function Kpi({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="card text-center !p-3">
      <p className="text-base font-extrabold leading-tight text-slate-900 sm:text-xl">{valor}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{rotulo}</p>
    </div>
  );
}

function Chip({ href, ativo, texto }: { href: string; ativo: boolean; texto: string }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${ativo ? "bg-brand-600 text-white" : "bg-white text-slate-700 shadow-sm"}`}
    >
      {texto}
    </Link>
  );
}

function Acao({
  action,
  id,
  texto,
  classe,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  texto: string;
  classe: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`btn w-full ${classe}`}>
        {texto}
      </button>
    </form>
  );
}
