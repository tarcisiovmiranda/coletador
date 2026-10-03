import fs from "node:fs";

const corpo = fs.readFileSync("prisma/contrato-modelo-v1.md", "utf8").replace(/\r\n/g, "\n").trimEnd() + "\n";
const saida =
  "// GERADO por scripts/gerar-modelo-inicial.mjs a partir de prisma/contrato-modelo-v1.md. Não edite.\n" +
  `export const TITULO_INICIAL = ${JSON.stringify("Contrato de Licença de Uso da Plataforma ConformidadePJ")};\n` +
  `export const MODELO_INICIAL = ${JSON.stringify(corpo)};\n`;
fs.writeFileSync("src/lib/contrato-modelo-inicial.ts", saida);
console.log("ok:", corpo.length, "caracteres");
