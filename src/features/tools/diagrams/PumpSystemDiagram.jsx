import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Maximize2, Minus, Pencil, Plus, Printer, Trash2, Undo2, X } from "lucide-react";
import { Num, Pick, Pills } from "./kit";
import { show, clamp } from "./helpers";
import { fromSI, toSI, fmt, unitLabel } from "../model/units";
import Chart from "../components/Chart";
import {
  PIPE_KINDS,
  FITTINGS,
  EQUIPMENT,
  fittingById,
  equipmentById,
  pipeKind,
  sizesFor,
  runGeometry,
  runLabel,
  parseModel,
  stringifyModel,
  isEquip,
  newEquipment,
  tagsFor,
  jointZ,
  jointMovable,
  moveJoint,
  insertEquipment,
  addFitting,
  removeItem,
} from "../model/pumpSystem";
import "./pumpSystem.css";

// Pump system builder: an elevation sketch of the whole system you can edit
// directly. Drag tank levels, the tank outlet, pipe joints and equipment up and
// down; drag equipment or valves from the palette onto a pipe to splice them in.
// Every drag shows the value it changes, and tapping that value lets you type it.
// The supply, each pipe run and the destination are also edited in cards below.

const VALVES = ["gate", "ball", "bfly", "globe", "swing", "el90"];
const VALVE_GLYPH = new Set(["gate", "ball", "bfly", "plug", "globe", "angle", "swing", "lift", "tilt"]);
const REPORT_KEY = "toolfox-pump-report";

export default function PumpSystemDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const runs = parseModel(v.model);
  const sRuns = runs.filter((r) => r.side === "s");
  const dRuns = runs.filter((r) => r.side === "d");
  const [sel, setSel] = useState(null); // "s0", "d2", …
  const [focus, setFocus] = useState(null); // the value chip on the drawing
  const [placing, setPlacing] = useState(null); // palette item being placed
  const [note, setNote] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const vis = output.visual?.type === "pump" ? output.visual : null;
  const fluid = calc.inputs.find((i) => i.id === "fluid");

  const save = (s, d) => set("model", stringifyModel([...s, ...d]));
  const saveSide = (side, list) => (side === "s" ? save(list, dRuns) : save(sRuns, list));
  const snapshot = () => setHistory((h) => [...h.slice(-49), { model: v.model, zs: v.zs, zd: v.zd }]);
  const undo = () => {
    const h = history[history.length - 1];
    if (!h) return;
    setHistory(history.slice(0, -1));
    set("model", h.model);
    set("zs", h.zs);
    set("zd", h.zd);
    setFocus(null);
  };
  const noteTimer = useRef(0);
  const flash = (text) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 2600);
  };

  const listOps = (side) => {
    const list = side === "s" ? sRuns : dRuns;
    const put = (next) => saveSide(side, next);
    return {
      list,
      update: (i, patch) => put(list.map((r, k) => (k === i ? { ...r, ...patch } : r))),
      remove: (i) => {
        snapshot();
        put(removeItem(list, i));
        setSel(null);
        setFocus(null);
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
        const dup = { ...list[i], fit: { ...list[i].fit }, name: list[i].name ? `${list[i].name} (copy)`.slice(0, 40) : "" };
        delete dup.fit.exit;
        delete dup.fit.entSharp;
        next.splice(i + 1, 0, dup);
        put(next);
        setSel(`${side}${i + 1}`);
      },
      add: () => {
        const pipes = (side === "s" ? [...sRuns, ...dRuns] : [...dRuns].reverse().concat([...sRuns].reverse())).filter((r) => !isEquip(r));
        const last = side === "s" ? pipes[sRuns.filter((r) => !isEquip(r)).length - 1] || pipes[0] : pipes[0];
        const base = last ? { kind: last.kind, size: last.size, D: last.D, eps: last.eps } : { kind: "s40", size: "3" };
        const run = { side, ...base, L: 5, dz: 0, fit: {}, dp: 0, name: "" };
        const next = list.map((r) => ({ ...r, fit: { ...r.fit } }));
        // The exit loss belongs to whichever run is now last.
        const lastPipe = [...next].reverse().find((r) => !isEquip(r));
        if (side === "d" && lastPipe?.fit.exit) {
          delete lastPipe.fit.exit;
          run.fit.exit = 1;
        }
        if (side === "s" && !next.some((r) => !isEquip(r))) run.fit.entSharp = 1;
        if (side === "d" && !next.some((r) => !isEquip(r))) run.fit.exit = 1;
        put([...next, run]);
        setSel(`${side}${list.length}`);
      },
      addEquip: (id) => {
        put([...list, newEquipment(side, id)]);
        setSel(`${side}${list.length}`);
      },
    };
  };
  const S = listOps("s");
  const D = listOps("d");
  const rowFor = (side, i) => {
    const row = side === "s" ? vis?.s.sRows[i] : vis?.s.dRows[i];
    return row && { ...row, rho: v.rho };
  };

  // Tank outlet / main tap height and where the discharge ends: set by moving the joint, so the pipe on it follows.
  const sZ = jointZ(sRuns, "s");
  const dZ = jointZ(dRuns, "d");
  const outletOk = jointMovable(sRuns, "s", 0);
  const endOk = jointMovable(dRuns, "d", dRuns.length);
  const setOutlet = (z) => Number.isFinite(z) && outletOk && saveSide("s", moveJoint(sRuns, "s", 0, z));
  const setEnd = (z) => Number.isFinite(z) && endOk && saveSide("d", moveJoint(dRuns, "d", dRuns.length, z));

  const edit = { save, saveSide, snapshot, set, flash, setSel, setFocus, setPlacing };

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
        <button type="button" className="ps-print-btn" onClick={() => setPrintOpen((o) => !o)} aria-expanded={printOpen}>
          <Printer size={16} aria-hidden="true" /> Print report
        </button>
      </div>
      {printOpen && <PrintPanel onClose={() => setPrintOpen(false)} />}

      {vis && (
        <Sketch
          vis={vis}
          sRuns={sRuns}
          dRuns={dRuns}
          unit={unit}
          setUnit={setUnit}
          sel={sel}
          focus={focus}
          placing={placing}
          note={note}
          edit={edit}
          canUndo={history.length > 0}
          undo={undo}
        />
      )}

      <div className="ps-cols">
        <div className="ps-col">
          <section className="ps-panel" aria-label="Supply">
            <h3 className="ps-h">Supply</h3>
            <div className="ps-fields">
              <Pills
                label="Supply type"
                value={v.src}
                onChange={(x) => set("src", x)}
                options={[
                  { value: "open", label: "Open tank" },
                  { value: "closed", label: "Closed tank" },
                  { value: "main", label: "Water main" },
                ]}
              />
              {v.src === "main" ? (
                <Num label="Pressure in the main (gauge)" dim="pressure" value={v.mainP} unit={unit("pressure")} onValue={(x) => set("mainP", x)} onUnit={(u) => setUnit("pressure", u)} />
              ) : (
                <Num label="Liquid level above pump (− if below)" dim="length" value={v.zs} unit={unit("length")} onValue={(x) => set("zs", x)} onUnit={(u) => setUnit("length", u)} />
              )}
              {outletOk ? (
                <Num label={v.src === "main" ? "Tap height above pump" : "Tank outlet height above pump"} dim="length" value={sZ[0]} unit={unit("length")} onValue={setOutlet} onUnit={(u) => setUnit("length", u)} />
              ) : (
                <p className="tf-muted tf-small">Add a suction pipe to set the {v.src === "main" ? "tap" : "outlet"} height. Right now the pump is right on it.</p>
              )}
              {v.src === "closed" && <Num label="Pressure above liquid (gauge)" dim="pressure" value={v.srcP} unit={unit("pressure")} onValue={(x) => set("srcP", x)} onUnit={(u) => setUnit("pressure", u)} />}
            </div>
            {outletOk && <p className="tf-muted tf-small ps-sub">The first suction pipe stays connected and stretches when this height changes.</p>}
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
              {endOk && <Num label={v.dst === "tank" ? "Pipe enters the tank at" : "Pipe ends at (above pump)"} dim="length" value={dZ[dZ.length - 1]} unit={unit("length")} onValue={setEnd} onUnit={(u) => setUnit("length", u)} />}
            </div>
            {endOk && <p className="tf-muted tf-small ps-sub">The last discharge pipe stays connected and stretches when this height changes.</p>}
          </section>
        </div>
      </div>

      {vis && <PumpReport calc={calc} v={v} vis={vis} output={output} sRuns={sRuns} dRuns={dRuns} unit={unit} presetValue={presetValue} />}
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

