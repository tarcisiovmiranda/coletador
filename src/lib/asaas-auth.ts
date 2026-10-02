import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Autentica chamadas vindas do Asaas pelo header `asaas-access-token`.
 * Sem ASAAS_WEBHOOK_TOKEN configurado, TUDO é recusado: um webhook sem senha deixaria
 * qualquer pessoa na internet marcar pagamentos como concluídos ou falhos.
 */
export function webhookAutenticado(req: Request): "ok" | "sem-config" | "negado" {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!esperado) return "sem-config";
  const recebido = req.headers.get("asaas-access-token") ?? "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "negado";
}
