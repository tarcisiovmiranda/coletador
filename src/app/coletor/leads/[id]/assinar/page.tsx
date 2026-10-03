import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { escopoLead, linkWhats } from "@/lib/leads";
import { AppShell } from "@/components/app-shell";
import { modeloVigente } from "@/lib/contrato-modelo";
import { agora, docLead, limiteDoDia, montarValores } from "@/lib/contrato-campos";
import { AssinarForm } from "./assinar-form";

export default async function AssinarPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, ...escopoLead(user) } });
  if (!lead) notFound();

  const faltando = [!lead.email && "e-mail", !docLead(lead) && "CPF ou CNPJ", !lead.endereco && "endereço"].filter(Boolean) as string[];
  if (faltando.length) {
    return (
      <AppShell user={user} title="Contrato para assinar">
        <div className="card space-y-3 lg:max-w-xl">
          <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 font-medium text-amber-800">
            Faltam dados do lead para o contrato: {faltando.join(", ")}.
          </p>
          <Link href={`/coletor/leads/${lead.id}/editar`} className="btn btn-primary w-full">
            Completar cadastro
          </Link>
        </div>
      </AppShell>
    );
  }

  const modelo = await modeloVigente(user.tenantId);
  const quando = agora();
  const limiteAuto = limiteDoDia(quando);
  const valores = montarValores(
    lead,
    { mensalidadeCents: 0, plano: "", vencimento: 0, medicoTrabalho: false, limiteVidas: limiteAuto ?? 0 },
    user.nome,
    quando,
  );
  // só os dados do lead seguem para o navegador; o texto final é montado no servidor ao assinar
  const dadosLead = {
    nome: valores.nome, documento: valores.documento, email: valores.email, whatsapp: valores.whatsapp,
    endereco_completo: valores.endereco_completo, empresa: valores.empresa, cargo: valores.cargo,
    coletor: valores.coletor, data: valores.data, local: valores.local,
  };

  return (
    <AppShell user={user} title="Contrato para assinar">
      <AssinarForm
        leadId={lead.id}
        modelo={{ corpo: modelo.corpo, titulo: modelo.titulo, versao: modelo.versao }}
        dadosLead={dadosLead}
        limiteAuto={limiteAuto}
        documentoInicial={docLead(lead)}
        nomeInicial={lead.nome}
        linkWhatsApp={lead.whatsapp ? linkWhats(lead.whatsapp, lead.whatsappDdi) : null}
      />
    </AppShell>
  );
}
