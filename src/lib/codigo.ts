import { createHmac, randomInt } from "node:crypto";
import { authSecret } from "./env";

// Sem 0/O/1/I/L para evitar erro de digitação no estande.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO = 10;

/** Gera um código pessoal legível (ex.: K7QM2-X9RTD). Mostrado uma única vez. */
export function gerarCodigo(): string {
  let c = "";
  for (let i = 0; i < TAMANHO; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

/** Remove hífens/espaços e padroniza caixa: aceita "k7qm2 x9rtd". */
export function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * HMAC-SHA256 com pepper (AUTH_SECRET). Determinístico para permitir busca
 * por índice único; o código tem ~50 bits de entropia e nunca é guardado em claro.
 */
export function hashCodigo(entrada: string): string {
  return createHmac("sha256", authSecret()).update(normalizarCodigo(entrada)).digest("hex");
}
