import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { diaBrasilia, hashTexto, limiteDoDia, montarValores, docLead, FERRAMENTAS } from "./contrato-campos";

test("limite de vidas por dia da feira, em hora de Brasília", () => {
  assert.equal(limiteDoDia(new Date("2026-10-06T15:00:00Z")), 1300);
  assert.equal(limiteDoDia(new Date("2026-10-07T15:00:00Z")), 1200);
  assert.equal(limiteDoDia(new Date("2026-10-08T15:00:00Z")), 1100);
  assert.equal(limiteDoDia(new Date("2026-10-09T15:00:00Z")), null);
  assert.equal(limiteDoDia(new Date("2026-10-05T15:00:00Z")), null);
});

test("virada do dia usa Brasília (UTC-3), não UTC", () => {
  assert.equal(diaBrasilia(new Date("2026-10-07T01:30:00Z")), "2026-10-06");
  assert.equal(limiteDoDia(new Date("2026-10-07T01:30:00Z")), 1300);
});

test("hashTexto é SHA-256 hex do texto", () => {
  assert.equal(hashTexto("abc"), createHash("sha256").update("abc").digest("hex"));
});

test("são 10 ferramentas", () => assert.equal(FERRAMENTAS.length, 10));

const lead = {
  nome: "Ana Souza", cpf: "52998224725", cnpj: null, email: "ana@x.com", whatsapp: "12999991234", whatsappDdi: "55",
  empresa: "Ana ME", cargo: "Sócia", endereco: "Rua A", numero: "10", complemento: null, bairro: "Centro",
  cidade: "São Paulo", uf: "SP", cep: "01038100", pais: "Brasil",
};

test("docLead prefere CNPJ", () => {
  assert.equal(docLead(lead), "52998224725");
  assert.equal(docLead({ ...lead, cnpj: "11222333000181" }), "11222333000181");
});

test("montarValores formata dados do lead e campos da assinatura", () => {
  const v = montarValores(
    lead,
    { mensalidadeCents: 70000, plano: "Completo", vencimento: 10, medicoTrabalho: false, limiteVidas: 1300 },
    "Beto",
    new Date("2026-10-06T15:00:00Z"),
  );
  assert.equal(v.nome, "Ana Souza");
  assert.equal(v.documento, "529.982.247-25");
  assert.equal(v.mensalidade, "700,00");
  assert.equal(v.vencimento, "10");
  assert.equal(v.medico_trabalho, "não contratado");
  assert.equal(v.limite_vidas, "1.300");
  assert.equal(v.data, "06/10/2026");
  assert.equal(v.coletor, "Beto");
  assert.match(v.endereco_completo, /Rua A, 10 - Centro - São Paulo\/SP - CEP 01038-100/);
});

import { dimensoesPng, entradaSchema, ROTULO_FALTANTE } from "./contrato-campos";

const PNG_1X1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

test("dimensoesPng lê largura e altura do cabeçalho", () => {
  assert.deepEqual(dimensoesPng(PNG_1X1), { w: 1, h: 1 });
  assert.equal(dimensoesPng(new Uint8Array(10)), null);
});

test("dimensoesPng enxerga um PNG que declara 20000x20000", () => {
  const b = Uint8Array.from(PNG_1X1);
  new DataView(b.buffer).setUint32(16, 20000);
  new DataView(b.buffer).setUint32(20, 20000);
  assert.deepEqual(dimensoesPng(b), { w: 20000, h: 20000 });
});

const base = {
  mensalidade: "700,00", plano: "Completo", vencimento: 10, medicoTrabalho: false, ferramentas: ["PGR"],
  signatarioNome: "Ana Souza", signatarioDocumento: "529.982.247-25", assinaturaPng: "x", aceite: true,
  versaoModelo: 1, limiteExibido: 1300,
};

test("mensalidade não aceita sinal nem texto", () => {
  for (const ruim of ["-700", "abc", "7a0", "700,00,1", "--1", "+700", ""]) {
    assert.equal(entradaSchema.safeParse({ ...base, mensalidade: ruim }).success, false, ruim);
  }
  for (const bom of ["700,00", "700", "1.234,56", "1234.56", "99,9"]) {
    assert.equal(entradaSchema.safeParse({ ...base, mensalidade: bom }).success, true, bom);
  }
});

test("entrada exige a versão do modelo que o cliente leu", () => {
  const semVersao: Record<string, unknown> = { ...base }; delete semVersao.versaoModelo;
  assert.equal(entradaSchema.safeParse(semVersao).success, false);
  assert.equal(entradaSchema.safeParse(base).success, true);
});

test("rótulos dos dados faltantes do lead", () => {
  assert.equal(ROTULO_FALTANTE.email, "e-mail");
  assert.equal(ROTULO_FALTANTE.whatsapp, "WhatsApp");
});
