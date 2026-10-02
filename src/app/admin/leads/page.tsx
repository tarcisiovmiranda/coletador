import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ETAPAS, ETAPA_KEYS } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { LeadList } from "@/components/lead-list";

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ colaborador?: string; etapa?: string; q?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const etapa = ETAPA_KEYS.find((k) => k === sp.etapa);
  const q = sp.q?.trim().slice(0, 80);

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
      ...(q
        ? {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { empresa: { contains: q, mode: "insensitive" } },
              { cnpj: { contains: q.replace(/\D/g, "") || "§" } },
              { whatsapp: { contains: q.replace(/\D/g, "") || "§" } },
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
  }).toString();

  return (
    <AppShell user={admin} title="Todos os leads" largo>
      <form className="card mb-4 space-y-3 lg:grid lg:grid-cols-[2fr_1.4fr_1.1fr_auto] lg:items-center lg:gap-3 lg:space-y-0">
        <input name="q" defaultValue={q} placeholder="Buscar nome, empresa, CNPJ, WhatsApp" className="field" />
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
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">
            Filtrar
          </button>
          <Link href="/admin/leads" className="btn btn-ghost">
            Limpar
          </Link>
        </div>
      </form>

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
