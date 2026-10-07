import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ETAPAS, ETAPA_KEYS } from "@/lib/leads";
import { intervaloCriacao } from "@/lib/datas";
import { AppShell } from "@/components/app-shell";
import { LeadList } from "@/components/lead-list";

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ colaborador?: string; etapa?: string; q?: string; de?: string; ate?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const etapa = ETAPA_KEYS.find((k) => k === sp.etapa);
  const q = sp.q?.trim().slice(0, 80);
  const periodo = intervaloCriacao(sp.de, sp.ate);
  const criadoEm = periodo.ok ? periodo.where : undefined;

  const equipe = await prisma.colaborador.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  // só aceita colaborador que pertence ao tenant (valida o parâmetro da URL)
  const colab = equipe.find((c) => c.id === sp.colaborador)?.id;

  const leads = await prisma.lead.findMany({
    where: {
      tenantId: admin.tenantId,
      ...(colab ? { colaboradorId: colab } : {}),
      ...(etapa ? { etapaKanban: etapa } : {}),
      ...(criadoEm ? { createdAt: criadoEm } : {}),
      ...(q
        ? {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { empresa: { contains: q, mode: "insensitive" } },
              { cnpj: { contains: q.replace(/\D/g, "") || "§" } },
              { whatsapp: { contains: q.replace(/\D/g, "") || "§" } },
              { email: { contains: q, mode: "insensitive" } },
              { cpf: { contains: q.replace(/\D/g, "") || "§" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      nome: true,
      empresa: true,
      cargo: true,
      etapaKanban: true,
      audioKey: true,
      createdAt: true,
      colaborador: { select: { nome: true } },
    },
  });

  const exportQs = new URLSearchParams({
    ...(colab ? { colaborador: colab } : {}),
    ...(etapa ? { etapa } : {}),
    ...(periodo.ok && sp.de ? { de: sp.de } : {}),
    ...(periodo.ok && sp.ate ? { ate: sp.ate } : {}),
  }).toString();

  return (
    <AppShell user={admin} title="Todos os leads" largo>
      <form className="card mb-4 space-y-3 lg:grid lg:grid-cols-[2fr_1.4fr_1.1fr_auto] lg:items-center lg:gap-3 lg:space-y-0">
        <input name="q" defaultValue={q} placeholder="Buscar nome, empresa, e-mail, CPF, CNPJ, WhatsApp" className="field" />
        <select name="colaborador" defaultValue={colab ?? ""} className="field">
          <option value="">Todos os coletadores</option>
          {equipe.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select name="etapa" defaultValue={etapa ?? ""} className="field">
          <option value="">Todas as etapas</option>
          {ETAPAS.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:max-w-lg">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Criado de</span>
            <input type="date" name="de" defaultValue={sp.de ?? ""} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Até</span>
            <input type="date" name="ate" defaultValue={sp.ate ?? ""} className="field" />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">
            Filtrar
          </button>
          <Link href="/admin/leads" className="btn btn-ghost">
            Limpar
          </Link>
        </div>
      </form>

      {!periodo.ok && (
        <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-base font-medium text-amber-800">
          {periodo.erro} O filtro de datas foi ignorado.
        </p>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">
          {leads.length}
          {leads.length === 300 ? "+" : ""} {leads.length === 1 ? "lead" : "leads"}
        </p>
        <a href={`/admin/leads/export${exportQs ? `?${exportQs}` : ""}`} className="text-sm font-bold text-brand-600">
          Exportar CSV
        </a>
      </div>
      <LeadList leads={leads} vazio="Nenhum lead com esses filtros." />
    </AppShell>
  );
}
