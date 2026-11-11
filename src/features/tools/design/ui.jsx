import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

// Small controls shared by the Design & Manufacturing pages.

/** A labelled slider with a typed value box. `value` is in mm (or degrees when unit is "deg"). */
export function Slider({ label, value, min, max, step, onChange, units, unit = "mm", help, id }) {
  const isLen = unit === "mm";
  const disp = isLen ? units.toDisp(value) : value;
  const dMin = isLen ? units.toDisp(min) : min;
  const dMax = isLen ? units.toDisp(max) : max;
  const dStep = isLen ? units.step(step) : step;
  const digits = isLen ? (units.us ? 4 : decimals(step)) : decimals(step);
  const [text, setText] = useState(null);
  const shown = text ?? disp.toFixed(digits);
  const suffix = isLen ? units.unit : unit === "deg" ? "°" : unit;
  return (
    <div className="gd-slider">
      <div className="gd-slider-head">
        <label htmlFor={id}>{label}</label>
        <span className="gd-slider-val">
          <input
            aria-label={`${label} value`}
            inputMode="decimal"
            value={shown}
            onFocus={(e) => {
              setText(disp.toFixed(digits));
              requestAnimationFrame(() => e.target.select());
            }}
            onBlur={() => setText(null)}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n)) onChange(clamp(isLen ? units.fromDisp(n) : n, min, max));
            }}
            size={Math.max(4, shown.length)}
          />
          <span>{suffix}</span>
        </span>
      </div>
      <input id={id} type="range" min={dMin} max={dMax} step={dStep} value={disp} onChange={(e) => onChange(clamp(isLen ? units.fromDisp(Number(e.target.value)) : Number(e.target.value), min, max))} />
      {help && <p className="gd-help">{help}</p>}
    </div>
  );
}

const decimals = (step) => Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Radio buttons in the ToolFox segmented style. */
export function Segmented({ label, options, value, onChange, small }) {
  return (
    <div className={`tf-segmented ${small ? "is-small" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Engineer ToolFox › Design & Manufacturing (› GD&T). */
export function Crumbs({ here }) {
  return (
    <nav className="gd-crumbs" aria-label="Breadcrumb">
      <Link to="/tools" className="tf-crumb">Engineer ToolFox</Link>
      <ChevronRight size={13} aria-hidden="true" />
      <Link to="/tools/c/design" className="tf-crumb">Design &amp; Manufacturing</Link>
      {here && (
        <>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to="/tools/gdt" className="tf-crumb">GD&amp;T</Link>
        </>
      )}
    </nav>
  );
}
