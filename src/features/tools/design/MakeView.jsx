import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown, Cog, Factory, Route as RouteIcon, TriangleAlert } from "lucide-react";
import { CHARS, FAMILIES, FEATURES, MATERIALS, PROCESSES, QUANTITIES, RA_STEPS, SHAPES, recommend } from "./processes";
import { calloutById } from "./gdtModel";
import { Symbol } from "./Frame";
import { Crumbs, Segmented } from "./ui";
import { DESIGN_HUE, lengthUnits, useTitle } from "./units";
import "./design.css";

// Manufacturing: a process finder that turns a part description into a route
// (make it, then finish what needs finishing), and a library of every method.

const STATUS = {
  good: { label: "Good fit", blurb: "Holds everything you asked for as normal shop practice." },
  care: { label: "Possible with care", blurb: "Can do it, but near the limit, or off its best quantity." },
  finish: { label: "Needs a finishing step", blurb: "Right material and shape, but can't reach the tolerance or finish on its own." },
  step: { label: "Finishing operations", blurb: "Not a way to make the part, but they finish the features you picked to this tolerance." },
  no: { label: "Not a fit", blurb: "Wrong material or shape for this process." },
};

const TOL_STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2];

export function MakeRoute({ prefsApi, library }) {
  return library ? <MethodsPage prefsApi={prefsApi} /> : <FinderPage prefsApi={prefsApi} />;
}

function Head({ title, lede, tab }) {
  return (
    <header className="tf-page-head">
      <Crumbs />
      <div className="tf-title-row">
        <h1>{title}</h1>
      </div>
      <p className="tf-lede">{lede}</p>
      <nav className="gd-tabs" aria-label="Manufacturing">
        <Link to="/tools/make" className={tab === "find" ? "is-on" : ""} aria-current={tab === "find" ? "page" : undefined}>
          <RouteIcon size={15} aria-hidden="true" /> Process finder
        </Link>
        <Link to="/tools/make/methods" className={tab === "lib" ? "is-on" : ""} aria-current={tab === "lib" ? "page" : undefined}>
          <Factory size={15} aria-hidden="true" /> All methods
        </Link>
      </nav>
    </header>
  );
}

function fromParams(params) {
  const char = CHARS.some((c) => c.id === params.get("char")) ? params.get("char") : "";
  const ct = Number(params.get("ct"));
  const f = FEATURES.some((x) => x.id === params.get("f")) ? params.get("f") : null;
  const from = calloutById[params.get("from")] ? params.get("from") : null;
  const shape = f === "od" || f === "bores" ? "round" : f === "freeform" ? "complex" : f === "profile" ? "sheet" : "prismatic";
  return {
    material: "al",
    shape: from ? shape : "prismatic",
    features: f ? [f] : ["flat", "holes", "pockets"],
    tol: 0.05,
    ra: 3.2,
    qty: 10,
    char,
    charTol: Number.isFinite(ct) && ct > 0 ? ct : 0.05,
    from,
  };
}

