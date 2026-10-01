/**
 * Fila local (IndexedDB) de leads ainda não enviados. SÓ roda no navegador.
 * Cada item guarda o lead + o áudio (Blob) e sobrevive a fechar o app/reiniciar o celular.
 */
export type Pendente = {
  clientId: string; // idempotência no servidor
  colaboradorId: string; // dono: só é enviado quando esse usuário estiver logado
  campos: Record<string, string>;
  audio: Blob | null;
  audioMime: string | null;
  serverId?: string; // lead já criado no servidor, falta só o áudio
  erro?: string; // recusado pelo servidor (não adianta reenviar sem corrigir)
  tentativas: number;
  criadoEm: number;
};

const DB = "coletador-offline";
const STORE = "leads";
const EVENTO = "outbox-change";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, modo);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

let canal: BroadcastChannel | null = null;
function avisar() {
  window.dispatchEvent(new Event(EVENTO));
  try {
    canal ??= new BroadcastChannel(EVENTO);
    canal.postMessage(1);
  } catch {
    /* sem BroadcastChannel: só a aba atual é avisada */
  }
}

/** Escuta mudanças na fila (desta aba e das outras). Retorna a função de cancelar. */
export function aoMudar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(EVENTO);
    bc.onmessage = cb;
  } catch {
    /* ignora */
  }
  return () => {
    window.removeEventListener(EVENTO, cb);
    bc?.close();
  };
}

export async function guardar(p: Pendente) {
  await tx("readwrite", (s) => s.put(p));
  avisar();
}

export async function listar(colaboradorId: string): Promise<Pendente[]> {
  const todos = await tx<Pendente[]>("readonly", (s) => s.getAll());
  return todos.filter((p) => p.colaboradorId === colaboradorId).sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function obter(clientId: string): Promise<Pendente | undefined> {
  return tx<Pendente | undefined>("readonly", (s) => s.get(clientId));
}

export async function atualizar(clientId: string, patch: Partial<Pendente>) {
  const atual = await obter(clientId);
  if (!atual) return;
  await tx("readwrite", (s) => s.put({ ...atual, ...patch }));
  avisar();
}

export async function remover(clientId: string) {
  await tx("readwrite", (s) => s.delete(clientId));
  avisar();
}

/** Pede ao navegador para não apagar estes dados quando faltar espaço. */
export async function protegerArmazenamento() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* melhor esforço */
  }
}
