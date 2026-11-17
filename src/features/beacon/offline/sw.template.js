// BeaconFox offline worker. The build fills in the file list and version
// (see scripts/beacon/offline-plugin.mjs) and serves this as /beacon-sw.js.
// It only looks after /beacon: the rest of the site is untouched.

const VERSION = "dev"; /*__VERSION__*/
const FILES = []; /*__FILES__*/
const SHELL = "/beacon";
const CACHE = `beaconfox-${VERSION}`;
const KEEP = new Set([SHELL, ...FILES]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll([SHELL, ...FILES]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("beaconfox-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data === "beacon-status") {
    caches
      .open(CACHE)
      .then(cache => cache.keys())
      .then(keys => event.source?.postMessage({ type: "beacon-status", version: VERSION, cached: keys.length, total: KEEP.size }));
  }
});

function fromNetwork(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("slow")), ms);
    fetch(request).then(
      res => {
        clearTimeout(timer);
        resolve(res);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The page: try the network for the newest version, but with weak signal
  // don't wait more than a few seconds before using the saved copy.
  if (request.mode === "navigate") {
    event.respondWith(
      fromNetwork(request, 3500)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL, { cacheName: CACHE }).then(hit => hit || Response.error()))
    );
    return;
  }

  // The app's own files never change under the same name: saved copy first.
  if (KEEP.has(url.pathname)) {
    event.respondWith(caches.match(url.pathname, { cacheName: CACHE }).then(hit => hit || fetch(request)));
  }
});
