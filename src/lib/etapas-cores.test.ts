import assert from "node:assert/strict";
import { test } from "node:test";
import { classesCor, corValida, CORES_ETAPA, reordenar } from "./etapas-cores";

test("cores: chaves únicas, validação e fallback", () => {
  assert.equal(new Set(CORES_ETAPA.map((c) => c.key)).size, CORES_ETAPA.length);
  assert.ok(corValida("teal"));
  assert.equal(corValida("bg-red-500"), false);
  assert.equal(classesCor("emerald"), "bg-emerald-100 text-emerald-800");
  assert.equal(classesCor("nao-existe"), CORES_ETAPA[0].classes);
});

test("reordenar sobe e desce uma posição", () => {
  assert.deepEqual(reordenar(["a", "b", "c"], "b", "subir"), ["b", "a", "c"]);
  assert.deepEqual(reordenar(["a", "b", "c"], "b", "descer"), ["a", "c", "b"]);
});

test("reordenar nas pontas ou com id inexistente não muda", () => {
  assert.deepEqual(reordenar(["a", "b", "c"], "a", "subir"), ["a", "b", "c"]);
  assert.deepEqual(reordenar(["a", "b", "c"], "c", "descer"), ["a", "b", "c"]);
  assert.deepEqual(reordenar(["a", "b"], "x", "subir"), ["a", "b"]);
});
