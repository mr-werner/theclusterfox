import { useMemo, useState } from "react";
import { Plus, Ruler, Trash2, Video, Hash, TrendingUp } from "lucide-react";

import { TESTS, testById, goalById } from "../data/goals";
import { fmtDay } from "../model/program";
import { bestByTest, flightFromFrames, fmtLength, heightFromFlight, heightFromReach, toCm } from "../model/vertical";

const METHODS = [
  { id: "reach", name: "Wall reach", icon: Ruler },
  { id: "flight", name: "Slow-mo video", icon: Video },
  { id: "direct", name: "Type it in", icon: Hash },
];

const num = v => (v === "" || v === null ? NaN : Number(v));

function Spark({ points }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 34;
  const vals = points.map(p => p.cm);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const d = points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * (w - 4) + 2).toFixed(1)} ${(h - 3 - ((p.cm - lo) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg className="lp-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TestsTab({ store, plan, today }) {
  const { data, setPrefs, addResult, deleteResult } = store;
  const unit = data.prefs.unit;
  const goal = plan ? goalById.get(plan.opts.goal) : null;
  const order = goal ? [...goal.tests, ...TESTS.map(t => t.id).filter(id => !goal.tests.includes(id))] : TESTS.map(t => t.id);

  const [test, setTest] = useState(order[0]);
  const [side, setSide] = useState(plan?.opts.leg ?? "left");
  const [method, setMethod] = useState("reach");
  const [day, setDay] = useState(today);
  const [form, setForm] = useState({ reach: "", touch: "", fps: "240", from: "", to: "", ms: "", value: "" });
  const [saved, setSaved] = useState(null);
  const f = patch => setForm(x => ({ ...x, ...patch }));

  const t = testById.get(test);
  const isHeight = t.kind === "height";
  const m = isHeight ? method : "direct";

  const flight = form.ms !== "" ? num(form.ms) / 1000 : flightFromFrames(num(form.from), num(form.to), num(form.fps));
  const cm =
    m === "reach"
      ? heightFromReach(toCm(num(form.reach), unit), toCm(num(form.touch), unit))
      : m === "flight"
        ? heightFromFlight(flight)
        : Number.isFinite(num(form.value)) && num(form.value) > 0
          ? toCm(num(form.value), unit)
          : null;

  const best = useMemo(() => bestByTest(data.results), [data.results]);
  const series = key => [...data.results].filter(r => (r.side ? `${r.test}:${r.side}` : r.test) === key).sort((a, b) => (a.day < b.day ? -1 : 1));

  const save = () => {
    if (!cm) return;
    const r = addResult({ day, test, side: t.perSide ? side : null, cm, method: m });
    if (r) {
      setSaved(r);
      f({ touch: "", from: "", to: "", ms: "", value: "" });
    }
  };

  const unitLabel = unit === "in" ? "in" : "cm";

  return (
    <section className="lp-tests">
      <div className="lp-section-head">
        <h2>Jump tests</h2>
        <div className="lp-seg is-small" role="group" aria-label="Units">
          {[["in", "Inches"], ["cm", "cm"]].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={unit === id} onClick={() => setPrefs({ unit: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {best.size > 0 && (
        <div className="lp-bests">
          {[...best.values()].map(b => {
            const tt = testById.get(b.test);
            const gain = b.best.cm - b.first.cm;
            return (
              <div key={b.key} className="lp-best">
                <small>
                  {tt.name}
                  {b.side ? ` · ${b.side}` : ""}
                </small>
                <strong>{fmtLength(b.best.cm, unit, { long: tt.kind === "distance" })}</strong>
                {b.count > 1 && gain > 0 ? (
                  <span className="lp-gain">
                    <TrendingUp size={13} aria-hidden="true" /> +{fmtLength(gain, unit)} since {fmtDay(b.first.day)}
                  </span>
                ) : (
                  <span className="lp-muted">best of {b.count}</span>
                )}
                <Spark points={series(b.key)} />
              </div>
            );
          })}
        </div>
      )}

      <div className="lp-card lp-test-form">
        <h3>Log a test</h3>
        <label className="lp-label">
          Test
          <select className="lp-input" value={test} onChange={e => setTest(e.target.value)}>
            {order.map(id => (
              <option key={id} value={id}>
                {testById.get(id).name}
              </option>
            ))}
          </select>
        </label>
        <p className="lp-hint">{t.blurb}</p>

        {t.perSide && (
          <div className="lp-seg" role="group" aria-label="Leg">
            {["left", "right"].map(s => (
              <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
                {s === "left" ? "Left leg" : "Right leg"}
              </button>
            ))}
          </div>
        )}

        {isHeight && (
          <div className="lp-methods" role="tablist" aria-label="How you measured">
            {METHODS.map(x => (
              <button key={x.id} type="button" role="tab" aria-selected={method === x.id} onClick={() => setMethod(x.id)}>
                <x.icon size={16} aria-hidden="true" /> {x.name}
              </button>
            ))}
          </div>
        )}

        {m === "reach" && (
          <>
            <p className="lp-hint">
              Stand side-on to a wall and reach as high as you can, flat-footed. Mark it. Then jump and touch as high as you can (chalk or a wet finger helps). Measure both from the floor.
            </p>
            <div className="lp-pair">
              <label className="lp-label">
                Standing reach ({unitLabel})
                <input className="lp-input" inputMode="decimal" value={form.reach} onChange={e => f({ reach: e.target.value })} placeholder={unit === "in" ? "e.g. 92" : "e.g. 234"} />
              </label>
              <label className="lp-label">
                Jump touch ({unitLabel})
                <input className="lp-input" inputMode="decimal" value={form.touch} onChange={e => f({ touch: e.target.value })} placeholder={unit === "in" ? "e.g. 116" : "e.g. 295"} />
              </label>
            </div>
          </>
        )}

        {m === "flight" && (
          <>
            <p className="lp-hint">
              Film your feet in slow motion, side-on. Step through the video frame by frame: note the frame where your toes leave the ground and the frame they touch back down. Land the way you took off (legs straight, no tucking), or the number reads high.
            </p>
            <div className="lp-pair is-three">
              <label className="lp-label">
                Frames per second
                <input className="lp-input" inputMode="numeric" value={form.fps} onChange={e => f({ fps: e.target.value })} />
              </label>
              <label className="lp-label">
                Takeoff frame
                <input className="lp-input" inputMode="numeric" value={form.from} onChange={e => f({ from: e.target.value, ms: "" })} />
              </label>
              <label className="lp-label">
                Landing frame
                <input className="lp-input" inputMode="numeric" value={form.to} onChange={e => f({ to: e.target.value, ms: "" })} />
              </label>
            </div>
            <label className="lp-label">
              …or time in the air (ms), from a jump mat or app
              <input className="lp-input" inputMode="numeric" value={form.ms} onChange={e => f({ ms: e.target.value })} placeholder="e.g. 560" />
            </label>
          </>
        )}

        {m === "direct" && (
          <label className="lp-label">
            {isHeight ? "Your vertical" : "Distance"} ({unitLabel})
            <input className="lp-input" inputMode="decimal" value={form.value} onChange={e => f({ value: e.target.value })} placeholder={isHeight ? (unit === "in" ? "e.g. 24" : "e.g. 61") : unit === "in" ? "e.g. 96" : "e.g. 244"} />
          </label>
        )}

        <div className="lp-result-row">
          <div className="lp-result" aria-live="polite">
            <small>Result</small>
            <strong>{cm ? fmtLength(cm, unit, { long: !isHeight }) : "–"}</strong>
            {m === "flight" && flight > 0 && <span className="lp-muted">{Math.round(flight * 1000)} ms in the air</span>}
          </div>
          <label className="lp-label is-date">
            Date
            <input className="lp-input" type="date" value={day} max={today} onChange={e => e.target.value && setDay(e.target.value)} />
          </label>
          <button type="button" className="lp-btn is-primary" disabled={!cm} onClick={save}>
            <Plus size={16} aria-hidden="true" /> Save
          </button>
        </div>
        {saved && (
          <p className="lp-saved" role="status">
            Saved {fmtLength(saved.cm, unit, { long: !isHeight })} for {testById.get(saved.test).name.toLowerCase()}.
          </p>
        )}
      </div>

      {data.results.length > 0 && (
        <div className="lp-card">
          <h3>History</h3>
          <ul className="lp-history">
            {data.results.map(r => {
              const tt = testById.get(r.test);
              return (
                <li key={r.id}>
                  <span className="lp-muted">{fmtDay(r.day)}</span>
                  <span>
                    {tt.name}
                    {r.side ? ` (${r.side})` : ""}
                  </span>
                  <strong>{fmtLength(r.cm, unit, { long: tt.kind === "distance" })}</strong>
                  <button type="button" className="lp-icon-btn is-small" aria-label={`Delete ${tt.name} on ${fmtDay(r.day)}`} onClick={() => deleteResult(r.id)}>
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
