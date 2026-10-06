/* Forge service worker.
   Bump CACHE whenever the shipped files change, otherwise phones keep
   serving the old copy from cache forever. */
const CACHE = "forge-v4";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-64.png",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./forge-bg.jpg",
  "./forge-bg-small.jpg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  // index.html: network first, so a new version is picked up as soon as
  // there's a connection, with cache as the offline fallback.
  const isDoc = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isDoc) {
    event.respondWith(
      fetch(req)
        .then(res => {
          caches.open(CACHE).then(c => c.put("./index.html", res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else (icons, background) is immutable per release:
  // serve from cache, fall back to network, and backfill the cache.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }))
  );
});
