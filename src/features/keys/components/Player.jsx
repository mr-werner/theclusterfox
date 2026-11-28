import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hand, Keyboard, Mic, MicOff, Music2, Pause, Play, Repeat, RotateCcw, Settings2, SlidersHorizontal, Usb, X } from "lucide-react";

import { createSynth } from "../../../lib/music/synth";
import { connectMidi, midiSupported } from "../../../lib/music/midiInput";
import { micSupported, startMic, tuningFromPitches } from "../../../lib/music/pitch";
import { createNoteListener, selfSounds } from "../../../lib/music/listener";
import { noteName } from "../../../lib/music/theory";
import { arrange, barAt, barBeats, barCount, barStart, keyRange, LEVELS } from "../model/song";
import { Engine, starsFor } from "../model/engine";
import { COMPUTER_LABELS, computerKey, keyAt, keyLayout } from "../model/keyboard";
import { todayKey } from "../model/dates";
import { barIndexAt, lastBar, loopBeats as loopBeatsFor, loopFromBeats } from "../model/loop";
import SheetView, { SHEET_HEIGHT, WINDOW_PX } from "./SheetView";
import BarStrip from "./BarStrip";

const HAND_COLOR = { R: "#f2b544", L: "#4fb7d6" };
const SPEEDS = [0.25, 0.5, 0.6, 0.75, 0.9, 1, 1.25];
const MIDI_PREF = "keysfox-midi-on";
const TAP_PX = 6; // on the sheet, a press that moves less than this is a tap

