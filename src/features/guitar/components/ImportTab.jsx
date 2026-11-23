// Bring your own music: a MIDI or MusicXML file, a recording, tab or a
// chord sheet. Everything becomes a song you can play at every level.
import { useState } from "react";
import { ExternalLink, FileMusic, Trash2, Upload } from "lucide-react";
import { parseMidi } from "../../../lib/music/midi.js";
import { parseMusicXml, parseMxl } from "../../../lib/music/musicXml.js";
import { audioToNotes } from "../../../lib/music/audioToNotes.js";
import { noteName } from "../../../lib/music/theory.js";
import { FREE_SOURCES } from "../data/songs";
import { newSongId, parseChordSheet, parseTabText, songFromNoteData, withBeats } from "../model/importers";
import { buildTimeline } from "../model/arrange";

export default function ImportTab({ store, onOpen }) {
  const { data, saveSong, deleteSong } = store;
  const [parsed, setParsed] = useState(null); // { data, title, source }
  const [track, setTrack] = useState(0);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tabText, setTabText] = useState("");
  const [chordText, setChordText] = useState("");
  const [sheet, setSheet] = useState({ title: "", sig: "4/4", bpm: 90 });

  const onFile = async file => {
    if (!file) return;
    setError("");
    setParsed(null);
    try {
      const name = file.name.replace(/\.[^.]+$/, "");
      const buf = await file.arrayBuffer();
      let result;
      let source = "midi";
      if (/\.midi?$/i.test(file.name)) result = parseMidi(buf);
      else if (/\.mxl$/i.test(file.name)) {
        result = await parseMxl(buf);
        source = "musicxml";
      } else if (/\.(musicxml|xml)$/i.test(file.name)) {
        result = parseMusicXml(new TextDecoder().decode(buf));
        source = "musicxml";
      } else if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name)) {
        setBusy("Listening to your recording…");
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const audio = await ctx.decodeAudioData(buf);
        ctx.close().catch(() => {});
        result = await audioToNotes(audio, { onProgress: p => setBusy(`Listening to your recording… ${Math.round(p * 100)}%`) });
        source = "audio";
      } else throw new Error("FretFox reads .mid, .musicxml, .mxl and audio files.");
      const full = withBeats(result);
      const tracks = full.tracks.filter(t => t.notes.length);
      if (!tracks.length) throw new Error("No notes found in that file.");
      // Best guess for the tune: the track with the highest average pitch that has a fair number of notes.
      const guess = tracks.map((t, i) => ({ i, score: t.notes.reduce((a, n) => a + n.midi, 0) / t.notes.length + Math.min(10, t.notes.length / 20) })).sort((a, b) => b.score - a.score)[0].i;
      setParsed({ data: { ...full, tracks }, source });
      setTrack(guess);
      setTitle(full.title || name);
    } catch (err) {
      setError(err?.message || "Couldn't read that file.");
    } finally {
      setBusy("");
    }
  };

  const save = song => {
    // Make sure it really plays before keeping it.
    buildTimeline(song, { part: song.notes || song.tab ? "lead" : "rhythm" });
    saveSong(song);
    onOpen(song.id);
  };

  return (
    <section className="frx-import">
      <div className="frx-importcard">
        <h2>
          <FileMusic size={18} aria-hidden="true" /> A music file or recording
        </h2>
        <p>MIDI (.mid) and sheet music (MusicXML .musicxml / .mxl) work best. A recording (mp3, wav, m4a) is turned into a rough melody and chords; it works best with one clear instrument or voice.</p>
        <label className="frx-drop">
          <Upload size={20} aria-hidden="true" />
          <span>{busy || "Choose a file"}</span>
          <input type="file" accept=".mid,.midi,.musicxml,.xml,.mxl,audio/*" onChange={e => onFile(e.target.files?.[0])} />
        </label>
        {parsed && (
          <div className="frx-trackpick">
            <label>
              Title
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
            </label>
            <p className="frx-small">Which part is the tune? The chords are worked out from every part.</p>
            {parsed.data.tracks.map((t, i) => {
              const lo = Math.min(...t.notes.map(n => n.midi));
              const hi = Math.max(...t.notes.map(n => n.midi));
              return (
                <label key={i} className={`frx-track ${track === i ? "is-on" : ""}`}>
                  <input type="radio" name="frx-track" checked={track === i} onChange={() => setTrack(i)} />
                  <b>{t.name || `Part ${i + 1}`}</b>
                  <span>
                    {t.notes.length} notes · {noteName(lo)}–{noteName(hi)}
                  </span>
                </label>
              );
            })}
            <button type="button" className="frx-btn" onClick={() => save(songFromNoteData(parsed.data, { melodyTrack: track, title, source: parsed.source }))}>
              Add to my songs
            </button>
          </div>
        )}
      </div>

      <div className="frx-importcard">
        <h2>Guitar tab</h2>
        <p>Paste six-line tab (e|--0--2--|). Plain-text tab has no rhythm, so notes are spaced by how far apart they're written.</p>
        <textarea value={tabText} onChange={e => setTabText(e.target.value)} rows={7} spellCheck="false" placeholder={"e|-----0-----|\nB|---1---1---|\nG|-0-------2-|\nD|-----------|\nA|-3---------|\nE|-----------|"} />
        <button
          type="button"
          className="frx-btn"
          disabled={!tabText.trim()}
          onClick={() => {
            setError("");
            try {
              save({ id: newSongId(), title: sheet.title || "My tab", by: "Pasted tab", sig: "4/4", bpm: Number(sheet.bpm) || 90, level: 2, source: "tab", addedAt: new Date().toISOString(), tab: parseTabText(tabText) });
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          Add tab
        </button>
      </div>

      <div className="frx-importcard">
        <h2>Chord sheet</h2>
        <p>Paste chords over lyrics, or ChordPro like [G]Amazing [C]grace. Each chord gets one bar; lyrics aren't kept.</p>
        <textarea value={chordText} onChange={e => setChordText(e.target.value)} rows={5} placeholder={"G        C        G\nD        G"} />
        <div className="frx-row">
          <input placeholder="Title" value={sheet.title} onChange={e => setSheet(s => ({ ...s, title: e.target.value }))} maxLength={120} />
          <select value={sheet.sig} onChange={e => setSheet(s => ({ ...s, sig: e.target.value }))} aria-label="Time signature">
            <option>4/4</option>
            <option>3/4</option>
            <option>6/8</option>
          </select>
          <input type="number" min="40" max="220" value={sheet.bpm} onChange={e => setSheet(s => ({ ...s, bpm: e.target.value }))} aria-label="Tempo (bpm)" />
        </div>
        <button
          type="button"
          className="frx-btn"
          disabled={!chordText.trim()}
          onClick={() => {
            setError("");
            try {
              save({ id: newSongId(), title: sheet.title || "My chord sheet", by: "Pasted chords", sig: sheet.sig, bpm: Number(sheet.bpm) || 90, level: 1, source: "chords", addedAt: new Date().toISOString(), chords: parseChordSheet(chordText) });
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          Add chords
        </button>
      </div>

      {error && <p className="frx-error" role="alert">{error}</p>}

      {data.songs.length > 0 && (
        <div className="frx-importcard">
          <h2>Your songs</h2>
          <ul className="frx-mine">
            {data.songs.map(s => (
              <li key={s.id}>
                <button type="button" className="frx-linkbtn" onClick={() => onOpen(s.id)}>
                  {s.title}
                </button>
                <span>{s.by}</span>
                <button type="button" className="frx-ghost" aria-label={`Delete ${s.title}`} onClick={() => deleteSong(s.id)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="frx-importcard">
        <h2>Free music to bring in</h2>
        <p>Public-domain music you're free to download. Get the MIDI or MusicXML file and add it above.</p>
        <ul className="frx-sources">
          {FREE_SOURCES.map(s => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.name} <ExternalLink size={12} aria-hidden="true" />
              </a>
              <span>{s.what}</span>
            </li>
          ))}
        </ul>
        <p className="frx-small">Only add music you have the right to use. Most popular songs are copyrighted; your imports stay in your own account.</p>
      </div>
    </section>
  );
}
