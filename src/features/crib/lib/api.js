// Talking to /api/apps/crib, and the small WebRTC helpers both phones use.

const API = "/api/apps/crib";
const DEVICE_KEY = "cribfox-device-v1";
const PREFS_KEY = "cribfox-v1";

export async function call(body, { keepalive = false } = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    keepalive,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // fall through
  }
  if (!res.ok) {
    const error = new Error(data?.error || "Couldn't reach the server. Check your connection.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export function readPrefs() {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
export function writePrefs(change) {
  const next = { ...readPrefs(), ...change };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: settings last until the page reloads.
  }
  return next;
}

let memoryDevice = null;
/** This phone's id, plus the role, so one phone can test both sides in two tabs. */
export function peerId(role) {
  let id = memoryDevice;
  try {
    id ||= window.localStorage.getItem(DEVICE_KEY);
  } catch {
    // ignore
  }
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
    try {
      window.localStorage.setItem(DEVICE_KEY, id);
    } catch {
      // ignore
    }
  }
  memoryDevice = id;
  return `${id}-${role === "monitor" ? "m" : "v"}`;
}

let icePromise = null;
/** STUN and (when the site has one) TURN servers. */
export function getIceServers() {
  icePromise ??= call({ op: "ice" })
    .then((d) => d.iceServers)
    .catch(() => {
      icePromise = null;
      return [{ urls: "stun:stun.l.google.com:19302" }];
    });
  return icePromise;
}

/** Resolves once the connection has found its addresses (or after `ms`). */
export function gathered(pc, ms = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const timer = setTimeout(done, ms);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
