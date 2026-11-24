import { useCallback, useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { emptyData, loadData, normalizeData, saveData, STORAGE_KEY } from "./groceryStore";
import { COOK_STORES_KEY, readCook } from "../model/cookLink";

// On first use, start from the place and stores CookFox already compares.
function firstLoad() {
  const data = loadData();
  if (data.place || data.stores.length) return data;
  const cook = readCook(COOK_STORES_KEY);
  if (!cook || typeof cook !== "object") return data;
  return normalizeData({ ...data, place: cook.place, radius: cook.radius, stores: cook.picked, typed: cook.typed, chosen: cook.chosen });
}

export function useGroceryData() {
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
  const setList = useCallback(fn => change(d => ({ list: fn(d.list) })), [change]);

  const syncStatus = useAccountSync("grocery_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, change, setList, syncStatus };
}
