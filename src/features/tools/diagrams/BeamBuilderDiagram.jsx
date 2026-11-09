import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Canvas, At, Num, DimLine } from "./kit";
import { useDrag, keyNudge, show, clamp } from "./helpers";
import { parseBeamModel, stringifyBeamModel, isSupport } from "../model/structures";

// Free-form beam: add supports and loads, drag them along the beam, and type
// their values right on the drawing. Clicking an item opens a small editor
// under it for its position and type. A list view is there too.

const W = 960, H = 580;
const X0 = 90, X1 = 870, BY = 240;

const ADD = [
  { kind: "pin", label: "Pin" },
  { kind: "roller", label: "Roller" },
  { kind: "fixed", label: "Fixed" },
  { kind: "point", label: "Point load" },
  { kind: "udl", label: "Distributed load" },
  { kind: "moment", label: "Moment" },
];
const NAMES = { pin: "Pin support", roller: "Roller support", fixed: "Fixed support", point: "Point load", udl: "Distributed load", moment: "Moment" };

/** A tidy step for snapping positions: about 1/100 of the span, rounded to 1, 2 or 5. */
const stepFor = (L) => {
  const raw = L / 100;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
};

export default function BeamBuilderDiagram({ values: v, set, output, unit, setUnit }) {
  const svgRef = useRef(null);
  const [sel, setSel] = useState(null);
  const L = v.L > 0 ? v.L : 1;
  const items = parseBeamModel(v.model);
  const step = stepFor(L);
  const snap = (x) => clamp(Math.round(x / step) * step, 0, L);
  const sx = (x) => X0 + (clamp(x, 0, L) / L) * (X1 - X0);
  const fromPx = (px) => ((px - X0) / (X1 - X0)) * L;
  const save = (next) => set("model", stringifyBeamModel(next));
  const update = (i, patch) => save(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const remove = (i) => {
    save(items.filter((_, k) => k !== i));
    setSel(null);
  };
  const add = (kind) => {
    const taken = new Set(items.filter((it) => it.x !== undefined).map((it) => it.x));
    // New items go somewhere free: ends first for supports, then the middle.
    const spots = isSupport({ kind }) ? [0, L, L / 2, L / 4, (3 * L) / 4] : [L / 2, L / 4, (3 * L) / 4, L / 3, (2 * L) / 3];
    const x = snap(spots.find((s) => !taken.has(snap(s))) ?? L / 2);
    const it =
      kind === "point" ? { kind, x, P: 10000 } : kind === "moment" ? { kind, x, M: 5000 } : kind === "udl" ? { kind, x1: snap(L / 4), x2: snap((3 * L) / 4), w1: 5000, w2: 5000 } : { kind, x };
    save([...items, it]);
    setSel(items.length);
  };

  const vis = output.visual?.pts ? output.visual : null;
  const maxW = Math.max(1e-9, ...items.filter((i) => i.kind === "udl").flatMap((u) => [Math.abs(u.w1), Math.abs(u.w2)]));

  // Deflected shape, exaggerated so the biggest movement is 40 px.
  let shape = null;
  if (vis) {
    const maxY = Math.max(...vis.pts.map((p) => Math.abs(p.y))) || 1;
    shape = vis.pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${(BY + (p.y / maxY) * 40).toFixed(1)}`).join(" ");
  }
  const reactionFor = (x) => vis?.reactions.find((r) => Math.abs(r.x - clamp(x, 0, L)) < 1e-9 && (r.R || r.M));

  const svg = (
    <>
      <rect x="0" y="0" width={W} height={H} fill="transparent" onPointerDown={() => setSel(null)} />
      {/* Distributed loads sit behind everything else. */}
      {items.map((it, i) => (it.kind === "udl" ? <Udl key={i} it={it} i={i} sel={sel === i} setSel={setSel} sx={sx} maxW={maxW} svgRef={svgRef} fromPx={fromPx} snap={snap} update={update} step={step} L={L} /> : null))}
      <rect x={X0} y={BY - 8} width={X1 - X0} height="16" rx="3" className="dg-beam" />
      {shape && <path d={shape} className="dg-deflected" />}
      {items.map((it, i) =>
        it.kind === "udl" ? null : (
          <Item key={i} it={it} i={i} sel={sel === i} setSel={setSel} sx={sx} svgRef={svgRef} fromPx={fromPx} snap={snap} update={update} step={step} L={L} unit={unit} reaction={isSupport(it) ? reactionFor(it.x) : null} />
        )
      )}
      <DimLine x1={X0} y1={H - 34} x2={X1} y2={H - 34} />
    </>
  );

  return (
    <div className="dg-builder">
      <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="Beam with the supports and loads you've added" minWidth={720}>
        <At x={14} y={14} anchor="tl">
          <div className="dg-add" role="group" aria-label="Add to the beam">
            {ADD.map((a) => (
              <button key={a.kind} type="button" onClick={() => add(a.kind)}>
                <Plus size={13} aria-hidden="true" />
                {a.label}
              </button>
            ))}
          </div>
        </At>
        <At x={(X0 + X1) / 2} y={H - 34} anchor="c">
          <Num label="Beam length" dim="length" value={v.L} unit={unit("length")} onValue={(x) => set("L", x)} onUnit={(u) => setUnit("length", u)} />
        </At>
        {/* Values typed straight onto each load. */}
        {items.map((it, i) => {
          const field = (key, label, dim, extra = {}) => (
            <Num compact label={label} dim={dim} value={it[key]} unit={unit(dim)} onValue={(x) => Number.isFinite(x) && update(i, { [key]: x, ...(typeof extra === "function" ? extra(x) : {}) })} onUnit={(u) => setUnit(dim, u)} />
          );
          const wrap = (x, y, anchor, child) => (
            <At key={i} x={clamp(x, 70, W - 70)} y={y} anchor={anchor} className={`dg-on ${sel === i ? "is-sel" : ""}`}>
              <div onFocusCapture={() => setSel(i)} onPointerDownCapture={() => setSel(i)}>
                {child}
              </div>
            </At>
          );
          if (it.kind === "point") return wrap(sx(it.x), BY - 116, "b", field("P", it.P < 0 ? "Load (up)" : "Load", "force"));
          if (it.kind === "moment") return wrap(sx(it.x), BY - 42, "b", field("M", it.M < 0 ? "Moment ↺" : "Moment ↻", "moment"));
          if (it.kind === "udl") {
            const a = sx(it.x1), b = sx(it.x2);
            const top = (x) => BY - 12 - (14 + 46 * (Math.abs(x === a ? it.w1 : it.w2) / maxW));
            if (Math.abs(it.w1 - it.w2) < 1e-9) return wrap((a + b) / 2, Math.min(top(a), top(b)) - 12, "b", field("w1", "Load per length", "linearLoad", (x) => ({ w2: x })));
            return wrap(
              (a + b) / 2,
              Math.min(top(a), top(b)) - 12,
              "b",
              <div className="dg-stack is-row is-nowrap">
                {field("w1", "Start", "linearLoad")}
                {field("w2", "End", "linearLoad")}
              </div>
            );
          }
          return null;
        })}
        {sel !== null && items[sel] && (
          <At x={clamp(items[sel].kind === "udl" ? sx((items[sel].x1 + items[sel].x2) / 2) : sx(items[sel].x), 200, W - 200)} y={BY + (items[sel].kind === "fixed" ? 104 : 96)} anchor="t" className="dg-on is-sel">
            <Editor it={items[sel]} i={sel} update={update} remove={remove} close={() => setSel(null)} unit={unit} setUnit={setUnit} />
          </At>
        )}
      </Canvas>

      <details className="dg-list">
        <summary>Edit as a list</summary>
      <div className="dg-items" role="list" aria-label="Supports and loads">
        {items.length === 0 && <p className="tf-muted tf-small">Nothing on the beam yet. Add a support and a load above.</p>}
        {items.map((it, i) => (
          <div key={i} role="listitem" className={`dg-item ${sel === i ? "is-sel" : ""}`} onFocus={() => setSel(i)} onClick={() => setSel(i)}>
            <span className={`dg-item-name is-${it.kind}`}>{NAMES[it.kind]}</span>
            <div className="dg-item-fields">
              {isSupport(it) && (
                <label className="dg-pick">
                  <span className="dg-num-label">Type</span>
                  <select value={it.kind} onChange={(e) => update(i, { kind: e.target.value })}>
                    <option value="pin">Pin</option>
                    <option value="roller">Roller</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
              )}
              {it.kind === "point" && <Num label="Load (down +)" dim="force" value={it.P} unit={unit("force")} onValue={(x) => Number.isFinite(x) && update(i, { P: x })} onUnit={(u) => setUnit("force", u)} />}
              {it.kind === "moment" && <Num label="Moment (clockwise +)" dim="moment" value={it.M} unit={unit("moment")} onValue={(x) => Number.isFinite(x) && update(i, { M: x })} onUnit={(u) => setUnit("moment", u)} />}
              {it.kind === "udl" && (
                <>
                  <Num label="Load at start" dim="linearLoad" value={it.w1} unit={unit("linearLoad")} onValue={(x) => Number.isFinite(x) && update(i, { w1: x })} onUnit={(u) => setUnit("linearLoad", u)} />
                  <Num label="Load at end" dim="linearLoad" value={it.w2} unit={unit("linearLoad")} onValue={(x) => Number.isFinite(x) && update(i, { w2: x })} onUnit={(u) => setUnit("linearLoad", u)} />
                  <Num label="From" dim="length" value={it.x1} unit={unit("length")} onValue={(x) => Number.isFinite(x) && update(i, { x1: x })} onUnit={(u) => setUnit("length", u)} />
                  <Num label="To" dim="length" value={it.x2} unit={unit("length")} onValue={(x) => Number.isFinite(x) && update(i, { x2: x })} onUnit={(u) => setUnit("length", u)} />
                </>
              )}
              {it.kind !== "udl" && <Num label="Position" dim="length" value={it.x} unit={unit("length")} onValue={(x) => Number.isFinite(x) && update(i, { x })} onUnit={(u) => setUnit("length", u)} />}
            </div>
            <button type="button" className="dg-item-del" onClick={(e) => (e.stopPropagation(), remove(i))} aria-label={`Remove ${NAMES[it.kind].toLowerCase()}`} title="Remove">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      </details>
    </div>
  );
}

/** The small editor that opens under the selected item. */
function Editor({ it, i, update, remove, close, unit, setUnit }) {
  const len = (key, label) => <Num compact label={label} dim="length" value={it[key]} unit={unit("length")} onValue={(x) => Number.isFinite(x) && update(i, { [key]: x })} onUnit={(u) => setUnit("length", u)} />;
  const sloped = it.kind === "udl" && Math.abs(it.w1 - it.w2) > 1e-9;
  return (
    <div className="dg-pop" role="group" aria-label={NAMES[it.kind]}>
      <div className="dg-pop-head">
        <strong className={`dg-item-name is-${it.kind}`}>{NAMES[it.kind]}</strong>
        <button type="button" className="dg-pop-x" onClick={close} aria-label="Close" title="Close">
          <X size={15} />
        </button>
      </div>
      {isSupport(it) && (
        <div className="dg-pills" role="radiogroup" aria-label="Support type">
          {["pin", "roller", "fixed"].map((k) => (
            <button key={k} type="button" role="radio" aria-checked={it.kind === k} onClick={() => update(i, { kind: k })}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      )}
      <div className="dg-pop-fields">
        {it.kind === "udl" ? (
          <>
            {len("x1", "From")}
            {len("x2", "To")}
          </>
        ) : (
          len("x", "Position")
        )}
      </div>
      <div className="dg-pop-actions">
        {(it.kind === "point" || it.kind === "moment") && (
          <button type="button" onClick={() => update(i, it.kind === "point" ? { P: -it.P } : { M: -it.M })}>
            {it.kind === "point" ? (it.P < 0 ? "Point it down" : "Point it up") : it.M < 0 ? "Make it clockwise" : "Make it counter-clockwise"}
          </button>
        )}
        {it.kind === "udl" && (
          <button type="button" onClick={() => update(i, sloped ? { w2: it.w1 } : { w2: it.w1 * 2 || 1000 })}>
            {sloped ? "Make it uniform" : "Make it sloped"}
          </button>
        )}
        <button type="button" className="is-danger" onClick={() => remove(i)}>
          <Trash2 size={14} aria-hidden="true" /> Remove
        </button>
      </div>
    </div>
  );
}

/** A support, point load or moment: drag it along the beam. */
function Item({ it, i, sel, setSel, sx, svgRef, fromPx, snap, update, step, L, unit, reaction }) {
  const drag = useDrag(svgRef, ({ x }) => update(i, { x: snap(fromPx(x)) }));
  const nudge = keyNudge((k) => update(i, { x: clamp(snap(it.x + k * step), 0, L) }));
  const x = sx(it.x);
  const cls = `dg-bitem ${sel ? "is-sel" : ""}`;
  const grab = { ...drag, ...nudge, onFocus: () => setSel(i), onPointerDownCapture: () => setSel(i), "aria-label": `${NAMES[it.kind]} position`, "aria-valuenow": it.x };
  if (isSupport(it)) {
    const side = it.kind === "fixed" ? (it.x <= 0 ? -1 : it.x >= L ? 1 : 0) : 0;
    return (
      <g className={cls}>
        <g {...grab}>
          <rect x={x - 22} y={BY + 6} width="44" height="44" fill="transparent" />
          {it.kind === "pin" && <path d={`M${x},${BY + 8} l-16,26 h32 Z`} className="dg-support" />}
          {it.kind === "roller" && (
            <>
              <circle cx={x} cy={BY + 21} r="13" className="dg-support" />
              <line x1={x - 22} x2={x + 22} y1={BY + 36} y2={BY + 36} className="dg-ground" />
            </>
          )}
          {it.kind === "pin" && <line x1={x - 22} x2={x + 22} y1={BY + 36} y2={BY + 36} className="dg-ground" />}
          {it.kind === "fixed" &&
            (side ? (
              <g className="dg-support">
                <rect x={side < 0 ? x - 18 : x} y={BY - 44} width="18" height="88" />
                {Array.from({ length: 6 }, (_, k) => (
                  <line key={k} x1={side < 0 ? x - 18 : x + 18} y1={BY - 40 + k * 16} x2={side < 0 ? x - 28 : x + 28} y2={BY - 30 + k * 16} className="dg-hatch" />
                ))}
              </g>
            ) : (
              <g>
                <rect x={x - 20} y={BY + 8} width="40" height="22" className="dg-support" />
                {Array.from({ length: 4 }, (_, k) => (
                  <line key={k} x1={x - 16 + k * 11} y1={BY + 30} x2={x - 24 + k * 11} y2={BY + 40} className="dg-hatch" />
                ))}
              </g>
            ))}
        </g>
        {reaction && (
          <text x={x} y={BY + 70} textAnchor="middle" className="dg-reaction-text">
            R {show(reaction.R, "force", unit("force"))}
            {reaction.M ? <tspan x={x} dy="18">M {show(Math.abs(reaction.M), "moment", unit("moment"))}</tspan> : null}
          </text>
        )}
      </g>
    );
  }
  if (it.kind === "point") {
    const up = it.P < 0;
    return (
      <g className={`${cls} dg-load`}>
        <g {...grab}>
          <rect x={x - 16} y={BY - 112} width="32" height="104" fill="transparent" />
          <line x1={x} x2={x} y1={up ? BY - 12 : BY - 96} y2={up ? BY - 92 : BY - 16} />
          <path d={up ? `M${x - 8},${BY - 84} L${x},${BY - 100} L${x + 8},${BY - 84} Z` : `M${x - 8},${BY - 24} L${x},${BY - 9} L${x + 8},${BY - 24} Z`} />
          <circle cx={x} cy={up ? BY - 100 : BY - 100} r="11" className="dg-handle" />
          <path d={`M${x - 5},${BY - 100} h10 M${x - 5},${BY - 104} l-3,4 l3,4 M${x + 5},${BY - 104} l3,4 l-3,4`} className="dg-handle-glyph" />
        </g>
      </g>
    );
  }
  // Moment: a curved arrow around the point.
  const cw = it.M >= 0;
  return (
    <g className={`${cls} dg-moment`}>
      <g {...grab}>
        <circle cx={x} cy={BY} r="34" fill="transparent" />
        <path d={`M${x - 26},${BY + 8} A27,27 0 1,1 ${x + 26},${BY + 8}`} className="dg-moment-arc" />
        <path d={cw ? `M${x + 26},${BY + 16} l-9,-12 l13,-2 Z` : `M${x - 26},${BY + 16} l9,-12 l-13,-2 Z`} className="dg-moment-head" />
        <circle cx={x} cy={BY} r="6" className="dg-handle" />
      </g>
    </g>
  );
}

/** A distributed load: drag the band to move it, or its end handles to resize it. */
function Udl({ it, i, sel, setSel, sx, maxW, svgRef, fromPx, snap, update, step, L }) {
  const grabAt = useRef(null);
  const span = it.x2 - it.x1;
  const body = useDrag(svgRef, ({ x }) => {
    const at = fromPx(x);
    if (grabAt.current === null) grabAt.current = at - it.x1;
    const x1 = clamp(snap(at - grabAt.current), 0, L - span);
    update(i, { x1, x2: x1 + span });
  });
  const left = useDrag(svgRef, ({ x }) => update(i, { x1: Math.min(snap(fromPx(x)), it.x2 - step) }));
  const right = useDrag(svgRef, ({ x }) => update(i, { x2: Math.max(snap(fromPx(x)), it.x1 + step) }));
  const nudge = keyNudge((k) => {
    const x1 = clamp(snap(it.x1 + k * step), 0, L - span);
    update(i, { x1, x2: x1 + span });
  });
  const a = sx(it.x1), b = sx(it.x2);
  const h1 = 14 + 46 * (Math.abs(it.w1) / maxW), h2 = 14 + 46 * (Math.abs(it.w2) / maxW);
  const top = (x) => BY - 12 - (h1 + ((h2 - h1) * (x - a)) / Math.max(1, b - a));
  const n = Math.max(2, Math.round((b - a) / 40));
  return (
    <g className={`dg-bitem dg-load ${sel ? "is-sel" : ""}`}>
      <g
        {...body}
        {...nudge}
        onPointerDown={(e) => ((grabAt.current = null), body.onPointerDown(e))}
        onPointerDownCapture={() => setSel(i)}
        onFocus={() => setSel(i)}
        aria-label="Distributed load position"
        aria-valuenow={it.x1}
      >
        <path d={`M${a},${BY - 12} V${top(a)} L${b},${top(b)} V${BY - 12} Z`} className="dg-udl" />
        {Array.from({ length: n + 1 }, (_, k) => {
          const x = a + ((b - a) * k) / n;
          return (
            <g key={k}>
              <line x1={x} x2={x} y1={top(x)} y2={BY - 14} />
              <path d={`M${x - 5},${BY - 21} L${x},${BY - 10} L${x + 5},${BY - 21} Z`} />
            </g>
          );
        })}
      </g>
      <circle cx={a} cy={top(a)} r="8" className="dg-handle" {...left} aria-label="Distributed load start" />
      <circle cx={b} cy={top(b)} r="8" className="dg-handle" {...right} aria-label="Distributed load end" />
    </g>
  );
}
