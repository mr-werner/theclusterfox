import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { fetchRemoteData, pushRemoteData, SyncUnavailableError } from "./cloudSync";
import { emptyData, loadData, MAX_HISTORY, mergeData, saveData, toRemote } from "./liftStore";

const PUSH_DELAY_MS = 1500;

/**
 * Settings, the workout in progress, history and plans. Always saved in this
 * browser; when signed in, also kept in sync with the account.
 *
 * syncStatus: "local" | "syncing" | "synced" | "unavailable" | "error"
 */
export function useLiftData() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState(loadData);
  const [syncState, setSyncState] = useState({ userId: null, status: "local" });
  const setSyncStatus = useCallback(status => setSyncState({ userId, status }), [userId]);
  const syncStatus = !userId ? "local" : syncState.userId === userId ? syncState.status : "syncing";
  const syncedFor = useRef(null);
  const pushTimer = useRef(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
    saveData(data);
  }, [data]);

  // Pull and merge the account copy when someone signs in.
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      syncedFor.current = null;
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchRemoteData(userId);
        if (cancelled) return;
        const current = dataRef.current;
        // Data last synced to a different account stays with that account.
        const local = current.syncedUserId && current.syncedUserId !== userId ? emptyData() : current;
        const merged = { ...(remote ? mergeData(local, remote) : local), syncedUserId: userId };
        syncedFor.current = null;
        setData(merged);
        await pushRemoteData(userId, toRemote(merged));
        if (cancelled) return;
        syncedFor.current = userId;
        setSyncStatus("synced");
      } catch (error) {
        if (cancelled) return;
        console.warn("LiftFox sync:", error.message);
        setSyncStatus(error instanceof SyncUnavailableError ? "unavailable" : "error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, setSyncStatus]);

  // Push later edits, batched.
  useEffect(() => {
    if (!userId || syncedFor.current !== userId) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        await pushRemoteData(userId, toRemote(data));
        setSyncStatus("synced");
      } catch (error) {
        console.warn("LiftFox sync:", error.message);
        setSyncStatus(error instanceof SyncUnavailableError ? "unavailable" : "error");
      }
    }, PUSH_DELAY_MS);
    return () => clearTimeout(pushTimer.current);
  }, [data, userId, setSyncStatus]);

  const update = useCallback(change => {
    setData(current => ({
      ...current,
      ...(typeof change === "function" ? change(current) : change),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setPrefs = useCallback(change => {
    update(current => ({ prefs: { ...current.prefs, ...change } }));
  }, [update]);

  const startWorkout = useCallback(workout => {
    update({ current: { ...workout, id: crypto.randomUUID(), startedAt: new Date().toISOString(), warmupDone: false, cooldownDone: false } });
  }, [update]);

  const updateCurrent = useCallback(change => {
    update(current => (current.current ? { current: { ...current.current, ...(typeof change === "function" ? change(current.current) : change) } } : {}));
  }, [update]);

  const discardWorkout = useCallback(() => update({ current: null }), [update]);

  // Logs the workout and, if it came from a plan, ticks that session off.
  const finishWorkout = useCallback(date => {
    update(current => {
      const w = current.current;
      if (!w) return {};
      const now = new Date().toISOString();
      const setsTotal = w.items.reduce((n, i) => n + i.sets, 0);
      const setsDone = w.items.reduce((n, i) => n + i.done.filter(Boolean).length, 0);
      const loads = Object.fromEntries(w.items.filter(i => i.load).map(i => [i.exerciseId, i.load]));
      const entry = {
        id: w.id, date, title: w.title, goal: w.goal, minutes: w.minutes, muscles: w.muscles,
        setsDone, setsTotal, loads, planId: w.planId ?? null, sessionId: w.sessionId ?? null, updatedAt: now,
      };
      const plans = w.planId
        ? current.plans.map(p => (p.id === w.planId ? { ...p, completed: { ...p.completed, [w.sessionId]: date }, updatedAt: now } : p))
        : current.plans;
      return { current: null, history: [entry, ...current.history.filter(h => h.id !== entry.id)].slice(0, MAX_HISTORY), plans };
    });
  }, [update]);

  const deleteHistory = useCallback(id => {
    update(current => ({
      history: current.history.filter(h => h.id !== id),
      deletedHistoryIds: [...current.deletedHistoryIds, { id, at: new Date().toISOString() }].slice(-200),
    }));
  }, [update]);

  const savePlan = useCallback(program => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    update(current => ({
      plans: [{ id, createdAt: now, updatedAt: now, program, completed: {} }, ...current.plans],
      activePlanId: id,
    }));
    return id;
  }, [update]);

  const deletePlan = useCallback(id => {
    update(current => {
      const plans = current.plans.filter(p => p.id !== id);
      return {
        plans,
        activePlanId: current.activePlanId === id ? plans[0]?.id ?? null : current.activePlanId,
        deletedPlanIds: [...current.deletedPlanIds, { id, at: new Date().toISOString() }].slice(-200),
      };
    });
  }, [update]);

  const toggleSession = useCallback((planId, sessionId, date) => {
    const now = new Date().toISOString();
    update(current => ({
      plans: current.plans.map(p => {
        if (p.id !== planId) return p;
        const completed = { ...p.completed };
        if (completed[sessionId]) delete completed[sessionId];
        else completed[sessionId] = date;
        return { ...p, completed, updatedAt: now };
      }),
    }));
  }, [update]);

  return {
    data,
    syncStatus,
    isSignedIn: Boolean(userId),
    authLoading,
    update,
    setPrefs,
    startWorkout,
    updateCurrent,
    discardWorkout,
    finishWorkout,
    deleteHistory,
    savePlan,
    deletePlan,
    toggleSession,
  };
}
