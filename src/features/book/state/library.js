// Where BookFox gets books from: the starter catalog that ships with the
// site (instant, works offline), the live /api/apps routes for searching
// all of Project Gutenberg and for Standard Ebooks, and this device's book
// cache (IndexedDB) for the text of books you've opened.
import { useEffect, useState } from "react";

import { SUMMARY_SHARDS } from "../../../services/books/catalog.js";

let catalogPromise = null;

/** { built, books: [...] } with byId, the most-read Gutenberg books. */
export function loadCatalog() {
  catalogPromise ??= fetch("/books/catalog.json")
    .then(r => {
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      return r.json();
    })
    .then(c => ({ ...c, byId: new Map(c.books.map(b => [b.id, b])) }))
    .catch(error => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}

export function useCatalog() {
  const [state, setState] = useState({ catalog: null, error: null });
  useEffect(() => {
    let live = true;
    loadCatalog().then(
      catalog => live && setState({ catalog, error: null }),
      error => live && setState({ catalog: null, error })
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

const shards = new Map();
/** A catalog book's summary, from the small file that holds it. */
export async function catalogSummary(id) {
  if (!Number.isInteger(id)) return null;
  const n = id % SUMMARY_SHARDS;
  if (!shards.has(n)) {
    shards.set(
      n,
      fetch(`/books/sum/${String(n).padStart(2, "0")}.json`)
        .then(r => (r.ok ? r.json() : {}))
        .catch(() => {
          shards.delete(n);
          return {};
        })
    );
  }
  return (await shards.get(n))[id] ?? null;
}

async function api(route, params, timeout = 25000) {
  const r = await fetch(`/api/apps/${route}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(timeout) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
  return body;
}

/** Search all of Project Gutenberg. */
export const searchBooks = (q, page = 1) => api("books", { q, page });

const details = new Map();
/** One book with its summary, from the catalog when it's there. */
export async function bookDetails(id) {
  const key = String(id);
  if (details.has(key)) return details.get(key);
  const load = (async () => {
    if (Number.isInteger(id)) {
      const catalog = await loadCatalog().catch(() => null);
      const hit = catalog?.byId.get(id);
      if (hit) {
        const summary = await catalogSummary(id);
        if (summary) return { ...hit, summary };
      }
    }
    return (await api("book", { id: key })).book;
  })();
  details.set(key, load);
  load.catch(() => details.delete(key));
  return load;
}

/** Remember a book seen in search results, so its page opens instantly. */
export function rememberBook(book) {
  if (book?.id !== undefined && book.summary !== undefined) details.set(String(book.id), Promise.resolve(book));
}

let standardPromise = null;
export function standardBooks() {
  standardPromise ??= api("standard", {}).then(
    r => {
      r.books.forEach(rememberBook);
      return r.books;
    },
    error => {
      standardPromise = null;
      throw error;
    }
  );
  return standardPromise;
}

// ── This device's book cache ─────────────────────────────────────────────

const DB = "bookfox";
const STORE = "texts";
const KEEP = 24; // books kept for offline besides the ones you pinned

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("No IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

export async function cachedText(key) {
  try {
    return (await tx("readonly", s => s.get(key))) ?? null;
  } catch {
    return null;
  }
}

/** Keys of the books on this device: { key: { pinned, savedAt, size } }. */
export async function cachedKeys() {
  try {
    const all = await tx("readonly", s => s.getAll());
    return Object.fromEntries(all.map(r => [r.key, { pinned: Boolean(r.pinned), savedAt: r.savedAt, size: r.size ?? 0 }]));
  } catch {
    return {};
  }
}

async function putText(record) {
  try {
    await tx("readwrite", s => s.put(record));
    const all = await tx("readonly", s => s.getAll());
    const loose = all.filter(r => !r.pinned).sort((a, b) => (b.readAt ?? b.savedAt).localeCompare(a.readAt ?? a.savedAt));
    if (loose.length > KEEP) await tx("readwrite", s => loose.slice(KEEP).forEach(r => s.delete(r.key)));
  } catch {
    // Private browsing or storage full: the book still opens for this visit.
  }
}

export async function setPinned(key, pinned) {
  const r = await cachedText(key);
  if (r) await putText({ ...r, pinned });
}

export async function forgetText(key) {
  try {
    await tx("readwrite", s => s.delete(key));
  } catch {
    /* nothing to remove */
  }
}

export async function touchText(key) {
  const r = await cachedText(key);
  if (r) await putText({ ...r, readAt: new Date().toISOString() });
}

/**
 * A book's text: { blocks, start, end, source }. From this device when it's
 * cached, otherwise downloaded (in parts for very long books) and cached.
 * onProgress(0..1) reports download progress.
 */
export async function loadText(key, onProgress) {
  const cached = await cachedText(key);
  if (cached?.blocks?.length) {
    touchText(key);
    return cached;
  }
  const first = await api("book-text", { id: key, part: 0 }, 60000);
  const blocks = [...first.blocks];
  onProgress?.(1 / first.parts);
  for (let part = 1; part < first.parts; part++) {
    const next = await api("book-text", { id: key, part }, 60000);
    blocks.push(...next.blocks);
    onProgress?.((part + 1) / first.parts);
  }
  const now = new Date().toISOString();
  const record = { key, blocks, start: first.start, end: first.end, source: first.source, savedAt: now, readAt: now, size: JSON.stringify(blocks).length };
  putText(record);
  return record;
}
