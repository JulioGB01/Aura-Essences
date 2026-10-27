// Network first, so updates arrive at once; the saved copy is used only without internet.
const CACHE = "aura-app";
const SHELL = ["./", "index.html", "style.css", "db.js", "sync.js", "common.js", "app.js", "manifest.webmanifest",
  "vendor/sql-wasm.js", "vendor/sql-wasm.wasm", "icon-192.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
