import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Perfil } from "@prisma/client";
import { prisma } from "./db";
import { authSecret } from "./env";

export const COOKIE = "coletador_session";
const DURACAO_SEG = 60 * 60 * 24 * 60; // 60 dias: sessão persistente no aparelho

export type SessionUser = {
  id: string;
  tenantId: string;
  nome: string;
  perfil: Perfil;
};

const key = () => new TextEncoder().encode(authSecret());

export async function criarSessao(c: { id: string; tenantId: string; perfil: Perfil }) {
  const token = await new SignJWT({ tid: c.tenantId, perfil: c.perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.id)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEG}s`)
    .sign(key());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SEG,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

/**
 * Fonte da verdade da sessão: valida o JWT E reconsulta o banco, assim
 * desativar um colaborador derruba o acesso na próxima requisição.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.tid !== "string") return null;
    const col = await prisma.colaborador.findFirst({
      where: { id: payload.sub, tenantId: payload.tid, ativo: true },
      select: { id: true, tenantId: true, nome: true, perfil: true },
    });
    return col;
  } catch {
    return null;
  }
});
