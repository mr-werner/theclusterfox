import { Star } from "lucide-react";
import { GOAL_ICONS } from "./icons";
import { MOODS, PRACTICES, moodBlurb } from "../data/moods";

export default function MoodHome({ favorites, onPick, onOpenSession }) {
  return (
    <section className="cm-home" aria-labelledby="cm-ask">
      <h1 id="cm-ask" className="cm-ask">
        What do you need <em>right now?</em>
      </h1>

      <div className="cm-moods">
        {MOODS.map((m, i) => {
          const Icon = GOAL_ICONS[m.id];
          return (
            <button
              key={m.id}
              type="button"
              className={`cm-mood-tile cm-mood-tile--${m.id}`}
              style={{ "--i": i }}
              onClick={() => onPick(m.id)}
            >
              <span className="cm-mood-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.6} />
              </span>
              <span className="cm-mood-name">{m.name}</span>
              <span className="cm-mood-blurb">{moodBlurb(m.id)}</span>
            </button>
          );
        })}
      </div>

      <div className="cm-practices">
        <h2>Or choose how to practice</h2>
        <div className="cm-practice-row">
          {PRACTICES.map(p => {
            const Icon = GOAL_ICONS[p.id];
            return (
              <button key={p.id} type="button" className={`cm-practice cm-practice--${p.id}`} onClick={() => onPick(p.id)}>
                <span className="cm-mood-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.6} />
                </span>
                <span className="cm-mood-name">{p.name}</span>
                <span className="cm-mood-blurb">{p.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      {favorites.length > 0 && (
        <div className="cm-favs">
          <h2>
            <Star size={16} aria-hidden="true" /> Your favorites
          </h2>
          <div className="cm-fav-row">
            {favorites.map(s => (
              <button key={s.id} type="button" onClick={() => onOpenSession(s.id)}>
                <strong>{s.title}</strong>
                <span>{s.minutes} min</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