function FinderPage({ prefsApi }) {
  useTitle("Manufacturing process finder · Engineer ToolFox");
  const [params] = useSearchParams();
  const [need, setNeed] = useState(() => fromParams(params));
  const units = lengthUnits(prefsApi.prefs.system);
  const set = (patch) => setNeed((n) => ({ ...n, ...patch }));
  const result = useMemo(() => recommend({ ...need, char: need.char || undefined }), [need]);
  const from = need.from ? calloutById[need.from] : null;
  const toggleFeature = (id) => set({ features: need.features.includes(id) ? need.features.filter((x) => x !== id) : [...need.features, id] });
  const tolIdx = nearestIdx(TOL_STEPS, need.tol);
  const raIdx = nearestIdx(RA_STEPS, need.ra);
  const [showNo, setShowNo] = useState(false);
  const groups = ["good", "care", "finish", "step", "no"].map((k) => ({ k, items: result.rated.filter((r) => r.status === k) }));
  const chartRows = result.rated.filter((r) => r.status !== "no").slice(0, 16);

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <Head
        tab="find"
        title="Manufacturing process finder"
        lede="Describe the part: material, shape, the features on it and the tightest tolerance. Get the processes and machines that make it, and the finishing steps the tight features need."
      />
      {from && (
        <p className="gd-from">
          <Symbol id={from.id} size={18} /> From the GD&amp;T explorer: {from.name} {units.L(need.charTol)}.{" "}
          <Link to={`/tools/gdt/${from.id}`}>Back to {from.name.toLowerCase()}</Link>
        </p>
      )}
      <div className="gd-make-grid">
        <section className="tf-card gd-panel gd-need" aria-label="The part">
          <h2>The part</h2>
          <Chips label="Material" options={MATERIALS} value={need.material} onPick={(material) => set({ material })} />
          <Chips label="Shape" options={SHAPES} value={need.shape} onPick={(shape) => set({ shape })} />
          <div className="gd-field">
            <span className="gd-field-label">Features on it</span>
            <div className="tf-chip-row">
              {FEATURES.map((f) => (
                <button key={f.id} type="button" className={`tf-chip ${need.features.includes(f.id) ? "is-on" : ""}`} aria-pressed={need.features.includes(f.id)} onClick={() => toggleFeature(f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <div className="gd-field">
            <span className="gd-field-label">
              Tightest size tolerance <strong className="gd-strong">±{units.L(need.tol)}</strong>
            </span>
            <input type="range" min={0} max={TOL_STEPS.length - 1} step={1} value={tolIdx} onChange={(e) => set({ tol: TOL_STEPS[Number(e.target.value)] })} aria-label="Tightest size tolerance" />
            <div className="gd-scale">
              <span>±{units.num(TOL_STEPS[0])}</span>
              <span>±{units.num(TOL_STEPS[TOL_STEPS.length - 1])}</span>
            </div>
          </div>
          <div className="gd-field">
            <span className="gd-field-label">
              Finest surface finish <strong className="gd-strong">Ra {need.ra} µm</strong> <small>({Math.round(need.ra * 39.37)} µin)</small>
            </span>
            <input type="range" min={0} max={RA_STEPS.length - 1} step={1} value={raIdx} onChange={(e) => set({ ra: RA_STEPS[Number(e.target.value)] })} aria-label="Finest surface finish" />
            <div className="gd-scale">
              <span>Mirror</span>
              <span>Rough</span>
            </div>
          </div>
          <div className="gd-field">
            <span className="gd-field-label">Quantity</span>
            <Segmented label="Quantity" small value={need.qty} onChange={(qty) => set({ qty })} options={QUANTITIES} />
          </div>
          <div className="gd-field">
            <span className="gd-field-label">Tightest GD&amp;T control (optional)</span>
            <select className="tf-select" value={need.char} onChange={(e) => set({ char: e.target.value })}>
              <option value="">None</option>
              {CHARS.filter((c) => c.id !== "size").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {need.char && (
              <div className="gd-inline">
                <input
                  type="range"
                  min={0}
                  max={TOL_STEPS.length - 1}
                  value={nearestIdx(TOL_STEPS, need.charTol)}
                  onChange={(e) => set({ charTol: TOL_STEPS[Number(e.target.value)] })}
                  aria-label="GD&T tolerance"
                />
                <strong className="gd-strong">{units.L(need.charTol)}</strong>
              </div>
            )}
          </div>
        </section>

        <div className="gd-results">
          <section className="tf-card gd-route" aria-label="Suggested route">
            <h2>
              <RouteIcon size={18} aria-hidden="true" /> Suggested route
            </h2>
            {result.route.length ? (
              <ol>
                {result.route.map((step, i) => (
                  <li key={i}>
                    <span className="gd-basic-num">{i + 1}</span>
                    <span>
                      <small>{step.step}</small>
                      <strong>{step.p ? step.p.name : "No common process"}</strong>
                      {step.p && <span className="gd-route-mach">{step.p.machines.slice(0, 2).join(" · ")}</span>}
                      <span className="gd-route-why">{step.why}</span>
                    </span>
                    {i < result.route.length - 1 && <ArrowRight size={16} className="gd-route-arrow" aria-hidden="true" />}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="tf-warning">
                <TriangleAlert size={15} aria-hidden="true" /> Nothing in the list makes this shape from this material. Try another shape or material.
              </p>
            )}
            <p className="gd-help">Typical job-shop values for a part around hand size. Big, thin or floppy parts hold less; a specialist shop can hold more.</p>
          </section>

          <section className="tf-card gd-cap" aria-label="Tolerance capability">
            <h2>What each process can hold</h2>
            <CapChart rows={chartRows} tol={need.tol} units={units} />
          </section>
        </div>
      </div>

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.k}>
              <h2 className="tf-block-title">
                <span className={`gd-fit is-${g.k}`}>{STATUS[g.k].label}</span>
                <small className="gd-group-blurb">{STATUS[g.k].blurb}</small>
              </h2>
              {g.k === "no" && !showNo ? (
                <button type="button" className="tf-chip" onClick={() => setShowNo(true)}>
                  Show {g.items.length} processes that don&apos;t fit
                </button>
              ) : (
                <div className="gd-proc-grid">
                  {g.items.map((r) => (
                    <ProcessCard key={r.p.id} p={r.p} why={r.why} status={r.status} units={units} />
                  ))}
                </div>
              )}
            </section>
          )
      )}
    </div>
  );
}

const nearestIdx = (arr, v) => arr.reduce((best, x, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(arr[best] / v)) ? i : best), 0);

function Chips({ label, options, value, onPick }) {
  return (
    <div className="gd-field">
      <span className="gd-field-label">{label}</span>
      <div className="tf-chip-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={`tf-chip ${value === o.id ? "is-on" : ""}`} onClick={() => onPick(o.id)} title={o.hint}>
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars on a log scale: best to typical ± tolerance for each process, with the requirement as a line. */
function CapChart({ rows, tol, units }) {
  const lo = 0.0005, hi = 2;
  const w = 600, rowH = 26, left = 210, right = 16, top = 24;
  const h = top + rows.length * rowH + 30;
  const X = (v) => left + (Math.log10(v / lo) / Math.log10(hi / lo)) * (w - left - right);
  const ticks = [0.001, 0.01, 0.1, 1];
  if (!rows.length) return <p className="gd-help">No process matches this material and shape.</p>;
  return (
    <svg className="gd-capchart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tolerance each process can hold, on a log scale">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={top - 6} y2={h - 26} className="gd-grid-line" />
          <text x={X(t)} y={h - 10} textAnchor="middle" className="gd-label is-dim">
            ±{units.num(t)}
          </text>
        </g>
      ))}
      <text x={left} y={14} className="gd-label is-dim">tighter ←</text>
      <text x={w - right} y={14} textAnchor="end" className="gd-label is-dim">→ looser</text>
      {rows.map((r, i) => {
        const y = top + i * rowH;
        return (
          <g key={r.p.id}>
            <text x={left - 10} y={y + rowH / 2 + 4} textAnchor="end" className="gd-label gd-cap-name">
              {r.p.name.length > 26 ? `${r.p.name.slice(0, 25)}…` : r.p.name}
            </text>
            <rect x={X(r.p.tol[1])} y={y + 6} width={X(hi) - X(r.p.tol[1])} height={rowH - 12} className={`gd-cap-bar is-${r.status}`} />
            <rect x={X(r.p.tol[0])} y={y + 6} width={X(r.p.tol[1]) - X(r.p.tol[0])} height={rowH - 12} className={`gd-cap-bar is-${r.status} is-care`} />
          </g>
        );
      })}
      <line x1={X(tol)} x2={X(tol)} y1={top - 4} y2={h - 26} className="gd-cap-need" />
      <text x={X(tol) + 4} y={top + 2} className="gd-label is-strong">you ±{units.num(tol)}</text>
    </svg>
  );
}

function ProcessCard({ p, why, status, units, open: startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <article className={`tf-card gd-proc ${status ? `is-${status}` : ""}`}>
      <button type="button" className="gd-proc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="gd-proc-icon" aria-hidden="true">
          <Cog size={17} />
        </span>
        <span className="gd-proc-title">
          <strong>{p.name}</strong>
          <small>
            ±{units.num(p.tol[1])} typical · ±{units.num(p.tol[0])} best · Ra {p.ra[1]}–{p.ra[0]} µm
          </small>
        </span>
        <ChevronDown size={16} className={`gd-proc-chev ${open ? "is-open" : ""}`} aria-hidden="true" />
      </button>
      {why && (
        <ul className="gd-why">
          {why.slice(0, open ? why.length : 2).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {open && (
        <div className="gd-proc-body">
          <p>{p.how}</p>
          <dl>
            <dt>Machines</dt>
            <dd>{p.machines.join(" · ")}</dd>
            <dt>Good for</dt>
            <dd>{p.good}</dd>
            <dt>Watch out</dt>
            <dd>{p.limits}</dd>
            <dt>Materials</dt>
            <dd>{p.materials.map((m) => MATERIALS.find((x) => x.id === m)?.name).join(", ")}</dd>
            <dt>Tooling</dt>
            <dd>{p.tooling}</dd>
            <dt>Geometric control</dt>
            <dd>
              {Object.entries(p.caps)
                .map(([k, v]) => `${CHARS.find((c) => c.id === k)?.name.split(" /")[0]} ${units.num(v[1])} (best ${units.num(v[0])})`)
                .join(" · ") || "Not used for geometric control"}
            </dd>
          </dl>
        </div>
      )}
    </article>
  );
}

function MethodsPage({ prefsApi }) {
  useTitle("Manufacturing methods · Engineer ToolFox");
  const units = lengthUnits(prefsApi.prefs.system);
  const [family, setFamily] = useState("all");
  const fams = family === "all" ? FAMILIES : [family];
  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <Head tab="lib" title="Manufacturing methods" lede={`${PROCESSES.length} common ways to make parts: how each works, the machines that do it, and what it can hold. Tap a card for the details.`} />
      <div className="tf-chip-row gd-fam-row" role="radiogroup" aria-label="Family">
        {["all", ...FAMILIES].map((f) => (
          <button key={f} type="button" role="radio" aria-checked={family === f} className={`tf-chip ${family === f ? "is-on" : ""}`} onClick={() => setFamily(f)}>
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>
      {fams.map((f) => (
        <section key={f}>
          <h2 className="tf-block-title">{f}</h2>
          <div className="gd-proc-grid">
            {PROCESSES.filter((p) => p.family === f).map((p) => (
              <ProcessCard key={p.id} p={p} units={units} />
            ))}
          </div>
        </section>
      ))}
      <section className="tf-card gd-rules">
        <h2>Rules of thumb</h2>
        <ol>
          <li>Each step tighter (±0.1 → ±0.05 → ±0.01 → ±0.005) roughly doubles the cost of that feature. Only tighten what has to fit.</li>
          <li>Make the shape with the cheapest process for the quantity, then finish only the features that need it: cast, then machine the bores; turn, then grind the bearing seat.</li>
          <li>Features cut in one setup line up with each other far better than features from different setups. Put related features on the same face, or reference them to the same datums.</li>
          <li>Surface finish and tolerance go together: a ±0.01 fit needs about Ra 0.8 or better, or the peaks wear off and the fit changes.</li>
        </ol>
      </section>
    </div>
  );
}
