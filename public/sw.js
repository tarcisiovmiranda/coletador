/* Service worker do Coletador: deixa o app abrir sem rede.
 *
 * - Arquivos estáticos (/_next/static, ícones): cache primeiro (nome com hash = imutável).
 * - Páginas /coletor e /coletor/novo: rede primeiro (sempre a versão atual); se a rede
 *   falhar ou demorar, usa a cópia guardada. Só guarda resposta 200 sem redirecionamento,
 *   então a tela de login nunca é confundida com a página.
 * - Qualquer outra tela de /coletor sem rede cai no formulário de novo lead.
 * - Nada de /admin e nada de /api é guardado.
 */
const PAGES = "coletador-pages-v1";
const ASSETS = "coletador-assets-v1";
const PAGINAS = ["/coletor", "/coletor/novo"];
const ESPERA_REDE_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k !== PAGES && k !== ASSETS) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

function comTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

// Guarda os arquivos que uma página referencia, para ela abrir inteira offline.
async function guardarAssetsDe(html) {
  const cache = await caches.open(ASSETS);
  const urls = new Set(html.match(/\/_next\/static\/[A-Za-z0-9_\-./%~]+/g) || []);
  await Promise.all(
    [...urls].map(async (u) => {
      try {
        if (await cache.match(u)) return;
        const r = await fetch(u);
        if (r.ok) await cache.put(u, r);
      } catch {
        /* sem rede agora: fica para a próxima visita */
      }
    }),
  );
}

async function guardarPagina(path, res, event) {
  if (!(res.ok && res.status === 200 && !res.redirected && res.type === "basic")) return;
  const copia = res.clone();
  const cache = await caches.open(PAGES);
  await cache.put(path, copia.clone());
  event?.waitUntil?.(copia.text().then(guardarAssetsDe));
}

async function paginaRedePrimeiro(event, req, path) {
  try {
    const res = await comTimeout(fetch(req), ESPERA_REDE_MS);
    event.waitUntil(guardarPagina(path, res.clone(), event));
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    const hit = (await cache.match(path)) || (await cache.match("/coletor/novo"));
    if (hit) return hit;
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
        "<body style='font-family:sans-serif;padding:24px'><h2>Sem conexão</h2>" +
        "<p>Abra o app uma vez com internet para usar offline.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  const ehPagina = req.mode === "navigate" && !req.headers.get("rsc");
  if (!ehPagina) return;

  if (PAGINAS.includes(url.pathname)) {
    event.respondWith(paginaRedePrimeiro(event, req, url.pathname));
  } else if (url.pathname.startsWith("/coletor/")) {
    // outras telas do coletador: com rede, normal; sem rede, o formulário de novo lead
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(PAGES);
        return (await cache.match("/coletor/novo")) || Response.error();
      }),
    );
  }
});

// A página pede para guardar já as telas offline (a 1ª visita não passa pelo worker).
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "aquecer") return;
  event.waitUntil(
    Promise.all(
      PAGINAS.map(async (path) => {
        try {
          const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "text/html" } });
          await guardarPagina(path, res, event);
        } catch {
          /* sem rede: tenta na próxima */
        }
      }),
    ),
  );
});
