import { Star } from "lucide-react";
import { STYLES, styleOf } from "../data/sessions";
import { STYLE_ICONS } from "./icons";

// Every session can run for any length, so the card says so: it shows the
// length the person last picked, or just that any length works.
function lengthLabel(chosenMinutes) {
  return chosenMinutes ? `Your ${chosenMinutes} min` : "Any length";
}

export default function SessionCard({ session, chosenMinutes, favorite, onOpen, onToggleFavorite }) {
  const style = styleOf(session);
  const Icon = STYLE_ICONS[style];
  return (
    <article className={`cm-card cm-card--${session.kind}`}>
      <button type="button" className="cm-card-main" onClick={() => onOpen(session.id)}>
        <span className="cm-card-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="cm-card-meta">
          {STYLES[style].name} · {lengthLabel(chosenMinutes)}
        </span>
        <h3>{session.title}</h3>
        <p>{session.summary}</p>
      </button>
      <button
        type="button"
        className={`cm-star${favorite ? " is-on" : ""}`}
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${session.title} from favorites` : `Add ${session.title} to favorites`}
        onClick={() => onToggleFavorite(session.id)}
      >
        <Star size={17} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
