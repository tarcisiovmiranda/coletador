import assert from "node:assert/strict";
import { test } from "node:test";
import { cifrarCodigo, decifrarCodigo, gerarCodigo } from "./codigo";

process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";


test("cifra e decifra o código", () => {
  const codigo = gerarCodigo();
  const cifrado = cifrarCodigo(codigo);
  assert.notEqual(cifrado, codigo);
  assert.equal(decifrarCodigo(cifrado), codigo);
});

test("cifras do mesmo código são diferentes (IV aleatório)", () => {
  assert.notEqual(cifrarCodigo("K7QM2-X9RTD"), cifrarCodigo("K7QM2-X9RTD"));
});

test("valor adulterado ou lixo devolve null", () => {
  const cifrado = cifrarCodigo("K7QM2-X9RTD");
  assert.equal(decifrarCodigo(cifrado.slice(0, -2) + "AA"), null);
  assert.equal(decifrarCodigo("lixo"), null);
});

test("AUTH_SECRET diferente não decifra", () => {
  const cifrado = cifrarCodigo("K7QM2-X9RTD");
  process.env.AUTH_SECRET = "outro-segredo-totalmente-diferente-123456789";
  assert.equal(decifrarCodigo(cifrado), null);
});
