import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Volume2, X } from "lucide-react";
import { BASICS } from "./gdtModel";
import { FrameSvg, SymbolPath, FrameBox } from "./Frame";
import { frameCells } from "./frameLayout";
import { Crumbs, Segmented, Slider } from "./ui";
import { DESIGN_HUE, lengthUnits, useTitle } from "./units";
import {
  COVER_HOLE,
  COVER_PATTERN,
  DATUM_BORE,
  ORDER_PART,
  PATTERN_HOLE,
  SQUARE_PATTERN,
  STUD,
  evaluatePattern,
  evaluateShift,
  holeMadeIn,
  seatPart,
} from "./gdtLessons";

// The longer GD&T lessons: datum modifiers and datum shift, hole patterns, and
// datum order. Each one has a drawing you can change and worked examples.

export function LessonHead({ title, lede }) {
  return (
    <header className="tf-page-head">
      <Crumbs here />
      <div className="tf-title-row">
        <h1>{title}</h1>
      </div>
      <p className="tf-lede">{lede}</p>
    </header>
  );
}

/** Previous and next lesson, so the lessons read as a course. */
export function LessonNav({ id }) {
  const i = BASICS.findIndex((b) => b.id === id);
  const prev = BASICS[i - 1];
  const next = BASICS[i + 1];
  return (
    <nav className="gd-prevnext" aria-label="More lessons">
      {prev ? (
        <Link to={`/tools/gdt/${prev.id}`} className="gd-pn">
          <ArrowLeft size={16} aria-hidden="true" /> {i}. {prev.name}
        </Link>
      ) : (
        <Link to="/tools/gdt" className="gd-pn">
          <ArrowLeft size={16} aria-hidden="true" /> GD&amp;T explorer
        </Link>
      )}
      {next ? (
        <Link to={`/tools/gdt/${next.id}`} className="gd-pn is-next">
          {i + 2}. {next.name} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <Link to="/tools/gdt" className="gd-pn is-next">
          All callouts <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}

export function Card({ title, children }) {
  return (
    <div className="tf-card gd-explain-card">
      <h3>{title}</h3>
      {typeof children === "string" ? <p>{children}</p> : children}
    </div>
  );
}

function Pass({ ok, yes = "Accept", no = "Reject" }) {
  return (
    <span className={`gd-pill ${ok ? "is-ok" : "is-bad"}`}>
      {ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />} {ok ? yes : no}
    </span>
  );
}

const MOD_OPTS = [
  { value: "RFS", label: "RFS" },
  { value: "MMC", label: "Ⓜ MMC" },
];

// Datum modifiers and datum shift ---------------------------------------------

const SHIFT_START = { tol: 0.2, mod: "MMC", dmod: "MMB", bore: 20.06, hole: 8.02, dx: 0.1, dy: 0.06, solo: 0 };

export function DatumShiftPage({ prefsApi }) {
  useTitle("Datum modifiers and datum shift · GD&T · Engineer ToolFox");
  const units = lengthUnits(prefsApi.prefs.system);
  const [s, setS] = useState(SHIFT_START);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const r = evaluateShift(s);
  const worst = Math.max(...r.errors);
  const rawWorst = Math.max(...r.raw);

  // Top view: plate 80 × 80 at 3.4 px/mm, errors drawn K px per mm.
  const W = 600, H = 400, cx = 200, cy = 200, mm = 4.3, K = 260;
  const slide = [-r.fit.sx * K, r.fit.sy * K];
  const boreR = 10 * mm + ((s.bore - 20) / 2) * K;
  const pinR = 10 * mm;
  const zr = (r.allowed / 2) * K;
  const zb = (s.tol / 2) * K;

  const sentence = `The four holes must each sit inside a ⌀${units.L(s.tol)} zone${s.mod === "MMC" ? " (plus bonus as each hole grows past ⌀8.0)" : ""}, square to A and centred on the true pattern around datum bore B${
    s.dmod === "MMB" ? ". B is read at MMB: the gauge pin is a fixed ⌀20.0, so if the bore is bigger the part may shift on it" : ". B is read at RMB: the gauge expands until it fills the bore, so the part can't shift"
  }.`;

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <LessonHead
        title="Datum modifiers and datum shift"
        lede="A circled M can sit in two places. After the tolerance it gives bonus to the feature. After a datum letter it lets the part shift on its datum. Here a plate's four holes are located from a centre bore, datum B."
      />
      <div className="gd-grid">
        <section className="tf-card gd-stage" aria-label="Datum shift drawing">
          <div className="gd-frame-wrap">
            <FrameBox symbol="position" tol={s.tol} dia mod={s.mod} datums={["A", "B"]} datumMods={["RMB", s.dmod]} fmtTol={units.num} scale={1.9} />
            <span className="gd-size-tag">{PATTERN_HOLE.label}</span>
            <span className="gd-size-tag">B = bore {DATUM_BORE.label}</span>
          </div>
          <p className="gd-read">
            <Volume2 size={15} aria-hidden="true" />
            <span>{sentence}</span>
          </p>
          <div className="gd-drawing">
<svg className="gd-sheet" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Top view of the plate sitting on a gauge pin in datum bore B">
            <g transform={`translate(${slide[0]} ${slide[1]})`}>
              <rect x={cx - 40 * mm} y={cy - 40 * mm} width={80 * mm} height={80 * mm} rx={6} className="gd-part" />
              <circle cx={cx} cy={cy} r={boreR} className="gd-cut" />
              <circle cx={cx} cy={cy} r={boreR} className="gd-actual" />
              {SQUARE_PATTERN.map(([bx, by], i) => {
                const [ox, oy] = r.offsets[i];
                return <circle key={i} cx={cx + bx * mm + ox * K} cy={cy - by * mm - oy * K} r={4 * mm} className="gd-cut" />;
              })}
            </g>
            <circle cx={cx} cy={cy} r={pinR} className="gd-gauge" />
            <text x={cx} y={cy + 4} textAnchor="middle" className="gd-label is-dim">
              {s.dmod === "MMB" ? "pin ⌀20.0" : "pin fills bore"}
            </text>
            {SQUARE_PATTERN.map(([bx, by], i) => {
              const tx = cx + bx * mm, ty = cy - by * mm;
              const [ox, oy] = r.offsets[i];
              const ax = tx + (ox - r.fit.sx) * K, ay = ty - (oy - r.fit.sy) * K;
              const ok = r.errors[i] <= r.allowed + 1e-9;
              return (
                <g key={i}>
                  <circle cx={tx} cy={ty} r={zr} className={`gd-zone ${ok ? "" : "is-bad"}`} />
                  {r.bonus > 0 && <circle cx={tx} cy={ty} r={zb} className="gd-zone-base" />}
                  <line x1={tx - 8} x2={tx + 8} y1={ty} y2={ty} className="gd-center" />
                  <line y1={ty - 8} y2={ty + 8} x1={tx} x2={tx} className="gd-center" />
                  <circle cx={ax} cy={ay} r={5} className={`gd-dot ${ok ? "" : "is-bad"}`} />
                  <text x={tx} y={ty + (by > 0 ? -zr - 8 : zr + 18)} textAnchor="middle" className="gd-label is-dim">
                    {i + 1}
                  </text>
                </g>
              );
            })}
            <g transform="translate(388 40)">
              <text className="gd-label is-strong">On the gauge</text>
              <text y={26} className="gd-label is-dim">Bore B: ⌀{units.num(s.bore)}</text>
              <text y={48} className="gd-label is-dim">Shift available: ⌀{units.num(r.shift)}</text>
              <text y={70} className="gd-label is-dim">Bonus per hole: {units.num(r.bonus)}</text>
              <text y={100} className="gd-label is-dim">Worst hole before shift:</text>
              <text y={120} className="gd-label">⌀{units.num(rawWorst)}</text>
              <text y={146} className="gd-label is-dim">Worst hole after the part</text>
              <text y={164} className="gd-label is-dim">slides on the pin:</text>
              <text y={184} className={`gd-label ${worst <= r.allowed + 1e-9 ? "is-ok" : "is-warn"}`}>
                ⌀{units.num(worst)} of ⌀{units.num(r.allowed)}
              </text>
            </g>
            <text x={W - 12} y={H - 10} textAnchor="end" className="gd-note">
              Errors and gaps exaggerated so you can see them
            </text>
          </svg>
          </div>
          <div className={`gd-verdict ${r.ok ? "is-ok" : "is-bad"}`} aria-live="polite">
            <div className="gd-verdict-top">
              <span className="gd-stamp">
                {r.ok ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />} {r.ok ? "Accept" : "Reject"}
              </span>
              <span className="gd-verdict-nums">
                worst hole <strong>⌀{units.L(worst)}</strong> · allowed <strong>⌀{units.L(r.allowed)}</strong>
                {r.shift > 0 && <em> (plus up to ⌀{units.L(r.shift)} shift for the pattern as a group)</em>}
              </span>
            </div>
            <ul className="gd-checks">
              {r.errors.map((e, i) => (
                <li key={i} className={e <= r.allowed + 1e-9 ? "is-ok" : "is-bad"}>
                  {e <= r.allowed + 1e-9 ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                  <span>
                    <strong>Hole {i + 1}</strong>
                    <span className="gd-check-nums">
                      {" "}
                      ⌀{units.L(e)} of ⌀{units.L(r.allowed)}
                    </span>
                    {r.shift > 0 && Math.abs(r.raw[i] - e) > 1e-4 && <span className="gd-check-text"> (⌀{units.L(r.raw[i])} before the part shifted)</span>}
                  </span>
                </li>
              ))}
              {!r.boreOk && (
                <li className="is-bad">
                  <X size={15} aria-hidden="true" />
                  <span>
                    <strong>Datum bore B size</strong> <span className="gd-check-text">⌀{units.num(s.bore)} is outside {DATUM_BORE.label}.</span>
                  </span>
                </li>
              )}
            </ul>
          </div>
        </section>
        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>The callout</h2>
            <div className="gd-field">
              <span className="gd-field-label">Datum B modifier</span>
              <Segmented
                label="Datum B modifier"
                small
                value={s.dmod}
                onChange={(dmod) => set({ dmod })}
                options={[
                  { value: "RMB", label: "None (RMB)" },
                  { value: "MMB", label: "Ⓜ MMB" },
                ]}
              />
            </div>
            <div className="gd-field">
              <span className="gd-field-label">Hole tolerance modifier</span>
              <Segmented label="Hole tolerance modifier" small value={s.mod} onChange={(mod) => set({ mod })} options={MOD_OPTS} />
            </div>
            <Slider id="ds-tol" label="Position tolerance" value={s.tol} min={0.05} max={0.4} step={0.01} units={units} onChange={(tol) => set({ tol })} />
          </div>
          <div className="tf-card gd-panel">
            <h2>The part as made</h2>
            <Slider id="ds-bore" label={`Datum bore B size (${DATUM_BORE.label})`} value={s.bore} min={20.0} max={20.1} step={0.005} units={units} onChange={(bore) => set({ bore })} help="Bigger than ⌀20.0 means the part can rattle on a ⌀20.0 gauge pin." />
            <Slider id="ds-hole" label="Actual size of the 4 holes" value={s.hole} min={8.0} max={8.1} step={0.005} units={units} onChange={(hole) => set({ hole })} />
            <Slider id="ds-dx" label="Whole pattern off to the right" value={s.dx} min={-0.2} max={0.2} step={0.005} units={units} onChange={(dx) => set({ dx })} />
            <Slider id="ds-dy" label="Whole pattern off upward" value={s.dy} min={-0.2} max={0.2} step={0.005} units={units} onChange={(dy) => set({ dy })} />
            <Slider id="ds-solo" label="Hole 1 off on its own" value={s.solo} min={-0.2} max={0.2} step={0.005} units={units} onChange={(solo) => set({ solo })} help="Shift moves all four holes together, so it can't rescue one stray hole." />
          </div>
        </aside>
      </div>

      <h2 className="tf-block-title">The three datum modifiers</h2>
      <section className="gd-explain">
        <Card title="None: RMB (regardless of material boundary)">
          The default. The gauge (datum feature simulator) grows or shrinks until it makes full contact with the datum feature: an expanding mandrel in a bore, a 3-jaw chuck on a shaft. The part is held tight, so there is no shift. Most accurate, but the gauge has moving parts.
        </Card>
        <Card title="Ⓜ after the letter: MMB (maximum material boundary)">
          The gauge is a fixed size at the datum's maximum material boundary: a ⌀20.0 pin for a ⌀20 +0.1/0 bore. When the real bore is bigger, the part can shift on the pin. That looseness is datum shift. Lets you build a simple fixed gauge and accept parts that still assemble.
        </Card>
        <Card title="Ⓛ after the letter: LMB (least material boundary)">
          The gauge sits at the least material boundary, so it holds the part from the side with the least material. Used when the datum feature's wall or edge distance matters more than fit, for example locating from a boss that gets machined later. Rare in gauging; mostly a CMM check.
        </Card>
        <Card title="Only features of size">
          Modifiers after a datum letter only mean something when the datum is a feature of size: a bore, a shaft, a slot or a tab. A flat face has no size, so it can't be at MMB or LMB. Datum A here is a face, so it never carries one.
        </Card>
        <Card title="Where the MMB size comes from">
          If datum B has no tolerance of its own back to A, its MMB is simply its MMC size (⌀20.0). If B also has, say, perpendicularity ⌀0.02 Ⓜ to A, the MMB is the virtual condition ⌀19.98: the gauge pin gets that much smaller and the shift grows by the same amount.
        </Card>
      </section>

      <h2 className="tf-block-title">Bonus and shift are not the same thing</h2>
      <section className="gd-explain">
        <Card title="Bonus goes to each hole">The Ⓜ after the tolerance adds (actual hole size − MMC) to each hole's own zone. A bigger hole 2 gets more room even if hole 1 is at MMC.</Card>
        <Card title="Shift goes to the whole pattern">
          The Ⓜ after B lets the part move on the gauge pin, so all four holes move together. If every hole is off the same way, shift brings them all back. If one hole is off on its own, shift can only help it by pulling the other three the other way. Try the &ldquo;Hole 1 off on its own&rdquo; slider.
        </Card>
        <Card title="Why it matters">
          Without MMB, a plate with the pattern 0.15 off the bore would be rejected even though its bore is 0.1 oversize and it slides onto the mating pin with the bolts lined up. MMB matches the check to how the part goes together, and lets a cheap fixed-pin gauge do the job.
        </Card>
      </section>

      <h2 className="tf-block-title">Worked examples</h2>
      <ShiftTable units={units} tol={s.tol} />
      <section className="gd-explain">
        <Card title="Example 1: a loose bore saves the part">
          Bore B is ⌀20.08, holes ⌀8.00 (no bonus), and the whole pattern is 0.12 off the bore centre (⌀0.24 position error against a ⌀0.2 tolerance). At RMB: rejected. At MMB the part can slide 0.04 on the ⌀20.0 pin, leaving 0.08 off, so ⌀0.16: accepted. And it really does assemble, because the mating pin has the same room.
        </Card>
        <Card title="Example 2: shift can't fix a stray hole">
          Bore ⌀20.06 (shift ⌀0.06), holes 1–3 perfect, hole 4 is 0.13 off (⌀0.26). Sliding the part 0.03 toward hole 4 brings it to ⌀0.20, just in, but moves holes 1–3 to ⌀0.06. Make hole 4 0.14 off and it fails however the part sits.
        </Card>
        <Card title="Example 3: stack bonus and shift">
          Holes at ⌀8.05 (bonus 0.05) and bore at ⌀20.10 (shift ⌀0.10). Each hole gets ⌀0.25, and the pattern as a group may sit up to 0.05 off the bore's centre on top of that. That's the most a fixed gauge would ever accept, and still exactly what the mating part can take.
        </Card>
      </section>
      <LessonNav id="datum-shift" />
    </div>
  );
}

function ShiftTable({ units, tol }) {
  const rows = [20.0, 20.025, 20.05, 20.075, 20.1];
  return (
    <div className="tf-card gd-table-card">
      <table className="gd-table">
        <caption>Position ⌀{units.num(tol)} Ⓜ | A | B Ⓜ, holes at MMC (⌀8.0, no bonus), whole pattern off the bore centre</caption>
        <thead>
          <tr>
            <th scope="col">Bore B size</th>
            <th scope="col">Shift available (⌀)</th>
            <th scope="col">Pattern may sit off-centre by</th>
            <th scope="col">Same part at RMB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const shift = b - 20;
            return (
              <tr key={b}>
                <td>⌀{units.num(b)}</td>
                <td>{units.num(shift)}</td>
                <td>up to {units.num((tol + shift) / 2)} (⌀{units.num(tol + shift)})</td>
                <td>up to {units.num(tol / 2)} (⌀{units.num(tol)})</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Hole patterns ------------------------------------------------------------------

const PATTERN_START = { type: "composite", single: 0.4, upper: 0.8, lower: 0.4, px: 0.25, py: -0.15, rotDeg: 0.1, stray: 0.0, hole: 8.45 };

/** A composite frame: one symbol cell spanning two rows of tolerance and datums. */
function CompositeFrame({ upper, lower, mod, fmt, scale = 1.7 }) {
  const top = frameCells({ symbol: "position", tol: upper.tol, dia: true, mod, datums: upper.datums, fmtTol: fmt });
  const bot = frameCells({ symbol: "position", tol: lower.tol, dia: true, mod, datums: lower.datums, fmtTol: fmt });
  const h = top.h;
  const w = Math.max(top.w, bot.w);
  const strip = (l) => ({ ...l, cells: l.cells.filter((c) => c.key !== "symbol") });
  return (
    <svg className="gd-fcf-svg" width={(w + 4) * scale} height={(h * 2 + 4) * scale} viewBox={`-2 -2 ${w + 4} ${h * 2 + 4}`} role="img" aria-label="Composite position frame">
      <FrameSvg layout={strip(top)} />
      <FrameSvg layout={strip(bot)} y={h} />
      <g className="gd-fcf">
        <rect x={0} y={0} width={h} height={h * 2} className="gd-fcf-box" />
        <g transform={`translate(${h / 2} ${h}) scale(1.05)`}>
          <SymbolPath id="position" />
        </g>
      </g>
    </svg>
  );
}

export function PatternPage({ prefsApi }) {
  useTitle("Locating a hole pattern · GD&T · Engineer ToolFox");
  const units = lengthUnits(prefsApi.prefs.system);
  const [s, setS] = useState(PATTERN_START);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const r = evaluatePattern(s);
  const comp = s.type === "composite";
  const ok = comp ? r.composite.ok : r.single.ok;

  // Plate 100 × 70 at 5 px/mm, errors drawn K px per mm.
  const W = 620, H = 440, x0 = 60, y0 = 50, mm = 5, K = 110;
  const P = ([x, y]) => [x0 + x * mm, y0 + 70 * mm - y * mm];
  const E = (basic, actual) => {
    const [bx, by] = P(basic);
    return [bx + (actual[0] - basic[0]) * K, by - (actual[1] - basic[1]) * K];
  };

  const sentence = comp
    ? `Upper line: each hole within ⌀${units.L(s.upper)} of true position from A, B and C (where the pattern sits on the plate). Lower line: each hole within ⌀${units.L(s.lower)} of the others, square to A, with the pattern free to move and turn (how the holes line up with each other).`
    : `Each hole must be within ⌀${units.L(s.single)} of its true position from A, B and C. That one number has to cover both where the pattern sits and how the holes line up with each other.`;

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <LessonHead
        title="Locating a hole pattern"
        lede="A cover bolts on with four M8 studs. What really matters is that the four holes line up with each other; where the group sits on the plate can be looser. Single-segment position can't say that. Composite position can."
      />
      <div className="gd-grid">
        <section className="tf-card gd-stage" aria-label="Hole pattern drawing">
          <div className="gd-frame-wrap">
            {comp ? (
              <CompositeFrame upper={{ tol: s.upper, datums: ["A", "B", "C"] }} lower={{ tol: s.lower, datums: ["A"] }} mod="MMC" fmt={units.num} />
            ) : (
              <FrameBox symbol="position" tol={s.single} dia mod="MMC" datums={["A", "B", "C"]} fmtTol={units.num} scale={1.7} />
            )}
            <span className="gd-size-tag">{COVER_HOLE.label}</span>
          </div>
          <p className="gd-read">
            <Volume2 size={15} aria-hidden="true" />
            <span>{sentence}</span>
          </p>
          <div className="gd-drawing">
<svg className="gd-sheet" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Top view of a plate with a four-hole pattern and its tolerance zones">
            <rect x={x0} y={y0} width={100 * mm} height={70 * mm} className="gd-part" />
            <text x={x0 - 10} y={y0 + 35 * mm} textAnchor="end" className="gd-label is-dim">B</text>
            <text x={x0 + 50 * mm} y={y0 + 70 * mm + 20} textAnchor="middle" className="gd-label is-dim">C</text>
            {comp &&
              r.fit.fitted.map((f, i) => {
                const [fx, fy] = E(COVER_PATTERN[i], f);
                return <circle key={`f${i}`} cx={fx} cy={fy} r={((s.lower + r.bonus) / 2) * K} className={`gd-zone ${r.lower.errors[i] <= r.lower.allowed + 1e-9 ? "" : "is-bad"} is-inner`} />;
              })}
            {COVER_PATTERN.map((b, i) => {
              const [bx, by] = P(b);
              const big = comp ? r.upper : r.single;
              const okHole = big.errors[i] <= big.allowed + 1e-9;
              const [ax, ay] = E(b, r.actual[i]);
              return (
                <g key={i}>
                  <circle cx={bx} cy={by} r={(big.allowed / 2) * K} className={`gd-zone ${okHole ? "" : "is-bad"}`} />
                  <line x1={bx - 10} x2={bx + 10} y1={by} y2={by} className="gd-center" />
                  <line y1={by - 10} y2={by + 10} x1={bx} x2={bx} className="gd-center" />
                  <circle cx={ax} cy={ay} r={5} className="gd-dot" />
                </g>
              );
            })}
            <polygon points={r.actual.map((a, i) => E(COVER_PATTERN[i], a).join(",")).join(" ")} className="gd-pattern-line" />
            <text x={x0} y={y0 - 16} className="gd-label is-dim">
              {comp ? "Big circles: upper line (from A, B, C). Small circles: lower line (fitted to the holes)." : "Circles: each hole's zone from A, B, C."}
            </text>
            <text x={x0} y={H - 14} className="gd-label is-dim">dot = actual hole centre</text>
            <text x={W - 12} y={H - 14} textAnchor="end" className="gd-note">
              Errors exaggerated so you can see them
            </text>
          </svg>
          </div>
          <div className={`gd-verdict ${ok ? "is-ok" : "is-bad"}`} aria-live="polite">
            <div className="gd-verdict-top">
              <span className="gd-stamp">
                {ok ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />} {ok ? "Accept" : "Reject"}
              </span>
              <span className="gd-verdict-nums">
                The cover {r.assembles ? <strong>bolts on</strong> : <strong>won't go on</strong>}: worst hole is {units.L(Math.max(...r.fit.left))} off the best-fit pattern, clearance is {units.L(r.clearance)}.
              </span>
            </div>
            <div className="gd-compare">
              <div>
                <span>Single ⌀{units.num(s.single)}</span>
                <Pass ok={r.single.ok} />
              </div>
              <div>
                <span>Composite upper ⌀{units.num(s.upper)}</span>
                <Pass ok={r.upper.ok && r.sizeOk} />
              </div>
              <div>
                <span>Composite lower ⌀{units.num(s.lower)}</span>
                <Pass ok={r.lower.ok && r.sizeOk} />
              </div>
              <div>
                <span>Cover with 4 fixed ⌀{STUD} studs</span>
                <Pass ok={r.assembles} yes="Fits" no="Doesn't fit" />
              </div>
            </div>
            {r.single.ok !== r.assembles && (
              <p className="gd-vc">
                {r.assembles
                  ? "Single-segment position rejects a part that bolts on fine. Composite lets the pattern sit further from the edges as long as the holes line up."
                  : "Single-segment accepted this part but the cover doesn't fit, because each hole was judged on its own."}
              </p>
            )}
            {!r.sizeOk && <p className="tf-warning">Hole size is outside {COVER_HOLE.label}.</p>}
          </div>
        </section>
        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>The callout</h2>
            <Segmented
              label="Frame type"
              small
              value={s.type}
              onChange={(type) => set({ type })}
              options={[
                { value: "single", label: "Single" },
                { value: "composite", label: "Composite" },
              ]}
            />
            {comp ? (
              <>
                <Slider id="pt-up" label="Upper line: pattern location" value={s.upper} min={0.2} max={1.2} step={0.05} units={units} onChange={(upper) => set({ upper })} />
                <Slider id="pt-lo" label="Lower line: hole to hole" value={s.lower} min={0.05} max={0.6} step={0.01} units={units} onChange={(lower) => set({ lower })} />
              </>
            ) : (
              <Slider id="pt-single" label="Position tolerance" value={s.single} min={0.05} max={1.2} step={0.01} units={units} onChange={(single) => set({ single })} />
            )}
          </div>
          <div className="tf-card gd-panel">
            <h2>The part as made</h2>
            <Slider id="pt-px" label="Whole pattern off to the right" value={s.px} min={-0.5} max={0.5} step={0.01} units={units} onChange={(px) => set({ px })} />
            <Slider id="pt-py" label="Whole pattern off upward" value={s.py} min={-0.5} max={0.5} step={0.01} units={units} onChange={(py) => set({ py })} />
            <Slider id="pt-rot" label="Pattern turned" value={s.rotDeg} min={-0.5} max={0.5} step={0.01} unit="deg" units={units} onChange={(rotDeg) => set({ rotDeg })} />
            <Slider id="pt-stray" label="Hole 3 off on its own" value={s.stray} min={-0.3} max={0.3} step={0.01} units={units} onChange={(stray) => set({ stray })} />
            <Slider id="pt-size" label={`Actual hole size (${COVER_HOLE.label})`} value={s.hole} min={8.35} max={8.65} step={0.005} units={units} onChange={(hole) => set({ hole })} help="Bigger holes give bonus to both lines of the frame, and more clearance for the studs." />
          </div>
        </aside>
      </div>

      <h2 className="tf-block-title">How a pattern is controlled</h2>
      <section className="gd-explain">
        <Card title="Single segment: one number for everything">Each hole must be inside its own zone, located from A, B and C. Fine when the pattern's location on the part matters as much as hole-to-hole, but it forces a tight location tolerance just to get the holes to line up.</Card>
        <Card title="Composite upper line (PLTZF)">The pattern-locating tolerance zone framework. Big zones, fixed to all the datums: where the group of holes sits on the part. It's usually loose, because the cover only needs to land roughly in the right place.</Card>
        <Card title="Composite lower line (FRTZF)">The feature-relating tolerance zone framework. Small zones in the perfect pattern, but they may slide and turn as a group, held only square to A. Each hole must be inside both its big zone and its small zone.</Card>
        <Card title="Two single segments">If the lower line repeats the datums in full (two separate symbols, one on each line), it's not composite: each line locates and orients on its own. Composite is the stacked frame with one shared symbol.</Card>
        <Card title="Simultaneous requirement">Two patterns that use the same datums, in the same order, with the same modifiers are checked as one pattern by default, as if they were a single gauge. Write SEP REQT under a frame to let them be checked separately.</Card>
        <Card title="How it's gauged">A fixed gauge: a plate with four pins at the virtual condition (⌀8.4 − tol), in the exact pattern. For composite, one gauge locates on A, B, C (upper line), a second sits on A only and may float (lower line).</Card>
      </section>

      <h2 className="tf-block-title">Worked examples</h2>
      <section className="gd-explain">
        <Card title="Example 1: good part, wrong callout">Pattern 0.25 right and 0.15 down, holes perfectly spaced, ⌀8.45. Single ⌀0.4 Ⓜ: each hole is ⌀0.58 off, allowed ⌀0.45, rejected. The cover bolts on fine. Composite ⌀0.8 / ⌀0.4: accepted. That's close to the starting setup on this page.</Card>
        <Card title="Example 2: holes don't line up">Pattern shift and turn at 0, holes ⌀8.4, hole 3 is 0.3 off on its own. Single ⌀0.4: hole 3 is ⌀0.60, rejected. But the cover can float, so the best-fit pattern splits the error: every hole is within ⌀0.30 of it, the lower line ⌀0.4 accepts, and the cover fits. Push hole 3 to 0.4 off and the lower line and the cover both fail together. Try it on the sliders.</Card>
        <Card title="Example 3: a turned pattern">Turn the pattern 0.4°. The far corners move about 0.25 each. The upper line sees it, because zones are fixed to B and C; the lower line doesn't, because its zones can turn with the pattern. The cover doesn't care either: it turns too.</Card>
        <Card title="Picking the numbers">Floating fastener: hole-to-hole T = H − F = 8.4 − 8.0 = ⌀0.4 for each part. That's the lower line, so it accepts exactly the plates the cover fits (with fixed studs on a perfect cover; a real cover shares the ⌀0.4 too). The upper line comes from how far the cover's edge can overhang the plate, often 4–10× looser.</Card>
      </section>
      <LessonNav id="patterns" />
    </div>
  );
}

// Datum order --------------------------------------------------------------------

const ORDER_START = { lean: 0.25, made: "AB", ex: 0, ez: 0, tol: 0.2 };
const EXAG = 30; // the drawing tilts the face 30× more than the real lean so it shows

function OrderPanel({ order, s, units }) {
  const hole = holeMadeIn(s.made, s.lean, s.ex, s.ez);
  const real = seatPart(order, s.lean, hole);
  const holeBig = holeMadeIn(s.made, s.lean * EXAG, s.ex * EXAG, s.ez * EXAG);
  const big = seatPart(order, s.lean * EXAG, holeBig);
  const ok = real.error <= s.tol + 1e-9;
  const mm = 3.6, ox = 52, oy = 236;
  const P = ([x, z]) => [ox + x * mm, oy - z * mm];
  const [hx, hy] = P(big.hole);
  const [tx, ty] = P([ORDER_PART.hx, ORDER_PART.hz]);
  const prim = order === "AB" ? "A" : "B";
  const sec = order === "AB" ? "B" : "A";
  const sc = P(big.contact.secondary);
  return (
    <div className={`gd-order-panel ${ok ? "is-ok" : "is-bad"}`}>
      <div className="gd-order-head">
        <FrameBox symbol="position" tol={s.tol} dia datums={order.split("")} fmtTol={units.num} scale={1.3} />
        <Pass ok={ok} />
      </div>
      <svg className="gd-sheet" viewBox="0 0 320 280" role="img" aria-label={`Part held with datum ${prim} primary and ${sec} secondary`}>
        <rect x={ox - 30} y={oy} width={260} height={14} className="gd-fixture" />
        <rect x={ox - 30} y={oy - 190} width={30} height={190} className="gd-fixture" />
        <text x={ox + 230} y={oy + 30} textAnchor="end" className="gd-label is-dim">
          A simulator{prim === "A" ? " (primary)" : ""}
        </text>
        <text x={ox - 26} y={oy - 196} className="gd-label is-dim">
          B{prim === "B" ? " (primary)" : ""}
        </text>
        <polygon points={big.corners.map((c) => P(c).join(",")).join(" ")} className="gd-part" />
        <line x1={P(big.contact.primary[0])[0]} y1={P(big.contact.primary[0])[1]} x2={P(big.contact.primary[1])[0]} y2={P(big.contact.primary[1])[1]} className="gd-contact-line" />
        <circle cx={sc[0]} cy={sc[1]} r={6} className="gd-contact" style={{ "--gd-rank": "#7be0c3" }} />
        <circle cx={tx} cy={ty} r={((s.tol / 2) * EXAG * mm) || 1} className={`gd-zone ${ok ? "" : "is-bad"}`} />
        <line x1={tx - 12} x2={tx + 12} y1={ty} y2={ty} className="gd-center" />
        <line y1={ty - 12} y2={ty + 12} x1={tx} x2={tx} className="gd-center" />
        <circle cx={hx} cy={hy} r={5} className={`gd-dot ${ok ? "" : "is-bad"}`} />
      </svg>
      <p className="gd-order-nums">
        Hole measures {units.L(ORDER_PART.hx + real.dx)} from B and {units.L(ORDER_PART.hz + real.dz)} from A. Position error <strong>⌀{units.L(real.error)}</strong> of ⌀{units.L(s.tol)}.
      </p>
    </div>
  );
}

export function DatumOrderPage({ prefsApi }) {
  useTitle("Why datum order matters · GD&T · Engineer ToolFox");
  const units = lengthUnits(prefsApi.prefs.system);
  const [s, setS] = useState(ORDER_START);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <LessonHead
        title="Why datum order matters"
        lede="Real faces are never perfectly square. This block's side face B leans out a quarter of a degree from its bottom A. The hole was drilled 30 from B and 20 from A. Hold the part A first or B first and the same hole measures differently."
      />
      <div className="gd-grid">
        <section className="tf-card gd-stage" aria-label="Datum order comparison">
          <div className="gd-order-grid">
            <OrderPanel order="AB" s={s} units={units} />
            <OrderPanel order="BA" s={s} units={units} />
          </div>
          <p className="gd-help">
            Side view. The long green line is the primary datum, in full contact (3 points on the real part). The green dot is where the secondary touches: only the high point. Drawn with the lean {EXAG}× bigger so you can see it; the numbers are real.
          </p>
        </section>
        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>The part as made</h2>
            <Slider id="do-lean" label="Face B out of square to A" value={s.lean} min={-0.6} max={0.6} step={0.01} unit="deg" units={units} onChange={(lean) => set({ lean })} help="Positive leans the top of B outward." />
            <div className="gd-field">
              <span className="gd-field-label">The shop drilled it held</span>
              <Segmented
                label="Drilling setup"
                small
                value={s.made}
                onChange={(made) => set({ made })}
                options={[
                  { value: "AB", label: "On A, against B" },
                  { value: "BA", label: "On B, against A" },
                ]}
              />
            </div>
            <Slider id="do-ex" label="Drilling error, along" value={s.ex} min={-0.15} max={0.15} step={0.005} units={units} onChange={(ex) => set({ ex })} />
            <Slider id="do-ez" label="Drilling error, up" value={s.ez} min={-0.15} max={0.15} step={0.005} units={units} onChange={(ez) => set({ ez })} />
            <Slider id="do-tol" label="Position tolerance" value={s.tol} min={0.05} max={0.5} step={0.01} units={units} onChange={(tol) => set({ tol })} />
          </div>
        </aside>
      </div>

      <h2 className="tf-block-title">What's going on</h2>
      <section className="gd-explain">
        <Card title="Same part, different answer">Held A first, the block sits flat on its bottom and touches B only at the top corner. Held B first, it stands flat on its side and touches A only at one bottom corner. The whole part is turned by the out-of-square angle between the two, so the hole moves by roughly its distance × the angle.</Card>
        <Card title="The primary wins">The primary datum gets full contact and sets the orientation. The secondary only stops the part sliding. So whichever face is primary gets its errors ignored, and the others' errors show up as location error.</Card>
        <Card title="Pick the order from the assembly">Ask how the part really sits in use. If the block bolts down on its bottom face and a pin locates its side, use A | B. If it clamps against a wall first, use B | A. Then the check matches what the hole sees in the machine.</Card>
        <Card title="And tell the shop">The drawing order also tells the shop how to fixture the part. Drill it held the same way it's checked (try the &ldquo;shop drilled it&rdquo; switch) and the out-of-square face costs nothing.</Card>
      </section>

      <h2 className="tf-block-title">Worked examples</h2>
      <section className="gd-explain">
        <Card title="Example 1: right order, perfect part">Lean 0.25°, drilled on A against B, checked ⌀0.2 | A | B: error ⌀0.00. Checked | B | A: the part turns 0.25°, the hole moves about 0.09 along and 0.13 up, error ⌀0.32. Same part, rejected.</Card>
        <Card title="Example 2: twice the angle, twice the error">At 0.5° the B | A error is about ⌀0.63. The error grows with the angle and with how far the hole is from where the part pivots, so big parts with far-off holes are hit hardest.</Card>
        <Card title="Example 3: a square part doesn't care">Set the lean to 0°. Both orders read the same. Datum order only changes the answer when the datum features aren't perfect, which is always on real parts. A perpendicularity callout on B to A limits how big this can get.</Card>
        <Card title="Example 4: tertiary datum C">Add a third face C (the end of the block) and it removes the last spin. Swapping B and C has the same effect in the other direction: the secondary gets 2 points of contact, the tertiary only 1.</Card>
      </section>
      <LessonNav id="datum-order" />
    </div>
  );
}
