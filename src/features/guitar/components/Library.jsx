// The song list: everything FretFox can teach, at a glance.
import { useState } from "react";
import { Play } from "lucide-react";
import { SONGS, EXERCISES } from "../data/songs";
import { buildTimeline, partsFor } from "../model/arrange";

const FILTERS = [
  { id: "all", name: "Everything" },
  { id: "melody", name: "Melodies" },
  { id: "chords", name: "Chord songs" },
  { id: "exercises", name: "Warm-ups & scales" },
  { id: "mine", name: "Your songs" },
];

export default function Library({ data, onOpen }) {
  const [filter, setFilter] = useState("all");
  const all = [...SONGS, ...EXERCISES, ...data.songs];
  const list = all.filter(s =>
    filter === "all" ? true : filter === "melody" ? !s.rhythmOnly && !s.exercise && !s.imported : filter === "chords" ? s.rhythmOnly : filter === "exercises" ? s.exercise : s.imported
  );
  const minutes = Math.round(data.history.reduce((a, h) => a + h.minutes, 0));
  return (
    <section>
      <div className="ff-stats">
        <div>
          <strong>{all.length}</strong>
          <span>songs & exercises</span>
        </div>
        <div>
          <strong>{new Set(data.history.map(h => h.songId)).size}</strong>
          <span>practiced</span>
        </div>
        <div>
          <strong>{minutes}</strong>
          <span>minutes played</span>
        </div>
      </div>
      <div className="ff-filters" role="tablist">
        {FILTERS.map(f => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? "is-on" : ""} onClick={() => setFilter(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
      {!list.length && <p className="ff-empty">No songs here yet. Import a MIDI file, sheet music, tab or chords from the Import tab.</p>}
      <div className="ff-songs">
        {list.map(s => (
          <SongCard key={s.id} song={s} best={data.best[s.id]} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function SongCard({ song, best, onOpen }) {
  const parts = partsFor(song);
  let chords = [];
  try {
    chords = song.chords ? buildTimeline(song, { part: "rhythm", level: "medium" }).chordsUsed : [];
  } catch {
    chords = [];
  }
  const top = best ? Math.max(...Object.values(best)) : null;
  return (
    <article className="ff-card">
      <div className="ff-card-top">
        <span className="ff-dots" aria-label={`Difficulty ${song.level} of 3`}>
          {[1, 2, 3].map(i => (
            <i key={i} className={i <= song.level ? "is-on" : ""} />
          ))}
        </span>
        {top != null && <span className="ff-best">{top}%</span>}
      </div>
      <h3>{song.title}</h3>
      <p className="ff-by">{song.by}</p>
      {chords.length > 0 && (
        <p className="ff-chips">
          {chords.slice(0, 7).map(c => (
            <span key={c}>{c}</span>
          ))}
        </p>
      )}
      <div className="ff-card-actions">
        {parts.map(p => (
          <button key={p.id} type="button" className="ff-btn ff-btn-sm" onClick={() => onOpen(song.id, p.id)}>
            <Play size={13} aria-hidden="true" /> {p.name}
          </button>
        ))}
      </div>
    </article>
  );
}
