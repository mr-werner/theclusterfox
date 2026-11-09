import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bell, BellOff, Info, Play, Star, Volume2 } from "lucide-react";

import { goalsById, KINDS } from "../data/sessions";
import { describePattern as describe, patterns } from "../data/breathing";
import { buildTimeline, spokenCount } from "../model/schedule";
import { INTERVALS } from "../state/calmStore";
import { NATURAL_VOICES, pickVoice, recordedSeconds, speak, stopSpeaking, voiceSupported } from "../audio/voice";
import { PREVIEW_LINE } from "../data/voiceLines";
import { startAmbient } from "../audio/sound";
import { AMBIENT_OPTIONS, GOAL_ICONS, KIND_ICONS } from "./icons";

const LENGTHS = [3, 5, 10, 15, 20, 30, 45, 60];
const PACES = [
  { value: 0.75, name: "Quicker" },
  { value: 1, name: "As written" },
  { value: 1.25, name: "Slower" },
  { value: 1.5, name: "Slowest" },
];
const CUES = [
  { id: "voiceThenTone", name: "Voice, then tones", note: "The voice counts the first few breaths, then soft tones take over." },
  { id: "voice", name: "Voice", note: "The voice says every in, hold and out." },
  { id: "tone", name: "Tones", note: "A rising tone to breathe in, a falling tone to breathe out." },
  { id: "off", name: "Silent", note: "Just follow the light." },
];

function intervalName(sec, kind) {
  if (sec === 0) return kind === "timer" ? "No bells" : "Start & end only";
  return sec < 60 ? `${sec} sec` : `${sec / 60} min`;
}

