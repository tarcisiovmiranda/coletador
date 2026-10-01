import { atualizar, listar, obter, remover, type Pendente } from "./outbox";

export type Resultado =
  | { status: "enviado"; serverId: string; avisoAudio?: string }
  | { status: "pendente"; motivo: "offline" | "sessao" | "servidor" }
  | { status: "erro"; erro: string };

async function lerErro(r: Response): Promise<string> {
  const j = (await r.json().catch(() => null)) as { erro?: string } | null;
  return j?.erro ?? `Erro ${r.status}`;
}

/** Envia UM lead (e o áudio). Seguro de repetir: lead é idempotente e o áudio só substitui. */
async function enviarUm(p: Pendente): Promise<Resultado> {
  let serverId = p.serverId;

  if (!serverId) {
    let r: Response;
    try {
      r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p.campos, clientId: p.clientId, colaboradorId: p.colaboradorId }),
      });
    } catch {
      return { status: "pendente", motivo: "offline" };
    }
    if (r.status === 401) return { status: "pendente", motivo: "sessao" };
    if (r.status >= 500) return { status: "pendente", motivo: "servidor" };
    if (!r.ok) {
      const erro = await lerErro(r);
      await atualizar(p.clientId, { erro, tentativas: p.tentativas + 1 });
      return { status: "erro", erro };
    }
    serverId = ((await r.json()) as { id: string }).id;
    await atualizar(p.clientId, { serverId }); // se cair aqui, o reenvio só falta o áudio
  }

  let avisoAudio: string | undefined;
  if (p.audio) {
    let r: Response;
    try {
      r = await fetch(`/api/leads/${serverId}/audio`, {
        method: "POST",
        headers: { "Content-Type": (p.audioMime ?? p.audio.type ?? "audio/webm").split(";")[0] },
        body: p.audio,
      });
    } catch {
      return { status: "pendente", motivo: "offline" };
    }
    if (r.status === 401) return { status: "pendente", motivo: "sessao" };
    if (r.status >= 500) return { status: "pendente", motivo: "servidor" };
    if (!r.ok) avisoAudio = await lerErro(r); // recusado de vez (ex.: formato): o lead fica, sem áudio
  }

  await remover(p.clientId);
  return { status: "enviado", serverId, avisoAudio };
}

export type RodadaSync = {
  enviados: number;
  parou?: "offline" | "sessao" | "servidor";
  resultados: Record<string, Resultado>;
};

async function rodada(colaboradorId: string, apenas?: string): Promise<RodadaSync> {
  const fila = (await listar(colaboradorId)).filter((p) => !p.erro && (!apenas || p.clientId === apenas));
  const out: RodadaSync = { enviados: 0, resultados: {} };
  for (const item of fila) {
    // relê: outra aba pode ter enviado/removido enquanto esperávamos a vez
    const p = await obter(item.clientId);
    if (!p || p.erro) continue;
    const r = await enviarUm(p);
    out.resultados[p.clientId] = r;
    if (r.status === "enviado") out.enviados++;
    if (r.status === "pendente") {
      out.parou = r.motivo;
      break; // sem rede/sessão: não adianta insistir nos demais
    }
  }
  return out;
}

/** Uma rodada por vez em todas as abas do aparelho (evita enviar duas vezes em paralelo). */
export async function sincronizar(colaboradorId: string, apenas?: string): Promise<RodadaSync> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("coletador-sync", () => rodada(colaboradorId, apenas));
  }
  return rodada(colaboradorId, apenas);
}
