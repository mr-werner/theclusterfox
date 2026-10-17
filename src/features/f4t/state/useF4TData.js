import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { fetchRemoteData, pushRemoteData, SyncUnavailableError } from "./cloudSync";
import {
  emptyData,
  loadData,
  MAX_RECENT_FOODS,
  mergeData,
  saveData,
  toRemote,
} from "./f4tStore";

const PUSH_DELAY_MS = 1200;

/**
 * Saved meals, favorites, adjustments, and weight. Always saved in this
 * browser; when signed in, also kept in sync with the account.
 *
 * syncStatus: "local" | "syncing" | "synced" | "unavailable" | "error"
 */
export function useF4TData() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState(loadData);
  // Status is tracked per account so signing in or out resets it.
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
        const merged = {
          ...(remote ? mergeData(local, remote, { combine: !local.syncedUserId }) : local),
          syncedUserId: userId,
        };
        // The merge is pushed just below; keep the edit watcher from pushing it too.
        syncedFor.current = null;
        setData(merged);
        await pushRemoteData(userId, toRemote(merged));
        if (cancelled) return;
        syncedFor.current = userId;
        setSyncStatus("synced");
      } catch (error) {
        if (cancelled) return;
        console.warn("F4T sync:", error.message);
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
        console.warn("F4T sync:", error.message);
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

  const setWeight = useCallback((weightLbs, weightUnit) => {
    update({ weightLbs: Number(weightLbs) > 0 ? Number(weightLbs) : null, weightUnit });
  }, [update]);

  const setFavorites = useCallback(favorites => update({ favorites }), [update]);

  const setSelection = useCallback((groupKey, activityId) => {
    update(current => ({ selections: { ...current.selections, [groupKey]: activityId } }));
  }, [update]);

  const saveMeal = useCallback(({ id, name, items }) => {
    const mealId = id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    update(current => {
      const existing = current.meals.find(meal => meal.id === mealId);
      const meal = { id: mealId, name, items: items.map(stripItemId), createdAt: existing?.createdAt ?? now, updatedAt: now };
      return { meals: [meal, ...current.meals.filter(m => m.id !== mealId)] };
    });
    return mealId;
  }, [update]);

  const deleteMeal = useCallback(id => {
    update(current => ({
      meals: current.meals.filter(meal => meal.id !== id),
      deletedMealIds: [...current.deletedMealIds, { id, at: new Date().toISOString() }].slice(-200),
    }));
  }, [update]);

  const rememberFood = useCallback(item => {
    const food = stripItemId({ ...item, servings: 1 });
    update(current => ({
      recentFoods: [
        food,
        ...current.recentFoods.filter(f => !(f.fdcId === food.fdcId && f.name === food.name)),
      ].slice(0, MAX_RECENT_FOODS),
    }));
  }, [update]);

  return {
    data,
    syncStatus,
    isSignedIn: Boolean(userId),
    setWeight,
    setFavorites,
    setSelection,
    saveMeal,
    deleteMeal,
    rememberFood,
  };
}

function stripItemId(item) {
  // eslint-disable-next-line no-unused-vars
  const { id, ...rest } = item;
  return rest;
}