export default function SessionSetup({ session, prefs, setPrefs, voices, favorite, onToggleFavorite, onBack, onStart }) {
  const [minutes, setMinutes] = useState(session.minutes);
  const [trying, setTrying] = useState(false);
  const tryRef = useRef(null);
  const goal = goalsById.get(session.goal);
  const GoalIcon = GOAL_ICONS[session.goal];
  const KindIcon = KIND_ICONS[session.kind];
  const pattern = patterns[session.pattern];
  const isBreath = session.kind === "breath";
  const isTimer = session.kind === "timer";
  const usesVoice = !isTimer || session.voiceTimer;
  const voice = pickVoice(voices, prefs.voiceURI);

  const timeline = useMemo(
    () =>
      buildTimeline(session, {
        seconds: minutes * 60,
        interval: prefs.interval,
        rate: prefs.rate,
        lengthOf: text => recordedSeconds(voice, text),
      }),
    [session, minutes, prefs.interval, prefs.rate, voice]
  );
  const lines = spokenCount(timeline);
  const bells = timeline.filter(i => i.kind === "bell").length;

  useEffect(() => () => tryRef.current?.stop(0.3), []);

  function preview() {
    speak(PREVIEW_LINE, {
      voice,
      rate: prefs.rate,
      pitch: prefs.pitch,
      volume: prefs.voiceVolume,
    });
  }

  function tryAmbient() {
    tryRef.current?.stop(0.5);
    tryRef.current = null;
    if (trying || prefs.ambient === "none") {
      setTrying(false);
      return;
    }
    tryRef.current = startAmbient(prefs.ambient, prefs.ambientVolume);
    setTrying(true);
  }

  function pickAmbient(id) {
    setPrefs({ ambient: id });
    if (trying) {
      tryRef.current?.stop(0.5);
      tryRef.current = id === "none" ? null : startAmbient(id, prefs.ambientVolume);
      if (id === "none") setTrying(false);
    }
  }

  function start() {
    stopSpeaking();
    tryRef.current?.stop(0.3);
    tryRef.current = null;
    setTrying(false);
    onStart({ minutes, voice });
  }

  return (
    <section className="cm-setup" aria-labelledby="cm-setup-title">
      <button type="button" className="cm-back" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" /> All sessions
      </button>

      <header className={`cm-panel cm-setup-head cm-card--${session.kind}`}>
        <div className="cm-setup-tags">
          <span>
            <GoalIcon size={14} aria-hidden="true" /> {goal.name}
          </span>
          <span>
            <KindIcon size={14} aria-hidden="true" /> {KINDS[session.kind]}
          </span>
          {isBreath && <span>{describe(pattern, prefs.pace)}</span>}
        </div>
        <div className="cm-setup-title">
          <h2 id="cm-setup-title">{session.title}</h2>
          <button
            type="button"
            className={`cm-star${favorite ? " is-on" : ""}`}
            aria-pressed={favorite}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => onToggleFavorite(session.id)}
          >
            <Star size={18} fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <p>{session.summary}</p>
        {session.caution && (
          <p className="cm-caution">
            <Info size={15} aria-hidden="true" /> {session.caution}
          </p>
        )}
      </header>

      <div className="cm-panel">
        <h3>How long?</h3>
        <div className="cm-chips" role="group" aria-label="Session length">
          {LENGTHS.map(n => (
            <button key={n} type="button" aria-pressed={minutes === n} onClick={() => setMinutes(n)}>
              {n} min
            </button>
          ))}
          <label className="cm-custom">
            <span className="sr-only">Custom minutes</span>
            <input
              type="number"
              min="1"
              max="120"
              inputMode="numeric"
              value={minutes}
              onChange={e => {
                const n = Math.round(Number(e.target.value));
                if (n >= 1 && n <= 120) setMinutes(n);
              }}
            />
            min
          </label>
        </div>
      </div>

      <div className="cm-panel">
        <h3>{isTimer ? "Bell every" : "Voice check-ins"}</h3>
        <p className="cm-muted cm-small">
          {isTimer
            ? "A soft bell marks each interval, so you can sit without watching the clock."
            : "How often the voice gently guides you. Less often means more silence to sit in."}
        </p>
        <div className="cm-chips" role="group" aria-label={isTimer ? "Bell interval" : "Voice frequency"}>
          {INTERVALS.map(sec => (
            <button key={sec} type="button" aria-pressed={prefs.interval === sec} onClick={() => setPrefs({ interval: sec })}>
              {intervalName(sec, session.kind)}
            </button>
          ))}
        </div>
        <p className="cm-note">
          {isTimer
            ? `${bells} interval ${bells === 1 ? "bell" : "bells"}${lines ? ` and ${lines} short check-ins` : ""} over ${minutes} min.`
            : `About ${lines} spoken ${lines === 1 ? "line" : "lines"} over ${minutes} min.`}
          {session.ordered && prefs.interval > 0 && " Step-by-step sessions may speak a little more often so every step fits."}
        </p>
      </div>

      {isBreath && (
        <div className="cm-panel">
          <h3>Breath cues</h3>
          <div className="cm-chips" role="group" aria-label="Breath cues">
            {CUES.map(c => (
              <button key={c.id} type="button" aria-pressed={prefs.cueMode === c.id} onClick={() => setPrefs({ cueMode: c.id })}>
                {c.name}
              </button>
            ))}
          </div>
          <p className="cm-note">{CUES.find(c => c.id === prefs.cueMode)?.note}</p>
          <h3 className="cm-sub">Pace</h3>
          <div className="cm-chips" role="group" aria-label="Breathing pace">
            {PACES.map(p => (
              <button key={p.value} type="button" aria-pressed={prefs.pace === p.value} onClick={() => setPrefs({ pace: p.value })}>
                {p.name}
              </button>
            ))}
          </div>
          <p className="cm-note">{describe(pattern, prefs.pace)} seconds.</p>
        </div>
      )}

      <div className="cm-grid-2">
        {usesVoice && (
          <div className="cm-panel">
            <h3>Voice</h3>
            {voiceSupported ? (
              <>
                <label className="cm-field">
                  <span>Speaker</span>
                  <select value={voice?.voiceURI ?? ""} onChange={e => setPrefs({ voiceURI: e.target.value })}>
                    {NATURAL_VOICES.length > 0 && (
                      <optgroup label="Natural voices">
                        {NATURAL_VOICES.map(v => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name}, {v.note}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {voices.length > 0 && (
                      <optgroup label="Your device's voices">
                        {voices.map(v => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                {!voice?.natural && (
                <label className="cm-field">
                  <span>Speed</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.2"
                    step="0.05"
                    value={prefs.rate}
                    onChange={e => setPrefs({ rate: Number(e.target.value) })}
                  />
                </label>
                )}
                <label className="cm-field">
                  <span>Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={prefs.voiceVolume}
                    onChange={e => setPrefs({ voiceVolume: Number(e.target.value) })}
                  />
                </label>
                <button type="button" className="cm-btn cm-btn--ghost" onClick={preview}>
                  <Volume2 size={16} aria-hidden="true" /> Hear it
                </button>
                <p className="cm-note">
                  {voice?.natural
                    ? "Natural voices are recorded ahead of time at a slow, calm pace, so they sound the same on every device."
                    : "Device voices vary by phone and browser. Ones marked Natural, Enhanced or Premium usually sound the best."}
                </p>
              </>
            ) : (
              <p className="cm-muted cm-small">
                This browser can't speak, so guidance will appear as text on screen instead. Chrome, Edge and Safari all support it.
              </p>
            )}
          </div>
        )}

        <div className="cm-panel">
          <h3>Sound</h3>
          <div className="cm-chips" role="group" aria-label="Background sound">
            {AMBIENT_OPTIONS.map(a => (
              <button key={a.id} type="button" aria-pressed={prefs.ambient === a.id} onClick={() => pickAmbient(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
          {prefs.ambient !== "none" && (
            <label className="cm-field">
              <span>Background volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={prefs.ambientVolume}
                onChange={e => {
                  const v = Number(e.target.value);
                  setPrefs({ ambientVolume: v });
                  tryRef.current?.setVolume(v);
                }}
              />
            </label>
          )}
          <div className="cm-row">
            {prefs.ambient !== "none" && (
              <button type="button" className="cm-btn cm-btn--ghost" aria-pressed={trying} onClick={tryAmbient}>
                {trying ? "Stop" : "Listen"}
              </button>
            )}
            <button
              type="button"
              className="cm-btn cm-btn--ghost"
              aria-pressed={prefs.bells}
              onClick={() => setPrefs({ bells: !prefs.bells })}
            >
              {prefs.bells ? <Bell size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />}
              {prefs.bells ? "Bells on" : "Bells off"}
            </button>
          </div>
          {session.sleep && <p className="cm-note">Sleep sessions skip the end bell and fade the sound out slowly.</p>}
        </div>
      </div>

      <div className="cm-start-bar">
        <button type="button" className="cm-btn cm-btn--primary cm-start" onClick={start}>
          <Play size={18} fill="currentColor" aria-hidden="true" /> Begin {minutes} min
        </button>
      </div>
    </section>
  );
}
