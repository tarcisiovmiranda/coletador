import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { escopoLead, etapaInfo, fmtCnpj, fmtData, fmtWhats, linkWhats } from "@/lib/leads";
import { storageConfigurado } from "@/lib/storage";
import { AppShell } from "@/components/app-shell";
import { ContratoCard } from "@/components/contrato-card";

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audio?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { audio: erroAudio } = await searchParams;

  // escopo: coletador só abre lead próprio; admin abre qualquer lead do tenant
  const lead = await prisma.lead.findFirst({
    where: { id, ...escopoLead(user) },
    include: { colaborador: { select: { nome: true } }, contrato: true },
  });
  if (!lead) notFound();

  const e = etapaInfo(lead.etapaKanban);

  return (
    <AppShell user={user} title={lead.nome}>
      {erroAudio && (
        <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-4 py-3 font-medium text-amber-800">
          Lead salvo, mas o áudio não foi enviado: {erroAudio.replace(/\.$/, "")}. Toque em “Editar” para gravar de novo.
        </p>
      )}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${e.cor}`}>{e.label}</span>
          <span className="text-sm text-slate-500">
            {fmtData(lead.createdAt)} · {lead.colaborador.nome}
          </span>
        </div>
        <Linha rotulo="Empresa" valor={lead.empresa} />
        <Linha rotulo="Cargo" valor={lead.cargo} />
        <Linha rotulo="CNPJ" valor={fmtCnpj(lead.cnpj)} />
        <Linha rotulo="Inscrição" valor={lead.inscricao} />
        <Linha rotulo="WhatsApp" valor={fmtWhats(lead.whatsapp)} />
        <Linha rotulo="Observações" valor={lead.observacoes} />

        {lead.audioKey && storageConfigurado() && (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Áudio</p>
            <audio controls preload="none" src={`/api/leads/${lead.id}/audio`} className="w-full" />
          </div>
        )}
      </div>

      <div className="mt-4">
        <ContratoCard leadId={lead.id} contrato={lead.contrato} />
      </div>

      <div className="mt-4 space-y-3">
        {lead.whatsapp && (
          <a href={linkWhats(lead.whatsapp)} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
            Abrir WhatsApp
          </a>
        )}
        <Link href={`/coletor/leads/${lead.id}/editar`} className="btn btn-ghost w-full">
          Editar
        </Link>
        <Link href="/coletor" className="btn btn-ghost w-full">
          Voltar
        </Link>
      </div>
    </AppShell>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="whitespace-pre-wrap break-words text-lg text-slate-900">{valor}</p>
    </div>
  );
}
