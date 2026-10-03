import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { gerarPdfContrato } from "./contrato-pdf";

// PNG 1x1 transparente
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const base = {
  titulo: "Contrato de Teste",
  assinaturaPng: PNG,
  signatarioNome: "Ana Souza",
  signatarioDocumento: "529.982.247-25",
  contratadaNome: "CONFORMIDADE PJ SERVIÇOS LTDA",
  contratadaCnpj: "66.914.632/0001-79",
  evidencias: { assinadoEm: "06/10/2026 10:00:00 (Brasília)", ip: "1.2.3.4", userAgent: "UA", hash: "a".repeat(64), versao: 1, id: "abc123" },
};

test("gera um PDF válido com várias páginas para texto longo", async () => {
  const paragrafos = Array.from({ length: 120 }, (_, i) => `${i + 1}.1. Cláusula **importante** número ${i} com acentuação: ação, coração, § 1º — “aspas”.`);
  const texto = ["## 1. Objeto", ...paragrafos, "> ### AVISO", ">", "> Texto do quadro", "[x] PGR", "[ ] CIPA"].join("\n");
  const bytes = await gerarPdfContrato({ ...base, textoFinal: texto });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3, `páginas: ${doc.getPageCount()}`);
});

test("caracteres fora da Helvetica não derrubam a geração", async () => {
  const bytes = await gerarPdfContrato({ ...base, signatarioNome: "Łukasz 😀 Souza", textoFinal: "Nome: Łukasz 😀 ✓ → fim" });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
});

test("texto vazio ainda gera PDF com assinatura e evidências", async () => {
  const bytes = await gerarPdfContrato({ ...base, textoFinal: "" });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1);
});
