const VERSION = "v2";
const RUNTIME_CACHE = `primeira-viagem-runtime-${VERSION}`;

// Telas principais pré-carregadas na instalação para continuarem acessíveis offline
// mesmo antes de a usuária visitá-las manualmente.
const CORE_PATHS = [
  "",
  "bebe/",
  "agenda/",
  "checklist/",
  "corpo/",
  "mala/",
  "diario/",
  "alimentacao/",
  "alertas/",
  "nascimento/",
  "favoritos/",
  "mais/",
  "configuracoes/",
  "privacidade/",
  "termos/",
  "manifest.webmanifest",
  "icon.svg",
];

function getScopePath() {
  return new URL(self.registration.scope).pathname;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      const cache = await caches.open(RUNTIME_CACHE);
      await Promise.allSettled(
        CORE_PATHS.map(async (path) => {
          const response = await fetch(scope + path, { cache: "no-cache" });
          if (response && response.ok) await cache.put(scope + path, response);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("primeira-viagem-runtime-") && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(getScopePath())) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname) || url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match(getScopePath());
    if (shell) return shell;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}
