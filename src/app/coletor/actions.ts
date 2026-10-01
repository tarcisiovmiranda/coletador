"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ETAPA_KEYS, escopoLead, leadSchema } from "@/lib/leads";

export type LeadResult = { ok: true; id: string } | { ok: false; erro: string };

function lerCampos(formData: FormData) {
  return leadSchema.safeParse({
    nome: formData.get("nome") ?? "",
    cargo: formData.get("cargo") ?? "",
    empresa: formData.get("empresa") ?? "",
    inscricao: formData.get("inscricao") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    cnpj: formData.get("cnpj") ?? "",
    observacoes: formData.get("observacoes") ?? "",
  });
}

export async function atualizarLead(id: string, formData: FormData): Promise<LeadResult> {
  const user = await requireUser();
  const parsed = lerCampos(formData);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };

  const r = await prisma.lead.updateMany({
    where: { id, ...escopoLead(user) },
    data: parsed.data,
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
