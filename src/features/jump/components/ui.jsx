import { LoaderCircle, Star } from "lucide-react";

import { DROPZONES } from "../data/dropzones";

const STATES = [...new Set(DROPZONES.map(d => d.state))].sort();

/** A drop zone picker grouped by state, with your home DZ first. */
export function DzSelect({ value, onChange, home, label = "Drop zone" }) {
  const homeDz = home && DROPZONES.find(d => d.id === home);
  return (
    <label className="jf-field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={e => onChange(e.target.value)}>
        {!value && <option value="">Pick a drop zone…</option>}
        {homeDz && (
          <optgroup label="Home DZ">
            <option value={homeDz.id}>★ {homeDz.name}</option>
          </optgroup>
        )}
        {STATES.map(st => (
          <optgroup key={st} label={st}>
            {DROPZONES.filter(d => d.state === st).map(d => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.city}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function HomeButton({ isHome, onClick }) {
  return (
    <button type="button" className={`jf-btn is-small${isHome ? " is-ghost" : ""}`} onClick={onClick} aria-pressed={isHome}>
      <Star size={14} fill={isHome ? "currentColor" : "none"} aria-hidden="true" /> {isHome ? "Home DZ" : "Make home DZ"}
    </button>
  );
}

export function Loading({ children = "Loading…" }) {
  return (
    <p className="jf-loading">
      <LoaderCircle size={16} className="jf-spin" aria-hidden="true" /> {children}
    </p>
  );
}

export function Ext({ href, children, className = "" }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

const pad = n => String(n).padStart(2, "0");
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hourLabel = h => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const fmtDay = day => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Saves text as a file the viewer downloads. */
export function download(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
