"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { gerarCodigo, hashCodigo } from "@/lib/codigo";

export type CriarState = {
  erro?: string;
  criado?: { nome: string; codigo: string };
};

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(80),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "WhatsApp inválido."),
  perfil: z.enum(["COLETADOR", "ADMIN"]),
});

export async function criarColaborador(_: CriarState, formData: FormData): Promise<CriarState> {
  const admin = await requireAdmin(); // tenant vem da sessão, nunca do formulário
  const parsed = schema.safeParse({
    nome: formData.get("nome"),
    whatsapp: formData.get("whatsapp") ?? "",
    perfil: formData.get("perfil") ?? "COLETADOR",
  });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo();
    try {
      await prisma.colaborador.create({
        data: {
          tenantId: admin.tenantId,
          nome: parsed.data.nome,
          whatsapp: parsed.data.whatsapp || null,
          perfil: parsed.data.perfil,
          codigoHash: hashCodigo(codigo),
        },
      });
      revalidatePath("/admin/equipe");
      return { criado: { nome: parsed.data.nome, codigo } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { erro: "Não foi possível gerar um código único. Tente de novo." };
}

async function alterarAtivo(formData: FormData, ativo: boolean) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!ativo && id === admin.id) return; // admin não desativa a si mesmo
  await prisma.colaborador.updateMany({
    where: { id, tenantId: admin.tenantId },
    data: { ativo },
  });
  revalidatePath("/admin/equipe");
}

export async function desativarColaborador(formData: FormData) {
  await alterarAtivo(formData, false);
}

export async function reativarColaborador(formData: FormData) {
  await alterarAtivo(formData, true);
}
