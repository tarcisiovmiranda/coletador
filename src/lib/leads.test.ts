import assert from "node:assert/strict";
import { test } from "node:test";
import { NOME_PADRAO, validarLead } from "./leads";

test("sem nenhum campo preenchido é recusado", () => {
  const r = validarLead({});
  assert.equal(r.ok, false);
  const r2 = validarLead({ nome: "  ", whatsappDdi: "55" });
  assert.equal(r2.ok, false);
});

test("um único campo basta; o nome vazio vira o nome padrão", () => {
  const r = validarLead({ empresa: "ACME" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.nome, NOME_PADRAO);
    assert.equal(r.data.empresa, "ACME");
    assert.equal(r.data.cpf, null);
    assert.equal(r.data.whatsapp, null);
    assert.equal(r.data.whatsappDdi, "55");
    assert.equal(r.data.dataNascimento, null);
  }
});

test("campos preenchidos continuam sendo conferidos", () => {
  const r = validarLead({ nome: "Ana", cpf: "123", email: "x", whatsapp: "123" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.erros.map((e) => e.campo).sort(), ["cpf", "email", "whatsapp"]);
});

test("Brasil sem CEP e UF é aceito, CEP incompleto não", () => {
  assert.ok(validarLead({ nome: "Ana", pais: "Brasil" }).ok);
  const r = validarLead({ nome: "Ana", pais: "Brasil", cep: "123" });
  assert.equal(r.ok, false);
});