// ── Cards ─────────────────────────────────────────────────────────────────

function RunList({ title, sub, side, ops, rowFor, sel, setSel, unit, setUnit }) {
  const tags = tagsFor(ops.list, side);
  return (
    <section className="ps-panel" aria-label={title}>
      <h3 className="ps-h">{title}</h3>
      <p className="tf-muted tf-small ps-sub">{sub}</p>
      <div className="ps-runs">
        {ops.list.length === 0 && <p className="tf-muted tf-small">No runs yet.</p>}
        {ops.list.map((r, i) =>
          isEquip(r) ? (
            <EquipCard key={i} run={r} i={i} n={ops.list.length} tag={tags[i]} side={side} ops={ops} row={rowFor(side, i)} selected={sel === `${side}${i}`} setSel={setSel} unit={unit} setUnit={setUnit} />
          ) : (
            <RunCard key={i} run={r} i={i} n={ops.list.length} tag={tags[i]} side={side} ops={ops} row={rowFor(side, i)} selected={sel === `${side}${i}`} setSel={setSel} unit={unit} setUnit={setUnit} />
          )
        )}
      </div>
      <div className="ps-add-row">
        <button type="button" className="ps-add" onClick={ops.add}>
          <Plus size={15} aria-hidden="true" /> Add a {side === "s" ? "suction" : "discharge"} run
        </button>
        <label className="ps-add ps-add-pick">
          <Plus size={15} aria-hidden="true" />
          <select value="" onChange={(e) => e.target.value && ops.addEquip(e.target.value)} aria-label={`Add equipment to the ${side === "s" ? "suction" : "discharge"} side`}>
            <option value="">Add equipment…</option>
            {EQUIPMENT.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function CardButtons({ i, n, tag, ops }) {
  return (
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
  );
}

function useScrollWhenSelected(ref, selected) {
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [ref, selected]);
}

function EquipCard({ run, i, n, tag, side, ops, row, selected, setSel, unit, setUnit }) {
  const ref = useRef(null);
  useScrollWhenSelected(ref, selected);
  const up = (patch) => ops.update(i, patch);
  const useCv = run.cv > 0;
  return (
    <article ref={ref} className={`ps-run is-equip ${selected ? "is-sel" : ""}`} onFocusCapture={() => setSel(`${side}${i}`)} onPointerDownCapture={() => setSel(`${side}${i}`)}>
      <header className="ps-run-head">
        <span className="ps-tag is-equip">{tag}</span>
        <input className="ps-name" value={run.name} placeholder={runLabel(run)} onChange={(e) => up({ name: e.target.value.replace(/[|,*+~]/g, " ") })} aria-label={`${tag} name`} maxLength={40} />
        <CardButtons i={i} n={n} tag={tag} ops={ops} />
      </header>
      <div className="ps-fields">
        <label className="dg-pick">
          <span className="dg-num-label">Equipment</span>
          <select value={run.eq} onChange={(e) => up({ eq: e.target.value, dp: equipmentById[e.target.value].dp, cv: 0 })}>
            {EQUIPMENT.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </label>
        {useCv ? (
          <Num label="Cv (US gpm at 1 psi)" dim="none" value={run.cv} unit="" onValue={(x) => Number.isFinite(x) && x > 0 && up({ cv: x })} onUnit={() => {}} />
        ) : (
          <Num label="Pressure drop at design flow" dim="pressure" value={run.dp} unit={unit("pressure")} onValue={(x) => Number.isFinite(x) && up({ dp: Math.max(0, x) })} onUnit={(u) => setUnit("pressure", u)} />
        )}
        <Pills
          label="Rate by"
          value={useCv ? "cv" : "dp"}
          onChange={(x) => up(x === "cv" ? { cv: equipmentById[run.eq]?.cv || 50 } : { cv: 0 })}
          options={[
            { value: "dp", label: "Pressure drop" },
            { value: "cv", label: "Cv" },
          ]}
        />
      </div>
      {row && (
        <p className="ps-run-out">
          <span>
            Loss <strong>{show(row.h, "length", unit("length"))}</strong>
          </span>
          <span>
            Drop <strong>{show(row.h * 9.80665 * row.rho, "pressure", unit("pressure"))}</strong>
          </span>
        </p>
      )}
    </article>
  );
}

function RunCard({ run, i, n, tag, side, ops, row, selected, setSel, unit, setUnit }) {
  const ref = useRef(null);
  useScrollWhenSelected(ref, selected);
  const k = pipeKind(run.kind);
  const sizes = sizesFor(run.kind);
  const up = (patch) => ops.update(i, patch);
  const len = (key, label, dim = "length") => <Num label={label} dim={dim} value={run[key]} unit={unit(dim)} onValue={(x) => Number.isFinite(x) && up({ [key]: x })} onUnit={(u) => setUnit(dim, u)} />;

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
        <CardButtons i={i} n={n} tag={tag} ops={ops} />
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
        <summary>Extra pressure drop in this run</summary>
        <div className="ps-fields">{len("dp", "Pressure drop at design flow", "pressure")}</div>
        <p className="tf-muted tf-small">For a filter, meter or coil you'd rather see on the drawing, drag it from the palette onto the pipe instead.</p>
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
function ZoomBox({ children, label, tools }) {
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
        const cx = (e.clientX - r.left) / r.width,
          cy = (e.clientY - r.top) / r.height;
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
      <div className="ps-zoom-bar">
        {tools}
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
      </div>
      <div ref={box} className="ps-zoom-box" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end} aria-label={label}>
        <div className="ps-zoom-inner" style={{ width: `${zoom * 100}%` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const EQW = 46;

/** Where everything sits on the drawing. Vertical is true elevation; sideways is a schematic share per run. */
function layoutSystem(vis, sRuns, dRuns, W, H, range) {
  const { zs, zd, dst, src } = vis;
  const sZ = jointZ(sRuns, "s");
  const dZ = jointZ(dRuns, "d");
  let zMin, zMax;
  if (range) ({ zMin, zMax } = range);
  else {
    const all = [0, ...sZ, ...dZ, src === "main" ? sZ[0] : zs, dst === "tank" ? zd : dZ[dZ.length - 1]];
    zMin = Math.min(...all);
    zMax = Math.max(...all);
    const span = Math.max(zMax - zMin, 1);
    zMin -= span * 0.14;
    zMax += span * 0.2;
  }
  const top = 40,
    bot = H - 30;
  const sy = (z) => bot - ((z - zMin) / (zMax - zMin)) * (bot - top);
  const zAt = (y) => zMin + ((bot - y) / (bot - top)) * (zMax - zMin);

  const tankW = W * 0.11;
  const xSrc0 = 54,
    xSrc1 = xSrc0 + tankW;
  const xPump = W * 0.46;
  const xDst1 = W - 18,
    xDst0 = xDst1 - tankW;
  const xEnd = dst === "tank" ? xDst0 : W - 60;

  const lay = (list, Z, x0, x1, side) => {
    const flat = (r) => Math.max(r.L - Math.abs(r.dz), 0);
    const nEq = list.filter(isEquip).length;
    const w = list.map((r) => (isEquip(r) ? 0 : Math.max(0.6, Math.sqrt(flat(r) + Math.abs(r.dz) * 0.3 + 0.5))));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    const room = Math.max(x1 - x0 - nEq * EQW, 36 * (list.length - nEq));
    let x = x0;
    return list.map((r, i) => {
      const xa = x,
        xb = x + (isEquip(r) ? EQW : (room * w[i]) / tot);
      x = xb;
      const ya = sy(Z[i]),
        yb = sy(Z[i + 1]);
      const xm = !isEquip(r) && Math.abs(yb - ya) > 0.5 ? xb - Math.min(22, (xb - xa) * 0.35) : xb;
      return { r, i, side, xa, xb, xm, ya, yb, za: Z[i], zb: Z[i + 1] };
    });
  };
  const sLay = lay(sRuns, sZ, xSrc1, xPump - 24, "s");
  const dLay = lay(dRuns, dZ, xPump + 24, xEnd, "d");

  const step = (() => {
    const raw = (zMax - zMin) / 5;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw);
  })();
  const ticks = [];
  for (let z = Math.ceil(zMin / step) * step; z <= zMax; z += step) ticks.push(Number(z.toPrecision(10)));

  return { W, H, sy, zAt, zMin, zMax, sZ, dZ, sLay, dLay, xSrc0, xSrc1, xPump, xDst0, xDst1, xEnd, ticks, yP: sy(0) };
}

/** Nearest pipe to a point, with how far along it (0…1 of its real length) the point is. */
function hitPipe(geo, px, py, maxD = 26) {
  let best = null;
  for (const seg of [...geo.sLay, ...geo.dLay]) {
    if (isEquip(seg.r)) continue;
    const flat = Math.max(seg.r.L - Math.abs(seg.r.dz), 0);
    const rise = Math.abs(seg.r.dz);
    const tot = flat + rise || 1;
    const parts = [
      [seg.xa, seg.ya, seg.xm, seg.ya, 0, flat / tot],
      [seg.xm, seg.ya, seg.xb, seg.yb, flat / tot, 1],
    ];
    for (const [x1, y1, x2, y2, a0, a1] of parts) {
      const dx = x2 - x1,
        dy = y2 - y1;
      const L2 = dx * dx + dy * dy;
      if (L2 < 1e-6) continue;
      const t = clamp(((px - x1) * dx + (py - y1) * dy) / L2, 0, 1);
      const qx = x1 + t * dx,
        qy = y1 + t * dy;
      const d = Math.hypot(px - qx, py - qy);
      if (d <= maxD && (!best || d < best.d)) best = { side: seg.side, i: seg.i, at: a0 + t * (a1 - a0), x: qx, y: qy, d };
    }
  }
  return best;
}

const niceStep = (raw) => {
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw);
};
const signed = (z, lu) => `${z > 1e-9 ? "+" : ""}${show(Math.abs(z) < 1e-9 ? 0 : z, "length", lu)}`;

function Sketch({ vis, sRuns, dRuns, unit, setUnit, sel, focus, placing, note, edit, canUndo, undo }) {
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const cw = useWidth(wrap);
  const W = clamp(cw || 900, 560, 1000);
  const H = W < 700 ? 440 : 480;
  const [range, setRange] = useState(null); // held steady while dragging
  const [hover, setHover] = useState(null); // drop target while placing or moving equipment
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const drag = useRef(null);
  const justPlaced = useRef(false);
  const geo = layoutSystem(vis, sRuns, dRuns, W, H, range);
  const { sy, sLay, dLay, sZ, dZ, xSrc0, xSrc1, xPump, xDst0, xDst1, xEnd, yP } = geo;
  const { s, zs, zd, dst, src } = vis;
  const lu = unit("length");
  const sTags = tagsFor(sRuns, "s");
  const dTags = tagsFor(dRuns, "d");
  const tagOf = (side, i) => (side === "s" ? sTags[i] : dTags[i]);
  const listOf = (side) => (side === "s" ? sRuns : dRuns);

  const toLocal = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const snap = (z, fine) => {
    const disp = fromSI(z, "length", lu);
    const span = fromSI(geo.zMax - geo.zMin, "length", lu);
    const st = niceStep(span / (fine ? 600 : 150));
    return toSI(Number((Math.round(disp / st) * st).toPrecision(10)), "length", lu);
  };

  // ── Dragging handles ──
  const startDrag = (e, target) => {
    e.stopPropagation();
    e.preventDefault();
    const p = toLocal(e);
    drag.current = { target, start: { s: sRuns, d: dRuns }, x: p.x, y: p.y, moved: false, drop: null, pointerId: e.pointerId };
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setRange({ zMin: geo.zMin, zMax: geo.zMax });
    setEditing(false);
    edit.setFocus(target);
    if (target.t === "joint" || target.t === "equip") edit.setSel(target.t === "equip" ? `${target.side}${target.i}` : null);
  };
  const applyDrag = (t, Z, start) => {
    if (t.t === "zs") edit.set("zs", Z);
    else if (t.t === "zd") edit.set("zd", Z);
    else if (t.t === "joint" || t.t === "equip") {
      const k = t.t === "equip" ? t.i : t.k;
      const next = moveJoint(start[t.side], t.side, k, Z);
      edit.save(t.side === "s" ? next : start.s, t.side === "d" ? next : start.d);
    }
  };
  const onMove = (e) => {
    const p = toLocal(e);
    if (!p) return;
    const dr = drag.current;
    if (!dr) {
      if (placing?.armed) setHover(hitPipe(geo, p.x, p.y, 30));
      return;
    }
    if (!dr.moved && Math.hypot(p.x - dr.x, p.y - dr.y) < 4) return;
    if (!dr.moved) {
      dr.moved = true;
      edit.snapshot();
      setDragging(true);
    }
    const t = dr.target;
    // Equipment dragged well sideways onto another pipe moves there instead.
    if (t.t === "equip" && Math.abs(p.x - dr.x) > 36) {
      const hit = hitPipe(geo, p.x, p.y, 30);
      dr.drop = hit;
      setHover(hit);
      if (hit) {
        edit.save(dr.start.s, dr.start.d);
        return;
      }
    } else if (dr.drop) {
      dr.drop = null;
      setHover(null);
    }
    applyDrag(t, snap(geo.zAt(p.y), e.shiftKey), dr.start);
  };
  const onUp = () => {
    const dr = drag.current;
    if (!dr) return;
    drag.current = null;
    setDragging(false);
    setRange(null);
    setHover(null);
    const t = dr.target;
    if (dr.moved && t.t === "equip" && dr.drop) {
      const lists = { s: [...dr.start.s], d: [...dr.start.d] };
      const item = lists[t.side][t.i];
      const to = dr.drop;
      lists[to.side] = insertEquipment(lists[to.side], to.i, to.at, item);
      let fi = t.i;
      if (to.side === t.side && to.i < t.i) fi += 2;
      lists[t.side] = removeItem(lists[t.side], fi);
      edit.save(lists.s, lists.d);
      edit.setFocus(null);
      edit.setSel(null);
      edit.flash(`Moved the ${runLabel(item).toLowerCase()} to ${tagOf(to.side, to.i)}.`);
    }
  };

  // ── Placing from the palette ──
  const place = (item, hit) => {
    const list = listOf(hit.side);
    justPlaced.current = true;
    setTimeout(() => (justPlaced.current = false), 400);
    edit.snapshot();
    if (item.kind === "eq") {
      edit.saveSide(hit.side, insertEquipment(list, hit.i, hit.at, newEquipment(hit.side, item.id)));
      edit.setSel(`${hit.side}${hit.i + 1}`);
      edit.setFocus({ t: "equip", side: hit.side, i: hit.i + 1 });
      edit.flash(`Added a ${equipmentById[item.id].name.toLowerCase()} and split ${tagOf(hit.side, hit.i)} around it.`);
    } else {
      edit.saveSide(hit.side, addFitting(list, hit.i, item.id));
      edit.setSel(`${hit.side}${hit.i}`);
      edit.setFocus({ t: "pipe", side: hit.side, i: hit.i });
      edit.flash(`Added a ${fittingById[item.id].name.toLowerCase()} to ${tagOf(hit.side, hit.i)}.`);
    }
  };
  useEffect(() => {
    if (!placing || placing.armed) return;
    const move = (e) => {
      const p = toLocal(e);
      edit.setPlacing((cur) => cur && { ...cur, cx: e.clientX, cy: e.clientY, moved: cur.moved || Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) > 6 });
      setHover(p ? hitPipe(geo, p.x, p.y, 30) : null);
    };
    const up = (e) => {
      const p = toLocal(e);
      const hit = p && hitPipe(geo, p.x, p.y, 30);
      setHover(null);
      if (hit) {
        place(placing, hit);
        edit.setPlacing(null);
      } else if (!placing.moved) edit.setPlacing({ ...placing, armed: true });
      else edit.setPlacing(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });
  useEffect(() => {
    if (!placing?.armed) return;
    const key = (e) => e.key === "Escape" && edit.setPlacing(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const onSvgDown = (e) => {
    const h = !placing?.armed && e.target.closest?.("[data-h]");
    if (h) return startDrag(e, JSON.parse(h.getAttribute("data-h")));
    if (placing?.armed) {
      const p = toLocal(e);
      const hit = p && hitPipe(geo, p.x, p.y, 34);
      if (hit) {
        place(placing, hit);
        edit.setPlacing(null);
        setHover(null);
      }
      return;
    }
    // A tap on empty drawing clears the value chip.
    if (e.target === svgRef.current || e.target.classList?.contains("ps-bg")) {
      edit.setFocus(null);
      setEditing(false);
    }
  };

  const pickPipe = (side, i) => {
    if (placing?.armed || justPlaced.current) return;
    edit.setSel(`${side}${i}`);
    edit.setFocus({ t: "pipe", side, i });
    setEditing(false);
  };

  // Keyboard: arrows nudge the focused handle, Enter opens the value.
  const nudge = (target) => ({
    tabIndex: 0,
    role: "slider",
    onFocus: () => edit.setFocus(target),
    onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        edit.setFocus(target);
        setEditing(true);
        return;
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const cur = valueOf(target);
      if (!Number.isFinite(cur)) return;
      const st = toSI(niceStep(fromSI(geo.zMax - geo.zMin, "length", lu) / (e.shiftKey ? 15 : 150)), "length", lu);
      edit.snapshot();
      applyDrag(target, snap(cur + (e.key === "ArrowUp" ? st : -st)), { s: sRuns, d: dRuns });
    },
  });
  const valueOf = (t) => (t.t === "zs" ? zs : t.t === "zd" ? zd : t.t === "joint" ? (t.side === "s" ? sZ : dZ)[t.k] : t.t === "equip" ? (t.side === "s" ? sZ : dZ)[t.i] : NaN);

  // ── Drawing pieces ──
  const thick = (r) => clamp(4 + runGeometry(r).D * 60, 4, 14);
  const pathOf = (seg) => `M${seg.xa},${seg.ya} H${seg.xm} L${seg.xb},${seg.yb}`;

  const pipe = (seg) => {
    const { side, i, r } = seg;
    const id = `${side}${i}`;
    const on = sel === id;
    const tag = tagOf(side, i);
    const row = side === "s" ? s.sRows[i] : s.dRows[i];
    const d = pathOf(seg);
    const lx = (seg.xa + seg.xm) / 2;
    const room = seg.xm - seg.xa;
    const name = `${tag} · ${runLabel(r).replace(/ \(.*\)/, "")}`;
    const label = name.length * 7 < room ? name : room > 22 ? tag : "";
    const sub = row ? `${show(row.v, "velocity", unit("velocity"))} · −${show(row.h, "length", lu)}` : "";
    const target = hover && hover.side === side && hover.i === i;
    const valves = Object.entries(r.fit || {}).filter(([fid, n]) => VALVE_GLYPH.has(fid) && n > 0);
    const nGlyph = Math.min(valves.reduce((a, [, n]) => a + n, 0), 3);
    return (
      <g
        key={id}
        className={`ps-pipe ${on ? "is-sel" : ""} ${target ? "is-target" : ""}`}
        onClick={() => pickPipe(side, i)}
        role="button"
        tabIndex={0}
        aria-label={`${tag}: ${r.name || runLabel(r)}`}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pickPipe(side, i))}
      >
        <path d={d} className="ps-pipe-hit" />
        <path d={d} className="ps-pipe-wall" style={{ strokeWidth: thick(r) + 4 }} />
        <path d={d} className="ps-pipe-bore" style={{ strokeWidth: thick(r) }} />
        {nGlyph > 0 &&
          room > 30 &&
          Array.from({ length: nGlyph }, (_, k) => {
            const gx = seg.xa + (room * (k + 1)) / (nGlyph + 1);
            return <path key={k} d={`M${gx - 7},${seg.ya - 7} L${gx + 7},${seg.ya + 7} V${seg.ya - 7} L${gx - 7},${seg.ya + 7} Z`} className="ps-valve" />;
          })}
        {label && (
          <text x={lx} y={seg.ya - thick(r) / 2 - 9} textAnchor="middle" className="ps-label">
            {label}
          </text>
        )}
        {sub && sub.length * 6.5 < room && (
          <text x={lx} y={seg.ya + thick(r) / 2 + 17} textAnchor="middle" className="ps-label is-dim">
            {sub}
          </text>
        )}
      </g>
    );
  };

  const equip = (seg) => {
    const { side, i, r } = seg;
    const cx = (seg.xa + seg.xb) / 2,
      cy = seg.ya;
    const on = sel === `${side}${i}`;
    const t = { t: "equip", side, i };
    return (
      <g
        key={`${side}${i}`}
        className={`ps-equip ${on ? "is-sel" : ""}`}
        data-h={JSON.stringify(t)}
        style={{ touchAction: "none" }}
        aria-label={`${tagOf(side, i)}: ${r.name || runLabel(r)}. Drag up or down to change its elevation, or sideways onto another pipe to move it.`}
        aria-valuetext={show(seg.za, "length", lu)}
        {...nudge(t)}
      >
        <line x1={seg.xa} x2={seg.xb} y1={cy} y2={cy} className="ps-stub" />
        <EquipGlyph id={r.eq} cx={cx} cy={cy} />
        <text x={cx} y={cy - 21} textAnchor="middle" className="ps-label is-small">
          {r.name ? r.name.slice(0, 12) : equipmentById[r.eq]?.short}
        </text>
      </g>
    );
  };

  const jointHandle = (side, k, x, y, label) => {
    const t = { t: "joint", side, k };
    const on = focus?.t === "joint" && focus.side === side && focus.k === k;
    return (
      <g key={`j${side}${k}`} className={`ps-handle ${on ? "is-on" : ""}`} data-h={JSON.stringify(t)} style={{ touchAction: "none" }} aria-label={`${label}. Drag up or down to change its elevation.`} aria-valuetext={show((side === "s" ? sZ : dZ)[k], "length", lu)} {...nudge(t)}>
        <circle cx={x} cy={y} r="16" className="ps-handle-hit" />
        <circle cx={x} cy={y} r="6" className="ps-handle-dot" />
      </g>
    );
  };

  // Joints you can drag: every joint between two pipes, plus the free ends.
  const handles = [];
  const jointsFor = (side, list, lay) => {
    for (let k = 0; k <= list.length; k++) {
      if (!jointMovable(list, side, k)) continue;
      if ((k > 0 && isEquip(list[k - 1])) || (k < list.length && isEquip(list[k]))) continue; // equipment is its own handle
      const x = k < list.length ? lay[k].xa : lay[k - 1].xb;
      const y = sy((side === "s" ? sZ : dZ)[k]);
      const label = side === "s" && k === 0 ? (src === "main" ? "Tap on the main" : "Tank outlet") : side === "d" && k === list.length ? (dst === "tank" ? "Where the pipe enters the tank" : "Pipe outlet") : `Joint after ${tagOf(side, k - 1)}`;
      if (side === "s" && k === 0 && src === "main") continue; // the main itself is the handle
      handles.push(jointHandle(side, k, x, y, label));
    }
  };
  jointsFor("s", sRuns, sLay);
  jointsFor("d", dRuns, dLay);

  const tank = (x0, x1, level, nozzle, closed, label, which) => {
    const hiZ = Math.max(level, nozzle),
      loZ = Math.min(level, nozzle);
    const yTop = Math.min(sy(hiZ) - 30, sy(loZ) - 44);
    const yBot = Math.max(sy(loZ) + 18, sy(hiZ) + 32);
    const ly = sy(level);
    const t = { t: which };
    const on = focus?.t === which;
    return (
      <g className="ps-tank">
        <rect x={x0} y={ly} width={x1 - x0} height={Math.max(0, yBot - ly)} className="ps-liquid" />
        <path d={closed ? `M${x0},${yTop} H${x1} V${yBot} H${x0} Z` : `M${x0},${yTop} V${yBot} H${x1} V${yTop}`} className="ps-tank-wall" />
        <text x={(x0 + x1) / 2} y={yTop - 8} textAnchor="middle" className="ps-label">
          {label}
        </text>
        <g className={`ps-handle ps-level ${on ? "is-on" : ""}`} data-h={JSON.stringify(t)} style={{ touchAction: "none" }} aria-label={`${label} liquid level. Drag up or down to change it.`} aria-valuetext={show(level, "length", lu)} {...nudge(t)}>
          <rect x={x0} y={ly - 14} width={x1 - x0} height="28" className="ps-handle-hit" />
          <line x1={x0 + 2} x2={x1 - 2} y1={ly} y2={ly} className="ps-level-line" />
          <path d={`M${(x0 + x1) / 2 - 8},${ly - 13} h16 l-8,11 Z`} className="ps-level-mark" />
        </g>
      </g>
    );
  };

  const main = () => {
    const y = sy(sZ[0]);
    const cx = xSrc1 - 20;
    const t = { t: "joint", side: "s", k: 0 };
    const on = focus?.t === "joint" && focus.side === "s" && focus.k === 0;
    const movable = jointMovable(sRuns, "s", 0);
    return (
      <g className="ps-main">
        <line x1={cx} x2={xSrc1} y1={y} y2={y} className="ps-stub" />
        <g className={`ps-handle ${on ? "is-on" : ""}`} data-h={movable ? JSON.stringify(t) : undefined} style={{ touchAction: "none" }} {...nudge(t)} aria-label="Water main. Drag up or down to change the tap height.">
          <circle cx={cx} cy={y} r="22" className="ps-main-pipe" />
          <circle cx={cx} cy={y} r="5" className="ps-main-dot" />
        </g>
        <text x={cx} y={y - 30} textAnchor="middle" className="ps-label">
          Water main
        </text>
        <text x={cx} y={y + 40} textAnchor="middle" className="ps-label is-dim">
          {show(vis.srcP, "pressure", unit("pressure"))}
        </text>
      </g>
    );
  };

  // ── The value chip ──
  const chip = focus ? chipFor(focus) : null;
  function chipFor(f) {
    const list = f.side ? listOf(f.side) : null;
    const Z = f.side === "s" ? sZ : dZ;
    const setJoint = (side, k) => (z) => Number.isFinite(z) && edit.saveSide(side, moveJoint(listOf(side), side, k, z));
    const pipeNote = (side, i) => {
      const r = listOf(side)[i];
      return r && !isEquip(r) ? `${tagOf(side, i)} rise ${signed(r.dz, lu)} · ${show(r.L, "length", lu)} long` : null;
    };
    if (f.t === "zs" || f.t === "zd") {
      const z = f.t === "zs" ? zs : zd;
      const x = f.t === "zs" ? (xSrc0 + xSrc1) / 2 : (xDst0 + xDst1) / 2;
      return { x, y: sy(z) - 16, title: f.t === "zs" ? "Supply level" : "Destination level", value: signed(z, lu), fields: [{ label: "Liquid level above pump", dim: "length", value: z, onValue: (x2) => Number.isFinite(x2) && edit.set(f.t, x2) }] };
    }
    if (f.t === "joint") {
      if (!list || f.k > list.length) return null;
      const lay = f.side === "s" ? sLay : dLay;
      const x = f.k < list.length ? lay[f.k]?.xa : lay[f.k - 1]?.xb;
      if (x === undefined) return null;
      const title = f.side === "s" && f.k === 0 ? (src === "main" ? "Tap height" : "Tank outlet") : f.side === "d" && f.k === list.length ? (dst === "tank" ? "Tank inlet" : "Pipe outlet") : `Joint ${tagOf(f.side, f.k - 1)}→${tagOf(f.side, f.k)}`;
      const notes = [f.k > 0 && pipeNote(f.side, f.k - 1), f.k < list.length && pipeNote(f.side, f.k)].filter(Boolean);
      return { x, y: sy(Z[f.k]) - 14, title, value: signed(Z[f.k], lu), notes, fields: [{ label: "Elevation above pump", dim: "length", value: Z[f.k], onValue: setJoint(f.side, f.k) }] };
    }
    if (f.t === "equip") {
      const r = list?.[f.i];
      if (!r || !isEquip(r)) return null;
      const seg = (f.side === "s" ? sLay : dLay)[f.i];
      const up = (patch) => edit.saveSide(f.side, list.map((x, k) => (k === f.i ? { ...x, ...patch } : x)));
      const fields = [{ label: "Elevation above pump", dim: "length", value: Z[f.i], onValue: setJoint(f.side, f.i) }];
      fields.push(r.cv > 0 ? { label: "Cv", dim: "none", value: r.cv, onValue: (x2) => x2 > 0 && up({ cv: x2 }) } : { label: "Drop at design flow", dim: "pressure", value: r.dp, onValue: (x2) => Number.isFinite(x2) && up({ dp: Math.max(0, x2) }) });
      return {
        x: (seg.xa + seg.xb) / 2,
        y: seg.ya - 30,
        title: r.name || equipmentById[r.eq]?.name,
        value: signed(Z[f.i], lu),
        notes: [r.cv > 0 ? `Cv ${fmt(r.cv, 3)}` : `${show(r.dp, "pressure", unit("pressure"))} at design flow`],
        fields,
        remove: () => {
          edit.snapshot();
          edit.saveSide(f.side, removeItem(list, f.i));
          edit.setFocus(null);
          edit.setSel(null);
        },
      };
    }
    if (f.t === "pipe") {
      const r = list?.[f.i];
      if (!r || isEquip(r)) return null;
      const seg = (f.side === "s" ? sLay : dLay)[f.i];
      const up = (patch) => edit.saveSide(f.side, list.map((x, k) => (k === f.i ? { ...x, ...patch } : x)));
      return {
        x: (seg.xa + seg.xm) / 2,
        y: seg.ya - thick(r) / 2 - 24,
        title: `${tagOf(f.side, f.i)} · ${runLabel(r).replace(/ \(.*\)/, "")}`,
        value: show(r.L, "length", lu),
        notes: [`Rise ${signed(r.dz, lu)}`],
        fields: [
          { label: "Length", dim: "length", value: r.L, onValue: (x2) => Number.isFinite(x2) && x2 >= 0 && up({ L: x2 }) },
          { label: "Rise (− for a drop)", dim: "length", value: r.dz, onValue: (x2) => Number.isFinite(x2) && up({ dz: x2 }) },
        ],
        remove: () => {
          edit.snapshot();
          edit.saveSide(f.side, removeItem(list, f.i));
          edit.setFocus(null);
          edit.setSel(null);
        },
      };
    }
    return null;
  }

  const palette = (
    <div className="ps-palette" aria-label="Drag onto a pipe, or tap then tap a pipe">
      <span className="ps-palette-h">Drag onto a pipe</span>
      <div className="ps-palette-row">
        {EQUIPMENT.map((q) => (
          <PaletteChip key={q.id} item={{ kind: "eq", id: q.id }} label={q.short} glyph={q.id} placing={placing} setPlacing={edit.setPlacing} />
        ))}
        <span className="ps-palette-sep" aria-hidden="true" />
        {VALVES.map((id) => (
          <PaletteChip key={id} item={{ kind: "fit", id }} label={fittingById[id].name.replace(/,.*$/, "").replace(/ valve$/, "").replace(/^90° elbow$/, "90° elbow")} glyph={id === "el90" ? "elbow" : "valve"} placing={placing} setPlacing={edit.setPlacing} />
        ))}
      </div>
    </div>
  );

  const tools = (
    <div className="ps-tools">
      <button type="button" className="ps-tool" onClick={undo} disabled={!canUndo} title="Undo the last change on the drawing">
        <Undo2 size={15} aria-hidden="true" /> Undo
      </button>
    </div>
  );

  const placingItem = placing && (placing.kind === "eq" ? equipmentById[placing.id]?.name : fittingById[placing.id]?.name);

  return (
    <div ref={wrap} className={`ps-sketch ${dragging ? "is-dragging" : ""} ${placing?.armed ? "is-placing" : ""}`}>
      {palette}
      <div className="ps-status" aria-live="polite">
        {placing?.armed ? (
          <span className="ps-status-armed">
            Tap a pipe to add the {placingItem?.toLowerCase()}.
            <button type="button" onClick={() => edit.setPlacing(null)}>
              Cancel
            </button>
          </span>
        ) : note ? (
          <span>{note}</span>
        ) : (
          <span className="tf-muted">Drag the dots, tank levels and equipment up or down. Tap a value to type it.</span>
        )}
      </div>
      <ZoomBox label="Elevation sketch of the pump system" tools={tools}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Side view of the pump system, drawn to true elevation" onPointerDown={onSvgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => !drag.current && placing?.armed && setHover(null)}>
          <rect x="0" y="0" width={W} height={H} className="ps-bg" />
          <Backdrop geo={geo} lu={lu} />
          {src === "main" ? main() : tank(xSrc0, xSrc1, zs, sZ[0], src === "closed", "Supply", "zs")}
          {dst === "tank" && tank(xDst0, xDst1, zd, dZ[dZ.length - 1], false, "Destination", "zd")}

          {sLay.map((seg) => (isEquip(seg.r) ? null : pipe(seg)))}
          {dLay.map((seg) => (isEquip(seg.r) ? null : pipe(seg)))}
          {sLay.length > 0 && <line x1={sLay[sLay.length - 1].xb} x2={xPump - 20} y1={yP} y2={yP} className="ps-stub" />}
          {sLay.length === 0 && <line x1={xSrc1} x2={xPump - 20} y1={yP} y2={yP} className="ps-stub" />}
          {dLay.length > 0 && <line x1={xPump + 20} x2={dLay[0].xa} y1={yP} y2={yP} className="ps-stub" />}
          {dst === "free" && dLay.length > 0 && <path d={`M${xEnd + 6},${sy(dZ[dZ.length - 1])} q22,4 30,34`} className="ps-spray" />}
          {sLay.map((seg) => (isEquip(seg.r) ? equip(seg) : null))}
          {dLay.map((seg) => (isEquip(seg.r) ? equip(seg) : null))}

          <g className="ps-pump" aria-label="Pump. Its centerline is the datum: every elevation is measured from here.">
            <title>The pump centerline is the datum (0). Every elevation is measured from it.</title>
            <circle cx={xPump} cy={yP} r="22" />
            <path d={`M${xPump - 10},${yP + 8} L${xPump + 12},${yP} L${xPump - 10},${yP - 8} Z`} />
          </g>
          <text x={xPump} y={yP + 40} textAnchor="middle" className="ps-label">
            Pump (datum)
          </text>
          {handles}
          {hover && <circle cx={hover.x} cy={hover.y} r="11" className="ps-drop" />}
        </svg>
        {chip && <ValueChip chip={chip} W={W} H={H} unit={unit} setUnit={setUnit} live={dragging} editing={editing && !dragging} setEditing={setEditing} snapshot={edit.snapshot} onClose={() => (edit.setFocus(null), setEditing(false))} />}
      </ZoomBox>
      {placing && !placing.armed && placing.moved && (
        <div className="ps-ghost" style={{ left: placing.cx, top: placing.cy }} aria-hidden="true">
          {placingItem}
        </div>
      )}
    </div>
  );
}

function Backdrop({ geo, lu }) {
  const { W, sy, ticks, yP } = geo;
  return (
    <>
      {ticks.map((z) => (
        <g key={z} className="ps-tick">
          <line x1={40} x2={W - 8} y1={sy(z)} y2={sy(z)} />
          <text x={36} y={sy(z) + 4} textAnchor="end">
            {show(z, "length", lu).replace(/ .*/, "")}
          </text>
        </g>
      ))}
      <text x={8} y={18} className="ps-label is-dim">
        Elevation ({unitLabel("length", lu)}) · not to scale sideways
      </text>
      <line x1={40} x2={W - 8} y1={yP} y2={yP} className="ps-centerline" />
    </>
  );
}

function EquipGlyph({ id, cx, cy, s = 1 }) {
  const w = 34 * s,
    h = 24 * s;
  const box = <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={4 * s} className="ps-eq-body" />;
  switch (id) {
    case "cv":
    case "bfp":
      return (
        <g>
          <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={4 * s} className="ps-eq-hit" />
          <path d={`M${cx - 14 * s},${cy - 9 * s} L${cx + 14 * s},${cy + 9 * s} V${cy - 9 * s} L${cx - 14 * s},${cy + 9 * s} Z`} className="ps-eq-body" />
          {id === "cv" ? <path d={`M${cx},${cy} V${cy - 15 * s} M${cx - 7 * s},${cy - 15 * s} h${14 * s}`} className="ps-eq-mark" /> : <path d={`M${cx},${cy - 9 * s} V${cy + 9 * s}`} className="ps-eq-mark" />}
        </g>
      );
    case "meter":
    case "wmeter":
      return (
        <g>
          <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={4 * s} className="ps-eq-hit" />
          <circle cx={cx} cy={cy} r={12 * s} className="ps-eq-body" />
          <text x={cx} y={cy + 4.5 * s} textAnchor="middle" className="ps-eq-text" style={{ fontSize: 12 * s }}>
            {id === "meter" ? "F" : "W"}
          </text>
        </g>
      );
    case "hx":
    case "coil":
    case "boiler":
      return (
        <g>
          {box}
          <path d={`M${cx - 12 * s},${cy} l${4 * s},-${6 * s} l${4 * s},${12 * s} l${4 * s},-${12 * s} l${4 * s},${12 * s} l${4 * s},-${6 * s}`} className="ps-eq-mark" />
        </g>
      );
    case "filter":
    case "basket":
      return (
        <g>
          {box}
          <path d={`M${cx - w / 2 + 4 * s},${cy + h / 2 - 4 * s} L${cx + w / 2 - 4 * s},${cy - h / 2 + 4 * s}`} className="ps-eq-mark is-dash" />
        </g>
      );
    default:
      return box;
  }
}

function PaletteChip({ item, label, glyph, placing, setPlacing }) {
  const on = placing && placing.kind === item.kind && placing.id === item.id;
  return (
    <button
      type="button"
      className={`ps-chip ${on ? "is-on" : ""}`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        if (on && placing.armed) return setPlacing(null);
        setPlacing({ ...item, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, moved: false, armed: false });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPlacing(on ? null : { ...item, armed: true });
        }
      }}
      aria-pressed={Boolean(on)}
    >
      <svg viewBox="0 0 40 28" width="26" height="18" aria-hidden="true">
        {glyph === "valve" ? <path d="M8,6 L32,22 V6 L8,22 Z" className="ps-eq-body" /> : glyph === "elbow" ? <path d="M6,8 H22 Q30,8 30,16 V26" className="ps-eq-mark" /> : <EquipGlyph id={glyph} cx={20} cy={14} s={0.75} />}
      </svg>
      {label}
    </button>
  );
}

/** The value being changed, shown on the drawing. Tap it to type a number. */
function ValueChip({ chip, W, H, unit, setUnit, live, editing, setEditing, snapshot, onClose }) {
  const below = chip.y < 90;
  const style = { left: `${clamp((chip.x / W) * 100, 8, 92)}%`, top: `${(clamp(chip.y, 0, H) / H) * 100}%` };
  if (!editing) {
    return (
      <div className={`ps-chip-at ${below ? "is-below" : ""}`} style={style}>
        <button
          type="button"
          className={`ps-value ${live ? "is-live" : ""}`}
          onClick={() => {
            snapshot();
            setEditing(true);
          }}
          title="Tap to type a value"
        >
          <span className="ps-value-title">{chip.title}</span>
          <strong>{chip.value}</strong>
          <Pencil size={12} aria-hidden="true" />
          {chip.notes?.length > 0 && <span className="ps-value-notes">{chip.notes.join(" · ")}</span>}
        </button>
      </div>
    );
  }
  return (
    <div className={`ps-chip-at ${below ? "is-below" : ""}`} style={style}>
      <div className="ps-value-edit" role="dialog" aria-label={`Edit ${chip.title}`} onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && setEditing(false)}>
        <header>
          <strong>{chip.title}</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </header>
        {chip.fields.map((f, i) => (
          <AutoFocus key={f.label} on={i === 0}>
            <Num label={f.label} dim={f.dim} value={f.value} unit={f.dim === "none" ? "" : unit(f.dim)} onValue={f.onValue} onUnit={(u) => setUnit(f.dim, u)} />
          </AutoFocus>
        ))}
        {chip.notes?.length > 0 && <p className="tf-muted tf-small">{chip.notes.join(" · ")}</p>}
        <div className="ps-value-btns">
          {chip.remove && (
            <button type="button" className="is-danger" onClick={chip.remove}>
              <Trash2 size={14} aria-hidden="true" /> Remove
            </button>
          )}
          <button type="button" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoFocus({ on, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (on) ref.current?.querySelector("input")?.focus();
  }, [on]);
  return <div ref={ref}>{children}</div>;
}

// ── Printable report ─────────────────────────────────────────────────────

function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function PrintPanel({ onClose }) {
  const [meta, setMeta] = useState(readMeta);
  const up = (k, x) => {
    const next = { ...meta, [k]: x };
    setMeta(next);
    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify(next));
    } catch {
      // Not saved; it still prints.
    }
    window.dispatchEvent(new Event("ps-report-meta"));
  };
  const print = () => {
    const root = document.documentElement;
    root.classList.add("ps-printing");
    const done = () => {
      root.classList.remove("ps-printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };
  const field = (k, label, ph) => (
    <label className="ps-print-field">
      <span>{label}</span>
      <input value={meta[k] || ""} placeholder={ph} onChange={(e) => up(k, e.target.value)} maxLength={80} />
    </label>
  );
  return (
    <section className="ps-print-panel" aria-label="Print a report">
      <div className="ps-print-fields">
        {field("title", "Report title", "Pump system")}
        {field("project", "Project", "Project name or number")}
        {field("by", "Prepared by", "Your name")}
        {field("tag", "Pump tag", "P-1")}
      </div>
      <label className="ps-print-field is-wide">
        <span>Notes for the report</span>
        <textarea rows={2} value={meta.notes || ""} onChange={(e) => up("notes", e.target.value)} maxLength={600} />
      </label>
      <div className="ps-value-btns">
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="is-primary" onClick={print}>
          <Printer size={15} aria-hidden="true" /> Print or save as PDF
        </button>
      </div>
      <p className="tf-muted tf-small">The report has a summary, the system sketch, design conditions, a line list with every loss, the pressure at each joint, the pump curves and the method. It prints in the units on screen.</p>
    </section>
  );
}

function PumpReport({ calc, v, vis, output, sRuns, dRuns, unit, presetValue }) {
  const [meta, setMeta] = useState(readMeta);
  useEffect(() => {
    const on = () => setMeta(readMeta());
    window.addEventListener("ps-report-meta", on);
    return () => window.removeEventListener("ps-report-meta", on);
  }, []);
  const { s, op } = vis;
  const val = (x, dim) => (Number.isFinite(x) ? `${fmt(fromSI(x, dim, unit(dim)))} ${unitLabel(dim, unit(dim))}`.trim() : "—");
  const lu = unit("length");
  const sTags = tagsFor(sRuns, "s");
  const dTags = tagsFor(dRuns, "d");
  const rows = [...s.sRows.map((r, i) => ({ ...r, tag: sTags[i] })), ...s.dRows.map((r, i) => ({ ...r, tag: dTags[i] }))];
  const geo = layoutSystem(vis, sRuns, dRuns, 1000, 440, null);
  const date = new Date().toISOString().slice(0, 10);
  const srcLabel = { open: "Open tank", closed: "Closed tank", main: "Water main" }[v.src];
  const fitText = (r) =>
    r.equip
      ? r.run.cv > 0
        ? `Cv ${fmt(r.run.cv, 3)}`
        : `${val(r.run.dp, "pressure")} at design flow`
      : Object.entries(r.run.fit || {})
          .filter(([id, n]) => fittingById[id] && n > 0)
          .map(([id, n]) => `${n}× ${fittingById[id].name}`)
          .join("; ") || "—";

  // Joints: where each pipe ends, with the pressure there.
  const nS = s.sRows.length;
  const jointRows = s.nodes.map((n, i) => {
    let label;
    if (i === 0) label = v.src === "main" ? "Tap on the main" : "Tank outlet";
    else if (i <= nS) label = i === nS ? "Pump suction" : `After ${sTags[i - 1]}`;
    else if (i === nS + 1) label = "Pump discharge";
    else label = i === s.nodes.length - 1 ? (v.dst === "tank" ? "Tank inlet" : "Pipe outlet") : `After ${dTags[i - nS - 2]}`;
    return { label, z: n.z, p: n.p - vis.patm, pa: n.p };
  });

  const curves = vis.curves;
  const series = [{ points: curves.sys, color: "#1f6feb", label: "System curve" }];
  if (curves.pump.length) series.push({ points: curves.pump, color: "#8250df", label: "Pump curve" });
  series.push({ points: curves.npsh, color: "#1a7f37", label: "NPSH available" });
  if (curves.req.length) series.push({ points: curves.req, color: "#cf222e", label: "NPSH required", dashed: true });

  const kv = [
    ["Design flow", val(v.Q, "flow")],
    ["Fluid", presetValue("fluid") || "Custom"],
    ["NPSH available", val(s.NPSHa, "length")],
    ...(vis.NPSHr > 0 ? [["NPSH required", val(vis.NPSHr, "length")], ["NPSH margin", val(s.NPSHa - vis.NPSHr, "length")]] : []),
    ["Total dynamic head", val(s.TDH, "length")],
    ["Static head", val(s.staticHead, "length")],
    ...(op ? [["Operating point", `${val(op.Q, "flow")} at ${val(op.H, "length")}`]] : []),
  ];
  const conds = [
    ["Density", val(v.rho, "density")],
    ["Viscosity", val(v.mu, "dynvisc")],
    ["Vapour pressure (abs)", val(v.pv, "pressure")],
    ["Site elevation", val(v.site, "length")],
    ["Atmospheric pressure", val(vis.patm, "pressure")],
    ["Supply", srcLabel],
    ...(v.src === "main" ? [["Main pressure (gauge)", val(v.mainP, "pressure")], ["Tap height above pump", val(s.inletZ, "length")]] : [["Liquid level above pump", val(v.zs, "length")], ["Outlet height above pump", val(s.inletZ, "length")]]),
    ...(v.src === "closed" ? [["Pressure above liquid (gauge)", val(v.srcP, "pressure")]] : []),
    ["Destination", v.dst === "tank" ? "Tank" : "Open pipe end"],
    ...(v.dst === "tank" ? [["Destination level above pump", val(v.zd, "length")], ["Destination pressure (gauge)", val(v.dstP, "pressure")]] : []),
    [v.dst === "tank" ? "Pipe enters tank at" : "Pipe ends at", val(s.outletZ, "length")],
    ["Pump efficiency", `${fmt(v.eta * 100, 3)} %`],
    ["Motor efficiency", `${fmt(v.etaM * 100, 3)} %`],
  ];
  const resultText = (r) => (r.text !== undefined ? r.text : val(r.value, r.dim));

  return (
    <section className="ps-report" aria-hidden="true">
      <header className="ps-r-head">
        <div>
          <h1>{meta.title || "Pump system"}{meta.tag ? ` · ${meta.tag}` : ""}</h1>
          <p>{calc.name}</p>
        </div>
        <table className="ps-r-block">
          <tbody>
            <tr>
              <th>Project</th>
              <td>{meta.project || "—"}</td>
            </tr>
            <tr>
              <th>Prepared by</th>
              <td>{meta.by || "—"}</td>
            </tr>
            <tr>
              <th>Date</th>
              <td>{date}</td>
            </tr>
          </tbody>
        </table>
      </header>

      <h2>Summary</h2>
      <dl className="ps-r-kv" data-report-table="Summary">
        {kv.map(([k, x]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{x}</dd>
          </div>
        ))}
      </dl>
      {meta.notes && <p className="ps-r-notes">{meta.notes}</p>}

      <h2>System sketch</h2>
      <div className="ps-r-fig" data-report-figure="System sketch">
        <StaticSketch geo={geo} vis={vis} sTags={sTags} dTags={dTags} lu={lu} />
      </div>

      <h2>Design conditions</h2>
      <table className="ps-r-table" data-report-table="Design conditions">
        <thead>
          <tr>
            <th>Item</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {conds.map(([k, x]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{x}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Line list at design flow</h2>
      <table className="ps-r-table is-small" data-report-table="Line list">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Item</th>
            <th>Length</th>
            <th>Rise</th>
            <th>Fittings or rating</th>
            <th>Velocity</th>
            <th>Re</th>
            <th>f</th>
            <th>Loss</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tag}>
              <td>{r.tag}</td>
              <td>
                {r.run.name ? `${r.run.name} · ` : ""}
                {runLabel(r.run)}
                {!r.equip && ` (ID ${val(r.D, "smallLength")})`}
              </td>
              <td>{r.equip ? "—" : val(r.run.L, "length")}</td>
              <td>{r.equip ? "—" : signed(r.run.dz, lu)}</td>
              <td>{fitText(r)}</td>
              <td>{r.equip ? "—" : val(r.v, "velocity")}</td>
              <td>{r.equip ? "—" : fmt(r.Re, 3)}</td>
              <td>{r.equip ? "—" : fmt(r.f, 3)}</td>
              <td>{val(r.h, "length")}</td>
            </tr>
          ))}
          <tr className="is-total">
            <td colSpan="8">Suction side total</td>
            <td>{val(s.hfS, "length")}</td>
          </tr>
          <tr className="is-total">
            <td colSpan="8">Discharge side total</td>
            <td>{val(s.hfD, "length")}</td>
          </tr>
        </tbody>
      </table>

      <h2>Pressure at each joint</h2>
      <table className="ps-r-table" data-report-table="Joint pressures">
        <thead>
          <tr>
            <th>Point</th>
            <th>Elevation above pump</th>
            <th>Pressure (gauge)</th>
            <th>Pressure (absolute)</th>
          </tr>
        </thead>
        <tbody>
          {jointRows.map((j, i) => (
            <tr key={i}>
              <td>{j.label}</td>
              <td>{signed(j.z, lu)}</td>
              <td>{val(j.p, "pressure")}</td>
              <td>{val(j.pa, "pressure")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Head against flow</h2>
      <div className="ps-r-fig is-chart" data-report-figure="Head against flow">
        <Chart series={series} x={{ label: "Flow", dim: "flow", unit: unit("flow"), min: 0 }} y={{ label: "Head", dim: "length", unit: lu, min: 0 }} marker={op ? { x: op.Q, y: op.H } : { x: v.Q, y: s.TDH }} />
      </div>

      <h2>Results</h2>
      <table className="ps-r-table" data-report-table="Results">
        <thead>
          <tr>
            <th>Result</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {output.results.map((r) => (
            <tr key={r.id}>
              <td>{r.label}</td>
              <td>{resultText(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {output.warnings.length > 0 && (
        <>
          <h2>Notes</h2>
          <ul className="ps-r-list">
            {output.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Method</h2>
      <ul className="ps-r-list is-mono">
        {calc.formula.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p className="ps-r-small">{calc.about}</p>
      <p className="ps-r-small">Sources: {calc.sources}</p>
      <footer className="ps-r-foot">Engineer ToolFox · The ClusterFOX · {date} · Check results before relying on them for design.</footer>
    </section>
  );
}

/** The sketch without handles, for the printed report. */
function StaticSketch({ geo, vis, sTags, dTags, lu }) {
  const { W, H, sy, sLay, dLay, sZ, dZ, xSrc0, xSrc1, xPump, xDst0, xDst1, xEnd, yP } = geo;
  const { zs, zd, dst, src } = vis;
  const thick = (r) => clamp(4 + runGeometry(r).D * 60, 4, 14);
  const tank = (x0, x1, level, nozzle, closed, label) => {
    const hiZ = Math.max(level, nozzle),
      loZ = Math.min(level, nozzle);
    const yTop = Math.min(sy(hiZ) - 30, sy(loZ) - 44);
    const yBot = Math.max(sy(loZ) + 18, sy(hiZ) + 32);
    return (
      <g className="ps-tank">
        <rect x={x0} y={sy(level)} width={x1 - x0} height={Math.max(0, yBot - sy(level))} className="ps-liquid" />
        <path d={closed ? `M${x0},${yTop} H${x1} V${yBot} H${x0} Z` : `M${x0},${yTop} V${yBot} H${x1} V${yTop}`} className="ps-tank-wall" />
        <path d={`M${(x0 + x1) / 2 - 7},${sy(level) - 12} h14 l-7,10 Z`} className="ps-level-mark" />
        <text x={(x0 + x1) / 2} y={yTop - 8} textAnchor="middle" className="ps-label">
          {label} {signed(level, lu)}
        </text>
      </g>
    );
  };
  const seg = (g, tags) =>
    isEquip(g.r) ? (
      <g key={`${g.side}${g.i}`}>
        <line x1={g.xa} x2={g.xb} y1={g.ya} y2={g.ya} className="ps-stub" />
        <EquipGlyph id={g.r.eq} cx={(g.xa + g.xb) / 2} cy={g.ya} />
        <text x={(g.xa + g.xb) / 2} y={g.ya - 20} textAnchor="middle" className="ps-label is-small">
          {tags[g.i]}
        </text>
      </g>
    ) : (
      <g key={`${g.side}${g.i}`} className="ps-pipe">
        <path d={`M${g.xa},${g.ya} H${g.xm} L${g.xb},${g.yb}`} className="ps-pipe-wall" style={{ strokeWidth: thick(g.r) + 4 }} />
        <path d={`M${g.xa},${g.ya} H${g.xm} L${g.xb},${g.yb}`} className="ps-pipe-bore" style={{ strokeWidth: thick(g.r) }} />
        {g.xm - g.xa > 22 && (
          <text x={(g.xa + g.xm) / 2} y={g.ya - thick(g.r) / 2 - 8} textAnchor="middle" className="ps-label">
            {tags[g.i]}
          </text>
        )}
        <circle cx={g.xb} cy={g.yb} r="3.5" className="ps-joint" />
      </g>
    );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Side view of the pump system">
      <Backdrop geo={geo} lu={lu} />
      {src === "main" ? (
        <g>
          <circle cx={xSrc1 - 20} cy={sy(sZ[0])} r="20" className="ps-main-pipe" />
          <text x={xSrc1 - 20} y={sy(sZ[0]) - 28} textAnchor="middle" className="ps-label">
            Water main
          </text>
        </g>
      ) : (
        tank(xSrc0, xSrc1, zs, sZ[0], src === "closed", "Supply")
      )}
      {dst === "tank" && tank(xDst0, xDst1, zd, dZ[dZ.length - 1], false, "Destination")}
      {sLay.map((g) => seg(g, sTags))}
      {dLay.map((g) => seg(g, dTags))}
      <line x1={sLay.length ? sLay[sLay.length - 1].xb : xSrc1} x2={xPump - 20} y1={yP} y2={yP} className="ps-stub" />
      {dLay.length > 0 && <line x1={xPump + 20} x2={dLay[0].xa} y1={yP} y2={yP} className="ps-stub" />}
      {dst === "free" && dLay.length > 0 && <path d={`M${xEnd + 6},${sy(dZ[dZ.length - 1])} q22,4 30,34`} className="ps-spray" />}
      <g className="ps-pump">
        <circle cx={xPump} cy={yP} r="22" />
        <path d={`M${xPump - 10},${yP + 8} L${xPump + 12},${yP} L${xPump - 10},${yP - 8} Z`} />
      </g>
      <text x={xPump} y={yP + 40} textAnchor="middle" className="ps-label">
        Pump
      </text>
    </svg>
  );
}
