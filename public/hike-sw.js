// TrailFox offline helper. Controls only the /hike pages.
// - Map tiles saved for offline use are answered from the tile cache.
// - The app's page and files are kept so TrailFox opens without signal.
// Everything else goes to the network as usual.

const TILES = "trailfox-tiles-v1";
const APP = "trailfox-app-v1";
const TILE_HOSTS = ["basemap.nationalmap.gov", "tile.opentopomap.org", "tile.openstreetmap.org"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches
        .open(TILES)
        .then(cache => cache.match(req.url))
        .then(hit => hit || fetch(req))
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // The page: fresh when online, the saved copy when not.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP).then(cache => cache.put("/hike", copy));
          }
          return res;
        })
        .catch(() => caches.open(APP).then(cache => cache.match("/hike")).then(hit => hit || Response.error()))
    );
    return;
  }

  // Built files have content hashes in their names, so a saved copy is always right.
  if (url.pathname.startsWith("/assets/") || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(APP).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
  }
});
