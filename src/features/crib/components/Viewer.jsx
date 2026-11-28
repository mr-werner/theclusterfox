import { useEffect, useRef, useState } from "react";
import { BatteryWarning, Bell, BellOff, Image as ImageIcon, Maximize, Power, RefreshCw, Volume2, VolumeX, WifiOff } from "lucide-react";

import { useViewer } from "../state/useViewer";
import { noiseAlarm, showCode } from "../lib/code";
import { chime, meter, unlock } from "../lib/audio";
import { useWakeLock } from "../lib/wakeLock";
import Meter from "./Meter";

const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// The parent's phone: the live picture and sound, a sound meter with an
// alert, and a loud chime if the monitor drops.
export default function Viewer({ code, prefs, save, onLeave }) {
  const v = useViewer(code);
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [localLevel, setLocalLevel] = useState(null);
  const [threshold, setThreshold] = useState(prefs.threshold ?? 55);
  const [alerts, setAlerts] = useState(prefs.alerts ?? true);
  const [lastNoise, setLastNoise] = useState(null);
  const [flash, setFlash] = useState(false);
  useWakeLock(true);

  const live = v.state === "live";

  // Show the stream; try with sound first, and fall back to muted until a tap.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !v.stream) return;
    el.srcObject = v.stream;
    el.muted = muted;
    el.play().catch(() => {
      el.muted = true;
      el.play().catch(() => {});
      setNeedsTap(true);
    });
    // Only when the stream changes; mute is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.stream]);

  useEffect(() => {
    if (videoRef.current && !needsTap) videoRef.current.muted = muted;
  }, [muted, needsTap]);

  // Measure the sound here when the live stream is on; otherwise use the
  // level the monitor reports each second.
  useEffect(() => {
    if (!live || !v.stream) return undefined;
    const m = meter(v.stream);
    const id = setInterval(() => setLocalLevel(m.read()), 150);
    return () => {
      clearInterval(id);
      m.stop();
    };
  }, [live, v.stream]);

  const reported = v.monitor?.online ? v.monitor.status?.level ?? 0 : null;
  const level = (live ? localLevel : null) ?? reported;

  // Noise alert.
  const alarm = useRef(noiseAlarm());
  useEffect(() => {
    if (level == null || !alerts) return;
    if (alarm.current(level, threshold, Date.now())) {
      setLastNoise(Date.now());
      chime(false);
      navigator.vibrate?.([300, 120, 300]);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
      if (document.visibilityState !== "visible" && window.Notification?.permission === "granted") {
        try {
          new Notification("CribFox: the baby's making noise", { tag: "cribfox-noise", body: "Sound picked up by the monitor." });
        } catch {
          // Some phones only notify from an installed app.
        }
      }
    }
  }, [level, threshold, alerts]);

  // Lost the monitor: chime loudly once, and again every minute it stays lost.
  const wasLive = useRef(false);
  const hidden = v.monitor?.online && v.monitor.status?.hidden;
  const trouble = v.lost || hidden;
  useEffect(() => {
    if (live) wasLive.current = true;
  }, [live]);
  useEffect(() => {
    if (!trouble || !alerts || !wasLive.current) return undefined;
    const ring = () => {
      chime(true);
      navigator.vibrate?.([600, 200, 600]);
    };
    ring();
    const id = setInterval(ring, 60000);
    return () => clearInterval(id);
  }, [trouble, alerts]);

  function tapSound() {
    unlock();
    setNeedsTap(false);
    setMuted(false);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
    }
  }

  function toggleAlerts() {
    const next = !alerts;
    setAlerts(next);
    save({ alerts: next });
    unlock();
    if (next && window.Notification?.permission === "default") window.Notification.requestPermission().catch?.(() => {});
  }

  function fullscreen() {
    const el = stageRef.current;
    const video = videoRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
  }

  const status = v.monitor?.status || {};
  const label = {
    connecting: "Connecting…",
    live: "Live",
    picture: "Picture mode · new photo every 2 seconds",
    offline: "Monitor offline",
    missing: "No monitor",
  }[v.state];

  return (
    <main className={`cf-wrap cf-viewer${flash ? " cf-flash" : ""}`}>
      {v.error && (
        <div className="cf-card">
          <p className="cf-error" role="alert">
            {v.error}
          </p>
          <button className="cf-btn cf-btn--ghost" onClick={onLeave}>
            Type the code again
          </button>
        </div>
      )}

      <div className="cf-stage" ref={stageRef}>
        <video ref={videoRef} className="cf-video" autoPlay playsInline hidden={!live} />
        {v.state === "picture" && v.snap && <img className="cf-video" src={v.snap.src} alt="Latest picture from the monitor" />}
        {!live && !(v.state === "picture" && v.snap) && (
          <div className="cf-stage-note">
            {v.state === "offline" ? (
              <>
                <WifiOff size={28} />
                <b>The monitor phone isn't connected.</b>
                <span>Check that it's plugged in, with CribFox open on screen.</span>
              </>
            ) : v.state === "missing" ? (
              <span>No monitor found for {showCode(code)}.</span>
            ) : (
              <span>Connecting to {showCode(code)}…</span>
            )}
          </div>
        )}
        <span className={`cf-chip ${live ? "cf-chip--live" : v.state === "offline" ? "cf-chip--bad" : ""}`}>
          {v.state === "picture" && <ImageIcon size={14} />} {label}
        </span>
        {!v.net && <span className="cf-chip cf-chip--warn cf-chip--right">Your connection dropped…</span>}
        {live && needsTap && (
          <button className="cf-tap" onClick={tapSound}>
            <Volume2 size={20} /> Tap to hear the room
          </button>
        )}
        {(live || v.state === "picture") && (
          <div className="cf-stage-tools">
            {live && !needsTap && (
              <button className="cf-icon-btn" onClick={() => setMuted(!muted)} aria-label={muted ? "Turn sound on" : "Mute"}>
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            <button className="cf-icon-btn" onClick={fullscreen} aria-label="Full screen">
              <Maximize size={20} />
            </button>
          </div>
        )}
      </div>

      {hidden && <p className="cf-warn">The monitor phone left the page or locked its screen, so its camera has stopped. Open CribFox on it again.</p>}
      {v.monitor?.online && status.charging === false && (
        <p className="cf-warn">
          <BatteryWarning size={18} /> The monitor phone isn't charging{status.battery != null ? ` (${status.battery}%)` : ""}.
        </p>
      )}
      {v.state === "picture" && (
        <p className="cf-muted cf-small">
          This network won't carry live video between the two phones, so you're seeing a fresh picture every couple of seconds. Sound alerts still work.
          It keeps trying for live video. Putting both phones on the same Wi-Fi usually fixes it.
        </p>
      )}

      <section className="cf-card">
        <Meter level={level} threshold={alerts ? threshold : null} label="Sound in the baby's room" stale={level == null} />
        <label className="cf-label" htmlFor="cf-threshold">
          Alert me when it's louder than the line
        </label>
        <input
          id="cf-threshold"
          className="cf-range"
          type="range"
          min={10}
          max={90}
          value={threshold}
          disabled={!alerts}
          onChange={(e) => {
            const t = Number(e.target.value);
            setThreshold(t);
            save({ threshold: t });
          }}
        />
        <div className="cf-row cf-between">
          <button className="cf-btn cf-btn--ghost" onClick={toggleAlerts}>
            {alerts ? <Bell size={18} /> : <BellOff size={18} />} {alerts ? "Alerts on" : "Alerts off"}
          </button>
          <span className="cf-muted cf-small">{lastNoise ? `Last noise ${timeOf(lastNoise)}` : "No noise alerts yet"}</span>
        </div>
      </section>

      <div className="cf-row cf-actions">
        {!live && v.monitor?.online && (
          <button className="cf-btn cf-btn--ghost" onClick={v.retry}>
            <RefreshCw size={18} /> Try live video again
          </button>
        )}
        <button className="cf-btn cf-btn--ghost cf-btn--stop" onClick={onLeave}>
          <Power size={18} /> Stop watching
        </button>
      </div>
      <p className="cf-muted cf-small cf-center">
        Watching {showCode(code)}. Keep this screen on: sound and alerts stop if this phone locks.
      </p>
    </main>
  );
}
