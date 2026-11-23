import { useEffect, useRef, useState } from "react";
import { ExternalLink, Film, LoaderCircle, Play, Search, X } from "lucide-react";

import {
  FREE_GENRES, FREE_PICKS, PAGE_SIZE, dedupeMovies, embedUrl, fetchFreeMovie, movieKey, pageUrl, searchFreeMovies,
} from "../../../services/watch/freeMovies";

const MAX_PAGES = 8;

function Poster({ movie, width, height }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="wf-tile-blank" aria-hidden="true">
        <Film size={26} />
      </span>
    );
  }
  return <img src={movie.poster} alt="" loading="lazy" width={width} height={height} onError={() => setBroken(true)} />;
}

/** Plays a public domain film with the Internet Archive's own player. */
function FreePlayer({ movie, onClose }) {
  const dialogRef = useRef(null);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Picks and some search results arrive without a synopsis or runtime.
  useEffect(() => {
    if (movie.overview && movie.runtime) return undefined;
    const controller = new AbortController();
    fetchFreeMovie(movie.id, { signal: controller.signal })
      .then(found => setDetails(found))
      .catch(() => {});
    return () => controller.abort();
  }, [movie]);

  const shown = { ...details, ...movie, overview: movie.overview || details?.overview, runtime: movie.runtime || details?.runtime };
  const facts = [shown.year, shown.runtime ? `${shown.runtime} min` : null, "Public domain"].filter(Boolean);

  return (
    <dialog
      ref={dialogRef}
      className="wf wf-detail wf-free-player"
      aria-label={shown.title}
      onClose={onClose}
      onClick={event => event.target === dialogRef.current && dialogRef.current.close()}
    >
      <div className="wf-detail-inner">
        <button type="button" className="wf-detail-close" aria-label="Close" onClick={() => dialogRef.current.close()}>
          <X size={20} />
        </button>
        <div className="wf-detail-media">
          <iframe src={embedUrl(movie.id)} title={`Watch ${shown.title}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
        <div className="wf-free-info">
          <h2>{shown.title}</h2>
          <p className="wf-type">{facts.join(" · ")}</p>
          {shown.subjects?.length > 0 && <p className="wf-genres">{shown.subjects.join(", ")}</p>}
          <p className="wf-overview">{shown.overview || (details ? "No synopsis yet." : "Loading the synopsis…")}</p>
          <a className="wf-link-btn wf-free-source" href={pageUrl(movie.id)} target="_blank" rel="noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> Download or watch on the Internet Archive
          </a>
        </div>
      </div>
    </dialog>
  );
}

function MovieTile({ movie, onOpen, small = false }) {
  return (
    <button type="button" className="wf-tile wf-free-tile" onClick={() => onOpen(movie)}>
      <span className="wf-free-poster">
        <Poster movie={movie} width={small ? 120 : 171} height={small ? 180 : 256} />
        <span className="wf-free-play" aria-hidden="true">
          <Play size={small ? 14 : 16} />
        </span>
      </span>
      <span className="wf-tile-title">{movie.title}</span>
      {movie.year && <span className="wf-tile-meta">{[movie.year, movie.runtime ? `${movie.runtime} min` : null].filter(Boolean).join(" · ")}</span>}
    </button>
  );
}

export default function FreeMovies() {
  const [draft, setDraft] = useState("");
  const [text, setText] = useState("");
  const [genre, setGenre] = useState("");
  const key = `${text}|${genre}`;
  const [state, setState] = useState({ key: null, items: [], page: 0, total: 0, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const [query, category] = key.split("|");
    searchFreeMovies({ text: query, genre: category, signal: controller.signal })
      .then(({ items, total }) => setState({ key, items, page: 1, total, error: "" }))
      .catch(error => {
        if (error.name !== "AbortError") setState({ key, items: [], page: 0, total: 0, error: error.message || "Couldn't reach the Internet Archive." });
      });
    return () => controller.abort();
  }, [key]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = state.page + 1;
      const { items } = await searchFreeMovies({ text, genre, page: next });
      setState(current => ({ ...current, page: next, items: [...current.items, ...dedupeMovies(items, new Set(current.items.map(movieKey)))] }));
    } catch {
      setState(current => ({ ...current, total: current.items.length }));
    } finally {
      setLoadingMore(false);
    }
  }

  const loading = state.key !== key;
  const more = !loading && state.items.length < state.total && state.items.length >= PAGE_SIZE && state.page < MAX_PAGES;
  const browsing = !text && !genre;

  return (
    <section className="wf-panel wf-free">
      <form
        className="wf-search-row"
        role="search"
        onSubmit={event => {
          event.preventDefault();
          setText(draft.trim());
        }}
      >
        <label className="wf-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={draft}
            onChange={event => {
              setDraft(event.target.value);
              if (!event.target.value) setText("");
            }}
            placeholder="Search free classic movies"
            aria-label="Search free classic movies"
          />
        </label>
        <button type="submit" className="wf-btn">
          Search
        </button>
      </form>

      <p className="wf-note">
        Classic films in the public domain, free for anyone to watch and download. They play right here, streamed from the{" "}
        <a href="https://archive.org/details/feature_films" target="_blank" rel="noreferrer">
          Internet Archive
        </a>
        . No sign-up and no ads.
      </p>

      {browsing && (
        <section className="wf-row" aria-label="Staff picks">
          <div className="wf-row-head">
            <h2>Staff picks</h2>
          </div>
          <ul className="wf-row-list">
            {FREE_PICKS.map(movie => (
              <li key={movie.id}>
                <MovieTile movie={movie} onOpen={setOpen} small />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="wf-browse">
        <div className="wf-browse-head">
          <h2>{text ? `Results for “${text}”` : "Most watched"}</h2>
          {text && (
            <button
              type="button"
              className="wf-link-btn"
              onClick={() => {
                setDraft("");
                setText("");
              }}
            >
              <X size={14} aria-hidden="true" /> Clear search
            </button>
          )}
        </div>

        <ul className="wf-chip-row wf-genres-row" aria-label="Categories">
          <li>
            <button type="button" className="wf-chip wf-chip--small" aria-pressed={!genre} onClick={() => setGenre("")}>
              All
            </button>
          </li>
          {FREE_GENRES.map(g => (
            <li key={g.id}>
              <button type="button" className="wf-chip wf-chip--small" aria-pressed={genre === g.id} onClick={() => setGenre(g.id)}>
                {g.name}
              </button>
            </li>
          ))}
        </ul>

        {loading && (
          <p className="wf-muted wf-loading">
            <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading free movies…
          </p>
        )}
        {!loading && state.error && <p className="wf-alert">{state.error}</p>}
        {!loading && !state.error && !state.items.length && <p className="wf-muted">No free movies found. Try another title or category.</p>}

        {!loading && state.items.length > 0 && (
          <>
            <ul className="wf-grid">
              {state.items.map(movie => (
                <li key={movie.id} className="wf-tile-wrap">
                  <MovieTile movie={movie} onOpen={setOpen} />
                </li>
              ))}
            </ul>
            {more && (
              <button type="button" className="wf-btn wf-btn--ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : "Show more"}
              </button>
            )}
          </>
        )}
      </div>

      {open && <FreePlayer key={open.id} movie={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
