import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { apps } from "../../../app/apps";
import { fetchRemoteData, pushRemoteData, SyncUnavailableError } from "./cloudSync";
import {
  addKey,
  emptyLayout,
  homeKeys,
  loadLayout,
  mergeLayout,
  moveKey,
  removeKey,
  saveLayout,
  toRemote,
} from "./homeStore";

const PUSH_DELAY_MS = 1200;
const originalIds = apps.map(app => app.id);

/**
 * Which apps are on the home screen. Always saved in this browser; when
 * signed in, also kept in sync with the ClusterFox account.
 *
 * syncStatus: "local" | "syncing" | "synced" | "unavailable" | "error"
 */
export function useHomeLayout() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [layout, setLayout] = useState(loadLayout);
  const [syncState, setSyncState] = useState({ userId: null, status: "local" });
  const setSyncStatus = useCallback(status => setSyncState({ userId, status }), [userId]);
  const syncStatus = !userId ? "local" : syncState.userId === userId ? syncState.status : "syncing";
  const syncedFor = useRef(null);
  const pushTimer = useRef(null);
  const layoutRef = useRef(layout);

  useEffect(() => {
    layoutRef.current = layout;
    saveLayout(layout);
  }, [layout]);

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
        const current = layoutRef.current;
        // A layout last synced to another account stays with that account.
        const local = current.syncedUserId && current.syncedUserId !== userId ? emptyLayout() : current;
        const merged = { ...(remote ? mergeLayout(local, remote) : local), syncedUserId: userId };
        syncedFor.current = null;
        setLayout(merged);
        await pushRemoteData(userId, toRemote(merged));
        if (cancelled) return;
        syncedFor.current = userId;
        setSyncStatus("synced");
      } catch (error) {
        if (cancelled) return;
        console.warn("Home screen sync:", error.message);
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
        await pushRemoteData(userId, toRemote(layout));
        setSyncStatus("synced");
      } catch (error) {
        console.warn("Home screen sync:", error.message);
        setSyncStatus(error instanceof SyncUnavailableError ? "unavailable" : "error");
      }
    }, PUSH_DELAY_MS);
    return () => clearTimeout(pushTimer.current);
  }, [layout, userId, setSyncStatus]);

  const keys = useMemo(() => homeKeys(layout, originalIds), [layout]);
  const keySet = useMemo(() => new Set(keys), [keys]);

  const change = useCallback(fn => {
    setLayout(current => {
      const next = fn(current, homeKeys(current, originalIds));
      return next === current ? current : { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const add = useCallback(key => change((l, cur) => addKey(l, cur, key)), [change]);
  const remove = useCallback(key => change((l, cur) => removeKey(l, cur, key)), [change]);
  const move = useCallback((key, targetKey) => change((l, cur) => moveKey(l, cur, key, targetKey)), [change]);
  const reset = useCallback(() => change(() => ({ ...emptyLayout(), syncedUserId: userId })), [change, userId]);

  return {
    keys,
    has: key => keySet.has(key),
    add,
    remove,
    move,
    reset,
    isCustomized: Boolean(layout.updatedAt),
    syncStatus,
    isSignedIn: Boolean(userId),
  };
}
