import { ArrowDown, ArrowUp, Plus, Ruler, Trash2 } from "lucide-react";
import { Num } from "./kit";
import { show } from "./helpers";
import Chart from "../components/Chart";
import { fmt } from "../model/units";
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

// The fan and duct path as a list of cards: duct runs, fittings and
// components in order from intake to the last outlet. Each card shows its own
// pressure loss, and the totals, a pressure budget and the fan and system
// curves sit underneath. A list works on a phone, where a drawing wouldn't.

const KIND = { duct: "Duct run", fit: "Fitting", comp: "Component" };
const COLORS = { duct: "#5cc8ff", fit: "#ffc764", comp: "#c6a6ff" };
const US_LENGTHS = new Set(["in", "ft", "yd", "mi", "mil", "thou"]);

function Select({ label, value, options, onChange }) {
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

export default function FanSystemBuilder({ values: v, set, output, unit, setUnit }) {
  const items = parseSystem(v.model);
  const vis = output.visual?.type === "fan" ? output.visual : null;
  const rowFor = (i) => vis?.rows.find((r) => r.i === i);
  const save = (next) => set("model", stringifySystem(next));
  const update = (i, patch) => save(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const remove = (i) => save(items.filter((_, k) => k !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const lastDuct = [...items].reverse().find((it) => it.kind === "duct");
  const add = (kind) => {
    const it =
      kind === "duct"
        ? lastDuct
          ? { ...lastDuct, L: 3.048 }
          : { kind, shape: "round", D: 0.3048, L: 3.048, mat: "g" }
        : kind === "fit"
          ? { kind, type: "el90r", n: 1 }
          : { kind, type: "filt", dp: componentById.filt.dp };
    save([...items, it]);
  };
  const field = (i, key, label, dim, opts = {}) => (
    <Num
      label={label}
      dim={dim}
      value={items[i][key]}
      unit={unit(dim)}
      onUnit={(u) => setUnit(dim, u)}
      onValue={(x) => {
        if (Number.isFinite(x) && x >= 0) update(i, { [key]: opts.int ? Math.max(1, Math.round(x)) : x });
        else if (opts.optional) update(i, { [key]: undefined });
      }}
    />
  );

  // Auto-size every round duct to the friction and velocity targets.
  const autoSize = () => {
    if (!(v.Q > 0)) return;
    const air = siteAir(v.z, v.T, v.rh);
    const sizes = roundSizes(US_LENGTHS.has(unit("smallLength")) ? "us" : "si");
    save(items.map((it) => (it.kind === "duct" && it.shape === "round" ? { ...it, D: sizeRound(Number.isFinite(it.Q) && it.Q > 0 ? it.Q : v.Q, { ...air }, it.mat, v.rate, v.vmax, sizes) } : it)));
  };

  const total = vis ? vis.rows.reduce((a, r) => a + r.dp, 0) : 0;
  const P = (x) => show(x, "airPressure", unit("airPressure"));

  return (
    <div className="dg-builder fs">
      <div className="fs-site" role="group" aria-label="Design conditions">
        <Num label="Fan airflow" dim="airflow" value={v.Q} unit={unit("airflow")} onValue={(x) => set("Q", x)} onUnit={(u) => setUnit("airflow", u)} />
        <Num label="Site elevation" dim="length" value={v.z} unit={unit("length")} onValue={(x) => set("z", x)} onUnit={(u) => setUnit("length", u)} />
        <Num label="Air temperature" dim="temp" value={v.T} unit={unit("temp")} onValue={(x) => set("T", x)} onUnit={(u) => setUnit("temp", u)} />
      </div>

      <div className="dg-items fs-items" role="list" aria-label="Duct path, in order of airflow">
        {items.length === 0 && <p className="tf-muted tf-small">The path is empty. Add duct runs, fittings and components below, in the order the air passes through them.</p>}
        {items.map((it, i) => {
          const r = rowFor(i);
          const share = total > 0 && r ? r.dp / total : 0;
          return (
            <div key={i} role="listitem" className={`dg-item fs-item is-${it.kind}`} style={{ "--fs-c": COLORS[it.kind] }}>
              <div className="fs-head">
                <span className="fs-step">{i + 1}</span>
                <span className="dg-item-name">{KIND[it.kind]}</span>
              </div>
              <div className="dg-item-fields">
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
                    {it.shape === "round" ? field(i, "D", "Diameter", "smallLength") : (
                      <>
                        {field(i, "a", "Width", "smallLength")}
                        {field(i, "b", "Height", "smallLength")}
                      </>
                    )}
                    {field(i, "L", "Length", "length")}
                    <Select label="Material" value={it.mat} options={DUCT_MATERIALS.map((m) => ({ value: m.id, label: m.label }))} onChange={(mat) => update(i, { mat })} />
                    {field(i, "Q", "Airflow (blank = fan)", "airflow", { optional: true })}
                  </>
                )}
                {it.kind === "fit" && (
                  <>
                    <Select label="Fitting" value={it.type} options={FITTINGS.map((f) => ({ value: f.id, label: f.label }))} onChange={(type) => update(i, { type, C: undefined })} />
                    {field(i, "n", "How many", "none", { int: true })}
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
                    {field(i, "dp", "Pressure drop at design airflow", "airPressure")}
                  </>
                )}
              </div>
              <div className="fs-tools">
                <button type="button" className="dg-item-del" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="dg-item-del" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down" title="Move down">
                  <ArrowDown size={15} />
                </button>
                <button type="button" className="dg-item-del" onClick={() => remove(i)} aria-label={`Remove ${KIND[it.kind].toLowerCase()}`} title="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
              {r && (
                <div className="fs-out">
                  <span className="fs-bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, share * 100).toFixed(1)}%` }} />
                  </span>
                  <strong>{P(r.dp)}</strong>
                  {r.kind === "duct" && (
                    <span className="tf-muted">
                      {show(r.v, "velocity", unit("velocity") === "ft/s" ? "fpm" : unit("velocity"))} · {show(r.rate, "pressureGradient", unit("pressureGradient"))}
                    </span>
                  )}
                  {r.kind === "fit" && !r.orphan && <span className="tf-muted">at {show(r.v, "velocity", unit("velocity") === "ft/s" ? "fpm" : unit("velocity"))}</span>}
                  {r.kind === "fit" && r.orphan && <span className="fs-warn">Needs a duct beside it</span>}
                  <span className="tf-muted">{fmt(share * 100, 2)}% of the path</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="dg-add fs-add" role="group" aria-label="Add to the path">
        <button type="button" onClick={() => add("duct")}>
          <Plus size={13} aria-hidden="true" /> Duct run
        </button>
        <button type="button" onClick={() => add("fit")}>
          <Plus size={13} aria-hidden="true" /> Fitting
        </button>
        <button type="button" onClick={() => add("comp")}>
          <Plus size={13} aria-hidden="true" /> Component
        </button>
        <button type="button" onClick={autoSize} title="Pick the smallest standard round size for each round duct that meets the friction rate and velocity limit in More settings">
          <Ruler size={13} aria-hidden="true" /> Auto-size round ducts
        </button>
      </div>

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
        </div>
      )}
    </div>
  );
}
