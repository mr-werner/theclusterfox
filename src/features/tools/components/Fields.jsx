import { useState } from "react";
import { DIMS, fromSI, toSI, fmtInput, parseNumber } from "../model/units";
import { useTerm } from "./useTerm";

export function UnitSelect({ dim, unit, onChange, label, compact }) {
  const d = DIMS[dim];
  if (!d || d.units.length < 2) {
    const only = d?.units[0]?.label;
    return only ? <span className="tf-unit-fixed">{only}</span> : null;
  }
  return (
    <select className={`tf-unit ${compact ? "is-compact" : ""}`} value={unit} onChange={(e) => onChange(e.target.value)} aria-label={`${label} unit`}>
      {d.units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label}
        </option>
      ))}
    </select>
  );
}

/** A number box that shows an SI value in the chosen unit and accepts things like 4.7k, 1 1/4 and 3/8. */
export function NumField({ id, label, hint, dim, value, unit, onValue, onUnit, term }) {
  const info = useTerm(term);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const shown = Number.isFinite(value) ? fmtInput(fromSI(value, dim, unit)) : text;
  const display = editing ? text : shown;
  const bad = editing && text.trim() !== "" && !Number.isFinite(parseNumber(text));

  return (
    <div className="tf-field">
      <div className="tf-label-row">
        <label htmlFor={id}>{label}</label>
        {info.button}
      </div>
      {info.panel}
      <div className={`tf-input-row ${bad ? "is-bad" : ""}`}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck="false"
          value={display}
          onFocus={(e) => {
            setText(shown);
            setEditing(true);
            requestAnimationFrame(() => e.target.select());
          }}
          onBlur={() => setEditing(false)}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseNumber(e.target.value);
            onValue(Number.isFinite(n) ? toSI(n, dim, unit) : NaN);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const n = parseNumber(text);
            if (!Number.isFinite(n)) return;
            const step = n === 0 ? 1 : 10 ** Math.floor(Math.log10(Math.abs(n))) / (e.shiftKey ? 1 : 10);
            const next = Number((n + (e.key === "ArrowUp" ? step : -step)).toPrecision(10));
            setText(String(next));
            onValue(toSI(next, dim, unit));
          }}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <UnitSelect dim={dim} unit={unit} onChange={onUnit} label={label} />
      </div>
      {hint && (
        <p className="tf-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function ChoiceField({ id, label, options, value, onChange, term }) {
  const info = useTerm(term);
  if (options.length <= 4 && options.every((o) => o.label.length < 26)) {
    return (
      <div className="tf-field">
        <div className="tf-label-row">
          <span className="tf-label" id={`${id}-label`}>
            {label}
          </span>
          {info.button}
        </div>
        {info.panel}
        <div className="tf-segmented" role="radiogroup" aria-labelledby={`${id}-label`}>
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="tf-field">
      <div className="tf-label-row">
        <label htmlFor={id}>{label}</label>
        {info.button}
      </div>
      {info.panel}
      <select id={id} className="tf-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PresetField({ id, label, options, value, onPick }) {
  return (
    <div className="tf-field tf-preset">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="tf-select" value={value} onChange={(e) => onPick(e.target.value)}>
        {!value && <option value="">Custom values</option>}
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextField({ id, label, value, onChange, term }) {
  const info = useTerm(term);
  return (
    <div className="tf-field">
      <div className="tf-label-row">
        <label htmlFor={id}>{label}</label>
        {info.button}
      </div>
      {info.panel}
      <input id={id} className="tf-text" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck="false" />
    </div>
  );
}
