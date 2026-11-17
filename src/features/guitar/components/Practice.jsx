// The practice screen for one song: falling notes, the fretboard, notation
// and tab, plus everything to slow it down, loop it, wait for you and
// listen to you play.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Gauge, Headphones, Mic, Music2, Pause, Play, Repeat, RotateCcw, SkipForward, Timer, Usb } from "lucide-react";

import { LEVELS, buildTimeline, partsFor } from "../model/arrange";
import { usePlayer } from "../state/usePlayer";
import { useInput } from "../state/useInput";
import { chordShape } from "../data/chords";
import { FINGER } from "./colors";
import Highway from "./Highway";
import Fretboard from "./Fretboard";
import ScoreStrip from "./ScoreStrip";
import ChordDiagram from "./ChordDiagram";

const SPEEDS = [0.25, 0.5, 0.6, 0.75, 0.9, 1, 1.25];

export default function Practice({ song, store, part: askedPart, level: askedLevel, onBack, onPick }) {
  const { data, setPrefs, recordPractice } = store;
  const prefs = data.prefs;
  const parts = partsFor(song);
  const part = parts.some(p => p.id === askedPart) ? askedPart : parts.some(p => p.id === prefs.part) ? prefs.part : parts[0].id;
  const level = LEVELS.some(l => l.id === askedLevel) ? askedLevel : prefs.level;
  const timeline = timelineFor(song, part, level);
  const [loopOn, setLoopOn] = useState(false);
  const [loopBars, setLoopBars] = useState([1, Math.min(4, timeline.bars.length)]);
  const [result, setResult] = useState(null);

  // (The page remounts this screen per song, so loop and result start fresh.)
  const nBars = timeline.bars.length;
  const loopA = Math.min(loopBars[0], nBars);
  const loopB = Math.max(loopA, Math.min(loopBars[1], nBars));
  const loop = useMemo(() => (loopOn ? { a: (loopA - 1) * timeline.barLen, b: loopB * timeline.barLen } : null), [loopOn, loopA, loopB, timeline.barLen]);

  const onFinish = r => {
    recordPractice({ songId: song.id, title: song.title, part, level, minutes: r.minutes, accuracy: r.accuracy });
    if (r.finished) setResult(r);
  };

  const player = usePlayer(timeline, { speed: prefs.speed, sound: prefs.sound, metronome: prefs.metronome, backing: prefs.backing, wait: prefs.wait, loop, onFinish });
  const input = useInput(player.hear);
  useEffect(() => player.setListening(Boolean(input.mode)), [input.mode, player]);

  // Space plays and pauses; right arrow steps past a note in wait mode.
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest("input, select, textarea, button")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (player.playing) player.pause();
        else {
          setResult(null);
          player.play();
        }
      } else if (e.code === "ArrowRight") player.skip();
      else if (e.code === "ArrowLeft") player.seek(player.beatRef.current - timeline.barLen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, timeline.barLen]);

  const chordsInSong = timeline.chordsUsed.length ? timeline.chordsUsed : timelineFor(song, "rhythm", level).chordsUsed;
  const now = player.current >= 0 ? timeline.events[player.current] : null;
  const next = timeline.events[player.current + 1] ?? null;
  const total = player.stats.hit + player.stats.missed;
  const best = data.best[song.id]?.[`${part}:${level}`];

  return (
    <div className="frx-practice">
      <header className="frx-ph">
        <button type="button" className="frx-ghost" onClick={onBack} aria-label="All songs">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="frx-ph-title">
          <h1>{song.title}</h1>
          <p>
            {song.by} · {timeline.sig} · {song.bpm} bpm{best != null ? ` · best ${best}%` : ""}
          </p>
        </div>
      </header>

      <div className="frx-pickers">
        <div className="frx-seg" role="radiogroup" aria-label="What to play">
          {parts.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={part === p.id} className={part === p.id ? "is-on" : ""} title={p.hint} onClick={() => onPick({ part: p.id })}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="frx-seg" role="radiogroup" aria-label="Difficulty">
          {LEVELS.map(l => (
            <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className={level === l.id ? "is-on" : ""} onClick={() => onPick({ level: l.id })}>
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <p className="frx-levelnote">{levelNote(part, level)}</p>

      <div className="frx-stage">
        <div className="frx-hw-wrap">
          <Highway timeline={timeline} player={player} lefty={prefs.lefty} />
          {player.counting > 0 && <div className="frx-countin">{player.counting}</div>}
          {player.waiting && (
            <button type="button" className="frx-waitchip" onClick={player.skip}>
              {input.mode ? "Waiting for you… (tap to skip)" : "Play it, then tap or press → for the next note"}
            </button>
          )}
          {result && (
            <div className="frx-result" role="status">
              <strong>{result.accuracy != null ? `${result.accuracy}%` : "Nice!"}</strong>
              <span>{result.accuracy != null ? `${result.hit} of ${result.hit + result.missed} on time` : "Turn on Listen to get a score."}</span>
              <button type="button" className="frx-btn" onClick={() => { setResult(null); player.seek(timeline.start); player.play(timeline.start); }}>
                Play again
              </button>
            </div>
          )}
        </div>
        <aside className="frx-side">
          <Fretboard now={now} next={next} lefty={prefs.lefty} />
          <div className="frx-legend" aria-label="Finger colors">
            {[1, 2, 3, 4, 0].map(f => (
              <span key={f}>
                <i style={{ background: FINGER[f].color }} />
                {f === 0 ? "Open" : FINGER[f].name.split(" ")[0]}
              </span>
            ))}
          </div>
          {chordsInSong.length > 0 && (
            <div className="frx-usedchords">
              {chordsInSong.map(name => (
                <ChordDiagram key={name} shape={chordShape(name)} name={name} size={74} onClick={() => player.preview({ kind: "strum", notes: chordShape(name).frets.map((f, s) => ({ midi: [40, 45, 50, 55, 59, 64][s] + f })).filter((n, s) => chordShape(name).frets[s] >= 0) })} />
              ))}
            </div>
          )}
          {input.mode && (
            <div className="frx-listen-state">
              <span className="frx-meter" style={{ "--lvl": input.level }} />
              Hearing {input.heard || "…"} · {player.stats.hit} hit{total ? ` · ${Math.round((player.stats.hit / total) * 100)}%` : ""}
            </div>
          )}
        </aside>
      </div>

      <ScoreStrip timeline={timeline} player={player} staff={prefs.staff} onSeek={b => player.seek(b)} />

      <div className="frx-transport">
        <button type="button" className="frx-play" onClick={() => (player.playing ? player.pause() : (setResult(null), player.play()))} aria-label={player.playing ? "Pause" : "Play"}>
          {player.playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button type="button" className="frx-ghost" onClick={() => player.seek(loop ? loop.a : timeline.start)} aria-label="Back to the start">
          <RotateCcw size={18} />
        </button>
        <button type="button" className="frx-ghost" onClick={player.skip} aria-label="Next note" title="Next note (→)">
          <SkipForward size={18} />
        </button>
        <label className="frx-speed">
          <Gauge size={16} aria-hidden="true" />
          <select value={prefs.speed} onChange={e => setPrefs({ speed: Number(e.target.value) })} aria-label="Speed">
            {SPEEDS.map(s => (
              <option key={s} value={s}>
                {Math.round(s * 100)}% · {Math.round(song.bpm * s)} bpm
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="frx-options">
        <Toggle on={prefs.wait} onClick={() => setPrefs({ wait: !prefs.wait })} icon={Timer} label="Wait for me" />
        <Toggle on={loopOn} onClick={() => setLoopOn(v => !v)} icon={Repeat} label="Loop" />
        {loopOn && (
          <span className="frx-loopbars">
            bars
            <input type="number" min="1" max={timeline.bars.length} value={loopBars[0]} onChange={e => setLoopBars(([, b]) => [clamp(+e.target.value, 1, b), b])} aria-label="Loop from bar" />–
            <input type="number" min={loopBars[0]} max={timeline.bars.length} value={loopBars[1]} onChange={e => setLoopBars(([a]) => [a, clamp(+e.target.value, a, timeline.bars.length)])} aria-label="Loop to bar" />
          </span>
        )}
        <Toggle on={prefs.metronome} onClick={() => setPrefs({ metronome: !prefs.metronome })} icon={Music2} label="Click" />
        <Toggle on={prefs.sound} onClick={() => setPrefs({ sound: !prefs.sound })} icon={Headphones} label="Hear my part" />
        {timeline.backing.length > 0 && <Toggle on={prefs.backing} onClick={() => setPrefs({ backing: !prefs.backing })} icon={Headphones} label={part === "lead" ? "Chords behind" : "Melody behind"} />}
        <Toggle on={prefs.staff} onClick={() => setPrefs({ staff: !prefs.staff })} label="Notation" />
        <Toggle on={prefs.lefty} onClick={() => setPrefs({ lefty: !prefs.lefty })} label="Left-handed" />
      </div>

      <div className="frx-listenbar">
        <strong>Listen to me play</strong>
        {input.canMic && (
          <Toggle on={input.mode === "mic"} onClick={() => (input.mode === "mic" ? input.stop() : input.listenMic())} icon={Mic} label="Microphone" />
        )}
        {input.canMidi && (
          <Toggle on={input.mode === "midi"} onClick={() => (input.mode === "midi" ? input.stop() : input.listenMidi())} icon={Usb} label="MIDI guitar" />
        )}
        <span className="frx-hint">
          {input.error ||
            (input.mode === "mic"
              ? "Listening. Your part goes quiet so the mic hears only you; headphones keep the click out of it."
              : "The mic hears any guitar. A MIDI guitar or pickup is more exact. Without either, Wait for me steps note by note when you press →.")}
        </span>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, icon: Icon, label }) {
  return (
    <button type="button" className={`frx-toggle ${on ? "is-on" : ""}`} aria-pressed={on} onClick={onClick}>
      {Icon && <Icon size={15} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

function levelNote(part, level) {
  const notes = {
    lead: { easy: "The tune with the quick in-between notes left out.", medium: "The whole tune in open position.", hard: "The whole tune up the neck around the 5th fret." },
    rhythm: { easy: "One strum on every beat, with easier shapes for barre chords.", medium: "A real strum pattern with downs and ups.", hard: "Fingerpicking: thumb on the bass, fingers roll through the chord." },
    both: { easy: "Tune on top, a bass note at the start of each bar.", medium: "Tune on top, bass notes twice a bar.", hard: "Tune on top with a bass note on every beat." },
  };
  return notes[part]?.[level] ?? "";
}

// One timeline per song, part and level, kept so re-renders don't rebuild it.
const timelines = new WeakMap();
function timelineFor(song, part, level) {
  if (!timelines.has(song)) timelines.set(song, new Map());
  const cache = timelines.get(song);
  const key = `${part}:${level}`;
  if (!cache.has(key)) cache.set(key, buildTimeline(song, { part, level }));
  return cache.get(key);
}
