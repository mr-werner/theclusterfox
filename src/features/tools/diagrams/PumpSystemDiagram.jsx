import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Maximize2, Minus, Plus, Trash2 } from "lucide-react";
import { Num, Pick, Pills } from "./kit";
import { show, clamp } from "./helpers";
import { PIPE_KINDS, FITTINGS, fittingById, pipeKind, sizesFor, runGeometry, runLabel, parseModel, stringifyModel } from "../model/pumpSystem";

// Pump system builder: an elevation sketch of the whole system that fits the
// screen and zooms (buttons, pinch or ctrl+scroll), with the supply, each pipe
// run and the destination edited in cards underneath.

export default function PumpSystemDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const runs = parseModel(v.model);
  const sRuns = runs.filter((r) => r.side === "s");
  const dRuns = runs.filter((r) => r.side === "d");
  const [sel, setSel] = useState(null); // "s0", "d2", …
  const save = (s, d) => set("model", stringifyModel([...s, ...d]));
  const vis = output.visual?.type === "pump" ? output.visual : null;
  const fluid = calc.inputs.find((i) => i.id === "fluid");

  const listOps = (side) => {
    const list = side === "s" ? sRuns : dRuns;
    const put = (next) => (side === "s" ? save(next, dRuns) : save(sRuns, next));
    return {
      list,
      update: (i, patch) => put(list.map((r, k) => (k === i ? { ...r, ...patch } : r))),
      remove: (i) => {
        put(list.filter((_, k) => k !== i));
        setSel(null);
      },
      move: (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        put(next);
        setSel(`${side}${j}`);
      },
      copy: (i) => {
        const next = [...list];
        const dup = { ...list[i], fit: { ...list[i].fit }, name: list[i].name ? `${list[i].name} (copy)` : "" };
        delete dup.fit.exit;
        delete dup.fit.entSharp;
        next.splice(i + 1, 0, dup);
        put(next);
        setSel(`${side}${i + 1}`);
      },
      add: () => {
        const last = list[list.length - 1] || (side === "s" ? dRuns[0] : sRuns[sRuns.length - 1]);
        const base = last ? { kind: last.kind, size: last.size, D: last.D, eps: last.eps } : { kind: "s40", size: "3" };
        const run = { side, ...base, L: 5, dz: 0, fit: {}, dp: 0, name: "" };
        const next = list.map((r) => ({ ...r, fit: { ...r.fit } }));
        // The exit loss belongs to whichever run is now last.
        if (side === "d" && next.length && next[next.length - 1].fit.exit) {
          delete next[next.length - 1].fit.exit;
          run.fit.exit = 1;
        }
        if (side === "s" && next.length === 0) run.fit.entSharp = 1;
        if (side === "d" && next.length === 0) run.fit.exit = 1;
        put([...next, run]);
        setSel(`${side}${list.length}`);
      },
    };
  };
  const S = listOps("s");
  const D = listOps("d");
  const rowFor = (side, i) => (side === "s" ? vis?.s.sRows[i] : vis?.s.dRows[i]);

  return (
    <div className="ps">
      <div className="ps-top">
        <Num label="Design flow" dim="flow" value={v.Q} unit={unit("flow")} onValue={(x) => set("Q", x)} onUnit={(u) => setUnit("flow", u)} />
        <Pick label="Fluid" options={fluid.options} value={presetValue("fluid")} onPick={(label) => pick("fluid", label)} />
        {vis && (
          <div className="ps-kpis" aria-live="polite">
            <Kpi label="NPSH available" value={show(vis.s.NPSHa, "length", unit("length"))} tone={vis.NPSHr > 0 ? (vis.s.NPSHa < vis.NPSHr ? "bad" : vis.s.NPSHa < vis.NPSHr * 1.3 ? "warn" : "ok") : ""} />
            <Kpi label="Total head" value={show(vis.s.TDH, "length", unit("length"))} />
            {vis.op && <Kpi label="Pump settles at" value={show(vis.op.Q, "flow", unit("flow"))} />}
          </div>
        )}
      </div>

      {vis && <Sketch vis={vis} sRuns={sRuns} dRuns={dRuns} unit={unit} sel={sel} setSel={setSel} />}

      <div className="ps-cols">
        <div className="ps-col">
          <section className="ps-panel" aria-label="Supply">
            <h3 className="ps-h">Supply</h3>
            <div className="ps-fields">
              <Pills label="Supply type" value={v.src} onChange={(x) => set("src", x)} options={[{ value: "open", label: "Open tank" }, { value: "closed", label: "Closed tank" }]} />
              <Num label="Liquid level above pump (− if below)" dim="length" value={v.zs} unit={unit("length")} onValue={(x) => set("zs", x)} onUnit={(u) => setUnit("length", u)} />
              {v.src === "closed" && <Num label="Pressure above liquid (gauge)" dim="pressure" value={v.srcP} unit={unit("pressure")} onValue={(x) => set("srcP", x)} onUnit={(u) => setUnit("pressure", u)} />}
            </div>
          </section>
          <RunList title="Suction piping" sub="From the supply to the pump, in flow order." side="s" ops={S} rowFor={rowFor} sel={sel} setSel={setSel} unit={unit} setUnit={setUnit} />
        </div>
        <div className="ps-col">
          <RunList title="Discharge piping" sub="From the pump to the end, in flow order." side="d" ops={D} rowFor={rowFor} sel={sel} setSel={setSel} unit={unit} setUnit={setUnit} />
          <section className="ps-panel" aria-label="Destination">
            <h3 className="ps-h">Destination</h3>
            <div className="ps-fields">
              <Pills label="Destination type" value={v.dst} onChange={(x) => set("dst", x)} options={[{ value: "tank", label: "Into a tank" }, { value: "free", label: "Open pipe end" }]} />
              {v.dst === "tank" && (
                <>
                  <Num label="Liquid level above pump" dim="length" value={v.zd} unit={unit("length")} onValue={(x) => set("zd", x)} onUnit={(u) => setUnit("length", u)} />
                  <Num label="Pressure in tank (gauge)" dim="pressure" value={v.dstP} unit={unit("pressure")} onValue={(x) => set("dstP", x)} onUnit={(u) => setUnit("pressure", u)} />
                </>
              )}
              {v.dst === "free" && vis && <p className="tf-muted tf-small">The pipe ends {show(vis.s.outletZ, "length", unit("length"))} above the pump (the sum of the discharge rises).</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "" }) {
  return (
    <div className={`ps-kpi ${tone ? `is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RunList({ title, sub, side, ops, rowFor, sel, setSel, unit, setUnit }) {
  return (
    <section className="ps-panel" aria-label={title}>
      <h3 className="ps-h">{title}</h3>
      <p className="tf-muted tf-small ps-sub">{sub}</p>
      <div className="ps-runs">
        {ops.list.length === 0 && <p className="tf-muted tf-small">No runs yet.</p>}
        {ops.list.map((r, i) => (
          <RunCard key={i} run={r} i={i} n={ops.list.length} side={side} ops={ops} row={rowFor(side, i)} selected={sel === `${side}${i}`} setSel={setSel} unit={unit} setUnit={setUnit} />
        ))}
      </div>
      <button type="button" className="ps-add" onClick={ops.add}>
        <Plus size={15} aria-hidden="true" /> Add a {side === "s" ? "suction" : "discharge"} run
      </button>
    </section>
  );
}

function RunCard({ run, i, n, side, ops, row, selected, setSel, unit, setUnit }) {
  const ref = useRef(null);
  const tag = `${side === "s" ? "S" : "D"}${i + 1}`;
  const k = pipeKind(run.kind);
  const sizes = sizesFor(run.kind);
  const up = (patch) => ops.update(i, patch);
  const len = (key, label, dim = "length") => <Num label={label} dim={dim} value={run[key]} unit={unit(dim)} onValue={(x) => Number.isFinite(x) && up({ [key]: x })} onUnit={(u) => setUnit(dim, u)} />;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const setKind = (id) => {
    const nk = pipeKind(id);
    const { D } = runGeometry(run);
    if (!nk.table) return up({ kind: id, D, eps: nk.eps, size: undefined });
    const list = sizesFor(id);
    const same = list.find((s) => s.size === run.size);
    const near = list.reduce((b, s) => (Math.abs(s.ID - D) < Math.abs(b.ID - D) ? s : b), list[0]);
    up({ kind: id, size: (same || near).size });
  };
  const fits = Object.entries(run.fit || {}).filter(([id, c]) => fittingById[id] && c > 0);
  const setFit = (id, c) => {
    const fit = { ...run.fit };
    if (c > 0) fit[id] = c;
    else delete fit[id];
    up({ fit });
  };

  return (
    <article ref={ref} className={`ps-run ${selected ? "is-sel" : ""}`} onFocusCapture={() => setSel(`${side}${i}`)} onPointerDownCapture={() => setSel(`${side}${i}`)}>
      <header className="ps-run-head">
        <span className="ps-tag">{tag}</span>
        <input className="ps-name" value={run.name} placeholder={runLabel(run)} onChange={(e) => up({ name: e.target.value.replace(/[|,*+~]/g, " ") })} aria-label={`${tag} name`} maxLength={40} />
        <div className="ps-run-btns">
          <button type="button" onClick={() => ops.move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
            <ArrowUp size={15} />
          </button>
          <button type="button" onClick={() => ops.move(i, 1)} disabled={i === n - 1} aria-label="Move down" title="Move down">
            <ArrowDown size={15} />
          </button>
          <button type="button" onClick={() => ops.copy(i)} aria-label="Duplicate" title="Duplicate">
            <Copy size={15} />
          </button>
          <button type="button" className="is-danger" onClick={() => ops.remove(i)} aria-label={`Remove ${tag}`} title="Remove">
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="ps-fields">
        <label className="dg-pick">
          <span className="dg-num-label">Pipe</span>
          <select value={run.kind} onChange={(e) => setKind(e.target.value)}>
            {PIPE_KINDS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {k.table ? (
          <label className="dg-pick">
            <span className="dg-num-label">Size</span>
            <select value={run.size} onChange={(e) => up({ size: e.target.value })}>
              {sizes.map((s) => (
                <option key={s.size} value={s.size}>
                  {s.size}″
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            {len("D", "Inside diameter", "smallLength")}
            {len("eps", "Roughness ε", "smallLength")}
          </>
        )}
        {len("L", "Length")}
        {len("dz", "Rise (− for a drop)")}
      </div>

      <div className="ps-fits" role="list" aria-label={`${tag} fittings`}>
        {fits.map(([id, c]) => (
          <div key={id} role="listitem" className="ps-fit">
            <span>{fittingById[id].name}</span>
            <div className="ps-stepper">
              <button type="button" onClick={() => setFit(id, c - 1)} aria-label={`One fewer ${fittingById[id].name}`}>
                <Minus size={13} />
              </button>
              <strong aria-label="Count">{c}</strong>
              <button type="button" onClick={() => setFit(id, c + 1)} aria-label={`One more ${fittingById[id].name}`}>
                <Plus size={13} />
              </button>
            </div>
          </div>
        ))}
        <label className="ps-fit-add">
          <Plus size={14} aria-hidden="true" />
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setFit(e.target.value, (run.fit?.[e.target.value] || 0) + 1);
            }}
            aria-label={`Add a fitting to ${tag}`}
          >
            <option value="">Add a fitting or valve…</option>
            {FITTINGS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="ps-more" open={run.dp ? true : undefined}>
        <summary>Equipment in this run (coil, filter, meter…)</summary>
        <div className="ps-fields">{len("dp", "Pressure drop at design flow", "pressure")}</div>
      </details>

      {row && (
        <p className="ps-run-out">
          <span>
            Velocity <strong>{show(row.v, "velocity", unit("velocity"))}</strong>
          </span>
          <span>
            Loss <strong>{show(row.h, "length", unit("length"))}</strong>
          </span>
          {row.Re < 2300 && <span className="ps-note">Laminar</span>}
        </p>
      )}
    </article>
  );
}

// ── The elevation sketch ─────────────────────────────────────────────────

function useWidth(ref) {
  const [w, setW] = useState(900);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Zoomable box: the drawing always fits at 1×; zoom with buttons, pinch or ctrl+scroll. */
function ZoomBox({ children, label }) {
  const box = useRef(null);
  const [zoom, setZoom] = useState(1);
  const pts = useRef(new Map());
  const pinch = useRef(null);
  const zoomTo = (z, cx = 0.5, cy = 0.5) => {
    const el = box.current;
    const nz = clamp(Number(z.toFixed(2)), 1, 4);
    if (!el) return setZoom(nz);
    // Keep the point under the fingers (or the middle) where it was.
    const fx = (el.scrollLeft + cx * el.clientWidth) / el.scrollWidth;
    const fy = (el.scrollTop + cy * el.clientHeight) / el.scrollHeight;
    setZoom(nz);
    requestAnimationFrame(() => {
      el.scrollLeft = fx * el.scrollWidth - cx * el.clientWidth;
      el.scrollTop = fy * el.scrollHeight - cy * el.clientHeight;
    });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setZoom((z) => {
        const nz = clamp(Number((z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)).toFixed(2)), 1, 4);
        const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
        const fx = (el.scrollLeft + cx * el.clientWidth) / el.scrollWidth;
        const fy = (el.scrollTop + cy * el.clientHeight) / el.scrollHeight;
        requestAnimationFrame(() => {
          el.scrollLeft = fx * el.scrollWidth - cx * el.clientWidth;
          el.scrollTop = fy * el.scrollHeight - cy * el.clientHeight;
        });
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType !== "touch") return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
    }
  };
  const onPointerMove = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2 && pinch.current) {
      const [a, b] = [...pts.current.values()];
      const r = box.current.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(pinch.current.z * (d / pinch.current.d), ((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height);
    }
  };
  const end = (e) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
  };

  return (
    <div className="ps-zoom">
      <div className="ps-zoom-btns" role="group" aria-label="Zoom the drawing">
        <button type="button" onClick={() => zoomTo(zoom / 1.4)} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out">
          <Minus size={16} />
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomTo(zoom * 1.4)} disabled={zoom >= 4} aria-label="Zoom in" title="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomTo(1)} disabled={zoom === 1} aria-label="Fit the whole system" title="Fit the whole system">
          <Maximize2 size={15} /> Fit
        </button>
      </div>
      <div ref={box} className="ps-zoom-box" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end} aria-label={label}>
        <div style={{ width: `${zoom * 100}%` }}>{children}</div>
      </div>
    </div>
  );
}

function Sketch({ vis, sRuns, dRuns, unit, sel, setSel }) {
  const wrap = useRef(null);
  const cw = useWidth(wrap);
  const W = clamp(cw || 900, 560, 1000);
  const H = W < 700 ? 420 : 460;
  const { s, zs, zd, dst, src } = vis;
  const lu = unit("length");

  // Vertical: real elevations. Horizontal: a schematic share for each run.
  const zs_ = [0, zs, s.inletZ, s.outletZ, dst === "tank" ? zd : s.outletZ, ...s.nodes.map((n) => n.z)];
  let zMin = Math.min(...zs_), zMax = Math.max(...zs_);
  const span = Math.max(zMax - zMin, 1);
  zMin -= span * 0.12;
  zMax += span * 0.18;
  const top = 34, bot = H - 30;
  const sy = (z) => bot - ((z - zMin) / (zMax - zMin)) * (bot - top);

  const tankW = W * 0.11;
  const xSrc0 = 54, xSrc1 = xSrc0 + tankW;
  const xPump = W * 0.46;
  const xDst1 = W - 18, xDst0 = xDst1 - tankW;
  const xEnd = dst === "tank" ? xDst0 - 6 : W - 60;

  const horiz = (r) => Math.sqrt(Math.max(r.L * r.L - r.dz * r.dz, 0));
  const layout = (list, x0, x1, z0) => {
    const w = list.map((r) => Math.max(0.6, Math.sqrt(horiz(r) + 0.5)));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    let x = x0, z = z0;
    return list.map((r, i) => {
      const xa = x, xb = x + ((x1 - x0) * w[i]) / tot;
      const za = z, zb = z + r.dz;
      x = xb;
      z = zb;
      return { r, xa, xb, za, zb };
    });
  };
  const sLay = layout(sRuns, xSrc1, xPump - 26, s.inletZ);
  const dLay = layout(dRuns, xPump + 26, xEnd, 0);
  const thick = (r) => clamp(4 + runGeometry(r).D * 60, 4, 14);

  const pipe = (seg, side, i) => {
    const id = `${side}${i}`;
    const on = sel === id;
    // Horizontal, then the rise or drop at the far end.
    const xm = seg.r.dz ? seg.xb - Math.min(18, (seg.xb - seg.xa) * 0.3) : seg.xb;
    const d = `M${seg.xa},${sy(seg.za)} H${xm} L${seg.xb},${sy(seg.zb)}`;
    const row = side === "s" ? s.sRows[i] : s.dRows[i];
    const tag = `${side === "s" ? "S" : "D"}${i + 1}`;
    const lx = (seg.xa + xm) / 2;
    const ly = sy(seg.za) - thick(seg.r) / 2 - 8;
    // Long labels only where the run has room for them.
    const room = xm - seg.xa;
    const name = `${tag} · ${runLabel(seg.r).replace(/ \(.*\)/, "")}`;
    const label = name.length * 7 < room ? name : tag;
    const sub = row ? `${show(row.v, "velocity", unit("velocity"))} · −${show(row.h, "length", lu)}` : "";
    return (
      <g key={id} className={`ps-pipe ${on ? "is-sel" : ""}`} onClick={() => setSel(id)} role="button" tabIndex={0} aria-label={`${tag}: ${seg.r.name || runLabel(seg.r)}`} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(id))}>
        <path d={d} className="ps-pipe-hit" />
        <path d={d} className="ps-pipe-wall" style={{ strokeWidth: thick(seg.r) + 4 }} />
        <path d={d} className="ps-pipe-bore" style={{ strokeWidth: thick(seg.r) }} />
        <text x={lx} y={ly} textAnchor="middle" className="ps-label">
          {label}
        </text>
        {sub && sub.length * 6.5 < room && (
          <text x={lx} y={sy(seg.za) + thick(seg.r) / 2 + 17} textAnchor="middle" className="ps-label is-dim">
            {sub}
          </text>
        )}
        <circle cx={seg.xb} cy={sy(seg.zb)} r="3.5" className="ps-joint" />
      </g>
    );
  };

  // Tanks.
  const tank = (x0, x1, level, bottom, closed, label) => {
    const yTop = Math.min(sy(level) - 28, sy(bottom) - 40);
    const yBot = Math.max(sy(bottom) + 16, sy(level) + 30);
    return (
      <g className="ps-tank">
        <rect x={x0} y={sy(level)} width={x1 - x0} height={Math.max(0, yBot - sy(level))} className="ps-liquid" />
        <path d={closed ? `M${x0},${yTop} H${x1} V${yBot} H${x0} Z` : `M${x0},${yTop} V${yBot} H${x1} V${yTop}`} className="ps-tank-wall" />
        <path d={`M${(x0 + x1) / 2 - 7},${sy(level) - 12} h14 l-7,10 Z`} className="ps-level-mark" />
        <text x={(x0 + x1) / 2} y={yTop - 8} textAnchor="middle" className="ps-label">
          {label}
        </text>
        <text x={(x0 + x1) / 2} y={sy(level) - 16} textAnchor="middle" className="ps-label is-dim">
          {level >= 0 ? "+" : ""}
          {show(level, "length", lu)}
        </text>
      </g>
    );
  };

  const yP = sy(0);

  // Elevation ticks.
  const step = (() => {
    const raw = (zMax - zMin) / 5;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw);
  })();
  const ticks = [];
  for (let z = Math.ceil(zMin / step) * step; z <= zMax; z += step) ticks.push(Number(z.toPrecision(10)));

  return (
    <div ref={wrap} className="ps-sketch">
      <ZoomBox label="Elevation sketch of the pump system">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Side view of the pump system, drawn to true elevation">
          {ticks.map((z) => (
            <g key={z} className="ps-tick">
              <line x1={40} x2={W - 8} y1={sy(z)} y2={sy(z)} />
              <text x={36} y={sy(z) + 4} textAnchor="end">
                {show(z, "length", lu).replace(/ .*/, "")}
              </text>
            </g>
          ))}
          <text x={8} y={18} className="ps-label is-dim">
            Elevation ({show(0, "length", lu).replace(/^[^ ]* /, "")}) · not to scale sideways
          </text>
          <line x1={40} x2={W - 8} y1={yP} y2={yP} className="ps-centerline" />

          {tank(xSrc0, xSrc1, zs, Math.min(s.inletZ, zs), src === "closed", "Supply")}
          {dst === "tank" && tank(xDst0, xDst1, zd, Math.min(s.outletZ, zd), false, "Destination")}

          {sLay.map((seg, i) => pipe(seg, "s", i))}
          {dLay.map((seg, i) => pipe(seg, "d", i))}
          {/* Short stubs from the last run into the pump. */}
          {sLay.length > 0 && <line x1={sLay[sLay.length - 1].xb} x2={xPump - 20} y1={yP} y2={yP} className="ps-stub" />}
          {dLay.length > 0 && <line x1={xPump + 20} x2={dLay[0].xa} y1={yP} y2={yP} className="ps-stub" />}
          {dst === "free" && dLay.length > 0 && (
            <path d={`M${xEnd + 6},${sy(s.outletZ)} q22,4 30,34`} className="ps-spray" />
          )}

          <g className="ps-pump">
            <circle cx={xPump} cy={yP} r="22" />
            <path d={`M${xPump - 10},${yP + 8} L${xPump + 12},${yP} L${xPump - 10},${yP - 8} Z`} />
          </g>
          <text x={xPump} y={yP + 40} textAnchor="middle" className="ps-label">
            Pump
          </text>
        </svg>
      </ZoomBox>
    </div>
  );
}
