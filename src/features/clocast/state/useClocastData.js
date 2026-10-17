import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { fetchRemoteData, pushRemoteData, SyncUnavailableError } from "./cloudSync";
import { emptyData, loadData, MAX_SAVED_PLACES, mergeData, saveData, toRemote } from "./clocastStore";

const PUSH_DELAY_MS = 1200;

/**
 * Places, activity, body details, and units. Always saved in this browser;
 * when signed in, also kept in sync with the account.
 *
 * syncStatus: "local" | "syncing" | "synced" | "unavailable" | "error"
 */
export function useClocastData() {
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
        const merged = {
          ...(remote ? mergeData(local, remote, { combine: !local.syncedUserId }) : local),
          syncedUserId: userId,
        };
        syncedFor.current = null;
        setData(merged);
        await pushRemoteData(userId, toRemote(merged));
        if (cancelled) return;
        syncedFor.current = userId;
        setSyncStatus("synced");
      } catch (error) {
        if (cancelled) return;
        console.warn("CloCast sync:", error.message);
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
        console.warn("CloCast sync:", error.message);
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

  const setPlace = useCallback(place => update({ place }), [update]);

  const toggleSavedPlace = useCallback(place => {
    update(current => ({
      savedPlaces: current.savedPlaces.some(p => p.id === place.id)
        ? current.savedPlaces.filter(p => p.id !== place.id)
        : [place, ...current.savedPlaces].slice(0, MAX_SAVED_PLACES),
    }));
  }, [update]);

  const setProfile = useCallback(change => {
    update(current => ({ profile: { ...current.profile, ...change } }));
  }, [update]);

  return {
    data,
    syncStatus,
    isSignedIn: Boolean(userId),
    update,
    setPlace,
    toggleSavedPlace,
    setProfile,
  };
}
