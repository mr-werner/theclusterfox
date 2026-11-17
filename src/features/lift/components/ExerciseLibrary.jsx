import { useMemo, useState } from "react";
import { ArrowLeft, Flame, Search, Star } from "lucide-react";

import HowTo from "./HowTo";
import { exercises, exercisesById } from "../data/exercises";
import { equipmentById } from "../data/equipment";
import { muscleName, muscles, REGIONS } from "../data/muscles";
import { movementFor } from "../data/activation";

const LEVELS = ["", "Beginner", "Intermediate", "Advanced"];

function FavButton({ on, onClick, name }) {
  return (
    <button
      type="button"
      className={`lx-fav ${on ? "is-on" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Star size={18} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

function Row({ exercise, fav, onFav, onOpen }) {
  const gear = exercise.gear.length ? exercise.gear.map(g => equipmentById.get(g)?.name).join(" + ") : "No gear";
  return (
    <li className="lx-row">
      <button type="button" className="lx-open" onClick={() => onOpen(exercise.id)}>
        <strong>
          {exercise.name}
          {movementFor(exercise) && <span className="lx-badge"><Flame size={12} aria-hidden="true" /> Muscle view</span>}
        </strong>
        <span>{gear} · {LEVELS[exercise.level]}{exercise.secondary.length > 0 && ` · also ${exercise.secondary.map(muscleName).join(", ").toLowerCase()}`}</span>
      </button>
      <FavButton on={fav} name={exercise.name} onClick={() => onFav(exercise.id)} />
    </li>
  );
}

/**
 * Every exercise, grouped by the muscles it targets. Open one to see how it's
 * done; star the ones you like.
 */
export default function ExerciseLibrary({ favorites, onToggleFavorite, openId, onOpen }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | favorites | a muscle id
  const favs = useMemo(() => new Set(favorites), [favorites]);

  const open = openId ? exercisesById.get(openId) : null;
  if (open) {
    return (
      <section className="lf-panel lx-detail" aria-labelledby="lx-detail-title">
        <button type="button" className="lf-link lx-back" onClick={() => onOpen(null)}>
          <ArrowLeft size={16} aria-hidden="true" /> All exercises
        </button>
        <div className="lx-detail-head">
          <div>
            <p className="lf-eyebrow">{open.primary.map(muscleName).join(" · ").toUpperCase()}</p>
            <h2 id="lx-detail-title">{open.name}</h2>
          </div>
          <FavButton on={favs.has(open.id)} name={open.name} onClick={() => onToggleFavorite(open.id)} />
        </div>
        <HowTo exercise={open} />
      </section>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = exercises.filter(e => {
    if (filter === "favorites" && !favs.has(e.id)) return false;
    if (filter !== "all" && filter !== "favorites" && !e.primary.includes(filter)) return false;
    if (!q) return true;
    return [e.name, ...e.primary.map(muscleName), ...e.secondary.map(muscleName)].some(s => s.toLowerCase().includes(q));
  });
  const groups = muscles
    .filter(m => filter === "all" || filter === "favorites" || filter === m.id)
    .map(m => ({ muscle: m, list: matches.filter(e => e.primary.includes(m.id)) }))
    .filter(g => g.list.length);

  return (
    <div className="lx">
      <section className="lf-panel lx-tools" aria-label="Find an exercise">
        <label className="lx-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder="Search exercises or muscles" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <div className="lx-filters" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" className="lf-chip" aria-checked={filter === "all"} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          <button type="button" role="radio" className="lf-chip lx-chip-fav" aria-checked={filter === "favorites"} aria-pressed={filter === "favorites"} onClick={() => setFilter("favorites")}>
            <Star size={13} fill="currentColor" aria-hidden="true" /> Favorites{favorites.length ? ` (${favorites.length})` : ""}
          </button>
          {REGIONS.map(region => (
            <span key={region.id} className="lx-region">
              {muscles.filter(m => m.region === region.id).map(m => (
                <button key={m.id} type="button" role="radio" className="lf-chip" aria-checked={filter === m.id} aria-pressed={filter === m.id} onClick={() => setFilter(filter === m.id ? "all" : m.id)}>
                  {m.name}
                </button>
              ))}
            </span>
          ))}
        </div>
      </section>

      {groups.length === 0 && (
        <p className="lf-panel lf-muted lx-empty">
          {filter === "favorites" && !q ? "No favorites yet. Tap the star on any exercise to keep it here." : "Nothing matches that. Try another word."}
        </p>
      )}

      {groups.map(({ muscle, list }) => (
        <section key={muscle.id} className="lf-panel lx-group" aria-labelledby={`lx-${muscle.id}`}>
          <h2 id={`lx-${muscle.id}`}>
            {muscle.name} <span className="lx-count">{list.length}</span>
          </h2>
          <ul className="lx-list">
            {list.map(e => <Row key={e.id} exercise={e} fav={favs.has(e.id)} onFav={onToggleFavorite} onOpen={onOpen} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
