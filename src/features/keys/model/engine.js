// The practice engine: moves the song along, plays the hand you aren't
// practicing, and judges the notes you play. Plain JS with no browser
// APIs, so the tests can play songs through it.
//
// Two ways to practice:
//   "wait" - the song stops at each note until you play it (learn the notes)
//   "play" - the song keeps going and you play along in time (perform it)
import { barBeats, songBeats } from "./song.js";

const EPS = 1e-6;
// In wait mode the next note counts when you play it up to this many beats early.
const WAIT_EARLY = 2;

export class Engine {
  /**
   * song: an arranged song. options:
   *   hands "R" | "L" | "both", mode "wait" | "play", speed (0.25–1.5),
   *   loop { a, b } in beats or null, countIn (bars, default 1),
   *   window: seconds either side of a note that still counts (default 0.2).
   */
  constructor(song, { hands = "both", mode = "wait", speed = 1, loop = null, countIn = 1, window = 0.2, start = 0 } = {}) {
    this.song = song;
    this.hands = hands;
    this.mode = mode;
    this.speed = speed;
    this.window = window;
    this.loop = loop && loop.b > loop.a ? loop : null;
    this.end = songBeats(song);
    this.bar = barBeats(song);
    this.practice = song.notes.filter(n => hands === "both" || n.hand === hands);
    this.auto = song.notes.filter(n => !(hands === "both" || n.hand === hands));
    this.reset(this.loop ? this.loop.a : start, countIn);
  }

  /** Beats per real second at the current speed. */
  get beatsPerSec() {
    return (this.song.bpm * this.speed) / 60;
  }

  reset(from = 0, countIn = 1) {
    this.beat = from - countIn * this.bar;
    this.from = from;
    this.result = new Map(); // note id -> "hit" | "miss"
    this.timing = []; // offsets in seconds of hits
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.nextAuto = 0;
    this.nextPractice = 0;
    this.nextClick = Math.ceil(this.beat - EPS);
    this.held = new Set();
    this.waiting = false;
    this.finished = false;
    this.elapsed = 0;
    this.seekIndexes(from);
  }

  seekIndexes(beat) {
    this.nextAuto = this.auto.findIndex(n => n.t >= beat - EPS);
    if (this.nextAuto < 0) this.nextAuto = this.auto.length;
    this.nextPractice = this.practice.findIndex(n => n.t >= beat - EPS);
    if (this.nextPractice < 0) this.nextPractice = this.practice.length;
  }

  /** The practice notes still to play at the next stop (wait mode). */
  pendingGroup() {
    let i = this.nextPractice;
    while (i < this.practice.length && this.result.has(this.practice[i].id)) i++;
    if (i >= this.practice.length) return [];
    const t = this.practice[i].t;
    const group = [];
    for (let j = i; j < this.practice.length && this.practice[j].t <= t + EPS; j++) if (!this.result.has(this.practice[j].id)) group.push(this.practice[j]);
    return group;
  }

  /** Notes you're expected to play right now (for highlighting keys). */
  expected() {
    if (this.mode === "wait") return this.pendingGroup().filter(n => n.t - this.beat < 0.75);
    const w = this.window * this.beatsPerSec;
    return this.practice.filter(n => !this.result.has(n.id) && Math.abs(n.t - this.beat) <= w);
  }

  /**
   * Notes the microphone should listen for. In wait mode that's the next
   * stop even before the song gets there: a mic only hears a note when it's
   * struck, so one played a little early would otherwise never count.
   */
  listenFor() {
    if (this.mode === "wait") return this.pendingGroup().filter(n => n.t - this.beat <= WAIT_EARLY);
    return this.expected();
  }

