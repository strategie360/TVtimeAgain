const STATIC = "static-v1";
const IMAGES = "tmdb-img-v1";
const PAGES = "pages-v1";
const MAX_IMAGES = 400;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  const keep = [STATIC, IMAGES, PAGES];
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    c.put(req, res.clone());
    if (name === IMAGES) trim(IMAGES, MAX_IMAGES);
  }
  return res;
}

async function networkFirst(req) {
  const c = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req)) || new Response("Hors ligne", { status: 503 });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "image.tmdb.org") return e.respondWith(cacheFirst(req, IMAGES));
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".svg")) return e.respondWith(cacheFirst(req, STATIC));
  if (req.mode === "navigate") return e.respondWith(networkFirst(req));
});
