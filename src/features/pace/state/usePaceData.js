import { useCallback, useEffect, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";
import { cleanActivity, deleteTrack, emptyData, loadData, MAX_ACTIVITIES, normalizeData, saveData, saveTrack, STORAGE_KEY } from "./paceStore";

const stamp = d => ({ ...d, updatedAt: new Date().toISOString() });

export function usePaceData() {
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
  const setProfile = useCallback(p => change(d => ({ ...d, profile: { ...d.profile, ...p } })), [change]);

  const savePlan = useCallback(plan => change(d => ({ ...d, plans: [plan, ...d.plans.filter(p => p.id !== plan.id)].slice(0, 12), activePlanId: plan.id })), [change]);
  const deletePlan = useCallback(id => change(d => {
    const plans = d.plans.filter(p => p.id !== id);
    return { ...d, plans, activePlanId: d.activePlanId === id ? plans[0]?.id ?? null : d.activePlanId };
  }), [change]);
  const setActivePlan = useCallback(id => change(d => ({ ...d, activePlanId: id })), [change]);
  const updatePlan = useCallback((id, fn) => change(d => ({ ...d, plans: d.plans.map(p => (p.id === id ? fn(p) : p)) })), [change]);

  /** Mark a plan session done (with the activity that did it), or undo with null. */
  const markSession = useCallback((planId, sessionId, value) =>
    updatePlan(planId, p => {
      const completed = { ...p.completed };
      const skipped = { ...p.skipped };
      if (value) completed[sessionId] = value;
      else delete completed[sessionId];
      delete skipped[sessionId];
      return { ...p, completed, skipped };
    }), [updatePlan]);

  const skipSession = useCallback((planId, sessionId, skip = true) =>
    updatePlan(planId, p => {
      const skipped = { ...p.skipped };
      if (skip) skipped[sessionId] = true;
      else delete skipped[sessionId];
      return { ...p, skipped };
    }), [updatePlan]);

  /** Log an activity (and its route on this device). Marks its plan session done. */
  const addActivity = useCallback((activity, track) => {
    const clean = cleanActivity({ ...activity, hasTrack: Boolean(track?.length) });
    if (!clean) return null;
    if (track?.length) clean.hasTrack = saveTrack(clean.id, track);
    change(d => {
      const activities = [clean, ...d.activities.filter(a => a.id !== clean.id)].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, MAX_ACTIVITIES);
      let plans = d.plans;
      if (clean.planId && clean.sessionId) {
        plans = plans.map(p => (p.id === clean.planId ? { ...p, completed: { ...p.completed, [clean.sessionId]: clean.id } } : p));
      }
      return { ...d, activities, plans };
    });
    return clean;
  }, [change]);

  const updateActivity = useCallback((id, patch) => change(d => ({ ...d, activities: d.activities.map(a => (a.id === id ? cleanActivity({ ...a, ...patch }) ?? a : a)) })), [change]);

  const deleteActivity = useCallback(id => {
    deleteTrack(id);
    change(d => ({
      ...d,
      activities: d.activities.filter(a => a.id !== id),
      plans: d.plans.map(p => {
        const hit = Object.entries(p.completed).find(([, v]) => v === id);
        if (!hit) return p;
        const completed = { ...p.completed };
        delete completed[hit[0]];
        return { ...p, completed };
      }),
    }));
  }, [change]);

  const syncStatus = useAccountSync("pace_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, setPrefs, setProfile, savePlan, deletePlan, setActivePlan, updatePlan, markSession, skipSession, addActivity, updateActivity, deleteActivity };
}
