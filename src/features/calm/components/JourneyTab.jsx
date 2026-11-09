import { CalendarCheck, Clock, Leaf, Sun } from "lucide-react";
import { sessionsById } from "../data/sessions";
import { lastDays, summarize, toIsoDay } from "../model/stats";
import { KIND_ICONS } from "./icons";

const MOOD_NAMES = { calmer: "Felt calmer", same: "About the same", restless: "Still restless" };

function dayName(iso, today) {
  if (iso === today) return "Today";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function JourneyTab({ history, onOpen, onClear }) {
  const today = toIsoDay(new Date());
  const stats = summarize(history, today);
  const week = lastDays(history, today, 7);
  const peak = Math.max(10, ...week.map(d => d.minutes));
  const calmer = history.filter(h => h.mood === "calmer").length;
  const rated = history.filter(h => h.mood).length;

  const tiles = [
    { icon: Clock, value: stats.minutes, label: "minutes" },
    { icon: CalendarCheck, value: stats.sessions, label: stats.sessions === 1 ? "session" : "sessions" },
    // No streaks: missing a day should never feel like failing.
    { icon: Sun, value: new Set(history.map(h => h.date)).size, label: "quiet days" },
    { icon: Leaf, value: calmer, label: "felt calmer after" },
  ];

  return (
    <section className="cm-journey">
      <div className="cm-tiles">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="cm-tile">
              <Icon size={18} aria-hidden="true" />
              <strong>{t.value}</strong>
              <span>{t.label}</span>
            </div>
          );
        })}
      </div>

      <div className="cm-panel">
        <h3>This week</h3>
        <div className="cm-week" role="img" aria-label={week.map(d => `${dayName(d.date, today)}: ${Math.round(d.minutes)} minutes`).join(", ")}>
          {week.map(d => (
            <div key={d.date} className={`cm-day${d.date === today ? " is-today" : ""}`}>
              <span className="cm-day-min">{d.minutes ? Math.round(d.minutes) : ""}</span>
              <span className="cm-day-bar">
                <span style={{ height: `${Math.max(d.minutes ? 6 : 0, (d.minutes / peak) * 100)}%` }} />
              </span>
              <span className="cm-day-name">{dayName(d.date, today)}</span>
            </div>
          ))}
        </div>
        {rated > 0 && (
          <p className="cm-note">
            You felt calmer after {calmer} of the {rated} sessions you rated.
          </p>
        )}
      </div>

      <div className="cm-panel">
        <h3>Recent sessions</h3>
        {history.length === 0 ? (
          <p className="cm-muted cm-small">Nothing here yet. Finish a session of a minute or more and it will show up here.</p>
        ) : (
          <ul className="cm-history">
            {history.slice(0, 30).map(h => {
              const s = sessionsById.get(h.sessionId);
              const Icon = KIND_ICONS[s?.kind ?? "meditation"];
              return (
                <li key={h.id}>
                  <button type="button" onClick={() => s && onOpen(s.id)} disabled={!s}>
                    <Icon size={17} aria-hidden="true" />
                    <span className="cm-history-title">{h.title}</span>
                    <span className="cm-muted">
                      {longDate(h.date)} · {Math.max(1, Math.round(h.minutes))} min
                      {h.mood ? ` · ${MOOD_NAMES[h.mood]}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {history.length > 0 && (
          <button
            type="button"
            className="cm-btn cm-btn--ghost cm-clear"
            onClick={() => {
              if (window.confirm("Clear your whole session history on this device?")) onClear();
            }}
          >
            Clear history
          </button>
        )}
      </div>
      <p className="cm-note cm-center-text">Your journey is saved in this browser only. Nothing leaves your device.</p>
    </section>
  );
}
