// The home screen layout: which apps are on it and in what order. It is kept
// in this browser, and mirrored to the ClusterFox account when signed in.
//
// Keys: "o:<id>" is a ClusterFox original (src/app/apps.js) and
// "a:<name>" is a 3rd party alternative (src/features/free/freeApps.js).
// Originals start on everyone's home screen. Removing one is remembered in
// `removed`, so originals launched later still show up for everyone else.

export const STORAGE_KEY = "clusterfox:home-v1";
const MAX_ITEMS = 200;

export const originalKey = id => `o:${id}`;
export const altKey = name => `a:${name}`;
export const isOriginalKey = key => key.startsWith("o:");
export const keyId = key => key.slice(2);

export function emptyLayout() {
  return { version: 1, order: [], removed: [], updatedAt: null, syncedUserId: null };
}

const keys = v =>
  Array.isArray(v)
    ? [...new Set(v.filter(k => typeof k === "string" && /^[oa]:./.test(k) && k.length < 120))].slice(0, MAX_ITEMS)
    : [];

export function cleanLayout(raw) {
  const base = emptyLayout();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  return {
    version: 1,
    order: keys(raw.order),
    removed: keys(raw.removed).filter(isOriginalKey),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    syncedUserId: typeof raw.syncedUserId === "string" ? raw.syncedUserId : null,
  };
}

export function loadLayout() {
  try {
    return cleanLayout(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return emptyLayout();
  }
}

export function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Private mode: the layout lasts for this visit only.
  }
}

export function toRemote(layout) {
  const { order, removed, updatedAt } = layout;
  return { version: 1, order, removed, updatedAt };
}

// The layout is one small list, so the most recently edited copy wins.
// A browser that was never customized always takes the account's copy.
export function mergeLayout(local, remote) {
  const r = cleanLayout(remote);
  if (!local.updatedAt) return r;
  if (!r.updatedAt) return local;
  return r.updatedAt > local.updatedAt ? r : local;
}

/**
 * The keys to show, in order. `originalIds` is every original on the site;
 * `altExists` says whether an alternative is still in the directory (null
 * while the directory is loading, so nothing is dropped early).
 */
export function homeKeys(layout, originalIds, altExists = null) {
  const originals = new Set(originalIds.map(originalKey));
  const listed = layout.order.filter(key =>
    isOriginalKey(key) ? originals.has(key) : !altExists || altExists(keyId(key))
  );
  const seen = new Set(listed);
  const removed = new Set(layout.removed);
  const fresh = [...originals].filter(key => !seen.has(key) && !removed.has(key));
  // New originals go after the other originals, before any alternatives.
  const lastOriginal = listed.findLastIndex(isOriginalKey);
  return [...listed.slice(0, lastOriginal + 1), ...fresh, ...listed.slice(lastOriginal + 1)];
}

export function addKey(layout, current, key) {
  if (current.includes(key)) return layout;
  return {
    ...layout,
    order: [...current, key],
    removed: layout.removed.filter(k => k !== key),
  };
}

export function removeKey(layout, current, key) {
  return {
    ...layout,
    order: current.filter(k => k !== key),
    removed: isOriginalKey(key) && !layout.removed.includes(key) ? [...layout.removed, key] : layout.removed,
  };
}

// Puts `key` where `targetKey` is now, shifting the rest along.
export function moveKey(layout, current, key, targetKey) {
  const from = current.indexOf(key);
  const to = current.indexOf(targetKey);
  if (from === -1 || to === -1 || from === to) return layout;
  const order = current.filter(k => k !== key);
  order.splice(to, 0, key);
  return { ...layout, order };
}
