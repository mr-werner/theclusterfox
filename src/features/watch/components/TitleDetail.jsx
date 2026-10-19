import { useEffect, useRef, useState } from "react";
import { Film, Heart, LoaderCircle, Play, Star, Tv, X } from "lucide-react";

import WhereToWatch from "./WhereToWatch";
import { fetchTitle } from "../../../services/watch/watchApi";
import { isFavorite, toggleFavorite } from "../state/watchStore";

// A movie or show opened from browse or search: poster, synopsis, trailer
// and where to watch it.
export default function TitleDetail({ item, data, update, onClose }) {
  const { region, services: myServices } = data;
  const dialogRef = useRef(null);
  const key = `${item.type}-${item.id}-${region}`;
  const [state, setState] = useState({ key: null, title: null, error: "" });
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTitle(item.type, item.id, region, { signal: controller.signal })
      .then(title => setState({ key, title, error: "" }))
      .catch(error => {
        if (error.name !== "AbortError") setState({ key, title: null, error: error.message });
      });
    return () => controller.abort();
  }, [item.type, item.id, region, key]);

  const loading = state.key !== key;
  // Show what we already know from the list while the details load.
  const title = state.title ?? item;
  const TypeIcon = title.type === "tv" ? Tv : Film;
  const facts = [
    title.year,
    title.type === "tv" ? (title.seasons ? `${title.seasons} season${title.seasons === 1 ? "" : "s"}` : "TV show") : "Movie",
    title.runtime ? `${title.runtime} min${title.type === "tv" ? " episodes" : ""}` : null,
  ].filter(Boolean);

  return (
    <dialog
      ref={dialogRef}
      className="wf wf-detail"
      aria-label={title.title}
      onClose={onClose}
      onClick={event => event.target === dialogRef.current && dialogRef.current.close()}
    >
      <div className="wf-detail-inner">
        <button type="button" className="wf-detail-close" aria-label="Close" onClick={() => dialogRef.current.close()}>
          <X size={20} />
        </button>

        <div className="wf-detail-media">
          {playing && title.trailer ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${title.trailer.key}?autoplay=1&rel=0`}
              title={title.trailer.name}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <>
              {title.backdrop ? (
                <img src={title.backdrop} alt="" />
              ) : (
                <div className="wf-detail-blank" aria-hidden="true" />
              )}
              {title.trailer && (
                <button type="button" className="wf-play" onClick={() => setPlaying(true)}>
                  <Play size={18} aria-hidden="true" /> Watch trailer
                </button>
              )}
            </>
          )}
        </div>

        <div className="wf-detail-body">
          {title.poster ? (
            <img className="wf-detail-poster" src={title.poster} alt="" width="120" height="180" />
          ) : (
            <div className="wf-detail-poster wf-poster--empty" aria-hidden="true">
              <TypeIcon size={32} />
            </div>
          )}
          <div className="wf-detail-text">
            <h2>{title.title}</h2>
            <p className="wf-type">
              <TypeIcon size={14} aria-hidden="true" /> {facts.join(" · ")}
              {data.showRatings && title.rating && (
                <span className="wf-rating">
                  <Star size={13} aria-hidden="true" /> {title.rating}
                </span>
              )}
            </p>
            {title.genres?.length > 0 && <p className="wf-genres">{title.genres.join(", ")}</p>}
            <button
              type="button"
              className="wf-chip wf-chip--small wf-fav-chip"
              aria-pressed={isFavorite(data, title)}
              onClick={() => update(current => toggleFavorite(current, title))}
            >
              <Heart size={13} aria-hidden="true" /> {isFavorite(data, title) ? "Favorited" : "Favorite"}
            </button>
            {title.tagline && <p className="wf-tagline">{title.tagline}</p>}
            <p className="wf-overview">{title.overview || "No synopsis yet."}</p>
          </div>
        </div>

        <div className="wf-detail-watch">
          <h3>Where to watch</h3>
          {loading && (
            <p className="wf-muted wf-loading">
              <LoaderCircle size={16} className="spin" aria-hidden="true" /> Checking services…
            </p>
          )}
          {!loading && state.error && <p className="wf-alert">{state.error}</p>}
          {!loading && state.title && <WhereToWatch title={title.title} providers={state.title.providers} myServices={myServices} />}
        </div>
      </div>
    </dialog>
  );
}
