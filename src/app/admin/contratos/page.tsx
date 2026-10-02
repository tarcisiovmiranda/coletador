import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { STATUS_CONTRATO } from "@/lib/contratos";
import { fmtCents, fmtPercent, toCents } from "@/lib/dinheiro";
import { fmtData } from "@/lib/leads";
import { asaasConfigurado, asaasEmProducao } from "@/lib/asaas";
import { PIX_TIPOS, mascararChave } from "@/lib/pix";
import { AppShell } from "@/components/app-shell";
import { PagarPix } from "@/components/pagar-pix";
import { PagamentoAcoes } from "@/components/pagamento-acoes";
import { aprovarContrato, cancelarContrato, reabrirContrato } from "@/app/coletor/contratos/actions";

const STATUS_PAGAMENTO = {
  PROCESSANDO: { label: "Processando", cor: "bg-sky-100 text-sky-800" },
  CONCLUIDO: { label: "Pago", cor: "bg-emerald-100 text-emerald-800" },
  FALHOU: { label: "Falhou", cor: "bg-red-100 text-red-800" },
  VERIFICAR: { label: "Verificar", cor: "bg-amber-100 text-amber-800" },
} as const;

type Linha = { id: string; nome: string; aPagar: number; emPagamento: number; pago: number; pendente: number; vendas: number };

