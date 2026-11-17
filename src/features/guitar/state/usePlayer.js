// The practice engine: a clock in beats that can run slow, loop a few
// bars, wait for you, count you in, play the music and judge what the
// microphone or a MIDI guitar hears. Per-frame drawing subscribes to it
// directly so React only re-renders when something you can read changes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSynth } from "../../../lib/music/synth.js";
import { accuracy } from "../../../lib/music/practice.js";
import { frameMatches } from "../model/listen.js";

const EARLY = 0.2; // seconds before a note that still counts
const LATE = 0.35; // seconds after

export function usePlayer(timeline, { speed, sound, metronome, backing, wait, loop, onFinish }) {
  const [playing, setPlaying] = useState(false);
  const [counting, setCounting] = useState(0);
  const [current, setCurrent] = useState(-1);
  const [stats, setStats] = useState({ hit: 0, missed: 0 });
  const [waiting, setWaiting] = useState(false);

  const beatRef = useRef(timeline.start);
  const subs = useRef(new Set());
  const synth = useRef(null);
  const raf = useRef(0);
  const clock = useRef({ perf: 0, beat: 0 });
  const scheduled = useRef(-Infinity);
  const clicked = useRef(-Infinity);
  const judged = useRef(new Map()); // event id -> "hit" | "miss" | "skip"
  const frames = useRef([]); // recent input frames { at (perf ms), frame }
  const listening = useRef(false);
  const played = useRef(0); // seconds actually played this visit
  const opts = useRef({});
  opts.current = { speed, sound, metronome, backing, wait, loop, onFinish };

  const events = timeline.events;
  const spb = useCallback(() => 60 / (timeline.bpm * opts.current.speed), [timeline.bpm]);

  const emit = useCallback(() => {
    for (const fn of subs.current) fn(beatRef.current, judged.current);
  }, []);

  const subscribe = useCallback(
    fn => {
      subs.current.add(fn);
      fn(beatRef.current, judged.current);
      return () => subs.current.delete(fn);
    },
    []
  );

  const ensureSynth = () => {
    if (!synth.current) synth.current = createSynth({ voice: "pluck", volume: 0.7 });
    return synth.current;
  };

  const countStats = useCallback(() => {
    let hit = 0;
    let missed = 0;
    for (const v of judged.current.values()) {
      if (v === "hit") hit++;
      else if (v === "miss") missed++;
    }
    setStats({ hit, missed });
  }, []);

  /** Sound for events starting in [from, to). */
  const scheduleRange = useCallback(
    (from, to, nowPerf) => {
      const s = ensureSynth();
      if (!s.ctx) return;
      const o = opts.current;
      const secPerBeat = spb();
      const at = beat => s.now() + Math.max(0, (clock.current.perf + (beat - clock.current.beat) * secPerBeat * 1000 - nowPerf) / 1000);
      // Your part is muted while we listen, so the mic hears you, not us.
      if (o.sound && !listening.current) {
        for (const e of events) {
          if (e.t < from || e.t >= to) continue;
          const dur = Math.max(0.15, e.d * secPerBeat);
          if (e.kind === "strum") s.strum(e.notes.map(n => n.midi), at(e.t), { down: e.dir !== "U", spread: 0.012, dur: dur + 0.3, vel: e.dir === "U" ? 0.45 : 0.6 });
          else for (const n of e.notes) s.playNote(n.midi, dur + 0.2, at(e.t), 0.75);
        }
      }
      if (o.backing) {
        for (const e of timeline.backing) {
          if (e.t < from || e.t >= to) continue;
          const dur = Math.max(0.15, e.d * secPerBeat);
          if (e.kind === "strum") s.strum(e.notes.map(n => n.midi), at(e.t), { down: e.dir !== "U", spread: 0.012, dur: dur + 0.2, vel: 0.25 });
          else for (const n of e.notes) s.playNote(n.midi, dur, at(e.t), 0.3);
        }
      }
      if (o.metronome) {
        const first = Math.ceil(Math.max(from, clicked.current + 1e-6) - 1e-6);
        for (let b = first; b < to; b++) {
          const inBar = (((b - timeline.start) % timeline.barLen) + timeline.barLen) % timeline.barLen;
          s.click(at(b), Math.abs(b % timeline.barLen) < 1e-6 || inBar < 1e-6);
          clicked.current = b;
        }
      }
    },
    [events, spb, timeline]
  );

  const findCurrent = beat => {
    let idx = -1;
    for (let i = 0; i < events.length; i++) {
      if (events[i].t <= beat + 0.05) idx = i;
      else break;
    }
    return idx;
  };

  const stop = useCallback(
    (finished = false) => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      synth.current?.stopAll();
      setPlaying(false);
      setCounting(0);
      setWaiting(false);
      if (played.current > 15 || finished) {
        let hit = 0;
        let missed = 0;
        for (const v of judged.current.values()) {
          if (v === "hit") hit++;
          else if (v === "miss") missed++;
        }
        const acc = listening.current && hit + missed > 0 ? accuracy({ hit, missed }) : null;
        opts.current.onFinish?.({ minutes: played.current / 60, accuracy: finished ? acc : null, finished, hit, missed });
        played.current = 0;
      }
    },
    []
  );

  const tick = useCallback(() => {
    const now = performance.now();
    const o = opts.current;
    const secPerBeat = spb();
    let beat = clock.current.beat + (now - clock.current.perf) / 1000 / secPerBeat;

    // Count-in: a bar of clicks before the music.
    if (beat < clock.current.musicFrom) {
      const left = Math.ceil(clock.current.musicFrom - beat);
      setCounting(left);
    } else setCounting(0);

    // Loop back.
    if (o.loop && beat >= o.loop.b) {
      const a = o.loop.a;
      for (const e of events) if (e.t >= a && e.t < o.loop.b) judged.current.delete(e.id);
      clock.current = { ...clock.current, perf: now, beat: a };
      scheduled.current = a;
      clicked.current = a - 1;
      beat = a;
      countStats();
    }

    // Wait mode: hold the clock on the next note until it's played.
    let isWaiting = false;
    if (o.wait && beat >= clock.current.musicFrom) {
      const due = events.find(e => e.t <= beat && !judged.current.has(e.id));
      if (due) {
        const recent = frames.current.filter(f => now - f.at < 400);
        if (recent.some(f => frameMatches(due, f.frame))) {
          judged.current.set(due.id, "hit");
          countStats();
        } else {
          beat = due.t;
          clock.current = { ...clock.current, perf: now, beat };
          isWaiting = true;
        }
      }
    }
    setWaiting(isWaiting);

    // Judge in time when listening.
    if (!o.wait && listening.current) {
      let changed = false;
      for (const e of events) {
        if (judged.current.has(e.id)) continue;
        const dt = (beat - e.t) * secPerBeat; // seconds since the note was due
        if (dt < -EARLY) break;
        const windowStart = now - (dt + EARLY) * 1000;
        const ok = frames.current.some(f => f.at >= windowStart && frameMatches(e, f.frame));
        if (ok) {
          judged.current.set(e.id, "hit");
          changed = true;
        } else if (dt > LATE) {
          judged.current.set(e.id, "miss");
          changed = true;
        }
      }
      if (changed) countStats();
    }
    frames.current = frames.current.filter(f => now - f.at < 1500);

    if (!isWaiting) {
      const ahead = beat + 0.15 / secPerBeat;
      if (ahead > scheduled.current) {
        scheduleRange(Math.max(scheduled.current, beat - 1e-6), ahead, now);
        scheduled.current = ahead;
      }
      played.current += 1 / 60;
    }

    beatRef.current = beat;
    const idx = findCurrent(beat);
    setCurrent(c => (c === idx ? c : idx));
    emit();

    if (beat >= timeline.end + 0.5 && !o.loop) {
      stop(true);
      return;
    }
    raf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, timeline.end, spb, scheduleRange, emit, stop, countStats]);

  const play = useCallback(
    async (fromBeat = beatRef.current) => {
      const s = ensureSynth();
      await s.ctx?.resume?.();
      const from = opts.current.loop && (fromBeat < opts.current.loop.a || fromBeat >= opts.current.loop.b) ? opts.current.loop.a : fromBeat;
      const atStart = from <= timeline.start + 1e-6 || (opts.current.loop && Math.abs(from - opts.current.loop.a) < 1e-6);
      // Count in a full bar from the top; just one beat when resuming.
      const lead = atStart ? timeline.barLen : 1;
      for (const e of events) if (e.t >= from - 1e-6) judged.current.delete(e.id);
      countStats();
      clock.current = { perf: performance.now(), beat: from - lead, musicFrom: from };
      scheduled.current = from - lead;
      clicked.current = from - lead - 1;
      setPlaying(true);
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(tick);
    },
    [events, tick, timeline.start, timeline.barLen, countStats]
  );

  const pause = useCallback(() => {
    beatRef.current = Math.max(timeline.start, beatRef.current);
    stop(false);
    emit();
  }, [stop, emit, timeline.start]);

  const seek = useCallback(
    beat => {
      const b = Math.max(timeline.start, Math.min(timeline.end, beat));
      const wasPlaying = Boolean(raf.current);
      if (wasPlaying) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        synth.current?.stopAll();
      }
      beatRef.current = b;
      setCurrent(findCurrent(b));
      emit();
      if (wasPlaying) play(b);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline, emit, play]
  );

  /** In wait mode, step past the note you're stuck on. */
  const skip = useCallback(() => {
    const beat = beatRef.current;
    const due = events.find(e => e.t <= beat + 1e-6 && !judged.current.has(e.id));
    if (due) judged.current.set(due.id, "skip");
    else if (!raf.current) {
      // Paused: step to the next note so you can learn shapes at your own pace.
      const next = events.find(e => e.t > beat + 1e-6);
      if (next) seek(next.t);
    }
  }, [events, seek]);

  /** Feed what the mic or MIDI heard. */
  const hear = useCallback(frame => {
    frames.current.push({ at: performance.now(), frame });
  }, []);
  const setListening = useCallback(on => {
    listening.current = on;
  }, []);

  // A new song, part or level starts from the top.
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    synth.current?.stopAll();
    judged.current = new Map();
    beatRef.current = timeline.start;
    setPlaying(false);
    setCurrent(-1);
    setStats({ hit: 0, missed: 0 });
    emit();
  }, [timeline, emit]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      synth.current?.stopAll();
    },
    []
  );

  /** Play one event now (tap a note or chord to hear it). */
  const preview = useCallback(e => {
    const s = ensureSynth();
    if (!s.ctx) return;
    if (e.kind === "strum" || e.notes.length > 2) s.strum(e.notes.map(n => n.midi), s.now(), { down: e.dir !== "U", dur: 1.2 });
    else for (const n of e.notes) s.playNote(n.midi, 0.8, s.now(), 0.8);
  }, []);

  return useMemo(
    () => ({ playing, counting, current, stats, waiting, beatRef, subscribe, play, pause, seek, skip, hear, setListening, preview, judged }),
    [playing, counting, current, stats, waiting, subscribe, play, pause, seek, skip, hear, setListening, preview]
  );
}
