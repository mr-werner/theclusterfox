// A tuner that listens through the microphone, with a few common tunings
// and a reference tone for each string.
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { startMic, micSupported } from "../../../lib/music/pitch.js";
import { createSynth } from "../../../lib/music/synth.js";
import { noteName } from "../../../lib/music/theory.js";

const TUNINGS = [
  { id: "standard", name: "Standard (E A D G B E)", notes: [40, 45, 50, 55, 59, 64] },
  { id: "half-down", name: "Half step down (Eb)", notes: [39, 44, 49, 54, 58, 63] },
  { id: "drop-d", name: "Drop D (D A D G B E)", notes: [38, 45, 50, 55, 59, 64] },
  { id: "dadgad", name: "DADGAD", notes: [38, 45, 50, 55, 57, 62] },
  { id: "open-g", name: "Open G (D G D G B D)", notes: [38, 43, 50, 55, 59, 62] },
];

export default function Tuner() {
  const [tuning, setTuning] = useState(TUNINGS[0]);
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(null);
  const stop = useRef(null);
  const synth = useRef(null);
  const smooth = useRef(null);

  useEffect(() => () => stop.current?.(), []);

  const toggle = async () => {
    if (on) {
      stop.current?.();
      stop.current = null;
      setOn(false);
      setReading(null);
      return;
    }
    setError("");
    try {
      stop.current = await startMic({
        minFreq: 60,
        maxFreq: 1000,
        onFrame: f => {
          if (!f.freq || f.clarity < 0.8) return;
          const midiF = 69 + 12 * Math.log2(f.freq / 440);
          smooth.current = smooth.current == null || Math.abs(smooth.current - midiF) > 0.7 ? midiF : smooth.current * 0.7 + midiF * 0.3;
          setReading({ midiF: smooth.current, freq: f.freq });
        },
      });
      setOn(true);
    } catch (err) {
      setError(err?.name === "NotAllowedError" ? "Microphone permission was turned down." : err?.message || "Couldn't open the microphone.");
    }
  };

  // The string you're closest to, and how far off it is.
  let target = null;
  let cents = 0;
  if (reading) {
    target = tuning.notes.reduce((best, n) => (Math.abs(n - reading.midiF) < Math.abs(best - reading.midiF) ? n : best), tuning.notes[0]);
    cents = Math.round((reading.midiF - target) * 100);
  }
  const inTune = reading && Math.abs(cents) <= 5;
  const angle = Math.max(-50, Math.min(50, cents)) * 1.6;

  return (
    <section className="frx-tuner">
      <select value={tuning.id} onChange={e => setTuning(TUNINGS.find(t => t.id === e.target.value))} aria-label="Tuning">
        {TUNINGS.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className={`frx-dial ${inTune ? "is-in" : ""}`}>
        <svg viewBox="0 0 220 130" aria-hidden="true">
          <path d="M20 120 A 90 90 0 0 1 200 120" fill="none" stroke="rgba(239,230,214,0.15)" strokeWidth="10" />
          <path d="M101 31 A 90 90 0 0 1 119 31" fill="none" stroke="#57e389" strokeWidth="10" />
          <line x1="110" y1="120" x2="110" y2="40" stroke={inTune ? "#57e389" : "#e8a45a"} strokeWidth="4" strokeLinecap="round" transform={`rotate(${reading ? angle : 0} 110 120)`} style={{ transition: "transform 120ms" }} />
          <circle cx="110" cy="120" r="7" fill="#e8a45a" />
        </svg>
        <div className="frx-dial-note">{target != null ? noteName(target, { octave: false }) : "–"}</div>
        <div className="frx-dial-cents">{reading ? (inTune ? "In tune" : `${cents > 0 ? "+" : ""}${cents} cents · ${cents > 0 ? "loosen" : "tighten"}`) : on ? "Play one string" : "Tap Start to listen"}</div>
      </div>
      <button type="button" className="frx-btn" onClick={toggle} disabled={!micSupported()}>
        {on ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />} {on ? "Stop" : "Start tuner"}
      </button>
      {error && <p className="frx-error">{error}</p>}
      <div className="frx-strings">
        {tuning.notes.map((n, i) => (
          <button
            key={i}
            type="button"
            className={target === n ? "is-on" : ""}
            onClick={() => {
              synth.current ??= createSynth({ voice: "pluck", volume: 0.8 });
              synth.current.playNote(n, 2, synth.current.now(), 0.9);
            }}
          >
            <Volume2 size={13} aria-hidden="true" />
            <span>{6 - i}</span>
            <b>{noteName(n)}</b>
          </button>
        ))}
      </div>
      <p className="frx-small">Tap a string to hear the note it should be. Strings are numbered from the thin high string (1) to the thick low one (6).</p>
    </section>
  );
}
