import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ETAPAS } from "@/lib/leads";
import { fmtCents, toCents } from "@/lib/dinheiro";
import { AppShell } from "@/components/app-shell";

// Brasil não tem horário de verão desde 2019: BRT = UTC-3 fixo.
const BRT_MS = 3 * 60 * 60 * 1000;
const inicioDoDiaBRT = (d: Date) => {
  const local = new Date(d.getTime() - BRT_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + BRT_MS);
};
const rotuloDia = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(d);

export default async function AdminPainel() {
  const admin = await requireAdmin();
  const where = { tenantId: admin.tenantId };

  const hoje = inicioDoDiaBRT(new Date());
  const seteDias = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [total, hojeCount, comAudio, porEtapa, porColab, equipe, recentes, contratos] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, createdAt: { gte: hoje } } }),
    prisma.lead.count({ where: { ...where, audioKey: { not: null } } }),
    prisma.lead.groupBy({ by: ["etapaKanban"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["colaboradorId"], where, _count: { _all: true } }),
    prisma.colaborador.findMany({ where, select: { id: true, nome: true, ativo: true } }),
    prisma.lead.findMany({ where: { ...where, createdAt: { gte: seteDias } }, select: { createdAt: true } }),
    prisma.contrato.findMany({ where, select: { status: true, valor: true, comissaoValor: true, pagamentoComissao: { select: { status: true } } } }),
  ]);

  let vendas = 0;
  let comissaoAprovada = 0;
  let pendentes = 0;
  for (const c of contratos) {
    if (c.status === "APROVADO") {
      vendas += toCents(c.valor);
      const pg = c.pagamentoComissao?.status;
      if (!pg || pg === "FALHOU") comissaoAprovada += toCents(c.comissaoValor); // só o que ainda falta pagar
    } else if (c.status === "PENDENTE") pendentes += 1;
  }

  const etapaCount = new Map(porEtapa.map((e) => [e.etapaKanban, e._count._all]));
  const nomes = new Map(equipe.map((c) => [c.id, c]));
  const ranking = porColab
    .map((r) => ({ nome: nomes.get(r.colaboradorId)?.nome ?? "—", n: r._count._all }))
    .sort((a, b) => b.n - a.n);
  const maxRank = Math.max(1, ...ranking.map((r) => r.n));

  const dias = Array.from({ length: 7 }, (_, i) => new Date(hoje.getTime() - (6 - i) * 86400000));
  const porDia = dias.map((d) => ({
    rotulo: rotuloDia(d),
    n: recentes.filter((l) => l.createdAt >= d && l.createdAt < new Date(d.getTime() + 86400000)).length,
  }));
  const maxDia = Math.max(1, ...porDia.map((d) => d.n));

  return (
    <AppShell user={admin} title="Painel">
      <div className="lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Kpi valor={total} rotulo="Leads" />
        <Kpi valor={hojeCount} rotulo="Hoje" />
        <Kpi valor={comAudio} rotulo="Com áudio" />
      </div>

      <Link href="/admin/contratos" className="card mt-3 block lg:mt-0">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-extrabold text-slate-900">{fmtCents(vendas)}</p>
            <p className="text-xs font-semibold text-slate-500">Vendas aprovadas</p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-slate-900">{fmtCents(comissaoAprovada)}</p>
            <p className="text-xs font-semibold text-slate-500">Comissão a pagar</p>
          </div>
          <div>
            <p className={`text-lg font-extrabold ${pendentes ? "text-amber-700" : "text-slate-900"}`}>{pendentes}</p>
            <p className="text-xs font-semibold text-slate-500">Para aprovar</p>
          </div>
        </div>
      </Link>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold text-slate-900">Funil</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ETAPAS.map((e) => (
          <div key={e.key} className={`rounded-2xl px-4 py-3 ${e.cor}`}>
            <p className="text-2xl font-extrabold">{etapaCount.get(e.key) ?? 0}</p>
            <p className="text-sm font-semibold">{e.label}</p>
          </div>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
      <div>
      <h2 className="mb-2 mt-6 text-lg font-bold text-slate-900">Ranking de coletadores</h2>
      <div className="card space-y-3">
        {ranking.length === 0 && <p className="text-slate-500">Ainda sem leads.</p>}
        {ranking.map((r, i) => (
          <div key={r.nome + i}>
            <div className="flex justify-between text-base font-semibold text-slate-800">
              <span className="truncate">
                {i + 1}. {r.nome}
              </span>
              <span>{r.n}</span>
            </div>
            <div className="mt-1 h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-brand-500" style={{ width: `${(r.n / maxRank) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      </div>

      <div>
      <h2 className="mb-2 mt-6 text-lg font-bold text-slate-900">Últimos 7 dias</h2>
      <div className="card flex h-44 items-end gap-2">
        {porDia.map((d) => (
          <div key={d.rotulo} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-sm font-bold text-slate-700">{d.n}</span>
            <div className="w-full rounded-t-lg bg-brand-500" style={{ height: `${Math.max(4, (d.n / maxDia) * 100)}px` }} />
            <span className="text-[11px] text-slate-500">{d.rotulo}</span>
          </div>
        ))}
      </div>

      </div>
      </div>

      <div className="mt-6 grid gap-3 lg:max-w-xl lg:grid-cols-2">
        <Link href="/admin/leads" className="btn btn-ghost w-full">
          Ver todos os leads
        </Link>
        <a href="/admin/leads/export" className="btn btn-primary w-full">
          Exportar CSV
        </a>
      </div>
    </AppShell>
  );
}

function Kpi({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-extrabold text-slate-900">{valor}</p>
      <p className="text-sm font-semibold text-slate-500">{rotulo}</p>
    </div>
  );
}
