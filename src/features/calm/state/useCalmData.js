import { useCallback, useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { emptyData, loadData, MAX_HISTORY, normalizeData, saveData } from "./calmStore";

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

  const setLength = useCallback((id, minutes) => setData(d => (d.lengths[id] === minutes ? d : { ...d, lengths: { ...d.lengths, [id]: minutes } })), []);

  const addHistory = useCallback(
    entry => setData(d => ({ ...d, history: [entry, ...d.history.filter(h => h.id !== entry.id)].slice(0, MAX_HISTORY) })),
    []
  );

  const setMood = useCallback(
    (id, mood) => setData(d => ({ ...d, history: d.history.map(h => (h.id === id ? { ...h, mood } : h)) })),
    []
  );

  const clearHistory = useCallback(() => setData(d => ({ ...d, history: [] })), []);

  const syncStatus = useAccountSync("calm_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, setPrefs, toggleFavorite, setLength, addHistory, setMood, clearHistory };
}
