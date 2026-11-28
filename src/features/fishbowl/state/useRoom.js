import { useCallback, useEffect, useRef, useState } from "react";

// The phone's side of a Fishbowl room: remembers which room you're in,
// polls the server about once a second, keeps the clock in step with the
// server's, and sends moves.

const SESSION_KEY = "fishbowl-session-v1";
const PLAYER_KEY = "fishbowl-player-v1";
const API = "/api/apps/fishbowl";

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the game still works until the page reloads.
  }
}

let memoryPlayer = null;
/** This phone's player id, kept so a reload puts you back in your seat. */
export function playerId() {
  let id = read(PLAYER_KEY) || memoryPlayer;
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, "");
    write(PLAYER_KEY, id);
  }
  memoryPlayer = id;
  return id;
}

async function call(method, body, query) {
  const url = method === "GET" ? `${API}?${new URLSearchParams(query)}` : API;
  const res = await fetch(url, {
    method,
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // fall through
  }
  if (!res.ok) {
    const error = new Error(data?.error || "Couldn't reach the game. Check your connection.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export function useRoom() {
  const [session, setSession] = useState(() => read(SESSION_KEY));
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(null);
  const offset = useRef({ value: 0, rtt: Infinity, at: 0 });
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const take = useCallback((data, t0, t1) => {
    if (data?.now) {
      const rtt = t1 - t0;
      const o = offset.current;
      // Keep the sample with the quickest round trip, refreshed now and then.
      if (rtt <= o.rtt || t1 - o.at > 30000) offset.current = { value: data.now - (t0 + t1) / 2, rtt, at: t1 };
    }
    if (data?.room) {
      version.current = data.version;
      setRoom(data.room);
    }
  }, []);

  const leaveLocal = useCallback(() => {
    write(SESSION_KEY, null);
    setSession(null);
    setRoom(null);
    version.current = null;
  }, []);

  // Poll while in a room.
  useEffect(() => {
    if (!session) return undefined;
    let stop = false;
    let timer = null;
    version.current = null;
    async function poll() {
      const s = sessionRef.current;
      if (stop || !s) return;
      const t0 = Date.now();
      try {
        const data = await call("GET", null, { room: s.room, password: s.password, player: playerId(), v: version.current ?? "" });
        if (stop) return;
        take(data, t0, Date.now());
        setOffline(false);
      } catch (e) {
        if (stop) return;
        if (e.status === 404 || e.status === 403) {
          setError(e.message);
          leaveLocal();
          return;
        }
        setOffline(true);
      }
      const wait = document.visibilityState === "visible" ? 900 : 4000;
      timer = setTimeout(poll, wait);
    }
    poll();
    const wake = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [session, take, leaveLocal]);

  const enter = useCallback(
    async (op, { room: roomName, password, name }) => {
      setBusy(true);
      setError(null);
      const t0 = Date.now();
      try {
        const data = await call("POST", { op, room: roomName, password, name, player: playerId() });
        take(data, t0, Date.now());
        const next = { room: data.room.roomName, password, name };
        write(SESSION_KEY, next);
        setSession(next);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [take],
  );

  const send = useCallback(
    async (action) => {
      const s = sessionRef.current;
      if (!s) return false;
      setError(null);
      const t0 = Date.now();
      try {
        const data = await call("POST", { op: "act", room: s.room, password: s.password, player: playerId(), action });
        take(data, t0, Date.now());
        return true;
      } catch (e) {
        if (e.status === 404 || e.status === 403) leaveLocal();
        setError(e.message);
        return false;
      }
    },
    [take, leaveLocal],
  );

  const leave = useCallback(async () => {
    if (await send({ type: "leave" })) leaveLocal();
  }, [send, leaveLocal]);

  const serverNow = useCallback(() => Date.now() + offset.current.value, []);

  return { session, room, error, setError, offline, busy, enter, send, leave, leaveLocal, serverNow };
}
