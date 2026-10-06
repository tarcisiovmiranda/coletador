import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// TEMPORÁRIO: exporta os dados do tenant do admin para migrar de banco.
// Remover do código assim que a migração terminar.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.perfil !== "ADMIN") {
    return NextResponse.json({ erro: "Somente admin." }, { status: 403 });
  }
  const tenantId = user.tenantId;
  const where = { tenantId };

  const [tenants, colaboradores, leads, modelosContrato, pagamentosComissao, contratos, assinaturas] =
    await Promise.all([
      prisma.tenant.findMany({ where: { id: tenantId } }),
      prisma.colaborador.findMany({ where }),
      prisma.lead.findMany({ where }),
      prisma.modeloContrato.findMany({ where }),
      prisma.pagamentoComissao.findMany({ where }),
      prisma.contrato.findMany({ where }),
      prisma.assinaturaContrato.findMany({ where }),
    ]);

  const corpo = JSON.stringify({
    exportadoEm: new Date().toISOString(),
    tenants,
    colaboradores,
    leads,
    modelosContrato,
    pagamentosComissao,
    contratos,
    assinaturas,
  });

  return new NextResponse(corpo, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="coletador-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
