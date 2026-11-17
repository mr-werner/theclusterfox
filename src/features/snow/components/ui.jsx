import { Star } from "lucide-react";
import { danger, fmtSnow } from "../model/snow";

export function FavButton({ on, onToggle, name }) {
  return (
    <button type="button" className={`sf-fav${on ? " is-on" : ""}`} aria-pressed={on} aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`} onClick={onToggle}>
      <Star size={18} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/** Small bars of snow per day (cm). */
export function SnowBars({ days, units, max = 30, tall = 34 }) {
  return (
    <ol className="sf-bars" aria-label="Snow by day">
      {days.map(d => {
        const h = Math.min(1, (d.snow ?? 0) / max);
        const wd = new Date(`${d.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" });
        return (
          <li key={d.day} title={`${d.day}: ${fmtSnow(d.snow, units)}`}>
            <span className="sf-bar" style={{ height: `${Math.max(2, h * tall)}px` }} data-deep={d.snow >= 15 ? "" : undefined} />
            <small>{wd}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function DangerChip({ level, small }) {
  const d = danger(level);
  return (
    <span className={`sf-danger${small ? " is-small" : ""}`} style={{ "--dg": d.color }} data-level={level}>
      <i aria-hidden="true" />
      {level > 0 ? `${level} · ${d.name}` : d.name}
    </span>
  );
}

export function Card({ title, icon: Icon, children, aside, className = "" }) {
  return (
    <section className={`sf-card ${className}`}>
      <header className="sf-card-head">
        <h3>
          {Icon && <Icon size={18} aria-hidden="true" />}
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export const Loading = ({ text = "Loading…" }) => <p className="sf-muted sf-loading">{text}</p>;
export const Problem = ({ text }) => <p className="sf-problem">{text}</p>;
