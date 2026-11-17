import { Music, Plus, Trash2, Upload } from "lucide-react";
import { CATEGORIES } from "../data/songs";
import { bestKey } from "../state/keysStore";

const FREE_SOURCES = [
  { name: "Mutopia Project", href: "https://www.mutopiaproject.org/", note: "Thousands of public domain pieces with MIDI files." },
  { name: "IMSLP", href: "https://imslp.org/", note: "The big public domain score library; many pieces have MIDI or MusicXML." },
  { name: "OpenScore", href: "https://musescore.com/openscore", note: "Classical scores re-typeset and given to the public domain (MusicXML)." },
];

function Stars({ n }) {
  return (
    <span className="ks-mini-stars" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map(i => (
        <span key={i} className={i <= n ? "is-on" : ""}>
          ★
        </span>
      ))}
    </span>
  );
}

function SongCard({ song, data, onOpen, onRemove }) {
  const { level, hands } = data.settings;
  const best = data.best[bestKey(song.id, level, hands)];
  return (
    <div className="ks-card">
      <button type="button" className="ks-card-main" onClick={() => onOpen(song.id)}>
        <span className="ks-card-level" aria-label={`Difficulty ${song.level} of 4`}>
          {[1, 2, 3, 4].map(i => (
            <i key={i} className={i <= song.level ? "is-on" : ""} />
          ))}
        </span>
        <strong>{song.title}</strong>
        <span className="ks-card-by">{song.composer || "Your song"}</span>
        {best ? <Stars n={best.stars} /> : <span className="ks-card-new">Not played yet</span>}
      </button>
      {onRemove && (
        <button type="button" className="ks-card-del" onClick={() => onRemove(song.id)} aria-label={`Remove ${song.title}`}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export default function Library({ songs, imported, data, setSettings, onOpen, onImport, onRemove }) {
  const { level, hands } = data.settings;
  const recent = data.recent.map(id => songs.find(s => s.id === id) || imported.find(s => s.id === id)).filter(Boolean).slice(0, 3);
  return (
    <div className="ks-lib">
      <header className="ks-hero">
        <div>
          <p className="ks-kicker">Piano, one hand at a time</p>
          <h1>Learn it by the notes falling into your keys</h1>
          <p className="ks-lede">Falling notes and real sheet music side by side. Practice either hand, slow it down, loop the hard bars, and let it wait for you. Plug in a keyboard, use the microphone with a real piano, or just tap.</p>
        </div>
        <div className="ks-hero-keys" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => (
            <span key={i} className="w" style={{ "--d": `${(i * 0.37) % 2.2}s` }} />
          ))}
        </div>
      </header>

      <div className="ks-setup">
        <div className="ks-field">
          <span>Difficulty</span>
          <div className="ks-seg">
            {[
              ["easy", "Easy"],
              ["medium", "Medium"],
              ["hard", "Hard"],
            ].map(([id, name]) => (
              <button key={id} type="button" className={level === id ? "is-on" : ""} onClick={() => setSettings({ level: id })}>
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="ks-field">
          <span>Practice</span>
          <div className="ks-seg">
            {[
              ["L", "Left hand"],
              ["both", "Both"],
              ["R", "Right hand"],
            ].map(([id, name]) => (
              <button key={id} type="button" className={hands === id ? "is-on" : ""} onClick={() => setSettings({ hands: id })}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <section className="ks-section">
          <h2>Pick up where you left off</h2>
          <div className="ks-grid">
            {recent.map(s => (
              <SongCard key={s.id} song={s} data={data} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {CATEGORIES.map(c => (
        <section key={c.id} className="ks-section">
          <h2>{c.name}</h2>
          <p className="ks-section-blurb">{c.blurb}</p>
          <div className="ks-grid">
            {songs
              .filter(s => s.tags.includes(c.id))
              .map(s => (
                <SongCard key={s.id} song={s} data={data} onOpen={onOpen} />
              ))}
          </div>
        </section>
      ))}

      <section className="ks-section">
        <h2>Your songs</h2>
        <p className="ks-section-blurb">Bring in a MIDI file, a MusicXML score, or a recording, and it becomes a song you can practice at Easy, Medium or Hard.</p>
        <div className="ks-grid">
          {imported.map(s => (
            <SongCard key={s.id} song={s} data={data} onOpen={onOpen} onRemove={onRemove} />
          ))}
          <button type="button" className="ks-card ks-card-add" onClick={onImport}>
            <Plus size={22} />
            <strong>Add a song</strong>
            <span>
              <Upload size={13} /> MIDI, MusicXML or audio
            </span>
          </button>
        </div>
        <div className="ks-free">
          <h3>
            <Music size={16} /> Free music to bring in
          </h3>
          <ul>
            {FREE_SOURCES.map(f => (
              <li key={f.href}>
                <a href={f.href} target="_blank" rel="noreferrer">
                  {f.name}
                </a>{" "}
                <span>{f.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
