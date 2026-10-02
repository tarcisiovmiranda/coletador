import "server-only";
import type { PixTipo } from "@prisma/client";

/**
 * Cliente mínimo do Asaas para pagar comissão por Pix.
 * SEGURANÇA: por padrão fala com o SANDBOX (dinheiro de teste). Produção só com ASAAS_ENV=producao.
 */

export const asaasConfigurado = () => Boolean(process.env.ASAAS_API_KEY?.trim());
export const asaasEmProducao = () => process.env.ASAAS_ENV?.trim().toLowerCase() === "producao";

const baseUrl = () =>
  (process.env.ASAAS_BASE_URL?.trim() ||
    (asaasEmProducao() ? "https://api.asaas.com" : "https://api-sandbox.asaas.com")) + "/v3";

/** Teto por pagamento (R$): limita o estrago de qualquer erro de dado ou de uso. */
export const limitePorPagamentoCents = () => {
  const n = Number(process.env.ASAAS_LIMITE_POR_PAGAMENTO);
  return Math.round((Number.isFinite(n) && n > 0 ? n : 5000) * 100);
};

export type TransferenciaAsaas = {
  id: string;
  status: "PENDING" | "BANK_PROCESSING" | "DONE" | "CANCELLED" | "FAILED" | string;
  value?: number;
  failReason?: string | null;
  transactionReceiptUrl?: string | null;
};

/** O Asaas respondeu e RECUSOU (4xx): nada foi movido, pode liberar para tentar de novo. */
export class AsaasRecusou extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AsaasRecusou";
  }
}
/** Não dá para saber se o Asaas executou (timeout, rede, 5xx): NÃO liberar sem conferir. */
export class AsaasIncerto extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasIncerto";
  }
}

async function chamar(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new AsaasRecusou("Asaas não configurado.", 0);

  let r: Response;
  try {
    r = await fetch(baseUrl() + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: key,
        "User-Agent": "coletador-fisp/1.0",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new AsaasIncerto(e instanceof Error ? e.name : "falha de rede");
  }

  const texto = await r.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* corpo não é JSON */
  }

  if (r.status >= 500) throw new AsaasIncerto(`Asaas respondeu ${r.status}`);
  if (!r.ok) {
    const erros = (json as { errors?: { description?: string }[] } | null)?.errors;
    const motivo = erros?.map((e) => e.description).filter(Boolean).join("; ") || `HTTP ${r.status}`;
    throw new AsaasRecusou(motivo.slice(0, 200), r.status);
  }
  return json;
}

export async function criarTransferenciaPix(p: {
  valorReais: number;
  chave: string;
  tipo: PixTipo;
  descricao: string;
  referencia: string;
}): Promise<TransferenciaAsaas> {
  const t = (await chamar("/transfers", {
    method: "POST",
    body: JSON.stringify({
      value: p.valorReais,
      pixAddressKey: p.chave,
      pixAddressKeyType: p.tipo,
      operationType: "PIX",
      description: p.descricao.slice(0, 140),
      externalReference: p.referencia,
    }),
  })) as TransferenciaAsaas | null;
  if (!t?.id) throw new AsaasIncerto("resposta sem id de transferência");
  return t;
}

export async function consultarTransferencia(id: string): Promise<TransferenciaAsaas> {
  const t = (await chamar(`/transfers/${encodeURIComponent(id)}`)) as TransferenciaAsaas | null;
  if (!t?.id) throw new AsaasIncerto("resposta sem id de transferência");
  return t;
}

/** Saldo disponível em reais; null se não conseguir saber (não bloqueia o pagamento). */
export async function consultarSaldoReais(): Promise<number | null> {
  try {
    const j = (await chamar("/finance/balance")) as { balance?: number } | null;
    return typeof j?.balance === "number" ? j.balance : null;
  } catch {
    return null;
  }
}
