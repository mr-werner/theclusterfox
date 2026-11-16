import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, LockOpen } from "lucide-react";
import { Canvas, At, Num, Pills, Pick, Badge, DimLine } from "./kit";
import { show, tidy, clamp } from "./helpers";
import { SectionShape } from "../components/Visuals";
import { section, sectionOutline, sectionStress } from "../model/structures";
import { toParams } from "../model/engine";
import { beamUrlFromSection, readBeamTrip, saveLastSection } from "../model/beamLink";
import { fmt, fromSI, unitLabel } from "../model/units";

// Section properties, drawn to scale. Grab an edge and drag it: the top edge sets
// the height, the side sets the width, a flange's underside its thickness, the hole
// in a tube its inside diameter. Each value can be locked so nothing changes it.
// Below the drawing, load the section and see how its shape sets the stress in it.

const W = 760, H = 480;
const CX = 330, CY = 278, BOX = 220;
const MIN = 2e-4; // smallest dimension a drag can make, m

const SHAPES = [
  { value: "rect", label: "Rectangle" },
  { value: "round", label: "Round" },
  { value: "tube", label: "Tube" },
  { value: "rhs", label: "Box tube" },
  { value: "ibeam", label: "I-beam" },
  { value: "tee", label: "Tee" },
  { value: "channel", label: "Channel" },
  { value: "angle", label: "Angle" },
  { value: "triangle", label: "Triangle" },
  { value: "hex", label: "Hex bar" },
];

/** The dimensions each shape has, in the order they're listed. `ID` is the tube's bore, kept as a wall thickness. */
const DIMS = {
  rect: ["h", "b"],
  round: ["D"],
  tube: ["D", "ID", "t"],
  rhs: ["H", "B", "t"],
  ibeam: ["h", "b", "tf", "tw"],
  tee: ["h", "b", "tf", "tw"],
  channel: ["h", "b", "tf", "tw"],
  angle: ["h", "b", "t"],
  triangle: ["h", "b"],
  hex: ["s"],
};
const NAMES = { h: "Height", b: "Width", D: "Outside dia.", ID: "Inside dia.", t: "Wall", H: "Height", B: "Width", tf: "Flange", tw: "Web", s: "Across flats" };
const lockKey = (key) => (key === "ID" ? "t" : key);

/** How far each dimension can go while keeping the shape valid. */
function limits(shape, v, key, k) {
  const room = (BOX * 1.6) / k; // keep a drag on the drawing
  switch (key) {
    case "b":
      return [Math.max(MIN, shape === "angle" ? v.t * 1.05 : ["ibeam", "tee", "channel"].includes(shape) ? v.tw * 1.05 : MIN), room];
    case "h":
      return [Math.max(MIN, shape === "ibeam" || shape === "channel" ? v.tf * 2.1 : shape === "tee" ? v.tf * 1.05 : shape === "angle" ? v.t * 1.05 : MIN), room];
    case "D":
      return [Math.max(MIN, shape === "tube" ? v.t * 2.1 : MIN), room];
    case "B":
    case "H":
      return [Math.max(MIN, v.t * 2.1), room];
    case "ID":
      return [MIN, v.D - 2 * MIN];
    case "t":
      return [MIN, shape === "rhs" ? Math.min(v.B, v.H) * 0.48 : shape === "angle" ? Math.min(v.b, v.h) * 0.95 : v.D * 0.48];
    case "tf":
      return [MIN, shape === "tee" ? v.h * 0.95 : v.h * 0.48];
    case "tw":
      return [MIN, shape === "channel" ? v.b * 0.95 : v.b];
    case "s":
      return [MIN, room];
    default:
      return [MIN, room];
  }
}

const valueOf = (v, key) => (key === "ID" ? v.D - 2 * v.t : v[key]);

