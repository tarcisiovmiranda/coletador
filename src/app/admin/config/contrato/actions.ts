"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { modeloVigente, validarModelo } from "@/lib/contrato-modelo";

export type ModeloState = { erro?: string; ok?: string };

export async function salvarModelo(_prev: ModeloState, fd: FormData): Promise<ModeloState> {
  const admin = await requireAdmin();
  const titulo = String(fd.get("titulo") ?? "").trim();
  const corpo = String(fd.get("corpo") ?? "").replace(/\r\n?/g, "\n");
  const erro = validarModelo(titulo, corpo);
  if (erro) return { erro };

  const atual = await modeloVigente(admin.tenantId);
  if (atual.titulo === titulo && atual.corpo === corpo) return { ok: "Nada mudou: o texto é igual à versão atual." };

  try {
    const novo = await prisma.modeloContrato.create({
      data: { tenantId: admin.tenantId, versao: atual.versao + 1, titulo, corpo, criadoPorNome: admin.nome },
    });
    revalidatePath("/admin/config/contrato");
    return { ok: `Versão ${novo.versao} salva. Novas assinaturas já usam este texto.` };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { erro: "Outra pessoa salvou uma versão agora. Recarregue a página e tente de novo." };
    }
    throw e;
  }
}
