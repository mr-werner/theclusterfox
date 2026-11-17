// MusicXML import (.musicxml / .xml and compressed .mxl), the format almost
// every notation program exports and that free libraries like Mutopia and
// MuseScore share. Result has the same shape as midi.js:
//   { tempo, timeSig, key (fifths or null), title, tracks: [{ name, notes: [{ midi, start, dur, vel, staff, beat, beats }] }] }
// start/dur in seconds (at the written tempo), beat/beats in quarter notes,
// staff 1 = upper (right hand on piano), 2 = lower (left hand).
import { kid, kids, parseXml, textOf } from "./xml.js";

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parse uncompressed MusicXML text. Throws on files that aren't partwise MusicXML. */
export function parseMusicXml(text) {
  const root = parseXml(String(text));
  if (!root) throw new Error("That file is empty.");
  if (root.name === "score-timewise") throw new Error("Timewise MusicXML isn't supported; export as partwise MusicXML.");
  if (root.name !== "score-partwise") throw new Error("That isn't a MusicXML score.");

  const title = textOf(kid(root, "work"), "work-title") || textOf(root, "movement-title") || null;
  const partNames = new Map(kids(kid(root, "part-list"), "score-part").map(p => [p.attrs.id, textOf(p, "part-name") || p.attrs.id]));

  let firstTempo = null;
  let timeSig = null;
  let key = null;
  const tempoMap = []; // [{ beat, bpm }]
  const tracks = [];

  for (const part of kids(root, "part")) {
    let divisions = 1;
    let measureStart = 0; // in quarter notes
    const notes = [];
    const open = new Map(); // tie continuation key -> note

    for (const measure of kids(part, "measure")) {
      let pos = 0;
      let measureLen = 0;
      let lastStart = 0;
      for (const el of measure.children) {
        if (el.name === "attributes") {
          const d = Number(textOf(el, "divisions"));
          if (d > 0) divisions = d;
          const time = kid(el, "time");
          const fifths = textOf(kid(el, "key"), "fifths");
          if (fifths != null && key == null && Number.isInteger(Number(fifths))) key = Number(fifths);
          if (time && !timeSig) timeSig = [Number(textOf(time, "beats")) || 4, Number(textOf(time, "beat-type")) || 4];
        } else if (el.name === "direction" || el.name === "sound") {
          const sound = el.name === "sound" ? el : kid(el, "sound");
          const bpm = Number(sound?.attrs?.tempo);
          if (bpm > 0) {
            tempoMap.push({ beat: measureStart + pos / divisions, bpm });
            firstTempo ??= bpm;
          }
        } else if (el.name === "backup") {
          pos -= Number(textOf(el, "duration")) || 0;
        } else if (el.name === "forward") {
          pos += Number(textOf(el, "duration")) || 0;
        } else if (el.name === "note") {
          if (kid(el, "grace") || kid(el, "cue")) continue;
          const dur = Number(textOf(el, "duration")) || 0;
          const isChord = Boolean(kid(el, "chord"));
          const start = isChord ? lastStart : pos;
          if (!isChord) {
            lastStart = pos;
            pos += dur;
          }
          measureLen = Math.max(measureLen, pos);
          const pitch = kid(el, "pitch");
          if (!pitch || kid(el, "rest")) continue;
          const step = STEP[(textOf(pitch, "step") || "").toUpperCase()];
          if (step == null) continue;
          const midi = (Number(textOf(pitch, "octave")) + 1) * 12 + step + Math.round(Number(textOf(pitch, "alter")) || 0);
          const staff = Number(textOf(el, "staff")) || 1;
          const beat = measureStart + start / divisions;
          const beats = dur / divisions;
          const ties = kids(el, "tie").map(t => t.attrs.type);
          const tieKey = `${midi}:${staff}`;
          const prev = open.get(tieKey);
          if (ties.includes("stop") && prev && Math.abs(prev.beat + prev.beats - beat) < 1e-6) {
            prev.beats += beats;
            if (!ties.includes("start")) open.delete(tieKey);
            continue;
          }
          const dyn = Number(el.attrs.dynamics);
          const note = { midi, beat, beats, staff, vel: dyn > 0 ? Math.min(1, dyn / 127) : 0.75 };
          notes.push(note);
          if (ties.includes("start")) open.set(tieKey, note);
        }
      }
      measureStart += Math.max(measureLen, pos) / divisions;
    }
    tracks.push({ name: partNames.get(part.attrs.id) || `Part ${tracks.length + 1}`, notes });
  }

  const bpm = firstTempo ?? 100;
  const toSec = beatsToSeconds(tempoMap.length ? tempoMap : [{ beat: 0, bpm }], bpm);
  for (const t of tracks) {
    for (const n of t.notes) {
      n.start = toSec(n.beat);
      n.dur = toSec(n.beat + n.beats) - n.start;
    }
    t.notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  }
  return { title, tempo: bpm, timeSig: timeSig ?? [4, 4], key, tracks: tracks.filter(t => t.notes.length) };
}

/** A function beat -> seconds for a tempo map [{ beat, bpm }]. */
export function beatsToSeconds(tempoMap, fallbackBpm = 120) {
  const map = [...tempoMap].sort((a, b) => a.beat - b.beat);
  if (!map.length || map[0].beat > 0) map.unshift({ beat: 0, bpm: map[0]?.bpm ?? fallbackBpm });
  const starts = [0];
  for (let i = 1; i < map.length; i++) starts[i] = starts[i - 1] + ((map[i].beat - map[i - 1].beat) * 60) / map[i - 1].bpm;
  return beat => {
    let i = map.length - 1;
    while (i > 0 && map[i].beat > beat) i--;
    return starts[i] + ((beat - map[i].beat) * 60) / map[i].bpm;
  };
}

// --- .mxl (zip) -------------------------------------------------------------

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser can't open .mxl files; export uncompressed MusicXML instead.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read the files in a zip: Map name -> () => Promise<Uint8Array>. */
export function readZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That .mxl file isn't a valid zip.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const dataAt = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    files.set(name, async () => {
      const raw = bytes.subarray(dataAt, dataAt + size);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      throw new Error("That .mxl file uses an unsupported compression.");
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Parse a compressed .mxl file (ArrayBuffer). */
export async function parseMxl(buffer) {
  const files = readZip(buffer);
  const dec = new TextDecoder();
  let path = null;
  const container = files.get("META-INF/container.xml");
  if (container) {
    const xml = parseXml(dec.decode(await container()));
    path = kid(kid(xml, "rootfiles"), "rootfile")?.attrs?.["full-path"] ?? null;
  }
  path ??= [...files.keys()].find(n => !n.startsWith("META-INF") && /\.(musicxml|xml)$/i.test(n));
  if (!path || !files.has(path)) throw new Error("No score found inside that .mxl file.");
  return parseMusicXml(dec.decode(await files.get(path)()));
}
