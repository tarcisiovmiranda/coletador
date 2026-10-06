// Importa o JSON gerado por /api/admin/exportar para o banco apontado por DATABASE_URL.
// Uso: node --env-file=.env.local scripts/importar-banco.mjs coletador-export-AAAA-MM-DD.json
// Recusa rodar se o banco de destino já tiver colaboradores (não rode o seed antes).
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Informe o arquivo JSON exportado.");
  process.exit(1);
}
const dados = JSON.parse(readFileSync(arquivo, "utf8"));
const prisma = new PrismaClient();

const ordem = [
  ["tenant", "tenants"],
  ["colaborador", "colaboradores"],
  ["lead", "leads"],
  ["modeloContrato", "modelosContrato"],
  ["pagamentoComissao", "pagamentosComissao"],
  ["contrato", "contratos"],
  ["assinaturaContrato", "assinaturas"],
];

try {
  const existentes = await prisma.colaborador.count();
  if (existentes > 0) {
    console.error(`O banco de destino já tem ${existentes} colaborador(es). Abortando para não misturar dados.`);
    process.exit(1);
  }

  await prisma.$transaction(
    async (tx) => {
      for (const [modelo, chave] of ordem) {
        const linhas = dados[chave] ?? [];
        if (linhas.length === 0) {
          console.log(`${chave}: 0`);
          continue;
        }
        const r = await tx[modelo].createMany({ data: linhas });
        if (r.count !== linhas.length) throw new Error(`${chave}: esperado ${linhas.length}, gravado ${r.count}`);
        console.log(`${chave}: ${r.count}`);
      }
    },
    { timeout: 120_000 },
  );
  console.log("Importação concluída.");
} finally {
  await prisma.$disconnect();
}
