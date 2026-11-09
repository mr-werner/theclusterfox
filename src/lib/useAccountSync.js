import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { createCloudSync, SyncUnavailableError } from "./cloudSync";
import { firstSyncAction } from "./syncDecision";

const PUSH_DELAY_MS = 1500;

function readStamp(key) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return { updatedAt: raw?.updatedAt ?? null, userId: raw?.userId ?? null };
  } catch {
    return { updatedAt: null, userId: null };
  }
}

function writeStamp(key, stamp) {
  try {
    window.localStorage.setItem(key, JSON.stringify(stamp));
  } catch {
    // Storage blocked: sync still works for this visit.
  }
}

/**
 * Keeps one app's saved settings in step with the ClusterFox account.
 * The app keeps its own state and localStorage as before; this hook only
 * mirrors that document to the account table (row-level security limits
 * every request to the signed-in user's row) and applies the account copy
 * when it is newer. Signed out, nothing changes: the app stays local.
 *
 * replace(doc) must load a document from the account into the app's state.
 * empty is the app's blank document, used when this device was last synced
 * with a different account, so that account's data never moves across.
 * Returns syncStatus: "local" | "syncing" | "synced" | "unavailable" | "error".
 */
export function useAccountSync(table, data, replace, empty) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const stampKey = `clusterfox:sync:${table}`;
  const cloud = useMemo(() => createCloudSync(table), [table]);

  const [state, setState] = useState({ userId: null, status: "local" });
  const status = !userId ? "local" : state.userId === userId ? state.status : "syncing";
  const setStatus = useCallback(s => setState({ userId, status: s }), [userId]);

  const dataRef = useRef(data);
  const replaceRef = useRef(replace);
  const emptyRef = useRef(empty);
  const syncedFor = useRef(null);
  const fromRemote = useRef(false);
  const first = useRef(true);
  const timer = useRef(null);

  useEffect(() => {
    replaceRef.current = replace;
    emptyRef.current = empty;
  });

  // Stamp every local change, so the newest copy can win later.
  useEffect(() => {
    dataRef.current = data;
    if (first.current) {
      first.current = false;
      return;
    }
    if (fromRemote.current) {
      fromRemote.current = false;
      return;
    }
    writeStamp(stampKey, { ...readStamp(stampKey), updatedAt: new Date().toISOString() });
  }, [data, stampKey]);

  // On sign-in: compare with the account copy, then pull or push.
  useEffect(() => {
    if (authLoading) return undefined;
    if (!userId) {
      syncedFor.current = null;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const remote = await cloud.fetchRemoteData(userId);
        if (cancelled) return;
        const local = readStamp(stampKey);
        const action = firstSyncAction(local, remote, userId);
        if (action === "reset") {
          fromRemote.current = true;
          dataRef.current = emptyRef.current;
          replaceRef.current(emptyRef.current);
        }
        if (action === "pull") {
          fromRemote.current = true;
          replaceRef.current(remote.doc);
          writeStamp(stampKey, { updatedAt: remote.updatedAt, userId });
        } else {
          const updatedAt = action === "reset" ? new Date().toISOString() : local.updatedAt ?? new Date().toISOString();
          await cloud.pushRemoteData(userId, { doc: dataRef.current, updatedAt });
          if (cancelled) return;
          writeStamp(stampKey, { updatedAt, userId });
        }
        syncedFor.current = userId;
        setStatus("synced");
      } catch (error) {
        if (cancelled) return;
        console.warn(`${table} sync:`, error.message);
        setStatus(error instanceof SyncUnavailableError ? "unavailable" : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, cloud, stampKey, table, setStatus]);

  // Push later edits, batched.
  useEffect(() => {
    if (!userId || syncedFor.current !== userId) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const stamp = readStamp(stampKey);
      try {
        await cloud.pushRemoteData(userId, { doc: dataRef.current, updatedAt: stamp.updatedAt ?? new Date().toISOString() });
        writeStamp(stampKey, { ...stamp, userId });
        setStatus("synced");
      } catch (error) {
        console.warn(`${table} sync:`, error.message);
        setStatus(error instanceof SyncUnavailableError ? "unavailable" : "error");
      }
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [data, userId, cloud, stampKey, table, setStatus]);

  return status;
}