  /**
   * Move time forward by dt real seconds. Returns events:
   *   { type: "auto", note }  play this note for the other hand
   *   { type: "click", accent } metronome / count-in
   *   { type: "miss", note }  a note went by unplayed (play mode)
   *   { type: "loop" } jumped back to the loop start
   *   { type: "end" }
   */
  tick(dt) {
    const events = [];
    if (this.finished || dt <= 0) return events;
    this.elapsed += dt;
    let target = this.beat + dt * this.beatsPerSec;

    if (this.mode === "wait") {
      const group = this.pendingGroup();
      if (group.length && target >= group[0].t) {
        target = Math.max(this.beat, group[0].t);
        this.waiting = true;
      } else this.waiting = false;
    }

    // Metronome ticks for the count-in (and the whole song when wanted).
    while (this.nextClick <= target + EPS) {
      if (this.nextClick < this.from || this.metronome) {
        const rel = this.nextClick - (this.song.pickup || 0);
        events.push({ type: "click", accent: Math.abs(((rel % this.bar) + this.bar) % this.bar) < EPS, countIn: this.nextClick < this.from });
      }
      this.nextClick += 1;
    }

    while (this.nextAuto < this.auto.length && this.auto[this.nextAuto].t <= target + EPS) {
      const n = this.auto[this.nextAuto++];
      if (n.t >= this.from - EPS) events.push({ type: "auto", note: n });
    }

    if (this.mode === "play") {
      const w = this.window * this.beatsPerSec;
      for (const n of this.practice) {
        if (n.t > target) break;
        if (!this.result.has(n.id) && n.t + w < target && n.t >= this.from - EPS) {
          this.result.set(n.id, "miss");
          this.streak = 0;
          events.push({ type: "miss", note: n });
        }
      }
    }
    while (this.nextPractice < this.practice.length && this.practice[this.nextPractice].t + (this.mode === "play" ? this.window * this.beatsPerSec : 0) < target - EPS && this.result.has(this.practice[this.nextPractice].id)) this.nextPractice++;

    this.beat = target;

    const stopAt = this.loop ? this.loop.b : this.end;
    if (this.beat >= stopAt - EPS && !(this.mode === "wait" && this.pendingGroup().some(n => n.t < stopAt - EPS))) {
      if (this.loop) {
        events.push({ type: "loop", stats: this.stats() });
        const keep = this.metronome;
        this.reset(this.loop.a, 0);
        this.metronome = keep;
      } else {
        this.finished = true;
        events.push({ type: "end" });
      }
    }
    return events;
  }

  /** You pressed a key. Returns { type: "hit", note, offset } | { type: "wrong" } | { type: "early" }. */
  press(midi, { fromMic = false } = {}) {
    this.held.add(midi);
    if (this.finished || this.beat < this.from - this.bar * 0.25) return { type: "ignored" };
    if (this.mode === "wait") {
      const group = this.pendingGroup();
      const n = group.find(g => g.midi === midi);
      if (n && n.t - this.beat <= (fromMic ? WAIT_EARLY : 0.75)) {
        this.result.set(n.id, "hit");
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        return { type: "hit", note: n, offset: 0 };
      }
      if (!fromMic) {
        this.wrong++;
        this.streak = 0;
      }
      return { type: "wrong" };
    }
    const w = this.window * this.beatsPerSec;
    let best = null;
    for (const n of this.practice) {
      if (n.t > this.beat + w) break;
      if (n.midi !== midi || this.result.has(n.id) || Math.abs(n.t - this.beat) > w) continue;
      if (!best || Math.abs(n.t - this.beat) < Math.abs(best.t - this.beat)) best = n;
    }
    if (best) {
      this.result.set(best.id, "hit");
      const offset = (this.beat - best.t) / this.beatsPerSec;
      this.timing.push(offset);
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      return { type: "hit", note: best, offset };
    }
    if (!fromMic) {
      this.wrong++;
      this.streak = 0;
    }
    return { type: "wrong" };
  }

  release(midi) {
    this.held.delete(midi);
  }

  /** Jump to a beat (e.g. tapping a bar on the sheet). */
  seek(beat) {
    const keep = this.metronome;
    this.reset(Math.max(0, Math.min(beat, this.end)), 0);
    this.metronome = keep;
  }

  stats() {
    const counted = this.practice.filter(n => n.t >= this.from - EPS && (!this.loop || n.t < this.loop.b - EPS));
    const hit = counted.filter(n => this.result.get(n.id) === "hit").length;
    const missed = counted.filter(n => this.result.get(n.id) === "miss").length;
    const total = counted.length;
    const judged = hit + missed + this.wrong * 0.5;
    const accuracy = judged ? Math.round((hit / judged) * 100) : 0;
    const avg = this.timing.length ? this.timing.reduce((a, b) => a + b, 0) / this.timing.length : 0;
    return { hit, missed, wrong: this.wrong, total, accuracy, bestStreak: this.bestStreak, timing: Math.round(avg * 1000), seconds: Math.round(this.elapsed) };
  }
}

/** 0–3 stars for a finished run. */
export const starsFor = ({ accuracy, total, hit }) => (!total || hit < total * 0.5 ? 0 : accuracy >= 95 ? 3 : accuracy >= 80 ? 2 : accuracy >= 60 ? 1 : 0);
