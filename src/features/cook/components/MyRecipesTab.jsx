import { Heart, History, Play, RotateCcw, Timer, Trash2 } from "lucide-react";
import RecipeCard from "./RecipeCard";
import { Cover } from "./ui";
import { clockText } from "./format";
import { recipes, recipesById } from "../data/recipes";
import { servingWord } from "../model/recipe";
import * as S from "../model/session";

const RATING = { loved: "Loved it", good: "Good", meh: "Not for me" };
const TIMING = { faster: "took less time", right: "timing was right", slower: "took longer" };

export default function MyRecipesTab({ data, now, onOpen, onResume, onDiscard, onToggleFavorite, onCookAgain, onRemoveHistory, onClearHistory }) {
  const sessions = Object.values(data.sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  const favorites = recipes.filter(r => data.favorites.includes(r.id));
  const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="ck-mine" aria-label="My recipes">
      {sessions.length > 0 && (
        <div className="ck-group">
          <h2>
            <Play size={20} aria-hidden="true" /> Still cooking
          </h2>
          <ul className="ck-sessions">
            {sessions.map(s => {
              const r = recipesById.get(s.recipeId);
              const running = s.timers.map(t => ({ t, st: S.timerState(t, now) })).filter(x => !x.st.paused);
              return (
                <li key={s.recipeId} className="ck-session">
                  <Cover recipe={r} size="thumb" />
                  <div className="ck-session-info">
                    <strong>{r.title}</strong>
                    <span className="ck-muted">
                      {s.phase === "prep" ? "Getting ready" : `Step ${s.step + 1} of ${r.steps.length}`} · {S.progressPercent(r, s)}% · {s.servings} {servingWord(r, s.servings)}
                    </span>
                    {running.map(({ t, st }) => (
                      <span key={t.step} className="ck-timer-chip">
                        <Timer size={13} aria-hidden="true" /> {t.label} · {st.finished ? "Done!" : clockText(st.left)}
                      </span>
                    ))}
                  </div>
                  <div className="ck-row">
                    <button type="button" className="ck-btn ck-btn--primary" onClick={() => onResume(s.recipeId)}>
                      Resume
                    </button>
                    <button
                      type="button"
                      className="ck-icon-btn"
                      aria-label={`Discard progress on ${r.title}`}
                      onClick={() => {
                        if (window.confirm(`Discard your progress on ${r.title}?`)) onDiscard(s.recipeId);
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="ck-group">
        <h2>
          <Heart size={20} aria-hidden="true" /> Saved recipes
        </h2>
        {favorites.length === 0 ? (
          <p className="ck-muted">Tap the heart on any recipe to keep it here.</p>
        ) : (
          <div className="ck-grid">
            {favorites.map(r => (
              <RecipeCard key={r.id} recipe={r} favorite inProgress={Boolean(data.sessions[r.id])} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        )}
      </div>

      <div className="ck-group">
        <div className="ck-group-head">
          <h2>
            <History size={20} aria-hidden="true" /> Cooking history
          </h2>
          {data.history.length > 0 && (
            <button
              type="button"
              className="ck-link"
              onClick={() => {
                if (window.confirm("Clear your whole cooking history?")) onClearHistory();
              }}
            >
              Clear history
            </button>
          )}
        </div>
        {data.history.length === 0 ? (
          <p className="ck-muted">Recipes you finish cooking show up here, with your notes, so you can make them again just the way you liked.</p>
        ) : (
          <ul className="ck-history">
            {data.history.map(h => {
              const r = recipesById.get(h.recipeId);
              const bits = [
                `${h.servings} ${servingWord(r, h.servings)}`,
                h.minutes ? `${h.minutes} min` : null,
                h.rating ? RATING[h.rating] : null,
                h.again === true ? "Would make again" : h.again === false ? "Wouldn't make again" : null,
                h.timing ? TIMING[h.timing] : null,
              ].filter(Boolean);
              return (
                <li key={h.id} className={h.status === "stopped" ? "is-stopped" : ""}>
                  <Cover recipe={r} size="thumb" />
                  <div className="ck-history-info">
                    <strong>
                      <button type="button" className="ck-link ck-link--plain" onClick={() => onOpen(r.id)}>
                        {r.title}
                      </button>
                    </strong>
                    <span className="ck-muted">
                      {fmtDate(h.date)} · {h.status === "stopped" ? `Stopped${h.note ? `: ${h.note}` : ""}` : bits.join(" · ")}
                    </span>
                    {h.status !== "stopped" && h.note && <span className="ck-history-note">“{h.note}”</span>}
                  </div>
                  <div className="ck-row">
                    <button type="button" className="ck-btn" onClick={() => onCookAgain(h)}>
                      <RotateCcw size={16} aria-hidden="true" /> {h.status === "stopped" ? "Try again" : "Cook again"}
                    </button>
                    <button type="button" className="ck-icon-btn" aria-label="Remove from history" onClick={() => onRemoveHistory(h.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
