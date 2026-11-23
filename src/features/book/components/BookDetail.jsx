import { useEffect, useMemo, useState } from "react";
import { BookMarked, BookOpen, Check, Download, ExternalLink, Trash2 } from "lucide-react";

import { downloadLinks, genreById, sourceName, sourceUrl } from "../../../services/books/catalog.js";
import { bookDetails, useCatalog } from "../state/library";
import { SHELVES } from "../state/bookStore";
import Cover from "./Cover";
import { BookTile } from "./Store";

const authorOf = b => (b.authors?.length ? b.authors.join(", ") : "Anonymous");
const LANGS = { en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian", fi: "Finnish", nl: "Dutch", pt: "Portuguese", la: "Latin", el: "Greek", sv: "Swedish", da: "Danish", zh: "Chinese", ja: "Japanese", ru: "Russian", hu: "Hungarian", eo: "Esperanto", pl: "Polish", tl: "Tagalog" };

/** A book's page: cover, what it's about, and ways to read it. */
export default function BookDetail({ id, data, store, onOpen, onRead }) {
  const key = String(id);
  const [loaded, setLoaded] = useState({ id: null, book: null, error: null });
  const { catalog } = useCatalog();
  const saved = data.books[key];

  useEffect(() => {
    let live = true;
    bookDetails(id).then(
      b => live && setLoaded({ id, book: b, error: null }),
      e => live && setLoaded({ id, book: null, error: e })
    );
    return () => {
      live = false;
    };
  }, [id]);

  const book = loaded.id === id ? loaded.book : null;
  const error = loaded.id === id ? loaded.error : null;
  const fallback = saved ? { ...saved, id } : catalog?.byId.get(id) ?? null;
  const shown = book ?? fallback;

  const related = useMemo(() => {
    if (!catalog || !shown) return { author: [], similar: [] };
    const first = shown.authors?.[0];
    const author = first && first !== "Anonymous" ? catalog.books.filter(b => b.id !== shown.id && b.authors.includes(first)).slice(0, 18) : [];
    const mine = catalog.byId.get(shown.id)?.g ?? [];
    const subjects = new Set(shown.subjects ?? []);
    const similar = catalog.books
      .filter(b => b.id !== shown.id && !author.includes(b) && b.lang === (shown.lang ?? "en"))
      .map(b => ({ b, score: b.g.filter(g => mine.includes(g)).length * 2 + b.subjects.filter(s => subjects.has(s)).length * 3 }))
      .filter(x => x.score >= 3)
      .sort((p, q) => q.score - p.score || q.b.downloads - p.b.downloads)
      .slice(0, 18)
      .map(x => x.b);
    return { author, similar };
  }, [catalog, shown]);

  if (error && !shown) return <p className="bx-empty">This book didn't load ({error.message}). Try again in a moment.</p>;
  if (!shown) return <div className="bx-detail is-loading" aria-label="Loading the book" />;

  const genres = (catalog?.byId.get(shown.id)?.g ?? []).map(g => genreById.get(g)?.name).filter(Boolean);
  const progress = saved?.progress ?? 0;
  const started = saved && (saved.pos || progress > 0);
  const paras = String(shown.summary ?? shown.blurb ?? "").split(/\n\n+/).filter(Boolean);

  return (
    <article className="bx-detail">
      <div className="bx-detail-top">
        <div className="bx-detail-cover">
          <Cover book={shown} size="medium" eager />
        </div>
        <div className="bx-detail-copy">
          <p className="bx-kicker">{sourceName(shown.id)}{genres.length ? ` · ${genres.slice(0, 2).join(" · ")}` : ""}</p>
          <h1>{shown.title}</h1>
          <p className="bx-detail-author">
            {authorOf(shown)}
            {shown.life && <span> ({shown.life})</span>}
          </p>
          {shown.translators?.length > 0 && <p className="bx-detail-small">Translated by {shown.translators.join(", ")}</p>}

          <div className="bx-actions">
            <button type="button" className="bx-btn is-primary" onClick={() => onRead(key, shown)}>
              <BookOpen size={17} aria-hidden="true" /> {started ? `Keep reading · ${Math.round(progress * 100)}%` : "Read now"}
            </button>
            {saved ? (
              <div className="bx-shelf-pick" role="radiogroup" aria-label="Your shelf">
                {SHELVES.map(s => (
                  <button key={s.id} type="button" role="radio" aria-checked={saved.shelf === s.id} className={saved.shelf === s.id ? "is-on" : ""} onClick={() => store.shelve(shown, s.id)}>
                    {saved.shelf === s.id && <Check size={14} aria-hidden="true" />} {s.name}
                  </button>
                ))}
                <button type="button" className="bx-icon-btn" onClick={() => store.remove(key)} title="Take it off your shelves (and remove your notes)" aria-label="Remove from my books">
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button type="button" className="bx-btn" onClick={() => store.shelve(shown, "want")}>
                <BookMarked size={17} aria-hidden="true" /> Want to read
              </button>
            )}
          </div>

          {paras.length > 0 ? (
            <div className="bx-detail-summary">
              {paras.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {Number.isInteger(shown.id) && <p className="bx-detail-small">Summary written automatically by Project Gutenberg.</p>}
            </div>
          ) : (
            !book && <p className="bx-detail-small">Loading the summary…</p>
          )}

          {shown.subjects?.length > 0 && (
            <ul className="bx-subjects" aria-label="Subjects">
              {shown.subjects.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}

          <div className="bx-downloads">
            <h2>
              <Download size={16} aria-hidden="true" /> Download to your phone or computer
            </h2>
            <div className="bx-download-list">
              {downloadLinks(shown.id).map(d => (
                <a key={d.kind} href={d.href} className="bx-download" target="_blank" rel="noreferrer" download>
                  <strong>{d.label}</strong>
                  <span>{d.note}</span>
                </a>
              ))}
            </div>
            <p className="bx-detail-small">
              {shown.downloads > 0 && <>{shown.downloads.toLocaleString()} downloads in the last 30 days · </>}
              {LANGS[shown.lang] ?? shown.lang ?? "English"} ·{" "}
              <a href={sourceUrl(shown.id)} target="_blank" rel="noreferrer">
                This book at {sourceName(shown.id)} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>
      </div>

      {related.author.length > 0 && (
        <section className="bx-related">
          <h2>More by {shown.authors[0]}</h2>
          <div className="bx-shelf-track">
            {related.author.map(b => (
              <BookTile key={b.id} book={b} onOpen={onOpen} progress={data.books[String(b.id)]?.progress ?? 0} />
            ))}
          </div>
        </section>
      )}
      {related.similar.length > 0 && (
        <section className="bx-related">
          <h2>If you like this, try</h2>
          <div className="bx-shelf-track">
            {related.similar.map(b => (
              <BookTile key={b.id} book={b} onOpen={onOpen} progress={data.books[String(b.id)]?.progress ?? 0} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
