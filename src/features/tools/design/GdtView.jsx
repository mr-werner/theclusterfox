import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Factory, RotateCcw, TriangleAlert, Volume2, X } from "lucide-react";
import { BASICS, CALLOUTS, GROUPS, allowsMods, calloutById, evaluate, initialState, showsDia } from "./gdtModel";
import { FrameBox, Symbol } from "./Frame";
import { frameCells } from "./frameLayout";
import CalloutDiagram from "./GdtDiagrams";
import { capableOf } from "./processes";
import { Crumbs, Segmented, Slider } from "./ui";
import { DESIGN_HUE, lengthUnits, useTitle } from "./units";
import { DatumsPage, FramePage, ModifiersPage } from "./GdtBasics";
import "./design.css";

// GD&T explorer: an index of every callout, and a page per callout where you
// edit the feature control frame and the part as made, and watch the drawing
// and the accept / reject verdict change.

export function GdtIndex() {
  useTitle("GD&T explorer · Engineer ToolFox");
  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <header className="tf-page-head">
        <Crumbs />
        <div className="tf-title-row">
          <h1>GD&amp;T explorer</h1>
        </div>
        <p className="tf-lede">
          Every geometric tolerance symbol, with a drawing you can change. Edit the callout or the part and see the tolerance zone move and the part pass or fail. Based on ASME Y14.5-2018; ISO 1101 works the same way for these.
        </p>
      </header>

      <h2 className="tf-block-title">Start here</h2>
      <div className="gd-basics">
        {BASICS.map((b, i) => (
          <Link key={b.id} to={`/tools/gdt/${b.id}`} className="gd-basic-card">
            <span className="gd-basic-num">{i + 1}</span>
            <span>
              <strong>{b.name}</strong>
              <span>{b.summary}</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </div>

      {GROUPS.map((g) => (
        <section key={g.id}>
          <h2 className="tf-block-title">
            {g.name} <small className="gd-group-blurb">{g.blurb}</small>
          </h2>
          <div className="gd-sym-grid">
            {CALLOUTS.filter((c) => c.group === g.id).map((c) => (
              <Link key={c.id} to={`/tools/gdt/${c.id}`} className="gd-sym-card">
                <span className="gd-sym-tile" aria-hidden="true">
                  <Symbol id={c.id} size={30} />
                </span>
                <span className="gd-sym-text">
                  <strong>
                    {c.name}
                    {c.legacy && <em className="gd-legacy">Legacy</em>}
                  </strong>
                  <span>{c.summary}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="tf-card gd-rules">
        <h2>Three rules that sit behind every callout</h2>
        <ol>
          <li>
            <strong>Rule #1 (envelope).</strong> A feature of size at its maximum material size must have perfect form. So a pin at its biggest allowed diameter must be perfectly straight and round, and size limits already control form.
          </li>
          <li>
            <strong>Basic dimensions are exact.</strong> Boxed numbers have no tolerance of their own. They say where the true position or true profile is; the feature control frame says how far the part may stray from it.
          </li>
          <li>
            <strong>Datums are read in order.</strong> The part sits on the primary, is pushed against the secondary, then slid to the tertiary. Changing the order changes the part that gets accepted.
          </li>
        </ol>
      </section>
    </div>
  );
}

export function GdtRoute({ prefsApi }) {
  const { id } = useParams();
  if (id === "frame") return <FramePage prefsApi={prefsApi} />;
  if (id === "datums") return <DatumsPage prefsApi={prefsApi} />;
  if (id === "modifiers") return <ModifiersPage prefsApi={prefsApi} />;
  const c = calloutById[id];
  if (!c) return <GdtIndex />;
  return <CalloutPage key={id} c={c} prefsApi={prefsApi} />;
}

const DATUMS_FOR = (c) => (c.id === "position" ? ["A", "B", "C"] : c.group === "profile" ? ["A", "B"] : ["A"]);

const CELL_HELP = {
  symbol: (c) => `${c.name}: the geometric characteristic. It decides what shape the tolerance zone is and whether datums are allowed.`,
  tol: (c, s) =>
    `The tolerance: the width of the zone${showsDia(c, s) ? ". The ⌀ in front makes the zone a cylinder, so the number is its diameter" : ""}.${allowsMods(c, s) && s.mod !== "RFS" ? ` The circled ${s.mod === "MMC" ? "M" : "L"} means the tolerance applies at ${s.mod} and grows as the feature's size moves away from it.` : ""}`,
  datum: (c, s, i) => `Datum ${s.datums[i]}, the ${["primary", "secondary", "tertiary"][i]} datum: ${["the part sits on it first", "the part is pushed against it next", "the part is slid against it last"][i]}. The zone is fixed relative to it.`,
};

function CalloutPage({ c, prefsApi }) {
  useTitle(`${c.name} · GD&T · Engineer ToolFox`);
  const units = lengthUnits(prefsApi.prefs.system);
  const [s, setS] = useState(() => initialState(c));
  const [active, setActive] = useState(null);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const r = useMemo(() => evaluate(c, s), [c, s]);
  const dia = showsDia(c, s);
  const mod = allowsMods(c, s) ? s.mod : "RFS";
  const layoutProps = { symbol: c.id, tol: s.tol, dia, mod, datums: s.datums, fmtTol: units.num };
  const layout = frameCells(layoutProps);
  const idx = CALLOUTS.indexOf(c);
  const prev = CALLOUTS[(idx - 1 + CALLOUTS.length) % CALLOUTS.length];
  const next = CALLOUTS[(idx + 1) % CALLOUTS.length];
  const group = GROUPS.find((g) => g.id === c.group);
  const avail = DATUMS_FOR(c);
  const cellHelp = active === "symbol" ? CELL_HELP.symbol(c) : active === "tol" ? CELL_HELP.tol(c, s) : active?.startsWith("datum") ? CELL_HELP.datum(c, s, Number(active.slice(5))) : null;

  const toggleDatum = (d) => {
    const has = s.datums.includes(d);
    const nextD = has ? s.datums.filter((x) => x !== d) : [...s.datums, d].sort();
    if (c.frame.datums === "required" && nextD.length === 0) return set({ datums: [] });
    set({ datums: nextD });
  };

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <header className="tf-page-head">
        <Crumbs here />
        <div className="tf-title-row">
          <span className="gd-title-sym" aria-hidden="true">
            <Symbol id={c.id} size={34} />
          </span>
          <h1>{c.name}</h1>
        </div>
        <p className="tf-lede">{c.summary}</p>
        <div className="gd-tags">
          <span className="gd-tag">{group.name}</span>
          <span className="gd-tag">{c.frame.datums === "none" ? "No datums" : c.frame.datums === "required" ? "Needs a datum" : "Datums optional"}</span>
          {c.legacy && <span className="gd-tag is-warn">Removed in ASME Y14.5-2018</span>}
        </div>
      </header>

      <nav className="gd-strip" aria-label="All callouts">
        {CALLOUTS.map((x) => (
          <Link key={x.id} to={`/tools/gdt/${x.id}`} className={`gd-strip-btn ${x.id === c.id ? "is-on" : ""}`} title={x.name} aria-label={x.name} aria-current={x.id === c.id ? "page" : undefined}>
            <Symbol id={x.id} size={22} />
          </Link>
        ))}
      </nav>

      <div className="gd-grid">
        <section className="tf-card gd-stage" aria-label="Drawing">
          <div className="gd-stage-head">
            <div className="gd-frame-wrap">
              <FrameBox {...layoutProps} active={active} onCell={(k) => setActive((a) => (a === k ? null : k))} scale={1.7} />
              <p className="gd-frame-hint">{cellHelp || "Tap a box in the frame to see what it means."}</p>
            </div>
            <p className="gd-read">
              <Volume2 size={15} aria-hidden="true" />
              <span>{c.read(s, units.L)}</span>
            </p>
          </div>
          <div className="gd-drawing">
            <CalloutDiagram id={c.id} s={{ ...s, dia, mod }} r={r} layout={layout} />
          </div>
          <Verdict r={r} units={units} />
        </section>

        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>The callout</h2>
            {c.modes && <Segmented label="Applies to" options={c.modes} value={s.mode} onChange={(mode) => set({ mode })} small />}
            <Slider id="gd-tol" label={dia ? "Tolerance (zone diameter)" : "Tolerance (zone width)"} value={s.tol} min={c.frame.tol[0]} max={c.frame.tol[1]} step={c.frame.tol[2]} units={units} onChange={(tol) => set({ tol })} />
            {c.frame.dia === "optional" && (
              <label className="gd-check">
                <input type="checkbox" checked={s.dia} onChange={(e) => set({ dia: e.target.checked })} />
                <span>⌀ round (cylindrical) zone</span>
              </label>
            )}
            {allowsMods(c, s) && (
              <div className="gd-field">
                <span className="gd-field-label">Material condition</span>
                <Segmented
                  label="Material condition"
                  small
                  value={s.mod}
                  onChange={(m) => set({ mod: m })}
                  options={[
                    { value: "RFS", label: "None (RFS)" },
                    { value: "MMC", label: "Ⓜ MMC" },
                    { value: "LMC", label: "Ⓛ LMC" },
                  ]}
                />
              </div>
            )}
            {c.frame.datums !== "none" ? (
              <div className="gd-field">
                <span className="gd-field-label">Datums referenced</span>
                <div className="tf-chip-row">
                  {avail.map((d) => (
                    <button key={d} type="button" className={`tf-chip ${s.datums.includes(d) ? "is-on" : ""}`} aria-pressed={s.datums.includes(d)} onClick={() => toggleDatum(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="gd-help">Form controls never take datums: they compare the feature only to itself.</p>
            )}
          </div>

          <div className="tf-card gd-panel">
            <div className="gd-panel-head">
              <h2>The part as made</h2>
              <button type="button" className="tf-icon-btn" onClick={() => setS(initialState(c))} title="Reset" aria-label="Reset to the starting part">
                <RotateCcw size={15} />
              </button>
            </div>
            {c.params(s).map((p) =>
              p.choices ? (
                <div className="gd-field" key={p.key}>
                  <span className="gd-field-label">{p.label}</span>
                  <Segmented label={p.label} small value={s[p.key]} onChange={(v) => set({ [p.key]: v })} options={p.choices.map((v) => ({ value: v, label: String(v) }))} />
                  {p.help && <p className="gd-help">{p.help}</p>}
                </div>
              ) : (
                <Slider key={p.key} id={`gd-${p.key}`} label={p.label} help={p.help} value={s[p.key]} min={p.min} max={p.max} step={p.step} unit={p.unit || "mm"} units={units} onChange={(v) => set({ [p.key]: v })} />
              )
            )}
          </div>
        </aside>
      </div>

      <section className="gd-explain" aria-label="Explanation">
        <Explain title="What it means">{c.text.means}</Explain>
        <Explain title="The tolerance zone">{c.text.zone}</Explain>
        <Explain title="How it changes the part">{c.text.part}</Explain>
        <Explain title="How it changes acceptance">{c.text.accept}</Explain>
        <Explain title="Datums">{c.text.datums}</Explain>
        <Explain title="Modifiers">{c.text.modifiers}</Explain>
        <Explain title="How it's checked">{c.text.inspect}</Explain>
        <Explain title="Common mistakes">
          <ul>
            {c.text.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Explain>
      </section>

      <MakeIt c={c} s={s} units={units} />

      <nav className="gd-prevnext" aria-label="More callouts">
        <Link to={`/tools/gdt/${prev.id}`} className="gd-pn">
          <ArrowLeft size={16} aria-hidden="true" />
          <Symbol id={prev.id} size={20} /> {prev.name}
        </Link>
        <Link to={`/tools/gdt/${next.id}`} className="gd-pn is-next">
          {next.name} <Symbol id={next.id} size={20} />
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}

function Explain({ title, children }) {
  return (
    <div className="tf-card gd-explain-card">
      <h3>{title}</h3>
      {typeof children === "string" ? <p>{children}</p> : children}
    </div>
  );
}

export function Verdict({ r, units }) {
  const m = r.main;
  const has = Number.isFinite(m.measured) && Number.isFinite(m.allowed);
  const top = has ? Math.max(m.allowed, m.measured) * 1.15 || 1 : 1;
  const pct = (v) => `${Math.min(100, (v / top) * 100)}%`;
  return (
    <div className={`gd-verdict ${r.ok ? "is-ok" : "is-bad"}`} aria-live="polite">
      <div className="gd-verdict-top">
        <span className="gd-stamp">{r.ok ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />} {r.ok ? "Accept" : "Reject"}</span>
        {has && (
          <span className="gd-verdict-nums">
            measured <strong>{units.L(m.measured)}</strong> · allowed <strong>{units.L(m.allowed)}</strong>
            {m.bonus > 0 && <em> (incl. {units.L(m.bonus)} bonus)</em>}
          </span>
        )}
      </div>
      {has && (
        <div className="gd-meter" aria-hidden="true">
          <span className="gd-meter-base" style={{ width: pct(m.base ?? m.allowed) }} />
          {m.bonus > 0 && <span className="gd-meter-bonus" style={{ left: pct(m.base), width: `calc(${pct(m.allowed)} - ${pct(m.base)})` }} />}
          <span className="gd-meter-mark" style={{ left: pct(m.measured) }} />
        </div>
      )}
      <ul className="gd-checks">
        {r.checks.map((k) => (
          <li key={k.id} className={k.ok ? "is-ok" : "is-bad"}>
            {k.ok ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
            <span>
              <strong>{k.label}</strong>
              {k.measured != null && k.allowed != null && (
                <span className="gd-check-nums">
                  {" "}
                  {units.L(k.measured)} of {units.L(k.allowed)}
                </span>
              )}
              {k.text && <span className="gd-check-text"> {k.text}</span>}
            </span>
          </li>
        ))}
      </ul>
      {r.vc != null && (
        <p className="gd-vc">
          {r.mod === "MMC"
            ? `Virtual condition ⌀${units.num(r.vc)}: the size of the fixed gauge ${r.vc > 10.05 ? "sleeve" : "pin"} that checks this in one go. It's also the worst case a mating part sees.`
            : `Virtual condition ⌀${units.num(r.vc)}: the worst-case boundary on the other side, used to protect minimum wall thickness.`}
        </p>
      )}
      {r.warnings.map((w) => (
        <p key={w} className="tf-warning">
          <TriangleAlert size={15} aria-hidden="true" /> {w}
        </p>
      ))}
    </div>
  );
}

function MakeIt({ c, s, units }) {
  const list = capableOf(c.make.char, s.tol, { feature: c.make.feature }).slice(0, 6);
  const q = new URLSearchParams({ char: c.make.char, ct: String(s.tol), f: c.make.feature, from: c.id });
  return (
    <section className="tf-card gd-make">
      <div className="gd-make-head">
        <h2>
          <Factory size={18} aria-hidden="true" /> What it takes to make {units.L(s.tol)}
        </h2>
        <Link to={`/tools/make?${q}`} className="gd-make-link">
          Open in the process finder <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {list.length ? (
        <ul className="gd-make-list">
          {list.map(({ p, cap, f }) => (
            <li key={p.id}>
              <span className={`gd-fit is-${f === 2 ? "good" : "care"}`}>{f === 2 ? "Holds it" : "With care"}</span>
              <span>
                <strong>{p.name}</strong>
                <small>
                  typical {units.L(cap[1])}, best about {units.L(cap[0])} · {p.machines[0]}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="gd-help">Nothing common holds {units.L(s.tol)} for this. It needs specialist work (or a looser tolerance).</p>
      )}
      <p className="gd-help">Typical shop values for a small to medium part. Tighter tolerances cost more at every step: slower cuts, more setups, more inspection.</p>
    </section>
  );
}
