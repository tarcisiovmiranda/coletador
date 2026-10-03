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
