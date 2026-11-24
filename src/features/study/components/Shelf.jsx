import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, Flame, Library, Play, Plus } from "lucide-react";

import { STUDY_LINKS } from "../../../app/studyLinks";
import { dayKey } from "../model/dates";
import { reviewQueue } from "../model/exercises";
import { deckStats, formatTime, streakOf } from "../model/stats";
import { useShelfDecks } from "../state/useStudyData";
import { AppMark } from "./ui";
import { appInfo } from "../model/stats";

export default function Shelf({ store }) {
  const { data, setSettings } = store;
  const today = dayKey();
  const loaded = useShelfDecks(data.decks);
  const ready = loaded.length > 0 && loaded.every(l => l.status !== "loading");
  const queue = useMemo(() => (ready ? reviewQueue(data, loaded.filter(l => l.deck), today, 1) : []), [ready, data, loaded, today]);
  const due = queue.filter(q => q.due).length;
  const fresh = queue.length - due;
  const streak = streakOf(data.log, today);
  const todayLog = data.log.find(e => e.day === today);
  const byKey = new Map(loaded.map(l => [`${l.ref.app}:${l.ref.id}`, l]));

  const grouped = useMemo(() => {
    const m = new Map();
    for (const d of data.decks) {
      if (!m.has(d.app)) m.set(d.app, []);
      m.get(d.app).push(d);
    }
    return [...m.entries()];
  }, [data.decks]);

  if (!data.decks.length) return <EmptyShelf />;

  return (
    <div className="sy-home">
      <section className="sy-today">
        <div className="sy-today-main">
          <p className="sy-kicker">Today · {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>{!ready ? "Getting your shelf ready…" : queue.length ? <>{queue.length} to review</> : todayLog ? "All done for today" : "You're all caught up"}</h1>
          <p className="sy-muted">
            {ready && queue.length
              ? `${due ? `${due} due` : "Nothing overdue"}${fresh ? `, ${fresh} new` : ""}, from ${data.decks.length} ${data.decks.length === 1 ? "deck" : "decks"}. About ${Math.max(1, Math.round(queue.length * 0.2))} min.`
              : todayLog
                ? `${todayLog.n} reviewed today, ${Math.round((todayLog.right / Math.max(1, todayLog.n)) * 100)}% right. Practice any deck below as much as you like.`
                : "Nothing is due. Practice any deck below, or add more to study."}
          </p>
          {ready && queue.length > 0 && (
            <Link to="/study?review=1" className="sy-btn is-big">
              <Play size={18} aria-hidden="true" /> Start today's review
            </Link>
          )}
        </div>
        <div className="sy-today-side">
          <div className="sy-streak" title="Days in a row you've studied">
            <Flame size={20} aria-hidden="true" />
            <strong>{streak}</strong>
            <span>day{streak === 1 ? "" : "s"} in a row</span>
          </div>
          <div className="sy-remind">
            <button type="button" className={`sy-toggle${data.settings.remind ? " is-on" : ""}`} onClick={() => setSettings({ remind: !data.settings.remind })} aria-pressed={data.settings.remind}>
              {data.settings.remind ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />}
              {data.settings.remind ? "TaskFox reminds me at" : "No TaskFox reminder"}
            </button>
            {data.settings.remind && (
              <input type="time" value={data.settings.time} onChange={e => e.target.value && setSettings({ time: e.target.value })} aria-label="Study time" />
            )}
          </div>
          <label className="sy-newper">
            New cards a day
            <select value={data.settings.newPerDay} onChange={e => setSettings({ newPerDay: Number(e.target.value) })}>
              {[0, 5, 10, 15, 20, 30, 50].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {data.settings.remind && <p className="sy-muted sy-small">Your review sits on your TaskFox calendar at {formatTime(data.settings.time)} each day something is due.</p>}
        </div>
      </section>

      <div className="sy-shelf-head">
        <h2>Your shelf</h2>
        <Link to="/study?tab=library" className="sy-btn is-ghost is-small">
          <Plus size={15} aria-hidden="true" /> Add more
        </Link>
      </div>

      {grouped.map(([app, list]) => (
        <section key={app} className="sy-shelf-app" style={{ "--app": `var(--${appInfo(app).accent ?? app}, #ffd84a)` }}>
          <h3>
            <AppMark app={app} /> {appInfo(app).subtitle}
          </h3>
          <div className="sy-decks">
            {list.map(d => {
              const entry = byKey.get(`${d.app}:${d.id}`);
              const st = entry?.deck ? deckStats(data, d, entry.deck, today) : null;
              return (
                <Link key={d.id} to={`/study?deck=${encodeURIComponent(`${d.app}:${d.id}`)}`} className={`sy-deck${entry?.status === "missing" || entry?.status === "error" ? " is-gone" : ""}`}>
                  <span className="sy-deck-title">{entry?.deck?.title ?? d.title}</span>
                  {st ? (
                    <>
                      <span className="sy-deck-meta">
                        {st.total} to learn{st.due ? <em> · {st.due} due</em> : null}
                      </span>
                      <span className="sy-meter" aria-label={`${st.known} of ${st.total} known well`}>
                        <i style={{ width: `${(st.known / Math.max(1, st.total)) * 100}%` }} />
                        <b style={{ width: `${((st.seen - st.known) / Math.max(1, st.total)) * 100}%` }} />
                      </span>
                    </>
                  ) : (
                    <span className="sy-deck-meta">{entry?.status === "missing" ? "No longer in the app" : entry?.status === "error" ? "Couldn't load" : "Loading…"}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyShelf() {
  return (
    <div className="sy-empty-shelf">
      <div className="sy-stack-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="sy-kicker">Your study shelf</p>
      <h1>Learn from every app, in one place</h1>
      <p className="sy-lede">
        Press <strong>Add to Study</strong> in any learning app, or pick from the library here. StudyFox links to the material (it stays up to date in its own app) and turns it into flashcards, quizzes, matching, sorting, fill in the blank and practice problems. Spaced review brings each thing back just before you'd forget it, and TaskFox reminds you when it's time.
      </p>
      <Link to="/study?tab=library" className="sy-btn is-big">
        <Library size={18} aria-hidden="true" /> Browse the library
      </Link>
      <ul className="sy-sources">
        {STUDY_LINKS.map(l => (
          <li key={l.app}>
            <AppMark app={l.app} /> {appInfo(l.app).subtitle}
          </li>
        ))}
      </ul>
    </div>
  );
}
