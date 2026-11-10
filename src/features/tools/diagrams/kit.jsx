import { createContext, useContext, useState } from "react";
import { DIMS, fromSI, toSI, fmtInput, parseNumber } from "../model/units";
import ZoomPan from "../components/ZoomPan";

// Building blocks for diagram-first calculators: an SVG drawing with live HTML
// inputs placed on top of it, and handles you can drag.

const Size = createContext({ w: 800, h: 400 });

/**
 * A drawing w×h (viewBox units). `svg` is drawn; `children` are overlays placed with <At>.
 * It's laid out at least `minWidth` px wide so the overlays have room, then scaled
 * to fit the screen, with pinch and buttons to zoom in on the details.
 */
export function Canvas({ w, h, svg, children, svgRef, label, minWidth = 560 }) {
  return (
    <Size.Provider value={{ w, h }}>
      <ZoomPan width={minWidth} label={label}>
        <div className="dg" style={{ aspectRatio: `${w} / ${h}` }}>
          <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
            {svg}
          </svg>
          {children}
        </div>
      </ZoomPan>
    </Size.Provider>
  );
}

const ANCHORS = {
  c: "-50%, -50%",
  t: "-50%, 0",
  b: "-50%, -100%",
  l: "0, -50%",
  r: "-100%, -50%",
  tl: "0, 0",
  tr: "-100%, 0",
  bl: "0, -100%",
  br: "-100%, -100%",
};

/** Place an HTML overlay at (x, y) in drawing units. */
export function At({ x, y, anchor = "c", children, className = "" }) {
  const { w, h } = useContext(Size);
  return (
    <div className={`dg-at ${className}`} style={{ left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%`, transform: `translate(${ANCHORS[anchor]})` }}>
      {children}
    </div>
  );
}

/** A compact number + unit box that lives on the drawing. */
export function Num({ label, dim, value, unit, onValue, onUnit, wide, compact }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const shown = Number.isFinite(value) ? fmtInput(fromSI(value, dim, unit), 5) : text;
  const bad = editing && text.trim() !== "" && !Number.isFinite(parseNumber(text));
  const units = DIMS[dim]?.units || [];
  return (
    <label className={`dg-num ${bad ? "is-bad" : ""} ${wide ? "is-wide" : ""} ${compact ? "is-compact" : ""}`}>
      <span className="dg-num-label">{label}</span>
      <span className="dg-num-row">
        <input
          inputMode="decimal"
          autoComplete="off"
          spellCheck="false"
          value={editing ? text : shown}
          size={Math.max(3, Math.min(8, (editing ? text : shown).length + 1))}
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
          aria-label={label}
        />
        {units.length > 1 ? (
          <select value={unit} onChange={(e) => onUnit(e.target.value)} aria-label={`${label} unit`}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        ) : (
          units[0]?.label && <span className="dg-num-unit">{units[0].label}</span>
        )}
      </span>
    </label>
  );
}

/** Small toggle buttons drawn on the diagram. */
export function Pills({ options, value, onChange, label }) {
  return (
    <div className="dg-pills" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A compact dropdown on the diagram (for presets such as fluid or pipe size). */
export function Pick({ label, options, value, onPick }) {
  return (
    <label className="dg-pick">
      <span className="dg-num-label">{label}</span>
      <select value={value} onChange={(e) => onPick(e.target.value)}>
        {!value && <option value="">Custom</option>}
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A labelled dropdown of { value, label } options. */
export function Choice({ label, value, options, onChange }) {
  return (
    <label className="dg-pick">
      <span className="dg-num-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A read-only value badge on the diagram. */
export function Badge({ label, children, strong }) {
  return (
    <div className={`dg-badge ${strong ? "is-strong" : ""}`}>
      {label && <span>{label}</span>}
      <strong>{children}</strong>
    </div>
  );
}

/** A dimension line with end ticks, in SVG. */
export function DimLine({ x1, y1, x2, y2 }) {
  const vertical = Math.abs(x1 - x2) < Math.abs(y1 - y2);
  const t = 7;
  return (
    <g className="dg-dim">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - t} x2={x1 + t} y1={y1} y2={y1} />
          <line x1={x2 - t} x2={x2 + t} y1={y2} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} x2={x1} y1={y1 - t} y2={y1 + t} />
          <line x1={x2} x2={x2} y1={y2 - t} y2={y2 + t} />
        </>
      )}
    </g>
  );
}

