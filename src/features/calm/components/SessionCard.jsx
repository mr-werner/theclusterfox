import { Star } from "lucide-react";
import { KINDS } from "../data/sessions";
import { KIND_ICONS } from "./icons";

export default function SessionCard({ session, favorite, onOpen, onToggleFavorite }) {
  const Icon = KIND_ICONS[session.kind];
  return (
    <article className={`cm-card cm-card--${session.kind}`}>
      <button type="button" className="cm-card-main" onClick={() => onOpen(session.id)}>
        <span className="cm-card-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="cm-card-meta">
          {KINDS[session.kind]} · {session.minutes} min
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
