import { useCallback, useEffect, useState } from "react";
import { loadData, normalizeData, saveData, STORAGE_KEY } from "./hikeStore";

// TrailFox's saved data, kept in this browser and in step across open tabs.
export function useHikeData() {
  const [data, setData] = useState(loadData);

  useEffect(() => saveData(data), [data]);

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

  const patch = useCallback(fn => setData(d => ({ ...d, ...(typeof fn === "function" ? fn(d) : fn), updatedAt: new Date().toISOString() })), []);
  return { data, patch };
}
