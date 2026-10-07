import assert from "node:assert/strict";
import { test } from "node:test";
import { intervaloCriacao } from "./datas";

test("sem datas não filtra", () => {
  assert.deepEqual(intervaloCriacao(undefined, undefined), { ok: true, where: undefined });
  assert.deepEqual(intervaloCriacao("", ""), { ok: true, where: undefined });
});

test("de/até cobrem o dia inteiro no fuso de São Paulo", () => {
  const r = intervaloCriacao("2026-10-02", "2026-10-03");
  assert.ok(r.ok && r.where);
  if (r.ok && r.where) {
    assert.equal(r.where.gte?.toISOString(), "2026-10-02T03:00:00.000Z");
    assert.equal(r.where.lt?.toISOString(), "2026-10-04T03:00:00.000Z");
  }
});

test("só 'de' ou só 'até'", () => {
  const a = intervaloCriacao("2026-10-02", undefined);
  assert.ok(a.ok && a.where?.gte && !a.where.lt);
  const b = intervaloCriacao(undefined, "2026-10-02");
  assert.ok(b.ok && b.where?.lt && !b.where.gte);
});

test("data inválida ou intervalo invertido dá erro", () => {
  assert.equal(intervaloCriacao("2026-13-40", undefined).ok, false);
  assert.equal(intervaloCriacao("abc", undefined).ok, false);
  const r = intervaloCriacao("2026-10-05", "2026-10-01");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erro, /anterior/);
});
