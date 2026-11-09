// Browser helpers for cooking: a ticking clock, timer alarms, notifications
// and keeping the screen awake. Each one fails quietly where unsupported.
import { useEffect, useState } from "react";

export function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);
  return now;
}

let audioCtx = null;

// Browsers only allow sound after a tap, so call this from a click handler
// (starting a timer) to unlock audio for the alarm later.
export function primeAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    // No audio available.
  }
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } catch {
    // Notifications unsupported.
  }
}

// A soft three-note kitchen chime.
export function ringAlarm(title, body) {
  try {
    if (audioCtx) {
      const t0 = audioCtx.currentTime;
      [0, 0.35, 0.7].forEach((offset, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = [880, 1046.5, 1318.5][i];
        gain.gain.setValueAtTime(0.0001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.9);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 1);
      });
    }
  } catch {
    // Ignore audio errors.
  }
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400]);
  } catch {
    // Ignore.
  }
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification(title, { body, tag: `cookfox-${title}` });
    }
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

// Keeps the screen on while cooking, where the browser supports it.
export function useWakeLock(enabled) {
  const [supported] = useState(() => typeof navigator !== "undefined" && "wakeLock" in navigator);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled || !supported) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release();
          return;
        }
        setActive(true);
        lock.addEventListener("release", () => setActive(false));
      } catch {
        setActive(false);
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
      setActive(false);
    };
  }, [enabled, supported]);
  return { supported, active };
}
