import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, MicOff, Music, Pause, Play, X } from "lucide-react";

import { patterns } from "../data/breathing";
import { buildTimeline, spokenCount } from "../model/schedule";
import { breathAt } from "../model/breath";
import { clock } from "../model/stats";
import { isSpeaking, speak, speechSupported, stopSpeaking } from "../audio/voice";
import { audio, bell, breathTone, startAmbient } from "../audio/sound";

const MOOD_OPTIONS = [
  { id: "calmer", name: "Calmer" },
  { id: "same", name: "About the same" },
  { id: "restless", name: "Still restless" },
];
const MIN_LOGGED = 60; // sessions shorter than this aren't saved to history
const RING = 2 * Math.PI * 47;

/**
 * Full-screen session. `config`: { minutes, interval, cueMode, pace, voice, rate, pitch, voiceVolume, ambient, ambientVolume, bells, seed }
 */
export default function Player({ session, config, onComplete, onMood, onClose }) {
  const seconds = config.minutes * 60;
  const pattern = patterns[session.pattern];
  const isBreath = session.kind === "breath";
  const timeline = useMemo(
    () => buildTimeline(session, { seconds, interval: config.interval, rate: config.rate, seed: config.seed }),
    [session, seconds, config.interval, config.rate, config.seed]
  );
  // Voice cues for the first rounds after the opening has finished, in "voice, then tones" mode.
  const voiceCueUntil = useMemo(() => {
    const openEnd = Math.max(0, ...timeline.filter(i => i.kind === "open").map(i => i.end));
    return openEnd + 3 * patterns[session.pattern].phases.reduce((s, p) => s + p.sec, 0) * config.pace;
  }, [timeline, session.pattern, config.pace]);

  const [status, setStatus] = useState("running"); // running | paused | done
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState({ label: "", count: 0 });
  const [voiceOn, setVoiceOn] = useState(speechSupported);
  const [soundOn, setSoundOn] = useState(config.ambient !== "none");
  const [result, setResult] = useState(null); // { id, minutes }
  const [mood, setMoodState] = useState(null);

  const acc = useRef(0); // seconds banked before the current run
  const startedAt = useRef(0);
  const running = useRef(true);
  const nextItem = useRef(0);
  const lastPhase = useRef(-1);
  const ambient = useRef(null);
  const orb = useRef(null);
  const voiceOnRef = useRef(voiceOn);

  const now = useCallback(
    () => acc.current + (running.current ? (performance.now() - startedAt.current) / 1000 : 0),
    []
  );

  const say = useCallback(
    text => {
      setCaption(text);
      if (voiceOnRef.current) {
        speak(text, { voice: config.voice, rate: config.rate, pitch: config.pitch, volume: config.voiceVolume });
      }
    },
    [config]
  );

  const finish = useCallback(
    early => {
      const t = Math.min(now(), seconds);
      running.current = false;
      acc.current = t;
      setStatus("done");
      if (early) stopSpeaking();
      if (config.bells && !(session.sleep && !early)) bell({ volume: 0.55 });
      ambient.current?.stop(session.sleep && !early ? 45 : 5);
      ambient.current = null;
      if (t >= MIN_LOGGED) setResult(onComplete(t));
      else setResult({ id: null, minutes: t / 60 });
    },
    [now, seconds, config.bells, session.sleep, onComplete]
  );

  // Start: bell, background sound. Everything stops when the player closes.
  useEffect(() => {
    startedAt.current = performance.now();
    audio();
    if (config.bells) bell({ volume: 0.55 });
    if (config.ambient !== "none") ambient.current = startAmbient(config.ambient, config.ambientVolume);
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      stopSpeaking();
      ambient.current?.stop(1);
      ambient.current = null;
      html.style.overflow = prevOverflow;
    };
    // Runs once per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the screen awake while running.
  useEffect(() => {
    if (status !== "running" || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then(l => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && request();
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [status]);

  // The clock: speaks lines, rings bells and cues breaths as their moment arrives.
  useEffect(() => {
    if (status !== "running") return undefined;
    const tick = () => {
      const t = now();
      if (t >= seconds) {
        finish(false);
        return;
      }
      while (nextItem.current < timeline.length && timeline[nextItem.current].at <= t) {
        const item = timeline[nextItem.current++];
        if (t - item.at > 8) continue; // stale (the tab was asleep); skip rather than pile up
        if (item.kind === "bell") {
          if (config.bells) bell({ volume: 0.4 });
        } else say(item.text);
      }
      if (isBreath) {
        const b = breathAt(pattern, t, config.pace);
        const key = b.cycle * 100 + b.index;
        if (key !== lastPhase.current) {
          const first = lastPhase.current === -1;
          lastPhase.current = key;
          const mode = config.cueMode;
          const useVoice = voiceOnRef.current && (mode === "voice" || (mode === "voiceThenTone" && t < voiceCueUntil));
          if (useVoice && !isSpeaking()) speak(b.phase.cue, { voice: config.voice, rate: config.rate, pitch: config.pitch, volume: config.voiceVolume });
          else if (mode !== "off" && !useVoice && !first) breathTone(b.phase.type, { volume: config.voiceVolume });
        }
        const count = Math.ceil(b.remaining);
        setPhase(p => (p.label === b.phase.label && p.count === count ? p : { label: b.phase.label, count }));
      }
      setElapsed(e => (Math.floor(t) === e ? e : Math.floor(t)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [status, now, seconds, timeline, say, finish, isBreath, pattern, config, voiceCueUntil]);

  // The breathing light, drawn every frame.
  useEffect(() => {
    if (status === "done") return undefined;
    let frame;
    const draw = () => {
      const b = breathAt(pattern, now(), config.pace);
      if (orb.current && b) {
        const scale = 0.52 + 0.48 * b.level;
        orb.current.style.transform = `scale(${scale.toFixed(4)})`;
        orb.current.style.opacity = String(0.55 + 0.45 * b.level);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [status, now, pattern, config.pace]);

  const togglePause = useCallback(() => {
    if (status === "done") return;
    if (running.current) {
      acc.current = now();
      running.current = false;
      stopSpeaking();
      ambient.current?.setVolume(config.ambientVolume * 0.3);
      setStatus("paused");
    } else {
      audio();
      startedAt.current = performance.now();
      running.current = true;
      ambient.current?.setVolume(soundOn ? config.ambientVolume : 0);
      setStatus("running");
    }
  }, [status, now, config.ambientVolume, soundOn]);

  useEffect(() => {
    const onKey = e => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        togglePause();
      } else if (e.key === "Escape" && status !== "done") {
        if (running.current) togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, status]);

  function toggleVoice() {
    voiceOnRef.current = !voiceOn;
    if (voiceOn) stopSpeaking();
    setVoiceOn(!voiceOn);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    if (next && !ambient.current && config.ambient !== "none") {
      ambient.current = startAmbient(config.ambient, config.ambientVolume);
    } else {
      ambient.current?.setVolume(next ? config.ambientVolume : 0);
    }
  }

  function end() {
    if (status === "done") onClose();
    else finish(true);
  }

  function pickMood(id) {
    setMoodState(id);
    if (result?.id) onMood(result.id, id);
  }

  const remaining = seconds - elapsed;
  const progress = Math.min(1, elapsed / seconds);
  const centerTop = isBreath ? phase.label : status === "paused" ? "Paused" : "";
  const lines = spokenCount(timeline);

  if (status === "done") {
    const logged = result?.id;
    const mins = Math.max(1, Math.round(result?.minutes ?? 0));
    return (
      <div className={`cm-player cm-player--${session.kind} is-done`} role="dialog" aria-modal="true" aria-label="Session complete">
        <div className="cm-done">
          <span className="cm-done-icon" aria-hidden="true">
            <Check size={30} />
          </span>
          <p className="cm-eyebrow">SESSION COMPLETE</p>
          <h2>{session.title}</h2>
          <p className="cm-muted">
            {logged ? `${mins} ${mins === 1 ? "minute" : "minutes"} added to your journey.` : "Short sessions under a minute aren't saved to your journey."}
          </p>
          {logged && (
            <div className="cm-mood">
              <p>How do you feel now?</p>
              <div className="cm-chips" role="group" aria-label="How do you feel now?">
                {MOOD_OPTIONS.map(m => (
                  <button key={m.id} type="button" aria-pressed={mood === m.id} onClick={() => pickMood(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="cm-btn cm-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`cm-player cm-player--${session.kind}${status === "paused" ? " is-paused" : ""}`} role="dialog" aria-modal="true" aria-label={session.title}>
      <header className="cm-player-top">
        <div>
          <p className="cm-eyebrow">{session.title.toUpperCase()}</p>
          <p className="cm-muted cm-small">
            {session.kind === "timer" ? "Silent timer" : `${lines} spoken lines`} · {config.minutes} min
          </p>
        </div>
        <button type="button" className="cm-icon-btn" onClick={end} aria-label="End session">
          <X size={20} />
        </button>
      </header>

      <div className="cm-stage">
        <svg className="cm-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="47" className="cm-ring-track" />
          <circle
            cx="50"
            cy="50"
            r="47"
            className="cm-ring-fill"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
          />
        </svg>
        <div className="cm-orb-wrap" aria-hidden="true">
          <div className="cm-orb" ref={orb} />
        </div>
        <div className="cm-center" aria-live="off">
          {centerTop && <span className="cm-phase">{centerTop}</span>}
          {isBreath && status === "running" ? (
            <span className="cm-count">{phase.count}</span>
          ) : (
            <span className="cm-time">{clock(remaining)}</span>
          )}
          {isBreath && <span className="cm-time-small">{clock(remaining)} left</span>}
        </div>
      </div>

      <p className="cm-caption" aria-live="polite">
        {caption || (session.kind === "timer" ? "Sit comfortably. A bell will mark the end." : " ")}
      </p>

      <div className="cm-controls">
        {(session.kind !== "timer" || session.voiceTimer) && speechSupported && (
          <button type="button" className="cm-icon-btn" onClick={toggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? "Mute voice" : "Unmute voice"}>
            {voiceOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        )}
        <button type="button" className="cm-play" onClick={togglePause} aria-label={status === "running" ? "Pause" : "Resume"}>
          {status === "running" ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </button>
        {config.ambient !== "none" && (
          <button type="button" className="cm-icon-btn" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? "Mute background sound" : "Play background sound"}>
            <Music size={20} className={soundOn ? "" : "is-off"} />
          </button>
        )}
      </div>
      <button type="button" className="cm-end" onClick={end}>
        End session
      </button>
    </div>
  );
}
