import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { MODELO_INICIAL, TITULO_INICIAL } from "./contrato-modelo-inicial";
import { VARIAVEIS, variaveisUsadas } from "./contrato-render";

const MAX_CORPO = 200_000;

const SEL = { id: true, versao: true, titulo: true, corpo: true } as const;

/** Versão vigente do modelo (a maior). Cria a v1 com o texto inicial na primeira vez. */
export async function modeloVigente(tenantId: string) {
  const achar = () => prisma.modeloContrato.findFirst({ where: { tenantId }, orderBy: { versao: "desc" }, select: SEL });
  const atual = await achar();
  if (atual) return atual;
  try {
    return await prisma.modeloContrato.create({
      data: { tenantId, versao: 1, titulo: TITULO_INICIAL, corpo: MODELO_INICIAL, criadoPorNome: "Modelo inicial" },
      select: SEL,
    });
  } catch (e) {
    // duas requisições criando a v1 ao mesmo tempo: a segunda cai aqui
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const deNovo = await achar();
      if (deNovo) return deNovo;
    }
    throw e;
  }
}

export function validarModelo(titulo: string, corpo: string): string | null {
  if (titulo.trim().length < 3) return "Informe o título do contrato.";
  if (corpo.trim().length < 50) return "O texto do contrato está vazio ou curto demais.";
  if (corpo.length > MAX_CORPO) return "O texto do contrato é grande demais (máximo 200 KB).";
  const conhecidas = new Set<string>(VARIAVEIS);
  const desconhecidas = variaveisUsadas(corpo).filter((v) => !conhecidas.has(v));
  if (desconhecidas.length) {
    return `Variável desconhecida: ${desconhecidas.map((v) => `{{${v}}}`).join(", ")}. Confira a lista ao lado do editor.`;
  }
  return null;
}
