import { useCallback, useEffect, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";
import { STORAGE_KEY as TASKFOX_KEY } from "../../plan/state/planStore";
import { emptyData, fromTaskFox, loadData, normalizeData, saveData, STORAGE_KEY } from "./tripStore";

export function readTaskFox() {
  try {
    return JSON.parse(window.localStorage.getItem(TASKFOX_KEY) ?? "null");
  } catch {
    return null;
  }
}

// On first use, start from the town and airport TaskFox already knows.
function firstLoad() {
  const data = loadData();
  if (data.home || data.homeAirport || data.trips.length) return data;
  return normalizeData({ ...data, ...fromTaskFox(readTaskFox()) });
}

export function useTripData() {
  const [data, setData] = useState(firstLoad);

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

  // fn: (data) => partial data. Every change is stamped so account sync knows which copy is newer.
  const change = useCallback(
    fn =>
      setData(d => {
        const patch = fn(d);
        if (!patch) return d;
        return normalizeData({ ...d, ...patch, updatedAt: new Date().toISOString() });
      }),
    []
  );

  /** Change one trip: fn(trip) => partial trip. */
  const changeTrip = useCallback((id, fn) => change(d => ({ trips: d.trips.map(t => (t.id === id ? { ...t, ...fn(t) } : t)) })), [change]);

  const syncStatus = useAccountSync("trip_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, change, changeTrip, syncStatus };
}
