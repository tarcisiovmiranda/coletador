"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { garantirEtapas } from "@/lib/etapas";
import { CORES_KEYS, reordenar } from "@/lib/etapas-cores";

export type EtapaState = { erro?: string; ok?: string };

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da etapa.").max(30, "O nome pode ter até 30 caracteres."),
  cor: z.enum(CORES_KEYS, { message: "Escolha uma cor da lista." }),
});

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/coletor", "layout");
}

/** Nome repetido no tenant (sem diferenciar maiúsculas), ignorando a própria etapa ao editar. */
async function nomeEmUso(tenantId: string, nome: string, ignorarId?: string) {
  const outra = await prisma.etapa.findFirst({
    where: { tenantId, nome: { equals: nome, mode: "insensitive" }, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true },
  });
  return outra !== null;
}

export async function criarEtapa(_: EtapaState, formData: FormData): Promise<EtapaState> {
  const admin = await requireAdmin(); // tenant vem da sessão, nunca do formulário
  const p = schema.safeParse({ nome: formData.get("nome"), cor: formData.get("cor") });
  if (!p.success) return { erro: p.error.issues[0].message };
  await garantirEtapas(admin.tenantId);
  if (await nomeEmUso(admin.tenantId, p.data.nome)) return { erro: "Já existe uma etapa com esse nome." };

  const ultima = await prisma.etapa.aggregate({ where: { tenantId: admin.tenantId }, _max: { ordem: true } });
  await prisma.etapa.create({
    data: { tenantId: admin.tenantId, nome: p.data.nome, cor: p.data.cor, ordem: (ultima._max.ordem ?? -1) + 1 },
  });
  revalidar();
  return { ok: `Etapa “${p.data.nome}” criada.` };
}

export async function editarEtapa(_: EtapaState, formData: FormData): Promise<EtapaState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const p = schema.safeParse({ nome: formData.get("nome"), cor: formData.get("cor") });
  if (!id) return { erro: "Etapa inválida." };
  if (!p.success) return { erro: p.error.issues[0].message };
  if (await nomeEmUso(admin.tenantId, p.data.nome, id)) return { erro: "Já existe uma etapa com esse nome." };

  const r = await prisma.etapa.updateMany({
    where: { id, tenantId: admin.tenantId },
    data: { nome: p.data.nome, cor: p.data.cor },
  });
  if (r.count === 0) return { erro: "Etapa não encontrada." };
  revalidar();
  return { ok: "Salvo." };
}

export async function moverOrdemEtapa(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const direcao = formData.get("direcao");
  if (!id || (direcao !== "subir" && direcao !== "descer")) return;

  const atuais = await prisma.etapa.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const ids = atuais.map((e) => e.id);
  const novos = reordenar(ids, id, direcao);
  if (novos.every((v, i) => v === ids[i])) return;
  // renumera todas (0..n-1): corrige também ordens repetidas ou com buracos
  await prisma.$transaction(
    novos.map((etapaId, ordem) => prisma.etapa.updateMany({ where: { id: etapaId, tenantId: admin.tenantId }, data: { ordem } })),
  );
  revalidar();
}
