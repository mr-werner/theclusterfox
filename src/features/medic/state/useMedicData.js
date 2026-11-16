import { useCallback, useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { addAnswer, addResult, emptyData, loadData, normalizeData, saveData, STORAGE_KEY } from "./medicStore";

export function useMedicData() {
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
  const setLevel = useCallback(level => setData(d => stamp({ ...d, level })), []);
  const recordResult = useCallback(result => setData(d => stamp(addResult(d, result))), []);
  const recordAnswer = useCallback((id, right) => setData(d => stamp(addAnswer(d, id, right))), []);

  const syncStatus = useAccountSync("medic_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, setLevel, recordResult, recordAnswer };
}
