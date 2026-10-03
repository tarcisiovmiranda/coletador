import test from "node:test";
import assert from "node:assert/strict";
import { parseContrato, preencher, variaveisUsadas, limparValor } from "./contrato-render";

test("parseContrato: título, parágrafo com negrito, item, quadro e check", () => {
  const b = parseContrato(
    ["## 1. Objeto", "", "Texto **forte** fim", "", "- item um", "", "> ### AVISO", ">", "> Primeiro", ">", "> Segundo", "", "[x] PGR", "[ ] CIPA"].join("\n"),
  );
  assert.deepEqual(b[0], { tipo: "titulo", texto: "1. Objeto" });
  assert.deepEqual(b[1], { tipo: "par", trechos: [{ t: "Texto ", b: false }, { t: "forte", b: true }, { t: " fim", b: false }] });
  assert.deepEqual(b[2], { tipo: "item", trechos: [{ t: "item um", b: false }] });
  assert.equal(b[3].tipo, "caixa");
  if (b[3].tipo === "caixa") {
    assert.equal(b[3].titulo, "AVISO");
    assert.equal(b[3].pars.length, 2);
  }
  assert.deepEqual(b[4], { tipo: "check", marcado: true, texto: "PGR" });
  assert.deepEqual(b[5], { tipo: "check", marcado: false, texto: "CIPA" });
});

test("preencher troca variáveis e reporta faltantes", () => {
  const r = preencher("Olá {{nome}}, {{email}} e {{nome}}", { nome: "Ana" }, null);
  assert.equal(r.texto, "Olá Ana, {{email}} e Ana");
  assert.deepEqual(r.faltantes, ["email"]);
});

test("valor vazio ou só espaços conta como faltante", () => {
  const r = preencher("{{plano}}", { plano: "   " }, null);
  assert.deepEqual(r.faltantes, ["plano"]);
});

test("valores não podem injetar negrito, variável nem quebra de linha", () => {
  assert.equal(limparValor("**Ana** {{cpf}}\nSilva"), "Ana cpf Silva");
  const r = preencher("{{nome}}", { nome: "**x** {{plano}}" }, null);
  assert.equal(r.texto, "x plano");
});

test("preencher gera linhas de check das ferramentas", () => {
  const r = preencher("{{ferramentas}}", {}, { todas: ["PGR", "CIPA"], marcadas: ["PGR"] });
  assert.equal(r.texto, "[x] PGR\n[ ] CIPA");
  assert.deepEqual(r.faltantes, []);
});

test("variaveisUsadas lista nomes únicos", () => {
  assert.deepEqual(variaveisUsadas("{{a}} {{b}} {{a}}").sort(), ["a", "b"]);
});

test("o modelo inicial só usa variáveis conhecidas e tem 10 ferramentas no Anexo", async () => {
  const { MODELO_INICIAL } = await import("./contrato-modelo-inicial");
  const { VARIAVEIS, FERRAMENTAS } = await import("./contrato-render");
  const conhecidas = new Set<string>(VARIAVEIS);
  assert.deepEqual(variaveisUsadas(MODELO_INICIAL).filter((v) => !conhecidas.has(v)), []);
  assert.equal(FERRAMENTAS.length, 10);
});
