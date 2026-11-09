import { useCallback, useEffect, useState } from "react";

// Engineering ToolFox remembers the unit system, favorites and recently used tools in this browser.
const KEY = "toolfox-prefs-v1";
const EMPTY = { system: "si", favorites: [], recent: [], units: {} };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    return {
      system: raw.system === "us" ? "us" : "si",
      favorites: Array.isArray(raw.favorites) ? raw.favorites.filter((x) => typeof x === "string") : [],
      recent: Array.isArray(raw.recent) ? raw.recent.filter((x) => typeof x === "string").slice(0, 8) : [],
      units: raw.units && typeof raw.units === "object" ? raw.units : {},
    };
  } catch {
    return EMPTY;
  }
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

  return { prefs, setSystem, toggleFavorite, touch, setUnit };
}
