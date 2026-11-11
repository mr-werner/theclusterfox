import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, List, Plus, Ruler, Trash2 } from "lucide-react";
import { Canvas, At, Num, Choice as Select } from "./kit";
import { show, clamp, keyNudge } from "./helpers";
import Chart from "../components/Chart";
import { fmt, fromSI, toSI, unitLabel } from "../model/units";
import {
  parseSystem,
  stringifySystem,
  DUCT_MATERIALS,
  FITTINGS,
  COMPONENTS,
  fittingById,
  componentById,
  sizeRound,
  roundSizes,
  siteAir,
} from "../model/airsystem";

// The fan and duct path as a drawing you edit directly. Items sit in airflow
// order, left to right, wrapping onto new rows. Tap an item to select it: drag
// its handles to change length, size or pressure drop (the value shows on the
// drawing while you drag, and you can type into it), drag the item itself to
// move it, or drag a new item from the toolbar onto the drawing. Dropping a
// fitting or component onto the middle of a duct run splits the run in two.
// The selected item's full settings sit in a card under the drawing.

const KIND = { duct: "Duct run", fit: "Fitting", comp: "Component" };
const COLORS = { duct: "#5cc8ff", fit: "#ffc764", comp: "#c6a6ff" };
const US_LENGTHS = new Set(["in", "ft", "yd", "mi", "mil", "thou"]);

const FIT_GLYPH = {
  el90r: "90°", el90g5: "90°", el90g3: "90°", el45r: "45°", el90rr: "90°", el90mv: "90°", el90m: "90°", flex90: "90°",
  teeS: "T", teeB: "T↑", wyeB: "Y", red: "▷", exp: "◁", con: "▷", entB: "In", entP: "In", exit: "Out", damp: "D", fire: "FD", custom: "C",
};
const COMP_SHORT = {
  filt: "Filter", filt13: "Filter", ccoil: "Cool coil", hcoil: "Heat coil", vav: "VAV box", diff: "Diffuser", grille: "Grille",
  louv: "Louver", att: "Silencer", hood: "Hood", other: "Other",
};

// Drawing sizes, in drawing units (px at 1×).
const ROW_H = 168;
const TOP = 12;
const MARGIN = 18;
const START = 62; // room for the "air in" arrow on each row
const FIT_W = 58;
const COMP_W = 74;
const ductW = (it) => clamp(64 + Math.sqrt(Math.max(it.L, 0)) * 26, 78, 250);
const itemW = (it) => (it.kind === "duct" ? ductW(it) : it.kind === "fit" ? FIT_W : COMP_W);
const ductH = (it) => clamp(10 + (it.shape === "rect" ? it.b : it.D) * 80, 12, 54);
const compH = (it) => clamp(30 + Math.sqrt(Math.max(it.dp, 0)) * 2.2, 34, 70);

/** Where each item sits: rows that wrap at the drawing width. */
function layoutPath(items, W) {
  const right = W - MARGIN - 34;
  let row = 0;
  let x = START;
  const boxes = items.map((it) => {
    const w = itemW(it);
    if (x + w > right && x > START) {
      row += 1;
      x = START;
    }
    const cy = TOP + 84 + row * ROW_H;
    const box = { it, row, x0: x, x1: x + w, cx: x + w / 2, cy };
    x += w;
    return box;
  });
  const rows = row + 1;
  return { boxes, rows, H: TOP + rows * ROW_H + 8 };
}

/** Round a length to a tidy step in the person's unit. */
const snapIn = (si, dim, u, sig = 2) => {
  const v = fromSI(si, dim, u);
  if (!(v > 0)) return si;
  const mag = 10 ** (Math.floor(Math.log10(v)) - sig + 1);
  const step = v >= 10 ? Math.max(1, mag) : mag * (v < 2 ? 1 : 5);
  return toSI(Math.max(step, Math.round(v / step) * step), dim, u);
};

