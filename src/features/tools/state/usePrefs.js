import { useCallback, useEffect, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";

// Engineer ToolFox remembers the unit system, favorites and recently used tools in this browser.
const KEY = "toolfox-prefs-v1";
const EMPTY = { system: "si", favorites: [], recent: [], units: {}, job: null };

function load() {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return EMPTY;
  }
}

// Tools that were folded into another one keep their place in favorites and recents.
const MOVED = { "calc:beam-builder": "calc:beam" };
const keys = (list) => [...new Set(list.filter((x) => typeof x === "string").map((x) => MOVED[x] || x))];

function clean(raw) {
  if (!raw || typeof raw !== "object") return EMPTY;
  return {
    system: raw.system === "us" ? "us" : "si",
    favorites: Array.isArray(raw.favorites) ? keys(raw.favorites) : [],
    recent: Array.isArray(raw.recent) ? keys(raw.recent).slice(0, 8) : [],
    units: raw.units && typeof raw.units === "object" ? raw.units : {},
    // The profession kit someone picked ("hvac-tech"), shown first on the home page.
    job: typeof raw.job === "string" && raw.job.length < 60 ? raw.job : null,
  };
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Storage can be blocked (private windows); the app still works without it.
    }
  }, [prefs]);

  const setSystem = useCallback((system) => setPrefs((p) => ({ ...p, system, units: {} })), []);
  const toggleFavorite = useCallback(
    (key) => setPrefs((p) => ({ ...p, favorites: p.favorites.includes(key) ? p.favorites.filter((x) => x !== key) : [key, ...p.favorites] })),
    []
  );
  const touch = useCallback((key) => setPrefs((p) => (p.recent[0] === key ? p : { ...p, recent: [key, ...p.recent.filter((x) => x !== key)].slice(0, 8) })), []);
  /** Remember a unit someone picked for a dimension, so it sticks across tools. */
  const setUnit = useCallback((dim, unit) => setPrefs((p) => ({ ...p, units: { ...p.units, [dim]: unit } })), []);

  const setJob = useCallback((job) => setPrefs((p) => ({ ...p, job: job || null })), []);

  const syncStatus = useAccountSync("tools_user_data", prefs, (doc) => setPrefs(clean(doc)), EMPTY);

  return { prefs, syncStatus, setSystem, toggleFavorite, touch, setUnit, setJob };
}
