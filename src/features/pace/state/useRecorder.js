import { useCallback, useEffect, useRef, useState } from "react";

import { activeSec, addFix, addSensor, finishLive, newLive, pause as pauseLive, resume as resumeLive, splitAnnouncement, splitMeters, stepAnnouncement, stepAt } from "../model/live";
import { recentSpeed } from "../model/geo";
import { judge, zoneTarget } from "../model/zones";
import { loadLive, saveLive } from "./paceStore";

// ---- Sound, voice and buzz ----------------------------------------------------

let audio = null;
function audioCtx() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    return audio;
  } catch {
    return null;
  }
}

export function beep(freq = 880, ms = 140, gain = 0.25) {
  const ctx = audioCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = freq;
  o.type = "sine";
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + ms / 1000 + 0.02);
}

export function speak(text, { interrupt = false } = {}) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    synth.speak(u);
  } catch {
    // No voice on this device.
  }
}

const buzz = pattern => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
};

// ---- The recorder ---------------------------------------------------------------

const SAVE_EVERY_MS = 4000;
const NAG_EVERY_SEC = 75;

/**
 * Records a run, ride or row: GPS (outdoors), Bluetooth readings, the
 * session's steps with spoken cues, and the screen kept awake.
 * Survives a reload: the recording is saved as it goes and picked up again.
 */
