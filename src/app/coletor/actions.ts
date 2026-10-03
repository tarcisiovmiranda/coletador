"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { removerAudio } from "@/lib/storage";
import { CAMPOS_LEAD, ETAPA_KEYS, escopoLead, validarLead } from "@/lib/leads";

export type LeadResult = { ok: true; id: string } | { ok: false; erro: string };

function lerCampos(formData: FormData) {
  return validarLead(Object.fromEntries(CAMPOS_LEAD().map((c) => [c, formData.get(c) ?? ""])));
}

export async function atualizarLead(id: string, formData: FormData): Promise<LeadResult> {
  const user = await requireUser();
  const v = lerCampos(formData);
  if (!v.ok) return { ok: false, erro: v.erros.map((e) => e.mensagem).join(" ") };

  const r = await prisma.lead.updateMany({
    where: { id, ...escopoLead(user) },
    data: v.data,
  });
  if (r.count === 0) return { ok: false, erro: "Lead não encontrado." };
  revalidatePath("/coletor");
  revalidatePath(`/coletor/leads/${id}`);
  return { ok: true, id };
}

const moverSchema = z.object({ id: z.string().min(1), etapa: z.enum(ETAPA_KEYS) });

export async function moverEtapa(formData: FormData) {
  const user = await requireUser();
  const parsed = moverSchema.safeParse({ id: formData.get("id"), etapa: formData.get("etapa") });
  if (!parsed.success) return;
  await prisma.lead.updateMany({
    where: { id: parsed.data.id, ...escopoLead(user) },
    data: { etapaKanban: parsed.data.etapa },
  });
  revalidatePath("/coletor", "layout");
  revalidatePath("/admin", "layout");
}

export type ExcluirResult = { ok: true } | { ok: false; erro: string };

/**
 * Exclui um lead (e o áudio). Só admin.
 * Lead com contrato pendente/aprovado não pode sair: cancele o contrato antes,
 * para não apagar histórico de comissão.
 */
export async function excluirLead(id: string): Promise<ExcluirResult> {
  const admin = await requireAdmin();
  const lead = await prisma.lead.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true, audioKey: true, contrato: { select: { id: true, status: true } }, _count: { select: { assinaturas: true } } },
  });
  if (!lead) return { ok: false, erro: "Lead não encontrado." };
  if (lead.contrato && lead.contrato.status !== "CANCELADO") {
    return { ok: false, erro: "Este lead tem contrato ativo. Cancele o contrato antes de excluir." };
  }
  if (lead._count.assinaturas > 0) {
    return { ok: false, erro: "Este lead tem contrato assinado, que fica guardado como comprovante. Ele não pode ser excluído." };
  }

  await prisma.$transaction([
    ...(lead.contrato ? [prisma.contrato.delete({ where: { id: lead.contrato.id } })] : []),
    prisma.lead.delete({ where: { id: lead.id } }),
  ]);
  if (lead.audioKey) await removerAudio(lead.audioKey).catch(() => {}); // melhor esforço

  revalidatePath("/coletor", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