export default function SectionDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const svgRef = useRef(null);
  const gid = useId().replace(/:/g, "");
  const [held, setHeld] = useState(null); // { key, k } while dragging: the scale holds still
  const { shape } = v;
  const lu = unit("smallLength");
  const locks = new Set(String(v.lock || "").split(",").filter(Boolean));
  const isLocked = (key) => locks.has(lockKey(key));
  const dims = DIMS[shape] || [];
  const toggleLock = (key) => {
    const next = new Set(locks);
    const lk = lockKey(key);
    if (next.has(lk)) next.delete(lk);
    else next.add(lk);
    set("lock", [...next].join(","));
  };
  const allLocked = dims.length > 0 && dims.every(isLocked);
  const lockAll = () => {
    const next = new Set(locks);
    for (const key of dims) allLocked ? next.delete(lockKey(key)) : next.add(lockKey(key));
    set("lock", [...next].join(","));
  };
  const apply = (key, x) => {
    if (!Number.isFinite(x) || isLocked(key)) return;
    if (key === "ID") set("t", tidy((v.D - x) / 2));
    else set(key, x);
  };

  const o = sectionOutline(shape, v);
  const ok = o.w > 0 && o.h > 0;
  const k = held?.k ?? (ok ? BOX / Math.max(o.w, o.h) : 1);
  const w = ok ? o.w * k : BOX, h = ok ? o.h * k : BOX;
  const L = CX - w / 2, T = CY - h / 2, R = CX + w / 2, B = CY + h / 2;
  const X = (x) => L + x * k;
  const Y = (y) => B - y * k;
  const px = (x) => Math.max(1.5, (x || 0) * k);

  // ── Edges you can drag ──
  // axis: which pointer motion counts; sign: + if moving right/down grows it;
  // factor: 2 when both sides move (the shape stays centred), 1 when only this face does.
  const edges = [];
  const seg = (x1, y1, x2, y2) => `M${x1},${y1} L${x2},${y2}`;
  const add = (key, d, gx, gy, axis, sign, factor) => edges.push({ id: `${key}${edges.length}`, key, d, gx, gy, axis, sign, factor });
  if (ok) {
    if (shape === "rect") {
      add("h", seg(L, T, R, T), CX, T, "y", -1, 2);
      add("b", seg(R, T, R, B), R, CY, "x", 1, 2);
    } else if (shape === "round" || shape === "tube") {
      const r = w / 2;
      add("D", `M${CX + r * Math.cos(-0.6)},${CY + r * Math.sin(-0.6)} A${r},${r} 0 0,1 ${CX + r * Math.cos(0.6)},${CY + r * Math.sin(0.6)}`, R, CY, "x", 1, 2);
      if (shape === "tube") {
        const ri = Math.max(2, r - px(v.t));
        add("ID", `M${CX - ri * Math.cos(-0.6)},${CY + ri * Math.sin(-0.6)} A${ri},${ri} 0 0,0 ${CX - ri * Math.cos(0.6)},${CY + ri * Math.sin(0.6)}`, CX - ri, CY, "x", -1, 2);
      }
    } else if (shape === "rhs") {
      const t = px(v.t);
      add("H", seg(L, T, R, T), CX, T, "y", -1, 2);
      add("B", seg(R, T, R, B), R, CY + h * 0.25, "x", 1, 2);
      add("t", seg(R - t, T + t, R - t, B - t), R - t, CY - h * 0.2, "x", -1, 1);
    } else if (shape === "ibeam" || shape === "tee" || shape === "channel") {
      const tf = px(v.tf), tw = px(v.tw);
      const webR = shape === "channel" ? L + tw : CX + tw / 2;
      const webBot = shape === "tee" ? B : B - tf;
      add("h", seg(L, T, R, T), (L + R) / 2, T, "y", -1, 2);
      add("b", seg(R, T, R, T + tf), R, T + tf / 2, "x", 1, 2);
      if (shape !== "tee") add("b", seg(R, B - tf, R, B), R, B - tf / 2, "x", 1, 2);
      add("tf", seg(webR, T + tf, R, T + tf), (webR + R) / 2, T + tf, "y", 1, 1);
      add("tw", seg(webR, T + tf, webR, webBot), webR, (T + tf + webBot) / 2, "x", 1, shape === "channel" ? 1 : 2);
    } else if (shape === "angle") {
      const t = px(v.t);
      add("h", seg(L, T, L + t, T), L + t / 2, T, "y", -1, 2);
      add("b", seg(R, B - t, R, B), R, B - t / 2, "x", 1, 2);
      add("t", seg(L + t, B - t, R, B - t), (L + t + R) / 2, B - t, "y", -1, 1);
    } else if (shape === "triangle") {
      add("h", seg(CX - 14, T, CX + 14, T), CX, T, "y", -1, 2);
      add("b", seg(R, B - 14, R, B), R, B, "x", 1, 2);
    } else if (shape === "hex") {
      const a = o.w / 4;
      add("s", seg(X(a), T, X(3 * a), T), CX, T, "y", -1, 2);
    }
  }

  // One drag at a time, for whichever edge was grabbed.
  const active = useRef(null);
  const toLocal = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const boxFor = (key) => svgRef.current?.closest(".dg")?.querySelector(`[data-field="${key}"]`);
  const bind = (edge) => {
    if (isLocked(edge.key)) return {};
    const step = (s) => {
      const cur = valueOf(v, edge.key);
      const [lo, hi] = limits(shape, v, edge.key, k);
      apply(edge.key, tidy(clamp(cur * (1 + 0.02 * s), lo, hi)));
    };
    return {
      onPointerDown: (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const p = toLocal(e);
        if (!p) return;
        active.current = { id: edge.id, p0: p, c0: { x: e.clientX, y: e.clientY }, start: valueOf(v, edge.key), k, moved: false };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      },
      onPointerMove: (e) => {
        const a = active.current;
        if (!a || a.id !== edge.id) return;
        if (!a.moved) {
          if (Math.hypot(e.clientX - a.c0.x, e.clientY - a.c0.y) < 4) return;
          a.moved = true;
          setHeld({ key: edge.key, k: a.k });
          boxFor(edge.key)?.setAttribute("data-live", "");
        }
        const p = toLocal(e);
        if (!p) return;
        const delta = edge.axis === "x" ? p.x - a.p0.x : p.y - a.p0.y;
        const [lo, hi] = limits(shape, v, edge.key, a.k);
        apply(edge.key, tidy(clamp(a.start + (edge.sign * edge.factor * delta) / a.k, lo, hi)));
      },
      onPointerUp: (e) => {
        const a = active.current;
        active.current = null;
        setHeld(null);
        boxFor(edge.key)?.removeAttribute("data-live");
        // A tap without a drag: go type the value.
        if (a && !a.moved && e.type === "pointerup") boxFor(edge.key)?.querySelector("input")?.focus();
      },
      onPointerCancel: () => {
        active.current = null;
        setHeld(null);
        boxFor(edge.key)?.removeAttribute("data-live");
      },
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          boxFor(edge.key)?.querySelector("input")?.focus();
          return;
        }
        const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        if (dir === undefined) return;
        e.preventDefault();
        step(dir * (e.shiftKey ? 10 : 1));
      },
      tabIndex: 0,
      role: "slider",
      "aria-label": `Drag to change the ${NAMES[edge.key].toLowerCase()}`,
      "aria-valuenow": valueOf(v, edge.key),
      style: { touchAction: "none", cursor: edge.axis === "x" ? "ew-resize" : "ns-resize" },
    };
  };

  const num = (key, label) => (
    <Num
      field={key}
      label={label}
      dim="smallLength"
      value={valueOf(v, key)}
      unit={lu}
      onValue={(x) => apply(key, x)}
      onUnit={(u) => setUnit("smallLength", u)}
      locked={isLocked(key)}
      onLock={() => toggleLock(key)}
    />
  );

  const pickKey = (map, fallback) => (shape in map ? map[shape] : fallback);
  const widthKey = pickKey({ round: "D", tube: "D", rhs: "B", hex: null }, "b");
  const heightKey = pickKey({ rhs: "H", hex: "s", round: null, tube: null }, "h");
  // Callouts on the right: [key, label, point on the shape (drawing coords), y of the label].
  const callouts = [];
  if (ok && (shape === "ibeam" || shape === "tee" || shape === "channel")) {
    callouts.push(["tf", "Flange", [R, Y(v.h - v.tf / 2)], T + px(v.tf) / 2 - 6]);
    const webX = shape === "channel" ? X(v.tw / 2) : CX;
    callouts.push(["tw", "Web", [webX, CY + 40], CY + 58]);
  }
  if (ok && shape === "tube") {
    callouts.push(["t", "Wall", [R - px(v.t) / 2, CY - 18], CY - 74]);
    callouts.push(["ID", "Inside dia.", [CX + Math.max(2, w / 2 - px(v.t)), CY + 18], CY + 64]);
  }
  if (ok && shape === "rhs") callouts.push(["t", "Wall", [R - px(v.t) / 2, CY - 50], CY - 74]);
  if (ok && shape === "angle") callouts.push(["t", "Thickness", [X(v.b * 0.75), B - px(v.t) / 2], B - 30]);

  // Tint the section with the bending stress: red where it pulls, blue where it pushes.
  const st = output.visual?.stress;
  const tint = ok && st ? stressTint(st, v.Sy) : null;

  const res = (id) => output.results.find((r) => r.id === id);
  const Ix = res("Ix"), Sx = res("Sx"), A = res("A"), wt = res("wt"), Imin = res("Imin");

  const svg = (
    <>
      {tint && (
        <defs>
          <linearGradient id={`${gid}-tint`} gradientUnits="userSpaceOnUse" x1="0" y1={T} x2="0" y2={B}>
            {tint.map((s, i) => (
              <stop key={i} offset={s.at} stopColor={s.color} stopOpacity={s.op} />
            ))}
          </linearGradient>
        </defs>
      )}
      {ok && <SectionShape shape={shape} dims={v} cx={CX} cy={CY} size={Math.max(w, h)} className="dg-section-path" axes={w / 2 + 36} fill={tint ? `url(#${gid}-tint)` : undefined} />}
      {widthKey && <DimLine x1={L} y1={B + 56} x2={R} y2={B + 56} />}
      {heightKey && <DimLine x1={L - 56} y1={T} x2={L - 56} y2={B} />}
      {shape === "hex" && (
        <>
          <line x1={L - 66} x2={X(o.w / 4)} y1={T} y2={T} className="dg-leader" />
          <line x1={L - 66} x2={X(o.w / 4)} y1={B} y2={B} className="dg-leader" />
        </>
      )}
      {callouts.map(([key, , [x0, y0], ly]) => (
        <path key={key} d={`M${x0},${y0} L${R + 30},${ly} H${R + 50}`} className="dg-leader" fill="none" />
      ))}
      {edges.map((edge) => {
        const locked = isLocked(edge.key);
        const live = held?.key === edge.key;
        return (
          <g key={edge.id} className={`dg-edge ${locked ? "is-locked" : ""} ${live ? "is-live" : ""}`} {...bind(edge)}>
            <path d={edge.d} className="dg-edge-hit" />
            <path d={edge.d} className="dg-edge-line" />
            {!locked && <rect x={edge.gx - (edge.axis === "x" ? 4 : 11)} y={edge.gy - (edge.axis === "x" ? 11 : 4)} width={edge.axis === "x" ? 8 : 22} height={edge.axis === "x" ? 22 : 8} rx="4" className="dg-edge-grip" />}
          </g>
        );
      })}
    </>
  );

  return (
    <>
      <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="Cross-section with its dimensions. Drag an edge to resize it.">
        <At x={14} y={14} anchor="tl">
          <div style={{ maxWidth: 520 }}>
            <Pills label="Shape" value={shape} onChange={(x) => set("shape", x)} options={SHAPES} />
          </div>
        </At>
        <At x={W - 14} y={14} anchor="tr">
          <button type="button" className={`dg-lock-all ${allLocked ? "is-on" : ""}`} onClick={lockAll} aria-pressed={allLocked}>
            {allLocked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
            {allLocked ? "Unlock sizes" : "Lock sizes"}
          </button>
        </At>
        {widthKey && (
          <At x={CX} y={B + 56} anchor="c">
            {num(widthKey, shape === "round" || shape === "tube" ? "Outside dia." : "Width")}
          </At>
        )}
        {heightKey && (
          <At x={L - 56} y={CY} anchor="c">
            {num(heightKey, shape === "hex" ? "Across flats" : "Height")}
          </At>
        )}
        {callouts.map(([key, label, , ly]) => (
          <At key={key} x={R + 54} y={ly} anchor="l">
            {num(key, label)}
          </At>
        ))}
        <At x={W - 14} y={H - 14} anchor="br">
          <div className="dg-stack">
            {Ix && <Badge strong label="Iₓ">{show(Ix.value, "inertia", unit("inertia"))}</Badge>}
            {Sx && <Badge label="Sₓ">{show(Sx.value, "sectionModulus", unit("sectionModulus"))}</Badge>}
            {Imin && <Badge label="I min (principal)">{show(Imin.value, "inertia", unit("inertia"))}</Badge>}
            {A && <Badge label="Area">{show(A.value, "smallArea", unit("smallArea"))}</Badge>}
            {wt && <Badge label="Weight">{show(wt.value, "linearMass", unit("linearMass"))}</Badge>}
          </div>
        </At>
      </Canvas>
      <LoadPanel calc={calc} v={v} set={set} output={output} unit={unit} setUnit={setUnit} pick={pick} presetValue={presetValue} isLocked={isLocked} />
    </>
  );
}

