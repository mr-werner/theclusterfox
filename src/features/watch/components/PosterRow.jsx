import { Film, Tv } from "lucide-react";

/** A shelf of posters that scrolls sideways. */
export default function PosterRow({ title, items, onOpen, onSeeAll }) {
  if (!items.length) return null;
  return (
    <section className="wf-row" aria-label={title}>
      <div className="wf-row-head">
        <h2>{title}</h2>
        {onSeeAll && (
          <button type="button" className="wf-link-btn" onClick={onSeeAll}>
            See all {items.length}
          </button>
        )}
      </div>
      <ul className="wf-row-list">
        {items.slice(0, 20).map(item => {
          const TypeIcon = item.type === "tv" ? Tv : Film;
          return (
            <li key={`${item.type}-${item.id}`}>
              <button type="button" className="wf-tile" onClick={() => onOpen(item)}>
                {item.poster ? (
                  <img src={item.poster} alt="" loading="lazy" width="120" height="180" />
                ) : (
                  <span className="wf-tile-blank" aria-hidden="true">
                    <TypeIcon size={22} />
                  </span>
                )}
                <span className="wf-tile-title">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
