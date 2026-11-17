import { useCallback, useEffect, useRef, useState } from "react";

import { addFix, modeById, shouldKeep, trackStats } from "../model/track";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const toFix = p => ({
  lat: p.coords.latitude,
  lon: p.coords.longitude,
  alt: p.coords.altitude,
  accuracy: p.coords.accuracy,
  heading: Number.isFinite(p.coords.heading) && p.coords.speed > 0.5 ? p.coords.heading : null,
  speed: p.coords.speed,
  time: p.timestamp / 1000,
});

/**
 * Records the hike in progress. The GPS is only asked as often as the
 * chosen mode needs (all the time, once a minute, every 3 minutes, or only
 * when you tap Locate me), fixes are only kept when you've moved, and the
 * live dot redraws at most every couple of seconds.
 */
export function useTracker({ data, patch }) {
  const active = data.active;
  const [me, setMe] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const lastKept = useRef(null);
  const lastShown = useRef(0);
  const lastPoint = active?.points[active.points.length - 1] ?? null;
  useEffect(() => {
    lastKept.current = lastPoint;
  }, [lastPoint]);

  const onFix = useCallback(
    fix => {
      setGpsError(null);
      const now = Date.now();
      if (now - lastShown.current > 2000 || !lastShown.current) {
        lastShown.current = now;
        setMe(fix);
      }
      if (!shouldKeep(lastKept.current, fix)) return;
      patch(d => (d.active && !d.active.pausedAt ? { active: { ...d.active, points: addFix(d.active.points, fix) } } : {}));
    },
    [patch]
  );
  const onError = useCallback(e => setGpsError(e.code === 1 ? "Location is off for this site. Allow it in your browser settings to track your hike." : "Waiting for a GPS fix. Open sky helps."), []);

  const recording = Boolean(active && !active.pausedAt);
  const mode = active?.mode;
  useEffect(() => {
    if (!recording || !navigator.geolocation) return undefined;
    const m = modeById(mode);
    if (m.every === null) return undefined;
    if (m.every === 0) {
      const id = navigator.geolocation.watchPosition(p => onFix(toFix(p)), onError, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
      return () => navigator.geolocation.clearWatch(id);
    }
    // Battery saver: one fix now and then, GPS off in between.
    const once = () => navigator.geolocation.getCurrentPosition(p => onFix(toFix(p)), onError, { enableHighAccuracy: true, maximumAge: 10000, timeout: 45000 });
    once();
    const timer = setInterval(once, m.every * 1000);
    // Phones pause timers in the background; take a fix as soon as you look again.
    const onVisible = () => document.visibilityState === "visible" && once();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [recording, mode, onFix, onError]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setGpsError("This browser can't share your location.");
    navigator.geolocation.getCurrentPosition(
      p => {
        const fix = toFix(p);
        lastShown.current = Date.now();
        setMe(fix);
        onFix(fix);
      },
      onError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }, [onFix, onError]);

  const start = useCallback(
    (trail, modeId) => {
      patch({ active: { id: newId(), trailId: trail?.id ?? null, name: trail?.name ?? "Hike", startedAt: Date.now() / 1000, mode: modeId, points: [], pausedAt: null }, trackMode: modeId });
      setTimeout(() => locate(), 0);
    },
    [patch, locate]
  );
  const pause = useCallback(() => patch(d => (d.active ? { active: { ...d.active, pausedAt: Date.now() / 1000 } } : {})), [patch]);
  const resume = useCallback(() => patch(d => (d.active ? { active: { ...d.active, pausedAt: null } } : {})), [patch]);
  const setMode = useCallback(m => patch(d => (d.active ? { active: { ...d.active, mode: m }, trackMode: m } : { trackMode: m })), [patch]);
  const finish = useCallback(() => {
    patch(d => {
      const a = d.active;
      if (!a) return {};
      if (a.points.length < 2) return { active: null };
      const st = trackStats(a.points);
      const hike = { id: a.id, trailId: a.trailId, name: a.name, startedAt: a.startedAt, endedAt: Date.now() / 1000, points: a.points, distance: st.distance, moving: st.moving, gain: st.gain };
      return { active: null, hikes: [hike, ...d.hikes].slice(0, 40) };
    });
  }, [patch]);
  const discard = useCallback(() => patch({ active: null }), [patch]);

  return { active, me, gpsError, locate, start, pause, resume, finish, discard, setMode };
}

/**
 * The phone's compass heading (degrees from true-ish north), when it has
 * one. iPhones ask permission first: call request() from a tap.
 */
export function useCompass(enabled = true) {
  const [heading, setHeading] = useState(null);
  const [state, setState] = useState(() => (typeof window === "undefined" || !("DeviceOrientationEvent" in window) ? "none" : typeof DeviceOrientationEvent.requestPermission === "function" ? "ask" : "on"));
  const frame = useRef(0);
  const latest = useRef(null);

  useEffect(() => {
    if (!enabled || state !== "on") return undefined;
    const absolute = "ondeviceorientationabsolute" in window;
    const type = absolute ? "deviceorientationabsolute" : "deviceorientation";
    let seen = false;
    const on = e => {
      let h = null;
      if (Number.isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading;
      else if ((absolute || e.absolute) && Number.isFinite(e.alpha)) h = 360 - e.alpha;
      if (h === null) return;
      seen = true;
      const angle = window.screen?.orientation?.angle ?? 0;
      latest.current = (h + angle + 360) % 360;
      if (!frame.current) {
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          setHeading(latest.current);
        });
      }
    };
    window.addEventListener(type, on);
    const check = setTimeout(() => !seen && setState("none"), 3000);
    return () => {
      window.removeEventListener(type, on);
      clearTimeout(check);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [enabled, state]);

  const request = useCallback(async () => {
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      setState(r === "granted" ? "on" : "denied");
    } catch {
      setState("denied");
    }
  }, []);

  return { heading, state, request };
}

/** Keep the screen on while navigating, if asked (re-acquired when you come back to the page). */
export function useWakeLock(on) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return undefined;
    let lock = null;
    let stopped = false;
    const get = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (stopped) lock.release();
        else {
          setHeld(true);
          lock.addEventListener("release", () => setHeld(false));
        }
      } catch {
        setHeld(false);
      }
    };
    get();
    const onVisible = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
      setHeld(false);
    };
  }, [on]);
  return held && on;
}
