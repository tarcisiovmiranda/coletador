import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } from "node:crypto";
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

function chaveCifra(): Buffer {
  return createHmac("sha256", authSecret()).update("codigo-cifrado-v1").digest();
}

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<cifrado>, tudo em base64url. */
export function cifrarCodigo(codigo: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chaveCifra(), iv);
  const dados = Buffer.concat([cifra.update(codigo, "utf8"), cifra.final()]);
  return ["v1", iv, cifra.getAuthTag(), dados].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Devolve o código em claro, ou null se o valor for inválido ou o AUTH_SECRET mudou. */
export function decifrarCodigo(valor: string): string | null {
  try {
    const [versao, iv, tag, dados] = valor.split(".");
    if (versao !== "v1" || !iv || !tag || !dados) return null;
    const decifra = createDecipheriv("aes-256-gcm", chaveCifra(), Buffer.from(iv, "base64url"));
    decifra.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decifra.update(Buffer.from(dados, "base64url")), decifra.final()]).toString("utf8");
  } catch {
    return null;
  }
}
