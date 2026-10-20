import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { fetchRemoteData, pushRemoteData, SyncUnavailableError } from "./cloudSync";
import { emptyData, loadData, mergeData, saveData, toRemote } from "./planStore";

const PUSH_DELAY_MS = 1200;

/**
 * Calendar items, layers and settings. Always saved in this browser; when
 * signed in, also kept in sync with the account.
 *
 * syncStatus: "local" | "syncing" | "synced" | "unavailable" | "error"
 */
export function usePlanData() {
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
        console.warn("PlanFox sync:", error.message);
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
        console.warn("PlanFox sync:", error.message);
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

  const saveItem = useCallback(item => {
    const id = item.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    update(current => ({
      items: [{ done: [], ...item, id, updatedAt: now }, ...current.items.filter(i => i.id !== id)].sort((x, y) => x.day.localeCompare(y.day)),
    }));
    return id;
  }, [update]);

  const deleteItem = useCallback(id => {
    update(current => ({
      items: current.items.filter(i => i.id !== id),
      deletedItemIds: [...current.deletedItemIds, { id, at: new Date().toISOString() }].slice(-300),
    }));
  }, [update]);

  // Tasks and bills are checked off one occurrence at a time.
  const toggleDone = useCallback((id, day) => {
    const now = new Date().toISOString();
    update(current => ({
      items: current.items.map(i =>
        i.id === id ? { ...i, done: i.done.includes(day) ? i.done.filter(d => d !== day) : [...i.done, day], updatedAt: now } : i
      ),
    }));
  }, [update]);

  const toggleLayer = useCallback(id => {
    update(current => ({ layers: { ...current.layers, [id]: !current.layers[id] } }));
  }, [update]);

  return { data, update, saveItem, deleteItem, toggleDone, toggleLayer, syncStatus, isSignedIn: Boolean(userId) };
}
