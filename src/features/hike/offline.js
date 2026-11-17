// Offline use. A small service worker (public/hike-sw.js) looks after the
// /hike pages: it keeps a copy of the app so it opens without signal, and
// answers map tile requests from the tiles saved here. Trail data, the
// profile and the forecast are already kept in this browser's storage.

import { bounds } from "./model/geo.js";
import { offlinePlan } from "./model/tiles.js";

export const TILE_CACHE = "trailfox-tiles-v1";
export const APP_CACHE = "trailfox-app-v1";

export const offlineSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;

/** Register the worker (production builds only; the dev server reloads too often). */
export function registerOffline() {
  if (!offlineSupported() || !import.meta.env?.PROD) return;
  navigator.serviceWorker.register("/hike-sw.js", { scope: "/hike" }).catch(() => {});
}

/** Keep a copy of the app itself: the page and every script, style and image it loaded. */
async function saveAppShell() {
  const cache = await caches.open(APP_CACHE);
  const own = performance
    .getEntriesByType("resource")
    .map(e => e.name)
    .filter(u => {
      try {
        const url = new URL(u);
        return url.origin === location.origin && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/src/") && !url.pathname.startsWith("/@") && !url.pathname.includes("node_modules");
      } catch {
        return false;
      }
    });
  const page = await fetch("/hike", { cache: "no-store" });
  if (page.ok) await cache.put("/hike", page);
  const keep = new Set(["/hike", ...own.map(u => new URL(u).pathname)]);
  await Promise.all(own.map(u => cache.match(u).then(hit => hit || cache.add(u)).catch(() => {})));
  // Drop files from older versions of the site.
  for (const req of await cache.keys()) if (!keep.has(new URL(req.url).pathname)) await cache.delete(req);
}

export const tilePlanFor = (trail, layer) => offlinePlan(bounds(trail.line, 1500), layer);

/**
 * Save a trail's map for offline use. onProgress(done, total). Returns
 * { tiles, maxZoom, failed }.
 */
export async function saveOffline(trail, layer, onProgress = () => {}, { signal } = {}) {
  if (!offlineSupported()) throw new Error("This browser can't save maps for offline use.");
  await saveAppShell().catch(() => {});
  const { tiles, maxZoom } = tilePlanFor(trail, layer);
  const cache = await caches.open(TILE_CACHE);
  let done = 0;
  let failed = 0;
  const queue = tiles.slice();
  async function worker() {
    while (queue.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const t = queue.shift();
      try {
        if (!(await cache.match(t.url))) {
          const res = await fetch(t.url, { mode: "cors", signal });
          if (res.ok) await cache.put(t.url, res);
          else failed += 1;
        }
      } catch (error) {
        if (error.name === "AbortError") throw error;
        failed += 1;
      }
      done += 1;
      onProgress(done, tiles.length);
    }
  }
  // A few at a time: kind to the volunteer tile servers.
  await Promise.all([worker(), worker(), worker()]);
  return { tiles: tiles.length, maxZoom, failed };
}

/** Remove saved tiles that no remaining offline trail needs. */
export async function pruneTiles(keepTrails) {
  if (!offlineSupported()) return;
  const keep = new Set();
  for (const t of keepTrails) if (t.offline) for (const tile of tilePlanFor(t, t.offline.layer).tiles) keep.add(tile.url);
  const cache = await caches.open(TILE_CACHE);
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

/** Roughly how much space the saved maps take, in MB, if the browser will say. */
export async function storageUsed() {
  try {
    const est = await navigator.storage?.estimate?.();
    return est ? { usedMb: Math.round((est.usage ?? 0) / 1e6), quotaMb: Math.round((est.quota ?? 0) / 1e6) } : null;
  } catch {
    return null;
  }
}
