import { useCallback, useEffect, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";
import { STUDY_LINKS } from "../../../app/studyLinks";
import { dayKey } from "../model/dates";
import { addDeck, emptyData, loadData, normalizeData, recordPractice, recordReview, removeDeck, saveData, STORAGE_KEY } from "./studyStore";

export function useStudyData() {
  const [data, setData] = useState(loadData);

  useEffect(() => saveData(data), [data]);

  // Keep step with other tabs, and with "Add to Study" pressed in another app's window.
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        setData(normalizeData(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stamp = d => ({ ...d, updatedAt: new Date().toISOString() });
  const add = useCallback(ref => setData(d => stamp(addDeck(d, ref))), []);
  const remove = useCallback((app, id) => setData(d => stamp(removeDeck(d, app, id))), []);
  const review = useCallback((key, rating) => setData(d => stamp(recordReview(d, key, rating, dayKey()))), []);
  const practice = useCallback((key, right) => setData(d => stamp(recordPractice(d, key, right, dayKey()))), []);
  const setSettings = useCallback(patch => setData(d => stamp({ ...d, settings: { ...d.settings, ...patch } })), []);

  const syncStatus = useAccountSync("study_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, add, remove, review, practice, setSettings };
}

// ── Loading linked material ─────────────────────────────────────────────
const modules = new Map();
const decks = new Map();
const catalogs = new Map();

function loadModule(app) {
  const link = STUDY_LINKS.find(l => l.app === app);
  if (!link) return Promise.reject(new Error(`No study material from ${app}`));
  if (!modules.has(app)) {
    const p = link.load().catch(e => {
      modules.delete(app);
      throw e;
    });
    modules.set(app, p);
  }
  return modules.get(app);
}

/** One deck's live material from its app, cached for this visit. */
export function loadDeck(app, id) {
  const key = `${app}:${id}`;
  if (!decks.has(key)) {
    const p = loadModule(app)
      .then(mod => mod.deck(id))
      .catch(e => {
        decks.delete(key);
        throw e;
      });
    decks.set(key, p);
  }
  return decks.get(key);
}

/** What an app offers: [{ id, title, blurb, group }]. */
export function loadCatalog(app) {
  if (!catalogs.has(app)) {
    const p = loadModule(app)
      .then(mod => mod.decks())
      .catch(e => {
        catalogs.delete(app);
        throw e;
      });
    catalogs.set(app, p);
  }
  return catalogs.get(app);
}

/** { status, deck } for one deck ref. */
export function useDeck(app, id) {
  const key = app && id ? `${app}:${id}` : null;
  const [state, setState] = useState({ key: null, status: "loading", deck: null });
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    loadDeck(app, id)
      .then(deck => live && setState({ key, status: deck ? "ready" : "missing", deck }))
      .catch(() => live && setState({ key, status: "error", deck: null }));
    return () => {
      live = false;
    };
  }, [key, app, id]);
  return state.key === key ? state : { key, status: "loading", deck: null };
}

/** [{ ref, deck, status }] for every deck on the shelf, filled in as they load. */
export function useShelfDecks(refs) {
  const keys = refs.map(r => `${r.app}:${r.id}`);
  const sig = keys.join("|");
  const [results, setResults] = useState(() => new Map());
  useEffect(() => {
    let live = true;
    for (const k of sig ? sig.split("|") : []) {
      const at = k.indexOf(":");
      loadDeck(k.slice(0, at), k.slice(at + 1))
        .then(deck => ({ deck, status: deck ? "ready" : "missing" }))
        .catch(() => ({ deck: null, status: "error" }))
        .then(res => live && setResults(m => new Map(m).set(k, res)));
    }
    return () => {
      live = false;
    };
  }, [sig]);
  return keys.map(k => {
    const at = k.indexOf(":");
    return { ref: { app: k.slice(0, at), id: k.slice(at + 1) }, ...(results.get(k) ?? { deck: null, status: "loading" }) };
  });
}
