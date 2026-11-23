import { useCallback, useState } from "react";

const KEY = "beaconfox-prefs-v1";

export const DEFAULT_PREFS = {
  screen: true,
  torch: false,
  sound: false,
  color: "white",
  wpm: 6,
  message: "HELP 2 PEOPLE AT TRAILHEAD",
  loop: true,
};

export const COLORS = {
  white: { name: "White", hint: "Brightest", value: "#ffffff" },
  red: { name: "Red", hint: "Keeps night vision", value: "#ff1a1a" },
  amber: { name: "Amber", hint: "Easy on the eyes", value: "#ffb020" },
};

export function normalizePrefs(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const bool = (v, d) => (typeof v === "boolean" ? v : d);
  const wpm = Number(p.wpm);
  return {
    screen: bool(p.screen, DEFAULT_PREFS.screen),
    torch: bool(p.torch, DEFAULT_PREFS.torch),
    sound: bool(p.sound, DEFAULT_PREFS.sound),
    color: COLORS[p.color] ? p.color : DEFAULT_PREFS.color,
    wpm: Number.isFinite(wpm) ? Math.min(12, Math.max(3, Math.round(wpm))) : DEFAULT_PREFS.wpm,
    message: typeof p.message === "string" ? p.message.slice(0, 120) : DEFAULT_PREFS.message,
    loop: bool(p.loop, DEFAULT_PREFS.loop),
  };
}

function load() {
  try {
    return normalizePrefs(JSON.parse(window.localStorage.getItem(KEY)));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function usePrefs() {
  const [prefs, setState] = useState(load);
  const setPrefs = useCallback(patch => {
    setState(prev => {
      const next = normalizePrefs({ ...prev, ...patch });
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private mode or full storage: settings last for this visit.
      }
      return next;
    });
  }, []);
  return [prefs, setPrefs];
}
