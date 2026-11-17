// Standard MIDI File (.mid) reader shared by the music apps.
//   parseMidi(arrayBuffer) -> { title, tempo, timeSig, key (fifths or null), tracks: [{ name, channel, program, notes: [{ midi, start, dur, vel, beat, beats }] }] }
// start/dur are seconds (following every tempo change), beat/beats are
// quarter notes. Drum tracks (channel 10) are dropped.
import { beatsToSeconds } from "./musicXml.js";

function reader(bytes) {
  let p = 0;
  return {
    get pos() {
      return p;
    },
    set pos(v) {
      p = v;
    },
    u8: () => bytes[p++],
    u16: () => (bytes[p++] << 8) | bytes[p++],
    u32: () => ((bytes[p++] << 24) >>> 0) + (bytes[p++] << 16) + (bytes[p++] << 8) + bytes[p++],
    vlq() {
      let v = 0;
      for (let i = 0; i < 4; i++) {
        const b = bytes[p++];
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return v;
    },
    text: n => {
      const s = new TextDecoder("latin1").decode(bytes.subarray(p, p + n));
      p += n;
      return s;
    },
    skip: n => {
      p += n;
    },
  };
}

export function parseMidi(buffer) {
  const bytes = new Uint8Array(buffer);
  const r = reader(bytes);
  if (r.text(4) !== "MThd") throw new Error("That isn't a MIDI file.");
  const hlen = r.u32();
  const format = r.u16();
  const ntracks = r.u16();
  const division = r.u16();
  r.skip(hlen - 6);
  if (division & 0x8000) throw new Error("SMPTE-timed MIDI files aren't supported.");
  const tpq = division || 480;

  const tempoMap = [];
  let timeSig = null;
  let key = null;
  let title = null;
  const out = [];

  for (let t = 0; t < ntracks && r.pos < bytes.length; t++) {
    const id = r.text(4);
    const len = r.u32();
    const end = r.pos + len;
    if (id !== "MTrk") {
      r.pos = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    let name = null;
    const open = new Map(); // ch*128+note -> [{ tick, vel }]
    const byChannel = new Map(); // ch -> { notes, program }
    const chan = ch => {
      if (!byChannel.has(ch)) byChannel.set(ch, { notes: [], program: 0 });
      return byChannel.get(ch);
    };
    const close = (ch, note, atTick) => {
      const stack = open.get(ch * 128 + note);
      const on = stack?.shift();
      if (!on) return;
      chan(ch).notes.push({ midi: note, beat: on.tick / tpq, beats: Math.max(1, atTick - on.tick) / tpq, vel: on.vel });
    };
    while (r.pos < end) {
      tick += r.vlq();
      let b = r.u8();
      if (b === 0xff) {
        const type = r.u8();
        const n = r.vlq();
        if (type === 0x51 && n === 3) {
          const us = (r.u8() << 16) | (r.u8() << 8) | r.u8();
          tempoMap.push({ beat: tick / tpq, bpm: 60e6 / us });
        } else if (type === 0x58 && n >= 2) {
          const num = r.u8();
          const den = 2 ** r.u8();
          r.skip(n - 2);
          timeSig ??= [num, den];
        } else if (type === 0x59 && n === 2) {
          const sf = r.u8();
          r.skip(1);
          key ??= sf > 127 ? sf - 256 : sf;
        } else if (type === 0x03) {
          name = r.text(n).trim() || name;
          if (format !== 1 || t === 0) title ??= name;
        } else r.skip(n);
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        r.skip(r.vlq());
        continue;
      }
      let d1;
      if (b & 0x80) {
        status = b;
        d1 = r.u8();
      } else {
        d1 = b; // running status
        b = status;
      }
      const kind = status & 0xf0;
      const ch = status & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) {
        if (kind === 0xc0) chan(ch).program = d1;
        continue;
      }
      const d2 = r.u8();
      if (kind === 0x90 && d2 > 0) {
        const key = ch * 128 + d1;
        if (!open.has(key)) open.set(key, []);
        open.get(key).push({ tick, vel: d2 / 127 });
      } else if (kind === 0x80 || kind === 0x90) close(ch, d1, tick);
    }
    for (const [key, stack] of open) while (stack.length) close(key >> 7, key & 127, tick);
    r.pos = end;
    for (const [ch, { notes, program }] of byChannel) {
      if (ch === 9 || !notes.length) continue;
      out.push({ name: name || `Track ${out.length + 1}`, channel: ch, program, notes });
    }
  }

  const bpm = tempoMap[0]?.bpm ?? 120;
  const toSec = beatsToSeconds(tempoMap.length ? tempoMap : [{ beat: 0, bpm }], bpm);
  for (const tr of out) {
    for (const n of tr.notes) {
      n.start = toSec(n.beat);
      n.dur = toSec(n.beat + n.beats) - n.start;
    }
    tr.notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  }
  if (title && out.some(tr => tr.name === title) && out.length > 1) title = null;
  return { title, tempo: Math.round(bpm), timeSig: timeSig ?? [4, 4], key, tracks: out };
}

/** Write a simple type-0 MIDI file from [{ midi, beat, beats, vel }] (for tests and export). */
export function writeMidi(notes, { bpm = 120, tpq = 480 } = {}) {
  const ev = [];
  for (const n of notes) {
    ev.push({ tick: Math.round(n.beat * tpq), data: [0x90, n.midi, Math.round((n.vel ?? 0.8) * 127)] });
    ev.push({ tick: Math.round((n.beat + n.beats) * tpq), data: [0x80, n.midi, 0] });
  }
  ev.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]);
  const body = [];
  const vlq = v => {
    const s = [v & 0x7f];
    while ((v >>= 7)) s.unshift((v & 0x7f) | 0x80);
    body.push(...s);
  };
  const us = Math.round(60e6 / bpm);
  vlq(0);
  body.push(0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255);
  let last = 0;
  for (const e of ev) {
    vlq(e.tick - last);
    last = e.tick;
    body.push(...e.data);
  }
  vlq(0);
  body.push(0xff, 0x2f, 0);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, tpq >> 8, tpq & 255];
  const len = body.length;
  return new Uint8Array([...head, 0x4d, 0x54, 0x72, 0x6b, len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...body]).buffer;
}