export function useRecorder({ prefs, profile, sensors }) {
  const [live, setLive] = useState(loadLive);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState({ status: "off", acc: null, error: null });
  const [awake, setAwake] = useState(false);
  const liveRef = useRef(live);
  const lastSave = useRef(0);
  const prefsRef = useRef(prefs);
  const profileRef = useRef(profile);
  const lastHr = useRef(null);
  const beeped = useRef(null);

  useEffect(() => {
    prefsRef.current = prefs;
    profileRef.current = profile;
  });

  // Save as it goes (often enough to survive the tab being closed).
  useEffect(() => {
    liveRef.current = live;
    const t = Date.now();
    if (!live || t - lastSave.current > SAVE_EVERY_MS || live.status !== "running") {
      saveLive(live);
      lastSave.current = t;
    }
  }, [live]);
  useEffect(() => {
    const flush = () => saveLive(liveRef.current);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  const recording = Boolean(live);
  const running = live?.status === "running";
  const mode = live?.mode;
  const sport = live?.sport;

  // The clock. Time comes from timestamps, so a sleeping phone loses nothing.
  useEffect(() => {
    if (!recording) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [recording]);

  // GPS while recording outdoors.
  useEffect(() => {
    if (!recording || mode !== "gps") {
      setGps({ status: "off", acc: null, error: null });
      return undefined;
    }
    if (!navigator.geolocation) {
      setGps({ status: "unavailable", acc: null, error: "This browser can't share your location." });
      return undefined;
    }
    setGps(g => ({ ...g, status: g.status === "ok" ? "ok" : "waiting" }));
    const id = navigator.geolocation.watchPosition(
      pos => {
        const c = pos.coords;
        setGps({ status: c.accuracy <= 35 ? "ok" : "weak", acc: Math.round(c.accuracy), error: null });
        setLive(l => (l ? addFix(l, { lat: c.latitude, lon: c.longitude, acc: c.accuracy, ele: c.altitude ?? undefined, t: pos.timestamp || Date.now(), hr: lastHr.current ?? undefined }) : l));
      },
      err => {
        const denied = err.code === 1;
        setGps({ status: denied ? "denied" : "waiting", acc: null, error: denied ? "Location is blocked for this site. Allow it in your browser's site settings to track distance." : "Looking for GPS…" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [recording, mode]);

  // Bluetooth readings while recording.
  useEffect(() => {
    if (!recording) return undefined;
    return sensors.subscribe(v => {
      if (v.hr) lastHr.current = v.hr;
      setLive(l => (l ? addSensor(l, v) : l));
    });
  }, [recording, sensors]);

  // Keep the screen on, and take the lock back when you return to the page.
  useEffect(() => {
    if (!recording || !prefs.keepAwake || !("wakeLock" in navigator)) {
      setAwake(false);
      return undefined;
    }
    let lock = null;
    let gone = false;
    const take = async () => {
      if (document.visibilityState !== "visible" || gone) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        setAwake(true);
        lock.addEventListener("release", () => setAwake(false));
      } catch {
        setAwake(false);
      }
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
    };
  }, [recording, prefs.keepAwake]);

  // Where you are in the session, how fast you're going, and what to say.
  const sec = live ? activeSec(live, now) : 0;
  const at = live ? stepAt(live.steps, sec) : null;
  const speed = live?.mode === "gps" ? recentSpeed(live.points, 20, now) : sensors.values.speed ?? (sensors.values.split ? 500 / sensors.values.split : null);
  const target = at && sport ? zoneTarget(at.step.zone, sport, profile, prefs.unit) : null;
  const metricValue = !target?.metric
    ? null
    : target.metric === "pace"
      ? speed > 0.5 ? (prefs.unit === "km" ? 1000 : 1609.344) / speed : null
      : target.metric === "split"
        ? sensors.values.split ?? (speed > 0.5 ? 500 / speed : null)
        : target.metric === "power"
          ? sensors.values.power ?? null
          : sensors.values.hr ?? null;
  const verdict = target?.metric && at && at.step.kind !== "rest" && at.step.kind !== "warm" && at.step.kind !== "cool" && at.into > 20 ? judge(target.metric, target.low, target.high, metricValue) : null;

  useEffect(() => {
    const l = liveRef.current;
    if (!l || l.status !== "running") return;
    const p = prefsRef.current;
    const cues = { ...l.cues };
    let changed = false;

    // A new step: say it, buzz, chime.
    if (at && at.index !== cues.step) {
      const t = zoneTarget(at.step.zone, l.sport, profileRef.current, p.unit);
      const fresh = cues.step === -1 || sec - (cues.stepAt ?? 0) > 2;
      cues.step = at.index;
      cues.stepAt = sec;
      cues.nagAt = sec;
      changed = true;
      if (fresh) {
        beep(at.step.kind === "work" ? 1175 : 660, 220);
        buzz(at.step.kind === "work" ? [250, 120, 250] : [180]);
        if (p.voice) speak(stepAnnouncement(at.step, t, p.unit), { interrupt: true });
      }
    }
    // Countdown pips into the next step.
    if (at?.left != null && at.left > 0 && at.left <= 3.2 && at.next) {
      const key = `${at.index}:${Math.ceil(at.left)}`;
      if (beeped.current !== key) {
        beeped.current = key;
        beep(880, 90, 0.18);
      }
    }
    if (at?.done && !cues.finished) {
      cues.finished = true;
      changed = true;
      beep(1320, 400);
      buzz([300, 100, 300, 100, 300]);
      if (p.voice) speak("Session complete. Nice work. Tap finish when you're ready.", { interrupt: true });
    }
    // Every mile, kilometer or 500 m.
    const unitM = splitMeters(l.sport, p.unit);
    const n = Math.floor(l.meters / unitM);
    if (n > (cues.split ?? 0)) {
      const splitSec = sec - (cues.splitAt ?? 0);
      cues.split = n;
      cues.splitAt = sec;
      changed = true;
      if (p.voice && p.splitCues && splitSec > 0) speak(splitAnnouncement(n, splitSec, l.sport, p.unit));
    }
    // Off target for a while? A gentle word.
    if (verdict && verdict !== "ok" && sec - (cues.nagAt ?? 0) > NAG_EVERY_SEC) {
      cues.nagAt = sec;
      changed = true;
      if (p.voice) speak(verdict === "fast" ? "A little hard. Ease off into your zone." : "A little easy. Pick it up into your zone.");
    } else if (verdict === "ok" && sec - (cues.nagAt ?? 0) > NAG_EVERY_SEC) {
      cues.nagAt = sec;
      changed = true;
    }
    if (changed) setLive(cur => (cur ? { ...cur, cues } : cur));
  }, [now, at, sec, verdict]);

  // ---- Controls ----
  const start = useCallback(opts => {
    // Wake up sound and voice while we have a tap to do it with.
    audioCtx();
    beep(990, 120);
    if (prefsRef.current.voice) speak(opts.steps?.length ? "Starting your session." : "Recording started.", { interrupt: true });
    const l = newLive({ ...opts, now: Date.now() });
    saveLive(l);
    setNow(Date.now());
    setLive(l);
  }, []);

  const pause = useCallback(() => {
    setLive(l => (l ? pauseLive(l, Date.now()) : l));
    if (prefsRef.current.voice) speak("Paused.", { interrupt: true });
  }, []);
  const resume = useCallback(() => {
    audioCtx();
    setLive(l => (l ? resumeLive(l, Date.now()) : l));
    if (prefsRef.current.voice) speak("Resumed.", { interrupt: true });
  }, []);
  const skipStep = useCallback(() => {
    // Jump to the next step by moving time forward in the session clock.
    setLive(l => {
      if (!l?.steps) return l;
      const t = Date.now();
      const s = stepAt(l.steps, activeSec(l, t));
      if (!s || s.left == null) return l;
      const shift = s.left * 1000 + 50;
      const segments = l.segments.map((seg, i) => (i === 0 ? { ...seg, from: seg.from - shift } : seg));
      return { ...l, segments, skipped: (l.skipped ?? 0) + s.left };
    });
  }, []);
  const finish = useCallback(meta => {
    const l = liveRef.current;
    if (!l) return null;
    const out = finishLive(l, Date.now(), { unit: prefsRef.current.unit, ...meta });
    // Skipped time wasn't trained.
    if (l.skipped) out.activity.sec = Math.max(0, out.activity.sec - l.skipped);
    return out;
  }, []);
  const clear = useCallback(() => {
    saveLive(null);
    setLive(null);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  return { live, now, sec, at, speed, target, metricValue, verdict, gps, awake, start, pause, resume, skipStep, finish, clear };
}