function useWidth(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const ductText = (it, unit) => {
  const u = unit("smallLength");
  const size = it.shape === "rect" ? `${fmt(fromSI(it.a, "smallLength", u), 3)}×${fmt(fromSI(it.b, "smallLength", u), 3)} ${unitLabel("smallLength", u)}` : `Ø${show(it.D, "smallLength", u)}`;
  return `${size} · ${show(it.L, "length", unit("length"))}`;
};

const itemName = (it, unit) => {
  if (it.kind === "duct") return `Duct ${ductText(it, unit)}`;
  if (it.kind === "fit") return `${fittingById[it.type].label}${it.n > 1 ? ` ×${it.n}` : ""}`;
  return componentById[it.type].label;
};

export default function FanSystemBuilder({ values: v, set, output, unit, setUnit }) {
  const items = parseSystem(v.model);
  const vis = output.visual?.type === "fan" ? output.visual : null;
  const rowFor = (i) => vis?.rows.find((r) => r.i === i);
  const [sel, setSelRaw] = useState(items.length ? 0 : null);
  const selIdx = sel !== null && sel < items.length ? sel : null;
  const setSel = (i) => setSelRaw(i);
  const [live, setLive] = useState(null); // the value being dragged right now: "L", "D", "dp" …
  const [drop, setDrop] = useState(null); // where a dragged item would land
  const [ghost, setGhost] = useState(null); // toolbar chip following the pointer
  const svgRef = useRef(null);
  const wrap = useRef(null);
  const avail = useWidth(wrap);
  const W = clamp(avail || 900, 340, 1100);
  const { boxes, H } = layoutPath(items, W);

  const save = (next) => set("model", stringifySystem(next));
  const update = (i, patch) => save(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const remove = (i) => {
    save(items.filter((_, k) => k !== i));
    setSel(items.length > 1 ? Math.min(i, items.length - 2) : null);
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
    setSel(j);
  };
  const duplicate = (i) => {
    const next = [...items];
    next.splice(i + 1, 0, { ...items[i] });
    save(next);
    setSel(i + 1);
  };
  const lastDuct = [...items].reverse().find((it) => it.kind === "duct");
  const fresh = (kind) =>
    kind === "duct"
      ? lastDuct
        ? { ...lastDuct, L: 3.048 }
        : { kind, shape: "round", D: 0.3048, L: 3.048, mat: "g" }
      : kind === "fit"
        ? { kind, type: "el90r", n: 1 }
        : { kind, type: "filt", dp: componentById.filt.dp };

  /** Put `it` into the path at a drop target, taking it out of `from` first when it's a move. */
  const place = (it, target, from = null) => {
    const list = from === null ? [...items] : items.filter((_, k) => k !== from);
    const fix = (k) => (from !== null && k > from ? k - 1 : k);
    if (target.split !== undefined) {
      const k = fix(target.split);
      const d = list[k];
      list.splice(k, 1, { ...d, L: d.L / 2 }, it, { ...d, L: d.L / 2 });
      save(list);
      setSel(k + 1);
      return;
    }
    const g = fix(target.gap);
    list.splice(g, 0, it);
    save(list);
    setSel(g);
  };

  /** The drop target under a point in drawing units, ignoring the item being moved. */
  const targetAt = (p, kind, from = null) => {
    const others = boxes.map((b, k) => ({ ...b, k })).filter((b) => b.k !== from);
    if (!others.length) return { gap: 0, x: START, cy: TOP + 84 };
    const row = clamp(Math.floor((p.y - TOP) / ROW_H), 0, Math.max(...others.map((b) => b.row)));
    const inRow = others.filter((b) => b.row === row);
    if (!inRow.length) return { gap: items.length, x: others[others.length - 1].x1, cy: others[others.length - 1].cy };
    const hit = inRow.find((b) => p.x >= b.x0 && p.x <= b.x1);
    if (hit && kind !== "duct" && hit.it.kind === "duct" && Math.abs(p.y - hit.cy) < 50) {
      const f = (p.x - hit.x0) / (hit.x1 - hit.x0);
      if (f > 0.25 && f < 0.75) return { split: hit.k, box: hit };
    }
    const after = inRow.find((b) => p.x < b.cx);
    if (after) return { gap: after.k, x: after.x0, cy: after.cy };
    const last = inRow[inRow.length - 1];
    return { gap: last.k + 1, x: last.x1, cy: last.cy };
  };

  const toLocal = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  };
  const scaleOf = () => {
    const svg = svgRef.current;
    return svg ? W / svg.getBoundingClientRect().width : 1;
  };

  // ── Toolbar chips: click to add after the selected item, or drag onto the drawing.
  const chip = useRef(null);
  const chipDown = (kind) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    chip.current = { kind, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const chipMove = (e) => {
    const c = chip.current;
    if (!c) return;
    if (!c.moved && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) return;
    c.moved = true;
    setGhost({ kind: c.kind, x: e.clientX, y: e.clientY });
    const p = toLocal(e.clientX, e.clientY);
    setDrop(p ? targetAt(p, c.kind) : null);
  };
  const chipUp = (e) => {
    const c = chip.current;
    chip.current = null;
    setGhost(null);
    setDrop(null);
    if (!c?.moved) return;
    const p = toLocal(e.clientX, e.clientY);
    if (p) place(fresh(c.kind), targetAt(p, c.kind));
    // The click that follows this pointerup shouldn't add a second item.
    chip.current = { dragged: true };
    setTimeout(() => (chip.current = null), 0);
  };
  const chipClick = (kind) => () => {
    if (chip.current?.dragged) return;
    const at = selIdx === null ? items.length : selIdx + 1;
    place(fresh(kind), { gap: at });
  };

  // ── Dragging an item to a new place.
  const grab = useRef(null);
  const itemDown = (i) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    setSel(i);
    grab.current = { i, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const itemMove = (e) => {
    const g = grab.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 8) return;
    g.moved = true;
    const p = toLocal(e.clientX, e.clientY);
    setDrop(p ? { ...targetAt(p, items[g.i].kind, g.i), moving: g.i, p } : null);
  };
  const itemUp = (e) => {
    const g = grab.current;
    grab.current = null;
    setDrop(null);
    if (!g?.moved) return;
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const t = targetAt(p, items[g.i].kind, g.i);
    if (t.gap === g.i || t.gap === g.i + 1) return; // same spot
    place(items[g.i], t, g.i);
  };

  const P = (x) => show(x, "airPressure", unit("airPressure"));
  const pu = unit("airPressure");
  const total = vis ? vis.rows.reduce((a, r) => a + r.dp, 0) : 0;
  const sizes = roundSizes(US_LENGTHS.has(unit("smallLength")) ? "us" : "si");
  const autoSize = () => {
    if (!(v.Q > 0)) return;
    const air = siteAir(v.z, v.T, v.rh);
    save(items.map((it) => (it.kind === "duct" && it.shape === "round" ? { ...it, D: sizeRound(Number.isFinite(it.Q) && it.Q > 0 ? it.Q : v.Q, air, it.mat, v.rate, v.vmax, sizes) } : it)));
  };

  const s = selIdx !== null ? boxes[selIdx] : null;
  const fanP = output.results.find((r) => r.id === "P");

  // ── The drawing.
  const path = [];
  const rowsUsed = boxes.length ? boxes[boxes.length - 1].row + 1 : 1;
  for (let r = 0; r < rowsUsed; r++) {
    const inRow = boxes.filter((b) => b.row === r);
    const cy = TOP + 84 + r * ROW_H;
    const x1 = inRow.length ? inRow[inRow.length - 1].x1 : START;
    path.push(`M${r === 0 ? MARGIN + 6 : START - 24},${cy} H${x1}`);
    if (r < rowsUsed - 1) path.push(`M${x1},${cy} H${W - MARGIN} V${cy + ROW_H / 2} H${START - 24} V${cy + ROW_H}`);
  }
  const lastBox = boxes[boxes.length - 1];

  const svg = (
    <>
      <rect x="0" y="0" width={W} height={H} fill="transparent" onPointerDown={() => setSel(null)} />
      <path d={path.join(" ")} className="fs-path" />
      <path d={`M${MARGIN},${TOP + 84 - 7} l12,7 l-12,7`} className="fs-arrow" />
      <text x={MARGIN} y={TOP + 84 - 16} className="fs-label is-dim">
        Air in
      </text>
      {lastBox && (
        <>
          <path d={`M${lastBox.x1 + 4},${lastBox.cy} h20 M${lastBox.x1 + 16},${lastBox.cy - 7} l9,7 l-9,7`} className="fs-arrow is-out" />
          <text x={lastBox.x1 + 6} y={lastBox.cy - 14} className="fs-label is-dim">
            Out
          </text>
        </>
      )}
      {boxes.map((b, i) => (
        <Item key={i} b={b} i={i} sel={selIdx === i} moving={drop?.moving === i} row={rowFor(i)} unit={unit} pu={pu} down={itemDown(i)} move={itemMove} up={itemUp} setSel={setSel} />
      ))}

      {/* Handles on the selected item. */}
      {s && s.it.kind === "duct" && (
        <>
          <Handle
            x={s.x1}
            y={s.cy}
            dir="x"
            label="Drag to change the duct length"
            item={s.it}
            scaleOf={scaleOf}
            onLive={(on) => setLive(on ? "L" : null)}
            onDrag={(b0, dx) => update(selIdx, { L: snapIn(b0.L * ((ductW(b0) + dx) / ductW(b0)) ** 2, "length", unit("length")) })}
            onStep={(k) => update(selIdx, { L: snapIn(Math.max(0.1, s.it.L * (1 + k * 0.1)), "length", unit("length")) })}
          />
          <Handle
            x={s.cx}
            y={s.cy - ductH(s.it) / 2}
            dir="y"
            label={s.it.shape === "rect" ? "Drag to change the duct height" : "Drag to change the duct diameter"}
            item={s.it}
            scaleOf={scaleOf}
            onLive={(on) => setLive(on ? (s.it.shape === "rect" ? "b" : "D") : null)}
            onDrag={(b0, dx, dy) => {
              if (b0.shape === "rect") return update(selIdx, { b: snapIn(Math.max(0.05, b0.b - dy / 80), "smallLength", unit("smallLength")) });
              update(selIdx, { D: sizes[clamp(nearestSize(sizes, b0.D) + Math.round(-dy / 10), 0, sizes.length - 1)] });
            }}
            onStep={(k) => {
              if (s.it.shape === "rect") return update(selIdx, { b: snapIn(Math.max(0.05, s.it.b * (1 + k * 0.1)), "smallLength", unit("smallLength")) });
              update(selIdx, { D: sizes[clamp(nearestSize(sizes, s.it.D) + k, 0, sizes.length - 1)] });
            }}
          />
        </>
      )}
      {s && s.it.kind === "comp" && (
        <Handle
          x={s.cx}
          y={s.cy - compH(s.it) / 2}
          dir="y"
          label="Drag to change the pressure drop"
          item={s.it}
          scaleOf={scaleOf}
          onLive={(on) => setLive(on ? "dp" : null)}
          onDrag={(b0, dx, dy) => update(selIdx, { dp: snapIn(Math.max(1, b0.dp * Math.exp(-dy / 70)), "airPressure", pu) })}
          onStep={(k) => update(selIdx, { dp: snapIn(Math.max(1, s.it.dp * (1 + k * 0.1)), "airPressure", pu) })}
        />
      )}
      {s && s.it.kind === "fit" && (
        <Handle
          x={s.cx}
          y={s.cy - 24}
          dir="y"
          label="Drag to change how many of this fitting"
          item={s.it}
          scaleOf={scaleOf}
          onLive={(on) => setLive(on ? "n" : null)}
          onDrag={(b0, dx, dy) => update(selIdx, { n: clamp(Math.round(b0.n - dy / 18), 1, 50) })}
          onStep={(k) => update(selIdx, { n: clamp(s.it.n + k, 1, 50) })}
        />
      )}

      {/* Where a dragged item would land. */}
      {drop && drop.split !== undefined && <rect x={drop.box.x0 + 2} y={drop.box.cy - 34} width={drop.box.x1 - drop.box.x0 - 4} height="68" rx="8" className="fs-drop is-split" />}
      {drop && drop.split !== undefined && (
        <text x={drop.box.cx} y={drop.box.cy + 50} textAnchor="middle" className="fs-label is-drop">
          Split this run
        </text>
      )}
      {drop && drop.gap !== undefined && <line x1={drop.x} x2={drop.x} y1={drop.cy - 38} y2={drop.cy + 38} className="fs-drop" />}
    </>
  );

  // Values you can type right on the drawing, beside the handles.
  const overlay = (key, label, dim, x, y, anchor, opts = {}) => (
    <At key={key} x={clamp(x, 70, W - 70)} y={y} anchor={anchor} className={`dg-on is-sel fs-on ${live === key ? "is-live" : ""}`}>
      <Num
        compact
        label={label}
        dim={dim}
        value={items[selIdx][key]}
        unit={opts.unit || unit(dim)}
        onValue={(x) => {
          if (Number.isFinite(x) && x > 0) update(selIdx, { [key]: opts.int ? Math.max(1, Math.round(x)) : x });
        }}
        onUnit={(u) => setUnit(dim, u)}
      />
    </At>
  );

  return (
    <div className="dg-builder fs">
      <div className="fs-top">
        <Num label="Fan airflow" dim="airflow" value={v.Q} unit={unit("airflow")} onValue={(x) => set("Q", x)} onUnit={(u) => setUnit("airflow", u)} />
        {vis && (
          <div className="ps-kpis" aria-live="polite">
            <div className="ps-kpi">
              <span>Path loss</span>
              <strong>{P(total)}</strong>
            </div>
            {fanP && (
              <div className="ps-kpi">
                <span>Fan pressure to select</span>
                <strong>{P(fanP.value)}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dg-add fs-add" role="group" aria-label="Add to the path">
        {["duct", "fit", "comp"].map((k) => (
          <button
            key={k}
            type="button"
            className={`fs-chip is-${k}`}
            style={{ "--fs-c": COLORS[k], touchAction: "none" }}
            onPointerDown={chipDown(k)}
            onPointerMove={chipMove}
            onPointerUp={chipUp}
            onPointerCancel={() => ((chip.current = null), setGhost(null), setDrop(null))}
            onClick={chipClick(k)}
            title={`Tap to add a ${KIND[k].toLowerCase()} after the selected item, or drag it onto the drawing`}
          >
            <Plus size={13} aria-hidden="true" /> {KIND[k]}
          </button>
        ))}
        <button type="button" onClick={autoSize} title="Pick the smallest standard round size for each round duct that meets the friction rate and velocity limit in More settings">
          <Ruler size={13} aria-hidden="true" /> Auto-size round ducts
        </button>
      </div>
      <p className="tf-muted tf-small fs-help">
        Tap an item to select it, then drag its handle. Drag an item to move it. Drag a new fitting or component onto the middle of a duct to split the run. Losses under each item are in {unitLabel("airPressure", pu)}.
      </p>

      <div ref={wrap} className="fs-canvas" data-report-figure="Duct path">
        <Canvas w={W} h={H} svg={svg} svgRef={svgRef} label="The duct path from intake to outlet, in airflow order" minWidth={W}>
          {s && s.it.kind === "duct" && (
            <>
              {overlay("L", "Length", "length", s.cx, s.cy + ductH(s.it) / 2 + 12, "t")}
              {s.it.shape === "rect"
                ? overlay("b", "Height", "smallLength", s.cx, s.cy - ductH(s.it) / 2 - 16, "b")
                : overlay("D", "Diameter", "smallLength", s.cx, s.cy - ductH(s.it) / 2 - 16, "b")}
            </>
          )}
          {s && s.it.kind === "comp" && overlay("dp", "Pressure drop", "airPressure", s.cx, s.cy - compH(s.it) / 2 - 16, "b")}
          {s && s.it.kind === "fit" && overlay("n", "How many", "none", s.cx, s.cy - 38, "b", { int: true, unit: "-" })}
          {items.length === 0 && (
            <At x={W / 2} y={TOP + 84} anchor="c">
              <p className="tf-muted tf-small">The path is empty. Add a duct run, fitting or component above.</p>
            </At>
          )}
        </Canvas>
      </div>

      {ghost && (
        <div className="fs-ghost" style={{ left: ghost.x, top: ghost.y, "--fs-c": COLORS[ghost.kind] }} aria-hidden="true">
          {KIND[ghost.kind]}
        </div>
      )}

      {selIdx !== null ? (
        <Editor key={selIdx} it={items[selIdx]} i={selIdx} n={items.length} row={rowFor(selIdx)} total={total} update={update} remove={remove} move={move} duplicate={duplicate} unit={unit} setUnit={setUnit} P={P} />
      ) : (
        items.length > 0 && <p className="tf-muted tf-small fs-none">Tap any item in the drawing to change it.</p>
      )}

      <details className="dg-list fs-list">
        <summary>
          <List size={14} aria-hidden="true" /> The path as a list ({items.length} {items.length === 1 ? "item" : "items"})
        </summary>
        <ol>
          {items.map((it, i) => {
            const r = rowFor(i);
            return (
              <li key={i}>
                <button type="button" className={selIdx === i ? "is-sel" : ""} style={{ "--fs-c": COLORS[it.kind] }} onClick={() => setSel(i)}>
                  <span className="fs-step">{i + 1}</span>
                  <span className="fs-list-name">{itemName(it, unit)}</span>
                  {r && <span className="tf-muted">{P(r.dp)}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </details>

      {vis && total > 0 && (
        <div className="fs-budget" aria-label="Where the pressure goes">
          <div className="fs-stack">
            {["comp", "fit", "duct"].map((k) => {
              const part = vis.rows.filter((r) => r.kind === k).reduce((a, r) => a + r.dp, 0);
              return part > 0 ? <i key={k} style={{ width: `${(part / total) * 100}%`, background: COLORS[k] }} title={`${KIND[k]}s: ${P(part)}`} /> : null;
            })}
          </div>
          <div className="tf-legend">
            {["comp", "fit", "duct"].map((k) => (
              <span key={k}>
                <i style={{ background: COLORS[k] }} />
                {k === "comp" ? "Components" : k === "fit" ? "Fittings" : "Duct friction"} {P(vis.rows.filter((r) => r.kind === k).reduce((a, r) => a + r.dp, 0))}
              </span>
            ))}
          </div>
        </div>
      )}

      {vis && vis.curve.length > 1 && (
        <details className="dg-list fs-curves" open={vis.fan ? true : undefined}>
          <summary>System curve{vis.fan ? " and fan curve" : ""}</summary>
          <div className="fs-chart">
            <h3 className="tf-visual-title">
              System curve{vis.fan ? " and fan curve" : ""} at your site
              {vis.fan?.op ? ` · fan runs at ${show(vis.fan.op.Q, "airflow", unit("airflow"))} and ${P(vis.fan.op.P)}` : ""}
            </h3>
            <Chart
              series={[
                { points: vis.curve, color: "#7be0c3", label: "System (no margin)" },
                ...(vis.fan ? [{ points: vis.fan.pts, color: "#ffab5c", label: "Fan at site air density" }] : []),
              ]}
              x={{ label: "Airflow", dim: "airflow", unit: unit("airflow"), min: 0 }}
              y={{ label: "Pressure", dim: "airPressure", unit: unit("airPressure"), min: 0 }}
              marker={vis.fan?.op ? { x: vis.fan.op.Q, y: vis.fan.op.P } : { x: vis.design.Q, y: vis.design.P }}
            />
            {!vis.fan && <p className="tf-muted tf-small">To see where a real fan would run, pick "Plot a fan from its catalog" under More settings.</p>}
          </div>
        </details>
      )}
    </div>
  );
}

const nearestSize = (sizes, D) => sizes.reduce((best, d, k) => (Math.abs(d - D) < Math.abs(sizes[best] - D) ? k : best), 0);

/** A drag handle. The value follows the pointer from where you grabbed it. */
function Handle({ x, y, dir, label, item, scaleOf, onLive, onDrag, onStep }) {
  const start = useRef(null);
  const stop = () => {
    start.current = null;
    onLive(false);
  };
  return (
    <g
      className="fs-handle-g"
      {...keyNudge(onStep)}
      aria-label={label}
      style={{ touchAction: "none", cursor: dir === "x" ? "ew-resize" : "ns-resize" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        start.current = { x: e.clientX, y: e.clientY, s: scaleOf(), item };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onLive(true);
      }}
      onPointerMove={(e) => {
        const st = start.current;
        if (st) onDrag(st.item, (e.clientX - st.x) * st.s, (e.clientY - st.y) * st.s);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <circle cx={x} cy={y} r="15" fill="transparent" />
      <circle cx={x} cy={y} r="8" className="dg-handle" />
      <path
        d={dir === "x" ? `M${x - 3},${y - 3} l-3,3 l3,3 M${x + 3},${y - 3} l3,3 l-3,3` : `M${x - 3},${y - 2} l3,-3 l3,3 M${x - 3},${y + 2} l3,3 l3,-3`}
        className="dg-handle-glyph"
      />
    </g>
  );
}

/** One item on the drawing. */
function Item({ b, i, sel, moving, row, unit, pu, down, move, up, setSel }) {
  const { it, x0, x1, cx, cy } = b;
  const c = COLORS[it.kind];
  const cls = `fs-it is-${it.kind} ${sel ? "is-sel" : ""} ${moving ? "is-moving" : ""}`;
  const loss = row ? fmt(fromSI(row.dp, "airPressure", pu), 3) : "";
  const w = x1 - x0;
  let shape, topY, label;
  if (it.kind === "duct") {
    const h = ductH(it);
    topY = cy - h / 2;
    shape = (
      <>
        <rect x={x0} y={cy - h / 2} width={w} height={h} rx={it.shape === "round" ? Math.min(h / 2, 8) : 2} className="fs-duct" style={{ "--fs-c": c }} />
        {it.mat === "f" && <path d={Array.from({ length: Math.floor(w / 8) }, (_, k) => `M${x0 + 4 + k * 8},${cy - h / 2 + 2} v${h - 4}`).join(" ")} className="fs-flex" />}
        {it.mat === "l" && <rect x={x0 + 2} y={cy - h / 2 + 2} width={w - 4} height={h - 4} rx="2" className="fs-liner" />}
      </>
    );
    const text = ductText(it, unit);
    label = text.length * 6.4 < w - 4 ? text : text.length * 6.4 < w + FIT_W ? text.split(" · ")[0] : "";
  } else if (it.kind === "fit") {
    topY = cy - 16;
    shape = (
      <>
        <rect x={cx - 16} y={cy - 16} width="32" height="32" rx="8" className="fs-fit" style={{ "--fs-c": c }} />
        <text x={cx} y={cy + 4.5} textAnchor="middle" className="fs-glyph">
          {FIT_GLYPH[it.type] || "C"}
        </text>
        {it.n > 1 && (
          <text x={cx + 18} y={cy - 12} className="fs-count">
            ×{it.n}
          </text>
        )}
      </>
    );
  } else {
    const h = compH(it);
    topY = cy - h / 2;
    shape = (
      <>
        <rect x={cx - 30} y={cy - h / 2} width="60" height={h} rx="6" className="fs-comp" style={{ "--fs-c": c }} />
        {(it.type === "filt" || it.type === "filt13") && <path d={Array.from({ length: 6 }, (_, k) => `M${cx - 24 + k * 9},${cy - h / 2 + 4} l6,${h - 8}`).join(" ")} className="fs-hatch" />}
        {(it.type === "ccoil" || it.type === "hcoil") && <path d={`M${cx - 24},${cy} ${Array.from({ length: 8 }, (_, k) => `L${cx - 21 + k * 6},${cy + (k % 2 ? 7 : -7)}`).join(" ")}`} className="fs-hatch" />}
        <text x={cx} y={cy + h / 2 - 5} textAnchor="middle" className="fs-comp-text">
          {COMP_SHORT[it.type] || "Item"}
        </text>
      </>
    );
  }
  return (
    <g
      className={cls}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      tabIndex={0}
      role="button"
      aria-label={`${i + 1}: ${KIND[it.kind]}`}
      aria-pressed={sel}
      onFocus={() => setSel(i)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(i))}
      style={{ touchAction: "none", cursor: "grab" }}
    >
      <rect x={x0} y={cy - 46} width={w} height="92" fill="transparent" />
      {shape}
      {!sel && (
        <>
          <text x={cx} y={topY - 8} textAnchor="middle" className="fs-label">
            <tspan className="fs-num" fill={c}>
              {i + 1}
            </tspan>
            {label ? `  ${label}` : ""}
          </text>
          {loss && (
            <text x={cx} y={cy + 52} textAnchor="middle" className={`fs-label is-dim ${row?.orphan ? "is-warn" : ""}`}>
              {row?.orphan ? "no duct" : `−${loss}`}
            </text>
          )}
        </>
      )}
    </g>
  );
}

/** The full settings of the selected item. */
function Editor({ it, i, n, row, total, update, remove, move, duplicate, unit, setUnit, P }) {
  const field = (key, label, dim, opts = {}) => (
    <Num
      label={label}
      dim={dim}
      value={it[key]}
      unit={unit(dim)}
      onUnit={(u) => setUnit(dim, u)}
      onValue={(x) => {
        if (Number.isFinite(x) && x >= 0) update(i, { [key]: opts.int ? Math.max(1, Math.round(x)) : x });
        else if (opts.optional) update(i, { [key]: undefined });
      }}
    />
  );
  const vu = unit("velocity") === "ft/s" ? "fpm" : unit("velocity");
  const share = total > 0 && row ? row.dp / total : 0;
  return (
    <section className={`fs-edit is-${it.kind}`} style={{ "--fs-c": COLORS[it.kind] }} aria-label={`Item ${i + 1}`}>
      <header className="fs-edit-head">
        <span className="fs-step">{i + 1}</span>
        <strong className="fs-edit-name">{KIND[it.kind]}</strong>
        <div className="fs-tools">
          <button type="button" className="dg-item-del" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier in the path" title="Move earlier">
            <ArrowLeft size={15} />
          </button>
          <button type="button" className="dg-item-del" onClick={() => move(i, 1)} disabled={i === n - 1} aria-label="Move later in the path" title="Move later">
            <ArrowRight size={15} />
          </button>
          <button type="button" className="dg-item-del" onClick={() => duplicate(i)} aria-label="Duplicate" title="Duplicate">
            <Copy size={15} />
          </button>
          <button type="button" className="dg-item-del is-danger" onClick={() => remove(i)} aria-label={`Remove this ${KIND[it.kind].toLowerCase()}`} title="Remove">
            <Trash2 size={15} />
          </button>
        </div>
      </header>
      <div className="dg-item-fields fs-edit-fields">
        {it.kind === "duct" && (
          <>
            <Select
              label="Shape"
              value={it.shape}
              options={[
                { value: "round", label: "Round" },
                { value: "rect", label: "Rectangular" },
              ]}
              onChange={(s) => update(i, s === "rect" ? { shape: s, a: it.a || it.D || 0.3, b: it.b || it.D || 0.3 } : { shape: s, D: it.D || Math.sqrt(it.a * it.b) })}
            />
            {it.shape === "round" ? field("D", "Diameter", "smallLength") : (
              <>
                {field("a", "Width", "smallLength")}
                {field("b", "Height", "smallLength")}
              </>
            )}
            {field("L", "Length", "length")}
            <Select label="Material" value={it.mat} options={DUCT_MATERIALS.map((m) => ({ value: m.id, label: m.label }))} onChange={(mat) => update(i, { mat })} />
            {field("Q", "Airflow (blank = fan)", "airflow", { optional: true })}
          </>
        )}
        {it.kind === "fit" && (
          <>
            <Select label="Fitting" value={it.type} options={FITTINGS.map((f) => ({ value: f.id, label: f.label }))} onChange={(type) => update(i, { type, C: undefined })} />
            {field("n", "How many", "none", { int: true })}
            <Num
              label={Number.isFinite(it.C) ? "Loss coefficient C" : "Loss coefficient C (typical)"}
              dim="none"
              value={Number.isFinite(it.C) ? it.C : fittingById[it.type].C}
              unit="-"
              onValue={(x) => update(i, { C: Number.isFinite(x) && x >= 0 ? x : undefined })}
              onUnit={() => {}}
            />
          </>
        )}
        {it.kind === "comp" && (
          <>
            <Select label="Component" value={it.type} options={COMPONENTS.map((c) => ({ value: c.id, label: c.label }))} onChange={(type) => update(i, { type, dp: componentById[type].dp })} />
            {field("dp", "Pressure drop at design airflow", "airPressure")}
          </>
        )}
      </div>
      {row && (
        <div className="fs-out">
          <span className="fs-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, share * 100).toFixed(1)}%` }} />
          </span>
          <strong>{P(row.dp)}</strong>
          {row.kind === "duct" && (
            <span className="tf-muted">
              {show(row.v, "velocity", vu)} · {show(row.rate, "pressureGradient", unit("pressureGradient"))}
            </span>
          )}
          {row.kind === "fit" && !row.orphan && <span className="tf-muted">at {show(row.v, "velocity", vu)}</span>}
          {row.kind === "fit" && row.orphan && <span className="fs-warn">Needs a duct beside it</span>}
          <span className="tf-muted">{fmt(share * 100, 2)}% of the path</span>
        </div>
      )}
    </section>
  );
}
