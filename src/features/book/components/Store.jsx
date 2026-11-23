import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Flame, Search, Sparkles } from "lucide-react";

import { GENRES, genreById } from "../../../services/books/catalog.js";
import { catalogSummary, rememberBook, searchBooks, standardBooks, useCatalog } from "../state/library";
import { minutesOn, streak } from "../state/bookStore";
import { todayKey } from "../model/dates";
import Cover from "./Cover";

const authorOf = b => (b.authors?.length ? b.authors.join(", ") : "Anonymous");
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** One book on a shelf: its cover, title and author. */
export function BookTile({ book, onOpen, progress, badge }) {
  return (
    <button type="button" className="bx-tile" onClick={() => onOpen(book)} title={`${book.title} by ${authorOf(book)}`}>
      <span className="bx-tile-book">
        <Cover book={book} />
        {badge && <span className="bx-tile-badge">{badge}</span>}
        {progress > 0 && (
          <span className="bx-tile-progress" aria-label={`${Math.round(progress * 100)}% read`}>
            <span style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="bx-tile-title">{book.title}</span>
      <span className="bx-tile-author">{authorOf(book)}</span>
    </button>
  );
}

/** A row of covers that scrolls sideways, with arrows on a computer. */
function ShelfRow({ title, blurb, books, onOpen, onMore, data, icon: Icon }) {
  const track = useRef(null);
  const scroll = dir => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: "smooth" });
  if (!books.length) return null;
  return (
    <section className="bx-shelf">
      <header className="bx-shelf-head">
        <div>
          <h2>
            {Icon && <Icon size={18} aria-hidden="true" />} {title}
          </h2>
          {blurb && <p>{blurb}</p>}
        </div>
        <div className="bx-shelf-tools">
          <button type="button" className="bx-round" onClick={() => scroll(-1)} aria-label="Scroll left">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="bx-round" onClick={() => scroll(1)} aria-label="Scroll right">
            <ChevronRight size={18} />
          </button>
          {onMore && (
            <button type="button" className="bx-link" onClick={onMore}>
              See all <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      <div className="bx-shelf-track" ref={track}>
        {books.map(b => (
          <BookTile key={b.id} book={b} onOpen={onOpen} progress={data.books[String(b.id)]?.progress ?? 0} />
        ))}
      </div>
      <div className="bx-shelf-plank" aria-hidden="true" />
    </section>
  );
}

function Hero({ data, catalog, onOpen, onRead }) {
  const recent = Object.entries(data.books)
    .filter(([, b]) => b.shelf === "reading" && b.opened)
    .sort(([, a], [, b]) => b.opened.localeCompare(a.opened))[0];
  const [summary, setSummary] = useState(null);
  // A different great book each day when there's nothing to continue.
  const [day] = useState(() => Math.floor(Date.now() / 86400000));
  const pick = useMemo(() => {
    if (!catalog) return null;
    const pool = catalog.books.filter(b => b.g.includes("classics") && b.lang === "en").slice(0, 120);
    return pool[day % pool.length] ?? null;
  }, [catalog, day]);
  useEffect(() => {
    if (recent || !pick) return undefined;
    let live = true;
    catalogSummary(pick.id).then(s => live && setSummary(s));
    return () => {
      live = false;
    };
  }, [recent, pick]);

  if (recent) {
    const [key, b] = recent;
    const book = { ...b, id: b.id };
    return (
      <section className="bx-hero is-continue">
        <button type="button" className="bx-hero-cover" onClick={() => onRead(key)} aria-label={`Keep reading ${b.title}`}>
          <Cover book={book} eager />
        </button>
        <div className="bx-hero-copy">
          <p className="bx-kicker">Pick up where you left off</p>
          <h1>{b.title}</h1>
          <p className="bx-hero-author">{authorOf(b)}</p>
          <div className="bx-meter" aria-label={`${Math.round(b.progress * 100)}% read`}>
            <span style={{ width: `${Math.max(2, b.progress * 100)}%` }} />
          </div>
          <p className="bx-hero-meta">{Math.round(b.progress * 100)}% read</p>
          <div className="bx-actions">
            <button type="button" className="bx-btn is-primary" onClick={() => onRead(key)}>
              <BookOpen size={17} aria-hidden="true" /> Keep reading
            </button>
            <button type="button" className="bx-btn" onClick={() => onOpen(book)}>
              About the book
            </button>
          </div>
        </div>
      </section>
    );
  }
  if (!pick) return <section className="bx-hero is-empty" />;
  return (
    <section className="bx-hero">
      <button type="button" className="bx-hero-cover" onClick={() => onOpen(pick)} aria-label={pick.title}>
        <Cover book={pick} eager />
      </button>
      <div className="bx-hero-copy">
        <p className="bx-kicker">
          <Sparkles size={14} aria-hidden="true" /> Today's pick from the classics
        </p>
        <h1>{pick.title}</h1>
        <p className="bx-hero-author">{authorOf(pick)}</p>
        {summary && <p className="bx-hero-blurb">{summary.length > 320 ? `${summary.slice(0, 317).replace(/\s\S*$/, "")}…` : summary}</p>}
        <div className="bx-actions">
          <button type="button" className="bx-btn is-primary" onClick={() => onRead(String(pick.id), pick)}>
            <BookOpen size={17} aria-hidden="true" /> Start reading
          </button>
          <button type="button" className="bx-btn" onClick={() => onOpen(pick)}>
            More about it
          </button>
        </div>
      </div>
    </section>
  );
}

function GoalStrip({ data }) {
  const today = todayKey();
  const mins = minutesOn(data, today);
  const days = streak(data, today);
  if (!data.sessions.length) return null;
  const share = data.goal ? Math.min(1, mins / data.goal) : 0;
  return (
    <div className="bx-goal">
      <span className="bx-goal-ring" style={{ "--p": share }} aria-hidden="true" />
      <span>
        <strong>{mins} min</strong> read today{data.goal ? ` of your ${data.goal}` : ""}
      </span>
      {days > 1 && (
        <span className="bx-goal-streak">
          <Flame size={15} aria-hidden="true" /> {days} days in a row
        </span>
      )}
    </div>
  );
}

/** The store's front: what you're reading, today's pick and the genre shelves. */
export function StoreFront({ data, onOpen, onRead, onGenre }) {
  const { catalog, error } = useCatalog();
  const [standard, setStandard] = useState([]);
  useEffect(() => {
    let live = true;
    standardBooks().then(
      list => live && setStandard(list),
      () => {}
    );
    return () => {
      live = false;
    };
  }, []);

  const english = useMemo(() => (catalog ? catalog.books.filter(b => b.lang === "en") : []), [catalog]);
  if (error) return <p className="bx-empty">The bookshelves didn't load. Check your connection and try again.</p>;
  if (!catalog) return <ShelfSkeleton />;
  return (
    <>
      <Hero data={data} catalog={catalog} onOpen={onOpen} onRead={onRead} />
      <GoalStrip data={data} />
      <ShelfRow title="Most read this month" blurb="What readers are downloading from Project Gutenberg right now." books={english.slice(0, 24)} onOpen={onOpen} data={data} />
      <ShelfRow
        title="Fresh from Standard Ebooks"
        blurb="Carefully typeset, proofread editions, newest first."
        books={standard}
        onOpen={onOpen}
        data={data}
        icon={Sparkles}
      />
      {GENRES.map(g => (
        <ShelfRow key={g.id} title={g.name} blurb={g.blurb} books={english.filter(b => b.g.includes(g.id)).slice(0, 18)} onOpen={onOpen} onMore={() => onGenre(g.id)} data={data} />
      ))}
      <p className="bx-credit">
        Books from <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">Project Gutenberg</a> and{" "}
        <a href="https://standardebooks.org" target="_blank" rel="noreferrer">Standard Ebooks</a>, free because they are in the public domain in the United States. Outside the US, check your
        country's copyright rules before downloading.
      </p>
    </>
  );
}

function ShelfSkeleton() {
  return (
    <div className="bx-skeleton" aria-label="Loading the shelves">
      {[0, 1, 2].map(r => (
        <div key={r} className="bx-skeleton-row">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Every catalog book in one genre, as a grid. */
export function GenrePage({ genre, data, onOpen, onSearch }) {
  const { catalog } = useCatalog();
  const g = genreById.get(genre);
  const [lang, setLang] = useState("en");
  const list = useMemo(() => (catalog ? catalog.books.filter(b => b.g.includes(genre) && (lang === "all" || b.lang === lang)) : []), [catalog, genre, lang]);
  if (!g) return null;
  return (
    <section className="bx-page">
      <header className="bx-page-head">
        <p className="bx-kicker">Shelf</p>
        <h1>{g.name}</h1>
        <p>{g.blurb}</p>
        <div className="bx-chips">
          <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
            English
          </button>
          <button type="button" className={lang === "all" ? "is-on" : ""} onClick={() => setLang("all")}>
            All languages
          </button>
        </div>
      </header>
      <div className="bx-grid">
        {list.map(b => (
          <BookTile key={b.id} book={b} onOpen={onOpen} progress={data.books[String(b.id)]?.progress ?? 0} />
        ))}
      </div>
      <p className="bx-more">
        These are the most-read. <button type="button" className="bx-link" onClick={() => onSearch(g.name.split(/ [&]/)[0])}>Search all of Project Gutenberg for “{g.name.split(/ [&]/)[0]}”</button>
      </p>
    </section>
  );
}

/** Search: instant matches from the shelves, then all of Project Gutenberg. */
export function SearchResults({ q, data, onOpen }) {
  const { catalog } = useCatalog();
  const [result, setLive] = useState({ q: null, books: [], count: 0, next: false, page: 1, error: null, loading: false });
  // Until the first answer for these words arrives, show nothing stale.
  const live = result.q === q ? result : { q, books: [], count: 0, next: false, page: 1, error: null, loading: true };

  const local = useMemo(() => {
    if (!catalog || !q.trim()) return [];
    const words = fold(q).split(/\s+/).filter(Boolean);
    return catalog.books.filter(b => {
      const hay = fold(`${b.title} ${b.authors.join(" ")} ${b.subjects.join(" ")}`);
      return words.every(w => hay.includes(w));
    });
  }, [catalog, q]);

  useEffect(() => {
    if (!q.trim()) return undefined;
    let alive = true;
    searchBooks(q, 1).then(
      r => {
        r.books.forEach(rememberBook);
        if (alive) setLive({ q, books: r.books, count: r.count, next: r.next, page: 1, error: null, loading: false });
      },
      error => alive && setLive({ q, books: [], count: 0, next: false, page: 1, error, loading: false })
    );
    return () => {
      alive = false;
    };
  }, [q]);

  const more = () => {
    const page = live.page + 1;
    setLive(s => ({ ...s, loading: true }));
    searchBooks(q, page).then(
      r => {
        r.books.forEach(rememberBook);
        setLive(s => ({ ...s, books: [...s.books, ...r.books], next: r.next, page, loading: false }));
      },
      error => setLive(s => ({ ...s, error, loading: false }))
    );
  };

  const seen = new Set();
  const merged = [];
  for (const b of [...local, ...live.books]) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    merged.push(b);
  }
  return (
    <section className="bx-page">
      <header className="bx-page-head">
        <p className="bx-kicker">
          <Search size={14} aria-hidden="true" /> Search
        </p>
        <h1>“{q}”</h1>
        <p>
          {live.loading && !live.books.length
            ? "Searching all of Project Gutenberg…"
            : live.error
              ? `Showing matches from the shelves. The full Gutenberg search didn't answer (${live.error.message}).`
              : `${Math.max(live.count, merged.length).toLocaleString()} book${Math.max(live.count, merged.length) === 1 ? "" : "s"} in Project Gutenberg`}
        </p>
      </header>
      {merged.length ? (
        <div className="bx-grid">
          {merged.map(b => (
            <BookTile key={b.id} book={b} onOpen={onOpen} progress={data.books[String(b.id)]?.progress ?? 0} />
          ))}
        </div>
      ) : (
        !live.loading && <p className="bx-empty">No books matched. Try an author's last name or fewer words.</p>
      )}
      {live.next && (
        <div className="bx-more">
          <button type="button" className="bx-btn" onClick={more} disabled={live.loading}>
            {live.loading ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </section>
  );
}