const pct = s => `${Math.round(s * 100)}%`;

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export default function Player({ song, settings, setSettings, onRun, onBack }) {
  const { level, hands, mode, speed, view, noteNames, otherHand, metronome, mySound, tuning = 0 } = settings;
  const arranged = useMemo(() => arrange(song, level), [song, level]);
  const [lo, hi] = useMemo(() => keyRange(song), [song]);
  const bars = barCount(arranged);

  const [status, setStatus] = useState("ready"); // ready | playing | paused | done
  const [hud, setHud] = useState({ bar: 0, accuracy: null, streak: 0, waiting: false });
  const [result, setResult] = useState(null);
  const [loop, setLoop] = useState({ on: false, a: 1, b: Math.min(bars, 4) });
  const [loopDraft, setLoopDraft] = useState(null); // the bars under a drag, before you let go
  const [panel, setPanel] = useState(null); // "settings" | null
  const [midi, setMidi] = useState({ on: false, devices: [], error: null });
  const [mic, setMic] = useState({ on: false, heard: null, error: null });
  const [octave, setOctave] = useState(60);
  const [win, setWin] = useState(0);

  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const sheetGroupRef = useRef(null);
  const sheetWrapRef = useRef(null);
  const stripHeadRef = useRef(null);
  const engineRef = useRef(null);
  const synthRef = useRef(null);
  const pressedRef = useRef(new Map()); // midi -> { source, verdict, at }
  const flashRef = useRef(new Map()); // note id -> "hit" time
  const statusRef = useRef(status);
  const stopMidiRef = useRef(null);
  const stopMicRef = useRef(null);
  const micHeardRef = useRef(new Set());
  const listenerRef = useRef(null);
  const selfSoundsRef = useRef([]); // notes KeysFox plays itself, so the mic doesn't take them for yours
  const quietUntilRef = useRef(0); // the metronome just clicked
  const calibRef = useRef(null); // { freqs, until } while tuning to the player's piano
  const setSettingsRef = useRef(setSettings);
  const [calib, setCalib] = useState(null); // null | "listening" | { cents } | { error }
  const settingsRef = useRef(settings);
  const winRef = useRef(0);
  useEffect(() => {
    statusRef.current = status;
    settingsRef.current = settings;
    setSettingsRef.current = setSettings;
  });

  const stage = useSize(stageRef);
  const sheetSize = useSize(sheetWrapRef);
  const minDur = Math.min(...arranged.notes.map(n => n.d), 1);
  const ppb = Math.min(120, Math.max(56, 26 / minDur));
  const headW = 62 + Math.abs(song.key || 0) * 9 + 26;
  const playX = Math.max(headW + 24, Math.round(sheetSize.w * 0.26));

  const synth = useCallback(() => {
    synthRef.current ??= createSynth({ voice: "piano", volume: 0.7 });
    return synthRef.current;
  }, []);

  const loopBeats = useMemo(() => (loop.on ? loopBeatsFor(arranged, loop) : null), [loop, arranged]);
  const selectLoop = useCallback(l => setLoop({ on: true, a: l.a, b: l.b }), []);

  const makeEngine = useCallback(
    (from = 0) => {
      const e = new Engine(arranged, { hands, mode, speed, loop: loopBeats, countIn: 1, start: from });
      e.metronome = metronome;
      return e;
    },
    [arranged, hands, mode, speed, loopBeats, metronome]
  );

  // A fresh engine whenever the practice setup changes.
  const [setupFor, setSetupFor] = useState(() => makeEngine);
  if (setupFor !== makeEngine) {
    setSetupFor(() => makeEngine);
    setStatus("ready");
    setResult(null);
  }
  useEffect(() => {
    engineRef.current = makeEngine(0);
    engineRef.current.beat = loopBeats ? loopBeats.a : 0;
    flashRef.current.clear();
    statusRef.current = "ready";
  }, [makeEngine, loopBeats]);

  // Speed and metronome change live without restarting.
  useEffect(() => {
    if (engineRef.current) engineRef.current.metronome = metronome;
  }, [metronome]);

  const start = useCallback(() => {
    synth();
    const e = engineRef.current;
    if (!e || e.finished) engineRef.current = makeEngine(0);
    else if (statusRef.current === "ready") engineRef.current = makeEngine(e.from);
    setResult(null);
    setStatus("playing");
  }, [makeEngine, synth]);

  const pause = useCallback(() => {
    setStatus(s => (s === "playing" ? "paused" : s));
    synthRef.current?.stopAll();
  }, []);

  const restart = useCallback(() => {
    engineRef.current = makeEngine(0);
    flashRef.current.clear();
    setResult(null);
    setStatus("playing");
    synth();
  }, [makeEngine, synth]);

  const finish = useCallback(() => {
    const e = engineRef.current;
    const st = e.stats();
    const stars = starsFor(st);
    setResult({ ...st, stars });
    setStatus("done");
    if (st.hit + st.missed > 0) {
      onRun({ id: `${Date.now().toString(36)}`, day: todayKey(), songId: song.id, title: song.title, level, hands, mode, speed, accuracy: st.accuracy, stars, seconds: st.seconds });
    }
  }, [onRun, song, level, hands, mode, speed]);

  // --- your notes ---------------------------------------------------------
  const noteOn = useCallback(
    (m, source, vel = 0.8) => {
      const s = settingsRef.current;
      if (source !== "mic" && s.mySound) synth().noteOn(m, vel);
      let verdict = null;
      const e = engineRef.current;
      if (e && statusRef.current === "playing") {
        const r = e.press(m, { fromMic: source === "mic" });
        verdict = r.type === "hit" ? "hit" : r.type === "wrong" ? "wrong" : null;
        if (r.type === "hit") flashRef.current.set(r.note.id, performance.now());
      }
      pressedRef.current.set(m, { source, verdict, at: performance.now() });
    },
    [synth]
  );
  const noteOff = useCallback(m => {
    synthRef.current?.noteOff(m);
    engineRef.current?.release(m);
    const p = pressedRef.current.get(m);
    if (p) pressedRef.current.delete(m);
  }, []);

  // Computer keyboard.
  useEffect(() => {
    const down = new Set();
    const onDown = e => {
      if (e.target.closest?.("input, select, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        if (statusRef.current === "playing") pause();
        else start();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "z") return setOctave(o => Math.max(24, o - 12));
      if (k === "x") return setOctave(o => Math.min(96, o + 12));
      const m = computerKey(k, octave);
      if (m == null || down.has(k)) return;
      down.add(k);
      noteOn(m, "keys");
    };
    const onUp = e => {
      const k = e.key.toLowerCase();
      if (!down.has(k)) return;
      down.delete(k);
      const m = computerKey(k, octave);
      if (m != null) noteOff(m);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [octave, noteOn, noteOff, pause, start]);

  // MIDI keyboard.
  const connectKeyboard = useCallback(async () => {
    try {
      stopMidiRef.current?.();
      stopMidiRef.current = await connectMidi({
        onNoteOn: (m, v) => noteOn(m, "midi", v),
        onNoteOff: m => noteOff(m),
        onDevices: devices => setMidi(s => ({ ...s, on: true, devices: devices.filter(d => d.state === "connected"), error: null })),
      });
      try {
        localStorage.setItem(MIDI_PREF, "1");
      } catch {
        /* ignore */
      }
    } catch (err) {
      setMidi({ on: false, devices: [], error: err?.message || "Couldn't reach MIDI devices." });
    }
  }, [noteOn, noteOff]);
  useEffect(() => {
    let wanted = false;
    try {
      wanted = localStorage.getItem(MIDI_PREF) === "1";
    } catch {
      /* ignore */
    }
    if (wanted && midiSupported()) queueMicrotask(() => connectKeyboard());
    return () => stopMidiRef.current?.();
  }, [connectKeyboard]);

  // Microphone.
  const finishCalib = useCallback(freqs => {
    calibRef.current = null;
    const cents = tuningFromPitches(freqs, 60);
    if (cents == null) {
      stopMicRef.current?.setTuning?.(settingsRef.current.tuning || 0);
      setCalib({ error: "Couldn't hear one steady C. Play middle C firmly, let it ring, and try again." });
      return;
    }
    stopMicRef.current?.setTuning?.(cents);
    setSettingsRef.current({ tuning: cents });
    setCalib({ cents });
  }, []);

  const toggleMic = useCallback(async () => {
    if (stopMicRef.current) {
      calibRef.current = null;
      setCalib(c => (c === "listening" ? null : c));
      stopMicRef.current();
      stopMicRef.current = null;
      listenerRef.current = null;
      setMic({ on: false, heard: null, error: null });
      return;
    }
    try {
      let lastShown = 0;
      const listener = createNoteListener();
      listenerRef.current = listener;
      stopMicRef.current = await startMic({
        minFreq: 26,
        maxFreq: 4200,
        tuning: settingsRef.current.tuning || 0,
        onFrame: frame => {
          const cal = calibRef.current;
          if (cal) {
            // Tuning to the player's piano: collect clear readings of the C they play.
            if (frame.freq && frame.clarity > 0.9 && frame.level > 0.008) cal.freqs.push(frame.freq);
            if (cal.freqs.length >= 24 || performance.now() > cal.until) finishCalib(cal.freqs);
          }
          const e = engineRef.current;
          const playing = e && statusRef.current === "playing";
          const t = performance.now();
          selfSoundsRef.current = selfSoundsRef.current.filter(x => x.until > t);
          // Only a key struck now counts: a note still ringing from before,
          // the app's own playing and room noise never move the song along.
          const exp = playing ? e.listenFor().map(n => n.midi) : [];
          const struck = listener.update(frame, exp, { ...selfSounds(selfSoundsRef.current, t), quiet: t < quietUntilRef.current });
          for (const m of struck) noteOn(m, "mic");
          const heard = listener.sounding;
          for (const m of micHeardRef.current) if (!heard.has(m) && pressedRef.current.get(m)?.source === "mic") pressedRef.current.delete(m);
          micHeardRef.current = new Set(heard);
          const now = performance.now();
          if (now - lastShown > 150) {
            lastShown = now;
            setMic(s => ({ ...s, heard: frame.midi }));
          }
        },
      });
      setMic({ on: true, heard: null, error: null });
    } catch (err) {
      setMic({ on: false, heard: null, error: err?.name === "NotAllowedError" ? "Microphone permission was blocked." : err?.message || "Couldn't open the microphone." });
    }
  }, [noteOn, finishCalib]);
  useEffect(() => () => stopMicRef.current?.(), []);

  // "Tune to my piano": hear middle C and listen in the piano's own tuning from then on.
  const tuneToPiano = useCallback(async () => {
    if (!stopMicRef.current) await toggleMic();
    if (!stopMicRef.current) return;
    stopMicRef.current.setTuning?.(0);
    calibRef.current = { freqs: [], until: performance.now() + 8000 };
    setCalib("listening");
  }, [toggleMic]);
  const resetTuning = useCallback(() => {
    calibRef.current = null;
    stopMicRef.current?.setTuning?.(0);
    setSettings({ tuning: 0 });
    setCalib(null);
  }, [setSettings]);

  // --- the frame loop -----------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    const frame = now => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const e = engineRef.current;
      const s = settingsRef.current;
      if (e && statusRef.current === "playing") {
        for (const ev of e.tick(dt)) {
          const sy = synthRef.current;
          if (ev.type === "auto" && s.otherHand === "play" && sy) {
            const secs = (ev.note.d * 60) / (e.song.bpm * e.speed);
            sy.playNote(ev.note.midi, secs, sy.now() + 0.01, ev.note.vel * 0.85);
            if (stopMicRef.current) selfSoundsRef.current.push({ midi: ev.note.midi, at: now, until: now + secs * 1000 + 400 });
          } else if (ev.type === "click" && sy) {
            sy.click(sy.now() + 0.01, ev.accent);
            quietUntilRef.current = now + 120;
          }
          else if (ev.type === "loop") flashRef.current.clear();
          else if (ev.type === "end") finish();
        }
      }
      const beat = e ? e.beat : 0;

      // Sheet follows the playhead.
      if (sheetGroupRef.current) {
        sheetGroupRef.current.setAttribute("transform", `translate(${playX - beat * ppb} 0)`);
        const w = Math.max(0, Math.floor((beat * ppb) / WINDOW_PX));
        if (w !== winRef.current) {
          winRef.current = w;
          setWin(w);
        }
      }

      // The bar strip's playhead: through the bar it's in, bar by bar.
      if (stripHeadRef.current && e) {
        const n = barCount(e.song);
        const i = barIndexAt(e.song, beat);
        const a = barStart(e.song, i);
        const frac = Math.max(0, Math.min(1, (beat - a) / Math.max(1e-6, barStart(e.song, i + 1) - a)));
        stripHeadRef.current.style.left = `${(beat < 0 ? 0 : ((i + frac) / n) * 100).toFixed(2)}%`;
      }

      if (ctx && canvas.width > 0) draw(ctx, canvas, e, beat, now);

      if (now - hudAt > 200 && e) {
        hudAt = now;
        const st = e.stats();
        setHud(h => {
          const next = { bar: barAt(e.song, Math.max(0, beat)), accuracy: st.hit + st.missed + st.wrong ? st.accuracy : null, streak: e.streak, waiting: e.waiting };
          return h.bar === next.bar && h.accuracy === next.accuracy && h.streak === next.streak && h.waiting === next.waiting ? h : next;
        });
      }
      raf = requestAnimationFrame(frame);
    };

    const draw = (ctx, canvas, e, beat, now) => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const keyH = Math.min(150, Math.max(84, W * 0.11));
      const fallH = H - keyH;
      const layout = keyLayout(lo, hi, W);
      const s = settingsRef.current;
      const bps = e ? e.beatsPerSec : 1;
      const pxPerBeat = Math.max(40, Math.min(260, 190 / bps));

      // Lanes: a faint line at every C and F, bar lines across.
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (const k of layout.keys.values()) if (k.black) ctx.fillRect(k.x, 0, k.w, fallH);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (const [m, k] of layout.keys) {
        if (m % 12 === 0 || m % 12 === 5) {
          ctx.beginPath();
          ctx.moveTo(Math.round(k.x) + 0.5, 0);
          ctx.lineTo(Math.round(k.x) + 0.5, fallH);
          ctx.stroke();
        }
      }
      if (e) {
        const bar = barBeats(e.song);
        const p = e.song.pickup || 0;
        const firstBar = Math.floor((beat - p) / bar);
        ctx.strokeStyle = "rgba(243,234,216,0.12)";
        for (let b = firstBar; b < firstBar + 40; b++) {
          const t = p + b * bar;
          const y = fallH - (t - beat) * pxPerBeat;
          if (y < 0) break;
          if (y > fallH) continue;
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(W, Math.round(y) + 0.5);
          ctx.stroke();
          ctx.fillStyle = "rgba(243,234,216,0.35)";
          ctx.font = "600 11px 'DM Sans', sans-serif";
          ctx.fillText(String(b + (p ? 2 : 1)), 6, y - 4);
        }
        if (e.loop) {
          for (const t of [e.loop.a, e.loop.b]) {
            const y = fallH - (t - beat) * pxPerBeat;
            if (y < 0 || y > fallH) continue;
            ctx.fillStyle = "rgba(242,181,68,0.5)";
            ctx.fillRect(0, y - 1, W, 2);
          }
        }
      }

      // Falling notes.
      if (e) {
        const lookahead = fallH / pxPerBeat;
        const practicing = n => s.hands === "both" || n.hand === s.hands;
        for (const n of e.song.notes) {
          if (n.t > beat + lookahead) break;
          if (n.t + n.d < beat - 0.5) continue;
          const k = layout.keys.get(n.midi);
          if (!k) continue;
          const yBottom = fallH - (n.t - beat) * pxPerBeat;
          const hgt = Math.max(8, n.d * pxPerBeat - 3);
          const yTop = yBottom - hgt;
          const pad = k.black ? 1 : 2.5;
          const res = e.result.get(n.id);
          const mine = practicing(n);
          ctx.globalAlpha = mine ? 1 : 0.38;
          const color = HAND_COLOR[n.hand];
          ctx.fillStyle = res === "miss" ? "rgba(255,95,95,0.35)" : color;
          roundRect(ctx, k.x + pad, yTop, k.w - pad * 2, hgt, Math.min(7, k.w / 3));
          ctx.fill();
          if (k.black) {
            ctx.strokeStyle = "rgba(0,0,0,0.45)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          if (res === "hit") {
            const age = (now - (flashRef.current.get(n.id) ?? 0)) / 400;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0.18, 0.75 - age)})`;
            ctx.fill();
          }
          if (s.noteNames && hgt > 16 && k.w > 13) {
            ctx.fillStyle = "rgba(14,12,11,0.85)";
            ctx.font = `700 ${Math.min(12, k.w * 0.5)}px 'DM Sans', sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(noteName(n.midi, { octave: false, flats: (e.song.key || 0) < 0 }).replace("♯", "#").replace("♭", "b"), k.x + k.w / 2, yBottom - 6);
            if (n.finger && hgt > 30) ctx.fillText(String(n.finger), k.x + k.w / 2, yTop + 14);
            ctx.textAlign = "left";
          }
          ctx.globalAlpha = 1;
        }
      }

      // The hit line.
      const glow = ctx.createLinearGradient(0, fallH - 18, 0, fallH);
      glow.addColorStop(0, "rgba(242,181,68,0)");
      glow.addColorStop(1, e?.waiting ? "rgba(242,181,68,0.32)" : "rgba(242,181,68,0.14)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, fallH - 18, W, 18);
      ctx.fillStyle = "#d9a441";
      ctx.fillRect(0, fallH - 2, W, 2);

      // Keys.
      const expected = new Map();
      if (e && statusRef.current !== "done") for (const n of e.expected()) expected.set(n.midi, n.hand);
      const drawKey = (m, k) => {
        const pressed = pressedRef.current.get(m);
        const h = k.black ? keyH * 0.62 : keyH;
        const x = k.x + (k.black ? 0 : 0.5);
        const w = k.w - (k.black ? 0 : 1);
        let fill = k.black ? "#1a1716" : "#f3ead8";
        if (expected.has(m)) fill = k.black ? "#6b5426" : "#f6dfaa";
        if (pressed) fill = pressed.verdict === "wrong" ? "#e0625b" : pressed.verdict === "hit" ? "#7fd18b" : k.black ? "#5a5047" : "#d8cdb6";
        ctx.fillStyle = fill;
        roundRect(ctx, x, fallH, w, h, k.black ? 3 : 5);
        ctx.fill();
        if (expected.has(m) && !pressed) {
          ctx.fillStyle = HAND_COLOR[expected.get(m)];
          ctx.fillRect(x + 2, fallH + h - 7, w - 4, 4);
        }
        if (!k.black && m % 12 === 0) {
          ctx.fillStyle = "rgba(14,12,11,0.5)";
          ctx.font = `600 ${Math.min(11, k.w * 0.45)}px 'DM Sans', sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(noteName(m), x + w / 2, fallH + h - 12);
          ctx.textAlign = "left";
        }
      };
      ctx.fillStyle = "#0e0c0b";
      ctx.fillRect(0, fallH, W, keyH);
      for (const [m, k] of layout.keys) if (!k.black) drawKey(m, k);
      for (const [m, k] of layout.keys) if (k.black) drawKey(m, k);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, fallH, W, 4);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lo, hi, ppb, playX, finish]);

  // Canvas size follows its box.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !stage.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(stage.w * dpr);
    c.height = Math.round(stage.h * dpr);
  }, [stage.w, stage.h]);

  // Touch / mouse on the keys.
  const pointerKeys = useRef(new Map());
  const pointerMidi = e => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const keyH = Math.min(150, Math.max(84, r.width * 0.11));
    const y = e.clientY - r.top - (r.height - keyH);
    if (y < 0) return null;
    return keyAt(keyLayout(lo, hi, r.width), e.clientX - r.left, y / keyH);
  };
  const onPointerDown = e => {
    const m = pointerMidi(e);
    if (m == null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointerKeys.current.set(e.pointerId, m);
    noteOn(m, "touch");
  };
  const onPointerMove = e => {
    if (!pointerKeys.current.has(e.pointerId)) return;
    const m = pointerMidi(e);
    const prev = pointerKeys.current.get(e.pointerId);
    if (m === prev || m == null) return;
    noteOff(prev);
    pointerKeys.current.set(e.pointerId, m);
    noteOn(m, "touch");
  };
  const onPointerUp = e => {
    const m = pointerKeys.current.get(e.pointerId);
    if (m == null) return;
    pointerKeys.current.delete(e.pointerId);
    noteOff(m);
  };

  // Jump to the start of a bar (tapping the sheet or the bar strip).
  const seekBar = useCallback(index => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.seek(barStart(eng.song, Math.max(0, Math.min(bars - 1, index))));
    flashRef.current.clear();
    if (statusRef.current === "done") setStatus("paused");
  }, [bars]);

  // On the sheet: tap a bar to jump there, drag across bars to loop them.
  const sheetDrag = useRef(null);
  const sheetBeat = clientX => {
    const eng = engineRef.current;
    const r = sheetWrapRef.current.getBoundingClientRect();
    return eng.beat + (clientX - r.left - playX) / ppb;
  };
  const onSheetDown = e => {
    if (!engineRef.current || !sheetWrapRef.current || (e.button !== undefined && e.button !== 0)) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    sheetDrag.current = { id: e.pointerId, x: e.clientX, beat: sheetBeat(e.clientX), moved: false };
  };
  const onSheetMove = e => {
    const d = sheetDrag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < TAP_PX) return;
    d.moved = true;
    setLoopDraft(loopFromBeats(arranged, d.beat, sheetBeat(e.clientX)));
  };
  const onSheetUp = e => {
    const d = sheetDrag.current;
    if (!d || d.id !== e.pointerId) return;
    sheetDrag.current = null;
    setLoopDraft(null);
    if (d.moved) selectLoop(loopFromBeats(arranged, d.beat, sheetBeat(e.clientX)));
    else seekBar(barIndexAt(arranged, d.beat));
  };
  const onSheetCancel = () => {
    sheetDrag.current = null;
    setLoopDraft(null);
  };
  const sheetLoop = useMemo(() => {
    const shown = loopDraft || (loop.on ? loop : null);
    return shown ? loopBeatsFor(arranged, shown) : null;
  }, [loopDraft, loop, arranged]);

  const playing = status === "playing";
  const handLabel = { R: "Right hand", L: "Left hand", both: "Both hands" };
  const sources = [
    midi.on && midi.devices.length ? `${midi.devices[0].name}` : null,
    mic.on ? "Microphone" : null,
  ].filter(Boolean);

  return (
    <div className={`ks-player view-${view}`}>
      <div className="ks-bar-top">
        <button type="button" className="ks-icon-btn" onClick={onBack} aria-label="Back to songs">
          <X size={18} />
        </button>
        <div className="ks-title">
          <strong>{song.title}</strong>
          <span>
            {song.composer ? `${song.composer} · ` : ""}
            {LEVELS.find(l => l.id === level)?.name} · {handLabel[hands]}
          </span>
        </div>
        <div className="ks-hud" aria-live="polite">
          <span title="Bar">
            Bar <b>{hud.bar}</b>/{song.pickup ? bars - 1 : bars}
          </span>
          {hud.accuracy !== null && (
            <span title="Accuracy">
              <b>{hud.accuracy}%</b>
            </span>
          )}
          {hud.streak > 4 && <span className="ks-streak">{hud.streak} in a row</span>}
        </div>
      </div>

      <div className="ks-controls">
        <button type="button" className="ks-play" onClick={playing ? pause : start} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={20} /> : <Play size={20} />}
          <span>{playing ? "Pause" : status === "paused" ? "Resume" : "Play"}</span>
        </button>
        <button type="button" className="ks-icon-btn" onClick={restart} aria-label="Start over" title="Start over">
          <RotateCcw size={17} />
        </button>

        <div className="ks-seg" role="radiogroup" aria-label="Which hand">
          {["L", "both", "R"].map(h => (
            <button key={h} type="button" role="radio" aria-checked={hands === h} className={hands === h ? "is-on" : ""} onClick={() => setSettings({ hands: h })}>
              {h === "both" ? "Both" : h === "L" ? "Left" : "Right"}
            </button>
          ))}
        </div>

        <label className="ks-speed">
          <span className="ks-long">Speed</span>
          <select aria-label="Speed" value={speed} onChange={e => setSettings({ speed: Number(e.target.value) })}>
            {SPEEDS.map(s => (
              <option key={s} value={s}>
                {pct(s)}
              </option>
            ))}
          </select>
        </label>

        <div className="ks-seg" role="radiogroup" aria-label="How to practice">
          <button type="button" role="radio" aria-checked={mode === "wait"} className={mode === "wait" ? "is-on" : ""} onClick={() => setSettings({ mode: "wait" })} title="The song waits for you to play each note">
            Wait for me
          </button>
          <button type="button" role="radio" aria-checked={mode === "play"} className={mode === "play" ? "is-on" : ""} onClick={() => setSettings({ mode: "play" })} title="The song keeps going; play in time">
            Play along
          </button>
        </div>

        <button type="button" className={`ks-chip${loop.on ? " is-on" : ""}`} onClick={() => setLoop(l => ({ ...l, on: !l.on }))} title="Repeat a few bars">
          <Repeat size={15} /> Loop
        </button>
        {loop.on && (
          <span className="ks-loop">
            bars
            <input type="number" min={1} max={lastBar(arranged)} value={loop.a} onChange={e => setLoop(l => ({ ...l, a: Math.max(1, Math.min(Number(e.target.value) || 1, l.b)) }))} aria-label="Loop from bar" />
            to
            <input type="number" min={1} max={lastBar(arranged)} value={loop.b} onChange={e => setLoop(l => ({ ...l, b: Math.max(l.a, Math.min(Number(e.target.value) || l.a, lastBar(arranged))) }))} aria-label="Loop to bar" />
          </span>
        )}

        <span className="ks-spacer" />

        {midiSupported() && (
          <button type="button" className={`ks-chip${midi.on && midi.devices.length ? " is-on" : ""}`} onClick={connectKeyboard} title="Use a keyboard plugged in by USB or Bluetooth MIDI">
            <Usb size={15} /> {midi.on ? (midi.devices.length ? midi.devices[0].name : "No keyboard found") : <><span className="ks-long">Connect keyboard</span><span className="ks-short">Keyboard</span></>}
          </button>
        )}
        {micSupported() && (
          <button type="button" className={`ks-chip${mic.on ? " is-on" : ""}`} onClick={toggleMic} title="Listen to a real piano through the microphone">
            {mic.on ? <Mic size={15} /> : <MicOff size={15} />} {mic.on ? `Listening${mic.heard != null ? ` · ${noteName(mic.heard)}` : ""}` : <><span className="ks-long">Use microphone</span><span className="ks-short">Mic</span></>}
          </button>
        )}
        <button type="button" className={`ks-icon-btn${panel === "settings" ? " is-on" : ""}`} onClick={() => setPanel(p => (p ? null : "settings"))} aria-label="More settings" aria-expanded={panel === "settings"}>
          <SlidersHorizontal size={17} />
        </button>
      </div>

      <BarStrip song={arranged} loop={loop} preview={loopDraft} onPreview={setLoopDraft} onSelect={selectLoop} onSeek={seekBar} headRef={stripHeadRef} />

      {(midi.error || mic.error) && <p className="ks-warn">{midi.error || mic.error}</p>}

      {panel === "settings" && (
        <div className="ks-panel">
          <div className="ks-field">
            <span>
              <Settings2 size={14} /> Difficulty
            </span>
            <div className="ks-seg">
              {LEVELS.map(l => (
                <button key={l.id} type="button" className={level === l.id ? "is-on" : ""} onClick={() => setSettings({ level: l.id })} title={l.hint}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
          <div className="ks-field">
            <span>
              <Music2 size={14} /> Show
            </span>
            <div className="ks-seg">
              {[
                ["both", "Notes + sheet"],
                ["falling", "Falling notes"],
                ["sheet", "Sheet music"],
              ].map(([id, name]) => (
                <button key={id} type="button" className={view === id ? "is-on" : ""} onClick={() => setSettings({ view: id })}>
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="ks-field">
            <span>
              <Hand size={14} /> Other hand
            </span>
            <div className="ks-seg">
              <button type="button" className={otherHand === "play" ? "is-on" : ""} onClick={() => setSettings({ otherHand: "play" })}>
                Plays for me
              </button>
              <button type="button" className={otherHand === "mute" ? "is-on" : ""} onClick={() => setSettings({ otherHand: "mute" })}>
                Silent
              </button>
            </div>
          </div>
          {micSupported() && (
            <div className="ks-field">
              <span>
                <Mic size={14} /> Piano tuning
              </span>
              <div className="ks-seg">
                <button type="button" className={calib === "listening" ? "is-on" : ""} onClick={tuneToPiano} disabled={calib === "listening"} title="Play middle C and KeysFox listens in your piano's tuning">
                  {calib === "listening" ? "Listening for C…" : "Tune to my piano"}
                </button>
                {tuning !== 0 && (
                  <button type="button" onClick={resetTuning} title="Go back to standard pitch (A = 440)">
                    Standard
                  </button>
                )}
              </div>
              <p className="ks-help">
                {calib === "listening"
                  ? "Play middle C (or any C) and let it ring."
                  : calib?.error
                    ? calib.error
                    : tuning === 0
                      ? "Standard pitch. If your piano is out of tune and notes aren't being heard, tune to it."
                      : `Listening in your piano's tuning: ${Math.abs(tuning)} cents ${tuning < 0 ? "flat" : "sharp"}.`}
              </p>
            </div>
          )}
          <label className="ks-check">
            <input type="checkbox" checked={noteNames} onChange={e => setSettings({ noteNames: e.target.checked })} /> Note names on falling notes
          </label>
          <label className="ks-check">
            <input type="checkbox" checked={metronome} onChange={e => setSettings({ metronome: e.target.checked })} /> Metronome
          </label>
          <label className="ks-check">
            <input type="checkbox" checked={mySound} onChange={e => setSettings({ mySound: e.target.checked })} /> Sound when I press keys (turn off if your keyboard makes its own)
          </label>
          <p className="ks-help">
            <Keyboard size={14} /> No piano handy? Your computer keys play: {Object.entries(COMPUTER_LABELS).slice(0, 13).map(([, k]) => k).join(" ")} starting at {noteName(octave)}. Z and X move an octave. Space plays and pauses. Tap the sheet music or the bar strip to jump to a bar; drag across either to loop those bars.
          </p>
          {mic.on && <p className="ks-help">With the microphone on, a note counts the moment you strike it, so a key that's still ringing won't move the song on. Headphones help it hear only you, not the hand KeysFox plays.</p>}
        </div>
      )}

      <div className="ks-stage-wrap">
        {view !== "falling" && (
          <div ref={sheetWrapRef} className="ks-sheet-wrap" onPointerDown={onSheetDown} onPointerMove={onSheetMove} onPointerUp={onSheetUp} onPointerCancel={onSheetCancel} style={{ minHeight: SHEET_HEIGHT }} title="Tap a bar to jump there. Drag across bars to loop them.">
            {sheetSize.w > 0 && <SheetView song={arranged} hands={hands} ppb={ppb} win={win} groupRef={sheetGroupRef} playX={playX} width={sheetSize.w} loop={sheetLoop} drafting={!!loopDraft} />}
          </div>
        )}
        <div ref={stageRef} className="ks-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <canvas ref={canvasRef} className="ks-canvas" style={{ width: stage.w, height: stage.h }} />
          {status === "ready" && (
            <div className="ks-start">
              <button type="button" className="ks-play ks-play--big" onClick={start}>
                <Play size={22} /> Start
              </button>
              <p>
                {mode === "wait" ? "The notes wait for you." : "Play each note as it reaches the gold line."} {sources.length ? `Playing with: ${sources.join(" and ")}.` : "Tap the keys, use your computer keys, or connect a keyboard."}
              </p>
            </div>
          )}
          {hud.waiting && playing && <div className="ks-waiting">Play the lit keys</div>}
        </div>
      </div>

      {status === "done" && result && (
        <div className="ks-result" role="dialog" aria-label="How it went">
          <div className="ks-result-card">
            <div className="ks-stars" aria-label={`${result.stars} of 3 stars`}>
              {[1, 2, 3].map(i => (
                <span key={i} className={i <= result.stars ? "is-on" : ""}>
                  ★
                </span>
              ))}
            </div>
            <h2>{result.accuracy >= 95 ? "Beautiful." : result.accuracy >= 80 ? "Nicely done." : result.accuracy >= 60 ? "Getting there." : "Keep at it."}</h2>
            <dl>
              <div>
                <dt>Accuracy</dt>
                <dd>{result.accuracy}%</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>
                  {result.hit}/{result.total}
                </dd>
              </div>
              <div>
                <dt>Best run</dt>
                <dd>{result.bestStreak}</dd>
              </div>
              {mode === "play" && result.hit > 4 && (
                <div>
                  <dt>Timing</dt>
                  <dd>{Math.abs(result.timing) < 25 ? "On time" : result.timing > 0 ? `${result.timing} ms late` : `${-result.timing} ms early`}</dd>
                </div>
              )}
            </dl>
            <p className="ks-next">
              {result.accuracy >= 90 && speed < 1
                ? `Try it at ${pct(SPEEDS.find(s => s > speed) ?? 1)} speed.`
                : result.accuracy >= 90 && mode === "wait"
                  ? "Ready to try Play along?"
                  : result.accuracy >= 90 && level !== "hard"
                    ? `Try ${level === "easy" ? "Medium" : "Hard"} next.`
                    : result.accuracy < 70
                      ? "Slow it down or loop the hard bars."
                      : "Once more and it's yours."}
            </p>
            <div className="ks-result-actions">
              <button type="button" className="ks-play" onClick={restart}>
                <RotateCcw size={18} /> Again
              </button>
              {result.accuracy >= 90 && speed < 1 && (
                <button type="button" className="ks-chip" onClick={() => setSettings({ speed: SPEEDS.find(s => s > speed) ?? 1 })}>
                  Faster
                </button>
              )}
              {result.accuracy >= 90 && mode === "wait" && (
                <button type="button" className="ks-chip" onClick={() => setSettings({ mode: "play" })}>
                  Play along
                </button>
              )}
              {result.accuracy >= 90 && level !== "hard" && (
                <button type="button" className="ks-chip" onClick={() => setSettings({ level: level === "easy" ? "medium" : "hard" })}>
                  Harder
                </button>
              )}
              <button type="button" className="ks-chip" onClick={onBack}>
                Songs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
