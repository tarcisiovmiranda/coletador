import "server-only";
import { prisma } from "./db";
import { classesCor } from "./etapas-cores";
import { ETAPAS_PADRAO } from "./etapas-padrao";

export type EtapaView = {
  id: string;
  nome: string;
  cor: string; // chave da paleta
  classes: string; // classes Tailwind do selo
  ordem: number;
  fechamento: boolean;
};

/** Cria as etapas padrão se o tenant ainda não tem nenhuma (tenant novo ou criado depois da migration). */
export async function garantirEtapas(tenantId: string) {
  if ((await prisma.etapa.count({ where: { tenantId } })) > 0) return;
  await prisma.etapa.createMany({
    data: ETAPAS_PADRAO.map((e, ordem) => ({ tenantId, ordem, ...e })),
    skipDuplicates: true,
  });
}

export async function listarEtapas(tenantId: string): Promise<EtapaView[]> {
  await garantirEtapas(tenantId);
  const etapas = await prisma.etapa.findMany({ where: { tenantId }, orderBy: [{ ordem: "asc" }, { createdAt: "asc" }] });
  return etapas.map((e) => ({ ...e, classes: classesCor(e.cor) }));
}

/** Etapa em que todo lead novo entra: a primeira da ordem. */
export async function etapaInicialId(tenantId: string): Promise<string> {
  await garantirEtapas(tenantId);
  const e = await prisma.etapa.findFirstOrThrow({ where: { tenantId }, orderBy: [{ ordem: "asc" }, { createdAt: "asc" }], select: { id: true } });
  return e.id;
}

/** Etapa marcada como fechamento (o contrato aprovado move o lead para ela). */
export async function etapaFechamentoId(tenantId: string): Promise<string | null> {
  await garantirEtapas(tenantId);
  const e = await prisma.etapa.findFirst({ where: { tenantId, fechamento: true }, select: { id: true } });
  return e?.id ?? null;
}
