import { AlertTriangle, ChevronRight, CloudRain, LoaderCircle, Sun, Wind } from "lucide-react";

import { band, mainGrade } from "../model/grades";
import { dayName, fmtHour, fmtTemp, fmtWind, TYPE_NAMES } from "./format";

export function GradeChip({ climb, big }) {
  const g = mainGrade(climb);
  return <span className={`cb-grade cb-grade--${g.kind} cb-grade--${band(climb)}${big ? " is-big" : ""}`}>{g.text}</span>;
}

export function TypeTags({ types }) {
  return (
    <span className="cb-types">
      {types.map(t => (
        <span key={t} className={`cb-type cb-type--${t}`}>
          {TYPE_NAMES[t] ?? t}
        </span>
      ))}
    </span>
  );
}

/** USA › Kentucky › Red River Gorge, each a link to that area. */
export function Breadcrumbs({ path = [], ancestors = [], onArea, includeLast = false }) {
  const n = Math.min(path.length, ancestors.length);
  const items = path.slice(0, n).map((name, i) => ({ name, uuid: ancestors[i] }));
  const shown = includeLast ? items : items.slice(0, -1);
  if (!shown.length) return null;
  return (
    <nav className="cb-crumbs" aria-label="Where this is">
      {shown.map((c, i) => (
        <span key={c.uuid}>
          {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
          <button type="button" onClick={() => onArea(c.uuid)}>
            {c.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function Spinner({ children = "Loading…" }) {
  return (
    <p className="cb-loading">
      <LoaderCircle size={18} className="cb-spin" aria-hidden="true" /> {children}
    </p>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <p className="cb-error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" /> {error}
      {onRetry && (
        <button type="button" className="cb-link" onClick={onRetry}>
          Try again
        </button>
      )}
    </p>
  );
}

/** A week of climbing conditions, one card per day. */
export function ConditionsStrip({ cond, units, limit = 7, onPick, picked }) {
  if (cond.loading) return <Spinner>Checking the forecast…</Spinner>;
  if (cond.error) return <ErrorNote error={cond.error} />;
  if (!cond.days?.length) return null;
  return (
    <div className="cb-days">
      {cond.days.slice(0, limit).map(d => (
        <button
          type="button"
          key={d.day}
          className={`cb-day cb-day--${d.label.id}${picked === d.day ? " is-on" : ""}`}
          onClick={onPick ? () => onPick(d.day) : undefined}
          disabled={!onPick}
          title={d.reasons.join(". ") || "Good climbing weather"}
        >
          <span className="cb-day-name">{dayName(d.day)}</span>
          <span className="cb-day-label">{d.label.text}</span>
          <span className="cb-day-temp">
            {fmtTemp(d.high, units)} <small>{fmtTemp(d.low, units)}</small>
          </span>
          <span className="cb-day-icons">
            {d.wetRock || d.rainMm > 1 ? <CloudRain size={14} aria-label="Rain or wet rock" /> : <Sun size={14} aria-hidden="true" />}
            {d.wind > 12 && <Wind size={14} aria-label="Windy" />}
          </span>
          <span className="cb-day-best">
            Best {fmtHour(d.best.from)}–{fmtHour(d.best.to)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** What a single day looks like, in words. */
export function DayDetail({ day, units, sandstone }) {
  if (!day) return null;
  return (
    <div className={`cb-daydetail cb-daydetail--${day.label.id}`}>
      <strong>
        {dayName(day.day)}: {day.label.text} ({day.score}/100)
      </strong>
      <p>
        High {fmtTemp(day.high, units)}, low {fmtTemp(day.low, units)}, gusts to {fmtWind(day.wind, units)}
        {day.rainMm > 0.2 ? `, ${units === "metric" ? `${day.rainMm.toFixed(1)} mm` : `${(day.rainMm / 25.4).toFixed(2)} in`} of rain` : ", dry"}. Best window {fmtHour(day.best.from)}–{fmtHour(day.best.to)}.
      </p>
      {day.reasons.length > 0 && (
        <ul>
          {day.reasons.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p className="cb-muted">{day.advice}</p>
      {sandstone && !day.wetRock && <p className="cb-muted">This is sandstone: if it rained hard, give it a day or two to dry before climbing.</p>}
    </div>
  );
}

