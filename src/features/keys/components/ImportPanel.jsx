import { useRef, useState } from "react";
import { FileAudio, FileMusic, Upload, X } from "lucide-react";

import { parseMidi } from "../../../lib/music/midi";
import { parseMusicXml, parseMxl } from "../../../lib/music/musicXml";
import { audioToNotes } from "../../../lib/music/audioToNotes";
import { audioContext } from "../../../lib/music/synth";
import { fromImport } from "../model/song";

// Bring your own music: a MIDI file or MusicXML score plays exactly as
// written; a recording (mp3, wav, m4a...) is listened to and turned into a
// melody with chords, which works best for one clear instrument or voice.

const MAX_MB = 30;

async function readFile(file, onProgress) {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (/\.(mid|midi|kar)$/.test(name)) return { parsed: parseMidi(buf), kind: "midi" };
  if (/\.mxl$/.test(name)) return { parsed: await parseMxl(buf), kind: "score" };
  if (/\.(musicxml|xml)$/.test(name)) return { parsed: parseMusicXml(new TextDecoder().decode(buf)), kind: "score" };
  if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm|opus)$/.test(name)) {
    const ctx = audioContext();
    if (!ctx) throw new Error("This browser can't decode audio.");
    const audio = await ctx.decodeAudioData(buf.slice(0));
    return { parsed: await audioToNotes(audio, { onProgress }), kind: "audio" };
  }
  throw new Error("KeysFox reads MIDI (.mid), MusicXML (.musicxml, .xml, .mxl) and audio files.");
}

export default function ImportPanel({ onClose, onAdd }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null); // { parsed, kind, title, keep: Set }

  const pick = async file => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB.`);
    setBusy({ name: file.name, progress: 0 });
    try {
      const { parsed, kind } = await readFile(file, p => setBusy({ name: file.name, progress: p }));
      if (!parsed.tracks.length) throw new Error("No notes found in that file.");
      const title = parsed.title || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      setDraft({ parsed, kind, title, keep: new Set(parsed.tracks.map((_, i) => i)) });
    } catch (err) {
      setError(err?.message || "Couldn't read that file.");
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    try {
      const song = fromImport(draft.parsed, { title: draft.title, tracks: [...draft.keep] });
      if (draft.kind === "audio") song.composer = "From a recording";
      if (!onAdd(song)) return setError("This browser is out of room for more songs. Remove one and try again.");
      onClose(song);
    } catch (err) {
      setError(err?.message || "Couldn't make a song from that.");
    }
  };

  return (
    <div className="ks-modal" role="dialog" aria-label="Add your own song" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ks-modal-card">
        <button type="button" className="ks-icon-btn ks-modal-x" onClick={() => onClose()} aria-label="Close">
          <X size={18} />
        </button>
        <h2>Add your own song</h2>
        {!draft && (
          <>
            <button type="button" className="ks-drop" onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => (e.preventDefault(), pick(e.dataTransfer.files?.[0]))} disabled={Boolean(busy)}>
              <Upload size={26} />
              <strong>{busy ? (busy.progress ? `Listening… ${Math.round(busy.progress * 100)}%` : `Reading ${busy.name}…`) : "Choose or drop a file"}</strong>
              <span>MIDI, MusicXML or a recording</span>
            </button>
            <input ref={input} type="file" hidden accept=".mid,.midi,.kar,.musicxml,.xml,.mxl,audio/*" onChange={e => pick(e.target.files?.[0])} />
            <ul className="ks-import-kinds">
              <li>
                <FileMusic size={18} />
                <div>
                  <strong>MIDI or MusicXML</strong> plays exactly as written, with both hands, and you still get Easy, Medium and Hard.
                </div>
              </li>
              <li>
                <FileAudio size={18} />
                <div>
                  <strong>A recording</strong> (mp3, wav, m4a) gets turned into the tune plus simple chords. It's a sketch, best with one clear instrument or a singer.
                </div>
              </li>
            </ul>
            <p className="ks-help">Your songs stay on this device. Only add music you're free to use.</p>
          </>
        )}
        {draft && (
          <div className="ks-draft">
            <label className="ks-field-col">
              <span>Name</span>
              <input value={draft.title} maxLength={80} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
            </label>
            {draft.parsed.tracks.length > 1 && (
              <fieldset className="ks-tracks">
                <legend>Parts to include</legend>
                {draft.parsed.tracks.map((t, i) => (
                  <label key={i} className="ks-check">
                    <input
                      type="checkbox"
                      checked={draft.keep.has(i)}
                      onChange={e =>
                        setDraft(d => {
                          const keep = new Set(d.keep);
                          if (e.target.checked) keep.add(i);
                          else keep.delete(i);
                          return { ...d, keep };
                        })
                      }
                    />
                    {t.name} <small>({t.notes.length} notes)</small>
                  </label>
                ))}
              </fieldset>
            )}
            <p className="ks-help">
              {draft.parsed.tempo} beats per minute · {draft.parsed.timeSig.join("/")} time · {draft.parsed.tracks.reduce((s, t) => s + t.notes.length, 0)} notes
            </p>
            <div className="ks-result-actions">
              <button type="button" className="ks-play" onClick={save} disabled={!draft.keep.size || !draft.title.trim()}>
                Add to my songs
              </button>
              <button type="button" className="ks-chip" onClick={() => setDraft(null)}>
                Pick another
              </button>
            </div>
          </div>
        )}
        {error && <p className="ks-warn">{error}</p>}
      </div>
    </div>
  );
}
