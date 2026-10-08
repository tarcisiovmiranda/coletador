import assert from "node:assert/strict";
import { test } from "node:test";
import { alternar, faixaSelecao } from "./selecao";

const ids = ["a", "b", "c", "d", "e"];

test("faixa: da âncora ao alvo, nos dois sentidos", () => {
  assert.deepEqual(faixaSelecao(ids, "b", "d"), ["b", "c", "d"]);
  assert.deepEqual(faixaSelecao(ids, "d", "b"), ["b", "c", "d"]);
  assert.deepEqual(faixaSelecao(ids, "c", "c"), ["c"]);
});

test("faixa: sem âncora ou âncora em outra coluna seleciona só o alvo", () => {
  assert.deepEqual(faixaSelecao(ids, null, "c"), ["c"]);
  assert.deepEqual(faixaSelecao(ids, "x", "c"), ["c"]);
});

test("faixa: alvo fora da lista não seleciona nada", () => {
  assert.deepEqual(faixaSelecao(ids, "a", "x"), []);
});

test("alternar marca e desmarca sem mutar o original", () => {
  const base = new Set(["a"]);
  const com = alternar(base, "b");
  assert.deepEqual([...com].sort(), ["a", "b"]);
  assert.deepEqual([...alternar(com, "a")], ["b"]);
  assert.deepEqual([...base], ["a"]);
});
