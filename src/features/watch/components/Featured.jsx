import { Bookmark, Check, Film, Info, Shuffle, Star, Tv } from "lucide-react";

import { isIn, toggleTitle } from "../state/watchStore";

/** The marquee: one title, big, with its poster lit behind it. */
export default function Featured({ item, data, update, onOpen, onPick, badge }) {
  const TypeIcon = item.type === "tv" ? Tv : Film;
  const onList = isIn(data, "watchlist", item);
  const seen = isIn(data, "watched", item);
  return (
    <section className="wf-feature" aria-label={`Featured: ${item.title}`}>
      {item.poster && <img className="wf-feature-glow" src={item.poster} alt="" aria-hidden="true" />}
      <button type="button" className="wf-feature-poster" onClick={() => onOpen(item)} aria-label={`Details for ${item.title}`}>
        {item.poster ? (
          <img src={item.poster} alt="" width="200" height="300" />
        ) : (
          <span className="wf-tile-blank" aria-hidden="true">
            <TypeIcon size={36} />
          </span>
        )}
      </button>
      <div className="wf-feature-text">
        <p className="wf-feature-kicker">{badge}</p>
        <h2>{item.title}</h2>
        <p className="wf-type">
          <TypeIcon size={14} aria-hidden="true" /> {[item.year, item.type === "tv" ? "Show" : "Movie"].filter(Boolean).join(" · ")}
          {data.showRatings && item.rating && (
            <span className="wf-rating">
              <Star size={13} aria-hidden="true" /> {item.rating}
            </span>
          )}
        </p>
        {item.overview && <p className="wf-feature-overview">{item.overview}</p>}
        <div className="wf-feature-actions">
          <button type="button" className="wf-btn" onClick={() => onOpen(item)}>
            <Info size={16} aria-hidden="true" /> Where to watch
          </button>
          <button
            type="button"
            className="wf-chip"
            aria-pressed={onList}
            onClick={() => update(current => toggleTitle(current, "watchlist", item))}
          >
            <Bookmark size={14} aria-hidden="true" /> {onList ? "On watchlist" : "Watchlist"}
          </button>
          <button type="button" className="wf-chip" aria-pressed={seen} onClick={() => update(current => toggleTitle(current, "watched", item))}>
            <Check size={14} aria-hidden="true" /> {seen ? "Seen" : "Seen it"}
          </button>
          {onPick && (
            <button type="button" className="wf-chip wf-pick" onClick={onPick}>
              <Shuffle size={14} aria-hidden="true" /> Pick for me
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