export default async function AdminContratos({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  const { status } = await searchParams;
  const filtro = (["PENDENTE", "APROVADO", "CANCELADO"] as const).find((s) => s === status);

  const where = { tenantId: admin.tenantId };
  const [contratos, todos, tenant, pagamentos] = await Promise.all([
    prisma.contrato.findMany({
      where: { ...where, ...(filtro ? { status: filtro } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, nome: true, empresa: true } },
        pagamentoComissao: { select: { status: true, concluidoEm: true } },
      },
    }),
    prisma.contrato.findMany({
      where,
      select: {
        colaboradorId: true,
        colaboradorNomeSnapshot: true,
        status: true,
        valor: true,
        comissaoValor: true,
        pagamentoComissao: { select: { status: true } },
      },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: admin.tenantId }, select: { comissaoPercentual: true } }),
    prisma.pagamentoComissao.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // totais por colaborador, em centavos inteiros
  const porColab = new Map<string, Linha>();
  for (const c of todos) {
    if (c.status === "CANCELADO") continue;
    const r = porColab.get(c.colaboradorId) ?? {
      id: c.colaboradorId,
      nome: c.colaboradorNomeSnapshot,
      aPagar: 0,
      emPagamento: 0,
      pago: 0,
      pendente: 0,
      vendas: 0,
    };
    const cents = toCents(c.comissaoValor);
    if (c.status === "APROVADO") {
      r.vendas += toCents(c.valor);
      const p = c.pagamentoComissao?.status;
      if (!p || p === "FALHOU") r.aPagar += cents;
      else if (p === "CONCLUIDO") r.pago += cents;
      else r.emPagamento += cents;
    } else r.pendente += cents;
    porColab.set(c.colaboradorId, r);
  }
  const linhas = [...porColab.values()].sort((a, b) => b.aPagar - a.aPagar);
  const soma = (k: keyof Omit<Linha, "id" | "nome">) => linhas.reduce((s, r) => s + r[k], 0);
  const pct = Number(tenant.comissaoPercentual.toString());

  const pixConfigurado = asaasConfigurado();
  const teste = !asaasEmProducao();
  const chaves = new Map(
    (
      await prisma.colaborador.findMany({
        where: { tenantId: admin.tenantId, id: { in: linhas.map((l) => l.id) } },
        select: { id: true, pixChave: true, pixTipo: true },
      })
    ).map((c) => [c.id, c]),
  );

  return (
    <AppShell user={admin} title="Contratos" largo>
      {pct === 0 && (
        <Link href="/admin/config" className="mb-4 block rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-800">
          O percentual de comissão está em 0%. Toque aqui para definir.
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi valor={fmtCents(soma("vendas"))} rotulo="Vendas aprovadas" />
        <Kpi valor={fmtCents(soma("aPagar"))} rotulo="Comissão a pagar" />
        <Kpi valor={fmtCents(soma("pago"))} rotulo="Comissão já paga" />
        <Kpi valor={fmtCents(soma("pendente"))} rotulo="Comissão pendente" />
      </div>

      <div className="mb-2 mt-6 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-slate-900">Comissão por coletador</h2>
        {pixConfigured(pixConfigurado, teste)}
      </div>
      <div className="card divide-y divide-slate-100 !p-0">
        {linhas.length === 0 && <p className="p-4 text-slate-500">Nenhum contrato ainda.</p>}
        {linhas.map((r) => {
          const ch = chaves.get(r.id);
          const tipoLabel = PIX_TIPOS.find((t) => t.key === ch?.pixTipo)?.label ?? "";
          return (
            <div key={r.id} className="space-y-2 p-4 lg:flex lg:items-center lg:justify-between lg:gap-6 lg:space-y-0">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-slate-900">{r.nome}</p>
                <p className="text-sm text-slate-600">
                  A pagar <span className="font-bold text-slate-900">{fmtCents(r.aPagar)}</span>
                  {r.emPagamento > 0 && <span className="text-sky-700"> · em pagamento {fmtCents(r.emPagamento)}</span>}
                  {r.pago > 0 && <span className="text-emerald-700"> · pago {fmtCents(r.pago)}</span>}
                  {r.pendente > 0 && <span className="text-amber-700"> · pendente {fmtCents(r.pendente)}</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {ch?.pixChave && ch.pixTipo ? (
                    <>
                      Pix ({tipoLabel}): {mascararChave(ch.pixTipo, ch.pixChave)}
                    </>
                  ) : (
                    <Link href="/admin/equipe" className="font-semibold text-amber-700 underline">
                      Sem chave Pix: cadastrar em Equipe
                    </Link>
                  )}
                </p>
              </div>
              {pixConfigurado && r.aPagar > 0 && ch?.pixChave && ch.pixTipo && (
                <div className="lg:shrink-0">
                  <PagarPix
                    colaboradorId={r.id}
                    nome={r.nome}
                    valor={fmtCents(r.aPagar)}
                    tipo={tipoLabel}
                    chave={mascararChave(ch.pixTipo, ch.pixChave)}
                    teste={teste}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pagamentos.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-lg font-bold text-slate-900">Pagamentos de comissão</h2>
          <ul className="grid gap-3 xl:grid-cols-2">
            {pagamentos.map((p) => {
              const st = STATUS_PAGAMENTO[p.status];
              return (
                <li key={p.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-900">
                        {fmtCents(toCents(p.valor))} · {p.colaboradorNomeSnapshot}
                      </p>
                      <p className="text-sm text-slate-500">
                        {fmtData(p.createdAt)} · por {p.criadoPorNome}
                        {p.concluidoEm ? ` · pago em ${fmtData(p.concluidoEm)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${st.cor}`}>{st.label}</span>
                  </div>
                  {p.erro && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{p.erro}</p>}
                  {p.comprovanteUrl && (
                    <a href={p.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-600">
                      Ver comprovante
                    </a>
                  )}
                  {(p.status === "PROCESSANDO" || p.status === "VERIFICAR") && (
                    <PagamentoAcoes id={p.id} status={p.status} nome={p.colaboradorNomeSnapshot} valor={fmtCents(toCents(p.valor))} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

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

      <ul className="grid gap-3 xl:grid-cols-2">
        {contratos.length === 0 && <li className="card text-center text-slate-500">Nenhum contrato aqui.</li>}
        {contratos.map((c) => {
          const st = STATUS_CONTRATO[c.status];
          const pg = c.pagamentoComissao?.status;
          const comissaoPaga = pg === "CONCLUIDO";
          const emPagamento = pg === "PROCESSANDO" || pg === "VERIFICAR";
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
              {(comissaoPaga || emPagamento) && (
                <p className={`text-sm font-semibold ${comissaoPaga ? "text-emerald-700" : "text-sky-700"}`}>
                  {comissaoPaga ? "Comissão paga por Pix" : "Pagamento da comissão em andamento"}
                </p>
              )}
              <div className="grid gap-2 pt-1 lg:flex lg:flex-wrap">
                {c.status === "PENDENTE" && <Acao action={aprovarContrato} id={c.id} texto="Aprovar" classe="btn-primary" />}
                {c.status !== "CANCELADO" && !c.pagamentoId && (
                  <Acao action={cancelarContrato} id={c.id} texto="Cancelar" classe="btn-danger" />
                )}
                {c.status === "CANCELADO" && <Acao action={reabrirContrato} id={c.id} texto="Reabrir" classe="btn-ghost" />}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}

function pixConfigured(configurado: boolean, teste: boolean) {
  if (!configurado) {
    return <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">Pix não configurado</span>;
  }
  return teste ? (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pix em TESTE (sem dinheiro real)</span>
  ) : (
    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">Pix em PRODUÇÃO (dinheiro real)</span>
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
      <button type="submit" className={`btn w-full lg:w-auto lg:px-8 ${classe}`}>
        {texto}
      </button>
    </form>
  );
}
