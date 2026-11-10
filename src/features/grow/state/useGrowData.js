import { useCallback, useEffect, useRef, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { computeClimate } from "../model/climate";
import { fetchDailyHistory } from "../../../services/garden/climateApi";
import { emptyData, loadData, MAX_DONE, normalizeData, saveData, STORAGE_KEY } from "./growStore";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useGrowData() {
  const [data, setData] = useState(loadData);
  // The last failed climate lookup: { key, message }.
  const [climateError, setClimateError] = useState(null);

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

  const patch = useCallback(fn => setData(d => ({ ...d, ...(typeof fn === "function" ? fn(d) : fn), updatedAt: new Date().toISOString() })), []);

  // Work out the climate whenever the place changes.
  const place = data.place;
  const needsClimate = place && (!data.climate || data.climate.placeId !== place.id);
  const attempt = useRef(0);
  const [retry, setRetry] = useState(0);
  const lookupKey = place ? `${place.id}#${retry}` : null;
  useEffect(() => {
    if (!needsClimate) return undefined;
    const controller = new AbortController();
    const run = ++attempt.current;
    fetchDailyHistory(place, { signal: controller.signal })
      .then(series => {
        if (run !== attempt.current) return;
        const climate = computeClimate(series, place.latitude);
        if (!climate) throw new Error("Not enough weather history for that spot.");
        setData(d => (d.place?.id === place.id ? { ...d, climate: { ...climate, placeId: place.id, fetchedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() } : d));
      })
      .catch(error => {
        if (controller.signal.aborted || run !== attempt.current) return;
        setClimateError({ key: `${place.id}#${retry}`, message: error.message });
      });
    return () => controller.abort();
  }, [needsClimate, place, retry]);
  const failed = needsClimate && climateError?.key === lookupKey;
  const climateStatus = !needsClimate ? { state: "idle", error: null } : failed ? { state: "error", error: climateError.message } : { state: "loading", error: null };

  const setPlace = useCallback(p => patch({ place: p, climate: null, zoneShift: 0 }), [patch]);
  const setPrefs = useCallback(p => patch(d => ({ prefs: { ...d.prefs, ...p } })), [patch]);
  const addSpot = useCallback(spot => {
    const id = newId();
    patch(d => ({ spots: [...d.spots, { soil: "", note: "", ...spot, id }] }));
    return id;
  }, [patch]);
  const updateSpot = useCallback((id, p) => patch(d => ({ spots: d.spots.map(s => (s.id === id ? { ...s, ...p } : s)) })), [patch]);
  const removeSpot = useCallback(id => patch(d => ({ spots: d.spots.filter(s => s.id !== id), garden: d.garden.map(e => (e.spotId === id ? { ...e, spotId: null } : e)) })), [patch]);
  const addEntry = useCallback(entry => {
    const id = newId();
    patch(d => ({ garden: [...d.garden, { qty: 1, name: "", note: "", spotId: null, planted: null, ...entry, id, added: new Date().toISOString() }] }));
    return id;
  }, [patch]);
  const updateEntry = useCallback((id, p) => patch(d => ({ garden: d.garden.map(e => (e.id === id ? { ...e, ...p } : e)) })), [patch]);
  const removeEntry = useCallback(id => patch(d => ({ garden: d.garden.filter(e => e.id !== id) })), [patch]);
  const toggleDone = useCallback(taskId => patch(d => {
    const done = { ...d.done };
    if (done[taskId]) delete done[taskId];
    else done[taskId] = new Date().toISOString();
    const keys = Object.keys(done);
    if (keys.length > MAX_DONE) for (const k of keys.slice(0, keys.length - MAX_DONE)) delete done[k];
    return { done };
  }), [patch]);

  const syncStatus = useAccountSync("grow_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return {
    data,
    patch,
    syncStatus,
    climateStatus,
    retryClimate: () => setRetry(r => r + 1),
    setPlace,
    setPrefs,
    addSpot,
    updateSpot,
    removeSpot,
    addEntry,
    updateEntry,
    removeEntry,
    toggleDone,
  };
}
