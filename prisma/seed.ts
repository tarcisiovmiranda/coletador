import { PrismaClient } from "@prisma/client";
import { gerarCodigo, hashCodigo } from "../src/lib/codigo";

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.TENANT_SLUG ?? "fisp2026";
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: { slug, nome: "FISP 2026 — Estande C93B" },
  });

  const jaTemAdmin = await prisma.colaborador.findFirst({
    where: { tenantId: tenant.id, perfil: "ADMIN" },
  });
  if (jaTemAdmin) {
    console.log(`Tenant "${slug}" já possui admin (${jaTemAdmin.nome}). Nada a fazer.`);
    return;
  }

  const codigo = process.env.SEED_ADMIN_CODIGO?.trim() || gerarCodigo();
  await prisma.colaborador.create({
    data: {
      tenantId: tenant.id,
      nome: process.env.SEED_ADMIN_NOME?.trim() || "Administrador",
      perfil: "ADMIN",
      codigoHash: hashCodigo(codigo),
    },
  });

  console.log("\n==============================================");
  console.log(` Admin criado no tenant "${slug}"`);
  console.log(` CÓDIGO DO ADMIN: ${codigo}`);
  console.log(" (exibido uma única vez — guarde)");
  console.log("==============================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
