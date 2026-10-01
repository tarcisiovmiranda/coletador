"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashCodigo, normalizarCodigo } from "@/lib/codigo";
import { TENANT_SLUG } from "@/lib/env";
import { criarSessao, encerrarSessao } from "@/lib/session";
import { homePorPerfil } from "@/lib/auth";

export type LoginState = { erro?: string };

// Freio básico contra tentativa em massa (por instância; reforçar na Etapa 2 com Redis/DB).
const tentativas = new Map<string, { n: number; ate: number }>();
const MAX = 8;
const JANELA_MS = 10 * 60 * 1000;

function limitado(ip: string) {
  const agora = Date.now();
  const t = tentativas.get(ip);
  if (!t || t.ate < agora) {
    tentativas.set(ip, { n: 1, ate: agora + JANELA_MS });
    return false;
  }
  t.n += 1;
  return t.n > MAX;
}

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limitado(ip)) return { erro: "Muitas tentativas. Aguarde alguns minutos." };

  const codigo = normalizarCodigo(String(formData.get("codigo") ?? ""));
  if (codigo.length < 6) return { erro: "Digite o seu código pessoal." };

  const col = await prisma.colaborador.findFirst({
    where: {
      codigoHash: hashCodigo(codigo),
      ativo: true,
      tenant: { slug: TENANT_SLUG },
    },
    select: { id: true, tenantId: true, perfil: true },
  });
  if (!col) return { erro: "Código inválido ou acesso desativado." };

  tentativas.delete(ip);
  await criarSessao(col);
  redirect(homePorPerfil(col.perfil));
}

export async function logout() {
  await encerrarSessao();
  redirect("/login");
}
