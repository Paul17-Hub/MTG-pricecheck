// Bewaart de app zelf offline en de kaartplaatjes die je hebt bekeken; de kaartdata zit in IndexedDB.
const V = 'wl-v2', IMGS = 'wl-img-v1', SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== IMGS).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // kaartplaatjes van Scryfall: eerst uit de cache, anders ophalen en bewaren
  if (u.hostname === 'cards.scryfall.io') {
    e.respondWith(caches.open(IMGS).then(async (c) => {
      const hit = await c.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request); c.put(e.request, r.clone()); return r; } catch { return hit || Response.error(); }
    }));
    return;
  }
  if (u.origin !== location.origin || u.pathname.includes('/data/')) return;
  // netwerk eerst (zodat updates direct zichtbaar zijn), cache als je offline bent
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
