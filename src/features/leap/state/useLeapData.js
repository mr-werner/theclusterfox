import { useCallback, useEffect, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";
import { cleanResult, emptyData, loadData, MAX_RESULTS, normalizeData, saveData, STORAGE_KEY } from "./leapStore";

const stamp = d => ({ ...d, updatedAt: new Date().toISOString() });

export function useLeapData() {
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

  const change = useCallback(fn => setData(d => stamp(fn(d))), []);

  const setPrefs = useCallback(p => change(d => ({ ...d, prefs: { ...d.prefs, ...p } })), [change]);

  const startPlan = useCallback((options, today) =>
    change(d => normalizeData({ ...d, plan: { id: `p${Date.now().toString(36)}`, createdAt: today, options, done: {}, checks: {} } })), [change]);

  const deletePlan = useCallback(() => change(d => ({ ...d, plan: null })), [change]);

  const markDone = useCallback((sessionId, day) =>
    change(d => {
      if (!d.plan) return d;
      const done = { ...d.plan.done };
      if (day) done[sessionId] = day;
      else delete done[sessionId];
      return { ...d, plan: { ...d.plan, done } };
    }), [change]);

  const toggleCheck = useCallback((sessionId, key) =>
    change(d => {
      if (!d.plan) return d;
      const list = d.plan.checks[sessionId] ?? [];
      const next = list.includes(key) ? list.filter(k => k !== key) : [...list, key];
      return { ...d, plan: { ...d.plan, checks: { ...d.plan.checks, [sessionId]: next } } };
    }), [change]);

  const addResult = useCallback(r => {
    const clean = cleanResult({ ...r, id: `r${Date.now().toString(36)}` });
    if (!clean) return null;
    change(d => ({ ...d, results: [clean, ...d.results].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, MAX_RESULTS) }));
    return clean;
  }, [change]);

  const deleteResult = useCallback(id => change(d => ({ ...d, results: d.results.filter(r => r.id !== id) })), [change]);

  const syncStatus = useAccountSync("leap_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, setPrefs, startPlan, deletePlan, markDone, toggleCheck, addResult, deleteResult };
}
