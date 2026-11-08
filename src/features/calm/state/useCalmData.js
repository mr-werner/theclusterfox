import { useCallback, useEffect, useState } from "react";
import { loadData, MAX_HISTORY, saveData } from "./calmStore";

export function useCalmData() {
  const [data, setData] = useState(loadData);

  useEffect(() => saveData(data), [data]);

  const setPrefs = useCallback(patch => setData(d => ({ ...d, prefs: { ...d.prefs, ...patch } })), []);

  const toggleFavorite = useCallback(
    id =>
      setData(d => ({
        ...d,
        favorites: d.favorites.includes(id) ? d.favorites.filter(x => x !== id) : [id, ...d.favorites],
      })),
    []
  );

  const addHistory = useCallback(
    entry => setData(d => ({ ...d, history: [entry, ...d.history.filter(h => h.id !== entry.id)].slice(0, MAX_HISTORY) })),
    []
  );

  const setMood = useCallback(
    (id, mood) => setData(d => ({ ...d, history: d.history.map(h => (h.id === id ? { ...h, mood } : h)) })),
    []
  );

  const clearHistory = useCallback(() => setData(d => ({ ...d, history: [] })), []);

  return { data, setPrefs, toggleFavorite, addHistory, setMood, clearHistory };
}
