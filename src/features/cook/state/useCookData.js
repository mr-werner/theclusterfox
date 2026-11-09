import { useCallback, useEffect, useState } from "react";
import { loadData, MAX_HISTORY, saveData, emptyData, STORAGE_KEY, normalizeData } from "./cookStore";

export function useCookData() {
  const [data, setData] = useState(loadData);

  // Save after every change, so a refresh or closed tab never loses progress.
  useEffect(() => saveData(data), [data]);

  // Keep two open tabs in step.
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        setData(normalizeData(JSON.parse(e.newValue)));
      } catch {
        // Ignore malformed data from elsewhere.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPrefs = useCallback(patch => setData(d => ({ ...d, prefs: { ...d.prefs, ...patch } })), []);
  const setProfile = useCallback(patch => setData(d => ({ ...d, profile: { ...d.profile, ...patch } })), []);
  const resetProfile = useCallback(() => setData(d => ({ ...d, profile: emptyData().profile })), []);

  const toggleFavorite = useCallback(
    id =>
      setData(d => ({
        ...d,
        favorites: d.favorites.includes(id) ? d.favorites.filter(x => x !== id) : [id, ...d.favorites],
      })),
    []
  );

  // update is a function (session) => session, or null to remove it.
  const updateSession = useCallback(
    (recipeId, update) =>
      setData(d => {
        const current = d.sessions[recipeId] ?? null;
        const next = typeof update === "function" ? update(current) : update;
        const sessions = { ...d.sessions };
        if (next) sessions[recipeId] = next;
        else delete sessions[recipeId];
        return { ...d, sessions };
      }),
    []
  );

  const addHistory = useCallback(
    entry => setData(d => ({ ...d, history: [entry, ...d.history.filter(h => h.id !== entry.id)].slice(0, MAX_HISTORY) })),
    []
  );
  const updateHistory = useCallback(
    (id, patch) => setData(d => ({ ...d, history: d.history.map(h => (h.id === id ? { ...h, ...patch } : h)) })),
    []
  );
  const removeHistory = useCallback(id => setData(d => ({ ...d, history: d.history.filter(h => h.id !== id) })), []);
  const clearHistory = useCallback(() => setData(d => ({ ...d, history: [] })), []);

  // fn: (pantry) => pantry, (shopping) => shopping, or (data) => partial data
  const setPantry = useCallback(fn => setData(d => ({ ...d, pantry: fn(d.pantry) })), []);
  const setShopping = useCallback(fn => setData(d => ({ ...d, shopping: fn(d.shopping) })), []);
  const patchData = useCallback(fn => setData(d => ({ ...d, ...fn(d) })), []);

  return { data, setPantry, setShopping, patchData, setPrefs, setProfile, resetProfile, toggleFavorite, updateSession, addHistory, updateHistory, removeHistory, clearHistory };
}
