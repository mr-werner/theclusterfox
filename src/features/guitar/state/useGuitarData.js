import { useCallback, useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { addPractice, addSong, emptyData, loadData, normalizeData, removeSong, saveData, STORAGE_KEY } from "./guitarStore";

export function useGuitarData() {
  const [data, setData] = useState(loadData);

  useEffect(() => saveData(data), [data]);

  // Keep two open tabs in step.
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
  const setPrefs = useCallback(patch => setData(d => stamp({ ...d, prefs: { ...d.prefs, ...patch } })), []);
  const recordPractice = useCallback(run => setData(d => stamp(addPractice(d, run))), []);
  const saveSong = useCallback(song => setData(d => stamp(addSong(d, song))), []);
  const deleteSong = useCallback(id => setData(d => stamp(removeSong(d, id))), []);

  const syncStatus = useAccountSync("guitar_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, setPrefs, recordPractice, saveSong, deleteSong };
}