/** Gradient stops for the section fill, from the top edge (0) to the bottom (1). */
function stressTint(st, Sy) {
  const ref = Sy > 0 ? Sy : Math.max(Math.abs(st.sTop), Math.abs(st.sBot)) || 1;
  const stop = (sigma, at) => ({ at, color: sigma >= 0 ? "#ff8a7a" : "#5cc8ff", op: sigma === 0 ? 0.08 : clamp(Math.abs(sigma) / ref, 0.25, 0.85) });
  const stops = [stop(st.sTop, 0)];
  if (st.yZero !== null && st.yZero > 0 && st.yZero < st.h) stops.push(stop(0, 1 - st.yZero / st.h));
  stops.push(stop(st.sBot, 1));
  return stops;
}

// ── Loads, stress and the link to beams ──────────────────────────────────

const SENS = { h: "Height", b: "Width", D: "Diameter", t: "Wall", H: "Height", B: "Width", tf: "Flange", tw: "Web", s: "Size" };

function LoadPanel({ calc, v, set, output, unit, setUnit, pick, presetValue, isLocked }) {
  const navigate = useNavigate();
  const st = output.visual?.stress;
  const props = output.visual?.props;
  const mat = calc.inputs.find((i) => i.id === "mat");
  const res = (id) => output.results.find((r) => r.id === id);
  const fos = res("fos")?.value;
  const trip = readBeamTrip();

  // Remember this section, so the beam page can come back to it.
  const params = toParams(calc, v);
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    const p = JSON.parse(paramsKey);
    delete p.M;
    delete p.V;
    delete p.P;
    saveLastSection(p);
  }, [paramsKey]);

  // What a 10% bigger dimension does to the peak stress and the weight.
  const sens = [];
  if (st && st.vm > 0 && props) {
    for (const key of DIMS[v.shape] || []) {
      if (key === "ID") continue;
      const next = { ...v, [key]: v[key] * 1.1 };
      const s2 = sectionStress(v.shape, next, { M: v.M || 0, V: v.V || 0, P: v.P || 0 }, 240);
      const p2 = section(v.shape, next);
      if (!s2 || !p2) continue;
      sens.push({ key, dStress: s2.vm / st.vm - 1, dWeight: p2.A / props.A - 1, locked: isLocked(key) });
    }
    sens.sort((a, b) => a.dStress / Math.max(a.dWeight, 0.01) - b.dStress / Math.max(b.dWeight, 0.01));
  }
  const pct = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x * 100))}%`;

  const shapeName = SHAPES.find((s) => s.value === v.shape)?.label || "Section";
  const lu = unit("smallLength");
  const sizeText = (DIMS[v.shape] || []).filter((key) => key !== "ID").map((key) => fmt(fromSI(valueOf(v, key), "smallLength", lu), 3)).join(" × ");
  const toBeam = () => {
    if (!props) return;
    navigate(beamUrlFromSection({ Ix: props.Ix, Sx: props.Sx, mat: v.mat, label: `${shapeName} ${sizeText} ${unitLabel("smallLength", lu)}` }));
  };

  return (
    <section className="dg-loads" aria-label="Load the section">
      <div className="dg-loads-head">
        <h3>Load it</h3>
        <p className="tf-muted tf-small">Put a bending moment, shear and axial force on this section and see where it's stressed. Change the shape above and watch the stress move.</p>
      </div>
      <div className="dg-loads-grid">
        <div className="dg-loads-in">
          <Num label="Bending moment" dim="moment" value={v.M} unit={unit("moment")} onValue={(x) => set("M", x)} onUnit={(u) => setUnit("moment", u)} />
          <Num label="Shear force" dim="force" value={v.V} unit={unit("force")} onValue={(x) => set("V", x)} onUnit={(u) => setUnit("force", u)} />
          <Num label="Axial (+ pulls)" dim="force" value={v.P} unit={unit("force")} onValue={(x) => set("P", x)} onUnit={(u) => setUnit("force", u)} />
          {mat && <Pick label="Material" options={mat.options} value={presetValue("mat")} onPick={(label) => pick("mat", label)} />}
          <Num label="Yield strength" dim="stress" value={v.Sy} unit={unit("stress")} onValue={(x) => set("Sy", x)} onUnit={(u) => setUnit("stress", u)} />
        </div>
        {st ? <StressPlot v={v} st={st} unit={unit} /> : <p className="tf-muted tf-small dg-loads-empty">Enter a moment, shear or axial force to see the stress across the section.</p>}
        <div className="dg-loads-out">
          {st && (
            <>
              <div className={`dg-fos ${fos === undefined ? "" : fos < 1 ? "is-bad" : fos < 1.5 ? "is-warn" : "is-ok"}`}>
                <span>Safety factor on yield</span>
                <strong>{fos === undefined ? "—" : fmt(fos, 3)}</strong>
                <small>Peak combined stress {show(st.vm, "stress", unit("stress"))}</small>
              </div>
              {sens.length > 0 && (
                <div className="dg-sens">
                  <span className="dg-num-label">Make one size 10% bigger</span>
                  <ul>
                    {sens.map((s) => (
                      <li key={s.key} className={s.locked ? "is-locked" : ""}>
                        <span>{SENS[s.key]}</span>
                        <strong className={s.dStress < -0.005 ? "is-good" : ""}>stress {pct(s.dStress)}</strong>
                        <em>weight {pct(s.dWeight)}</em>
                        {s.locked && <Lock size={11} aria-label="locked" />}
                      </li>
                    ))}
                  </ul>
                  <p className="tf-muted tf-small">Best value first: the most stress taken off for the weight added.</p>
                </div>
              )}
            </>
          )}
          <button type="button" className="dg-beam-link" onClick={toBeam} disabled={!props}>
            {trip ? "Back to the beam with this section" : "Use this section on a beam"} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** The section on its side next to how normal stress and shear vary through its depth. */
function StressPlot({ v, st, unit }) {
  const PW = 440, PH = 250;
  const o = sectionOutline(v.shape, v);
  const k = Math.min(170 / o.h, 96 / o.w);
  const hpx = o.h * k;
  const top = 44 + (180 - hpx) / 2;
  const Y = (y) => top + (o.h - y) * k;
  const sx = 82, ax = 224, tx = 320;
  const sMax = Math.max(Math.abs(st.sTop), Math.abs(st.sBot), 1e-9);
  const ks = 58 / sMax;
  const kt = st.tauMax > 0 ? 52 / st.tauMax : 0;
  const rows = st.rows.filter((_, i) => i % 6 === 0 || i === st.rows.length - 1);
  const sigPath = `M${ax},${Y(0)} ` + rows.map((r) => `L${ax + r.sigma * ks},${Y(r.y)}`).join(" ") + ` L${ax},${Y(o.h)} Z`;
  const tauPath = `M${tx},${Y(0)} ` + rows.map((r) => `L${tx + r.tau * kt},${Y(r.y)}`).join(" ") + ` L${tx},${Y(o.h)} Z`;
  const yN = st.yZero !== null && st.yZero > 0 && st.yZero < o.h ? Y(st.yZero) : null;
  const su = unit("stress");
  const sTxt = (x) => show(x, "stress", su);
  return (
    <svg className="dg-stress" viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label={`Stress through the depth: ${sTxt(st.sTop)} at the top, ${sTxt(st.sBot)} at the bottom, shear up to ${sTxt(st.tauMax)}.`}>
      <defs>
        <clipPath id="dg-tension">
          <rect x={ax} y="0" width={PW} height={PH} />
        </clipPath>
        <clipPath id="dg-compression">
          <rect x="0" y="0" width={ax} height={PH} />
        </clipPath>
      </defs>
      <text x={sx} y="14" textAnchor="middle" className="dg-stress-h">Section</text>
      <text x={ax} y="14" textAnchor="middle" className="dg-stress-h">Normal stress σ</text>
      <text x={tx + 20} y="14" textAnchor="middle" className="dg-stress-h">Shear τ</text>
      <SectionShape shape={v.shape} dims={v} cx={sx} cy={top + hpx / 2} size={Math.max(o.w, o.h) * k} className="dg-section-path" />
      {yN !== null && <line x1={sx - (o.w * k) / 2 - 6} x2={tx + 60} y1={yN} y2={yN} className="dg-stress-na" />}
      {yN !== null && (
        <text x={sx - (o.w * k) / 2 - 8} y={yN + 4} textAnchor="end" className="dg-stress-tick">
          N.A.
        </text>
      )}
      <path d={sigPath} className="dg-stress-t" clipPath="url(#dg-tension)" />
      <path d={sigPath} className="dg-stress-c" clipPath="url(#dg-compression)" />
      <line x1={ax} x2={ax} y1={Y(o.h) - 6} y2={Y(0) + 6} className="dg-stress-axis" />
      {kt > 0 && <path d={tauPath} className="dg-stress-s" />}
      <line x1={tx} x2={tx} y1={Y(o.h) - 6} y2={Y(0) + 6} className="dg-stress-axis" />
      <text x={ax + (st.sTop >= 0 ? 6 : -6)} y={Y(o.h) - 8} textAnchor={st.sTop >= 0 ? "start" : "end"} className={`dg-stress-val ${st.sTop >= 0 ? "is-t" : "is-c"}`}>
        {sTxt(st.sTop)}
      </text>
      <text x={ax + (st.sBot >= 0 ? 6 : -6)} y={Y(0) + 18} textAnchor={st.sBot >= 0 ? "start" : "end"} className={`dg-stress-val ${st.sBot >= 0 ? "is-t" : "is-c"}`}>
        {sTxt(st.sBot)}
      </text>
      {kt > 0 && (
        <text x={tx + st.tauMax * kt + 4} y={Y(st.yTau) + 4} className="dg-stress-val is-s">
          {sTxt(st.tauMax)}
        </text>
      )}
      <text x={ax - 8} y="29" textAnchor="end" className="dg-stress-tick is-c">
        ← push
      </text>
      <text x={ax + 8} y="29" className="dg-stress-tick is-t">
        pull →
      </text>
    </svg>
  );
}
