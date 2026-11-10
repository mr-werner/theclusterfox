import { useState } from "react";
import { Check, TriangleAlert, Volume2 } from "lucide-react";
import { CALLOUTS, GROUPS, HOLE, PIN, bonusFor, calloutById, inSize, virtualCondition } from "./gdtModel";
import { FrameBox } from "./Frame";
import { Crumbs, Segmented, Slider } from "./ui";
import { DESIGN_HUE, lengthUnits, useTitle } from "./units";

// The three "start here" pages: reading a frame, datums, and material condition modifiers.

function Head({ title, lede }) {
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

// Reading a feature control frame ------------------------------------------------

const NO_DIA = new Set(["flatness", "circularity", "cylindricity", "profile-line", "profile-surface", "circular-runout", "total-runout", "symmetry"]);
const NO_MODS = new Set(["flatness", "circularity", "cylindricity", "profile-line", "profile-surface", "circular-runout", "total-runout", "concentricity", "symmetry"]);
const RANKS = ["primary", "secondary", "tertiary"];

export function FramePage({ prefsApi }) {
  useTitle("Reading a feature control frame · GD&T · Engineer ToolFox");
  const units = lengthUnits(prefsApi.prefs.system);
  const [sym, setSym] = useState("position");
  const [tol, setTol] = useState(0.25);
  const [dia, setDia] = useState(true);
  const [mod, setMod] = useState("MMC");
  const [dat, setDat] = useState(["A", "B", "C"]);
  const [active, setActive] = useState("tol");
  const c = calloutById[sym];
  const datums = dat.filter(Boolean);

  const problems = [];
  if (c.group === "form" && datums.length) problems.push(`${c.name} is a form control, so it can't have datums. Remove them.`);
  if (c.group !== "form" && c.frame.datums === "required" && !datums.length) problems.push(`${c.name} needs at least one datum to measure from.`);
  if (dia && NO_DIA.has(sym)) problems.push(`${c.name} doesn't take ⌀: its zone isn't a cylinder.`);
  if (!dia && sym === "concentricity") problems.push("Concentricity always has ⌀ in front of the tolerance.");
  if (mod !== "RFS" && NO_MODS.has(sym)) problems.push(`${c.name} can't take ${mod}. Material condition modifiers only go on features of size (holes, pins, slots), with position, orientation or straightness.`);
  if (new Set(datums).size !== datums.length) problems.push("Each datum letter should appear once.");
  if (dat.some((d, i) => !d && dat.slice(i + 1).some(Boolean))) problems.push("Fill the datum boxes in order: primary first.");

  const sentence = [
    `${c.name}:`,
    `the feature must stay inside a ${dia ? `cylindrical zone ⌀${units.L(tol)}` : `zone ${units.L(tol)} wide`}`,
    mod === "MMC" ? "when the feature is at its maximum material size, with bonus tolerance as it departs from MMC" : mod === "LMC" ? "when the feature is at its least material size, with bonus as it departs from LMC" : "at whatever size the feature is (RFS)",
    datums.length ? `, ${datums.map((d, i) => `${RANKS[i]} datum ${d}`).join(", ")}.` : c.group === "form" ? ", with no datums (it's compared only to itself)." : ".",
  ].join(" ").replace(" ,", ",");

  const cells = [
    { key: "symbol", n: 1, title: "Characteristic symbol", body: "What kind of control this is: form, orientation, location, profile or runout. It sets the shape of the zone." },
    { key: "tol", n: 2, title: "Tolerance, ⌀ and modifier", body: "The size of the zone. ⌀ in front makes it a cylinder. A circled M or L after it says the value applies at maximum or least material condition, and grows as the size moves away." },
    { key: "datum0", n: 3, title: "Primary datum", body: "The part sits on this first. A flat primary locks 3 degrees of freedom: one move and two tilts." },
    { key: "datum1", n: 4, title: "Secondary datum", body: "Pushed against next, square to the primary. Locks 2 more." },
    { key: "datum2", n: 5, title: "Tertiary datum", body: "Slid against last. Locks the final one." },
  ];

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <Head title="Reading a feature control frame" lede="A feature control frame is a sentence in boxes. Build one here and see it read out in plain words, with a warning if it breaks the rules." />
      <div className="gd-grid">
        <section className="tf-card gd-stage">
          <div className="gd-frame-big">
            <FrameBox symbol={sym} tol={tol} dia={dia} mod={mod} datums={datums} fmtTol={units.num} scale={2.6} active={active} onCell={setActive} />
          </div>
          <p className="gd-read is-big">
            <Volume2 size={16} aria-hidden="true" />
            <span>{sentence}</span>
          </p>
          {problems.length ? (
            problems.map((p) => (
              <p key={p} className="tf-warning">
                <TriangleAlert size={15} aria-hidden="true" /> {p}
              </p>
            ))
          ) : (
            <p className="gd-ok-line">
              <Check size={15} aria-hidden="true" /> This is a valid callout.
            </p>
          )}
          <ol className="gd-anatomy">
            {cells.map((k) => (
              <li key={k.key} className={active === k.key ? "is-on" : ""}>
                <button type="button" onClick={() => setActive(k.key)}>
                  <span className="gd-basic-num">{k.n}</span>
                  <span>
                    <strong>{k.title}</strong>
                    <span>{k.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>Build a frame</h2>
            <label className="gd-field">
              <span className="gd-field-label">Characteristic</span>
              <select className="tf-select" value={sym} onChange={(e) => setSym(e.target.value)}>
                {GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {CALLOUTS.filter((x) => x.group === g.id).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <Slider id="fr-tol" label="Tolerance" value={tol} min={0.005} max={1} step={0.005} units={units} onChange={setTol} />
            <label className="gd-check">
              <input type="checkbox" checked={dia} onChange={(e) => setDia(e.target.checked)} />
              <span>⌀ cylindrical zone</span>
            </label>
            <div className="gd-field">
              <span className="gd-field-label">Material condition</span>
              <Segmented label="Material condition" small value={mod} onChange={setMod} options={[{ value: "RFS", label: "RFS" }, { value: "MMC", label: "Ⓜ MMC" }, { value: "LMC", label: "Ⓛ LMC" }]} />
            </div>
            {RANKS.map((rank, i) => (
              <label key={rank} className="gd-field">
                <span className="gd-field-label">{rank[0].toUpperCase() + rank.slice(1)} datum</span>
                <select className="tf-select" value={dat[i] || ""} onChange={(e) => setDat((d) => d.map((x, j) => (j === i ? e.target.value : x)))}>
                  <option value="">None</option>
                  {["A", "B", "C", "D"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// Datums and 3-2-1 -------------------------------------------------------------

const PLANES = {
  A: { name: "Bottom face", normal: "Z" },
  B: { name: "Back face", normal: "Y" },
  C: { name: "Side face", normal: "X" },
};
const RANK_COLORS = ["#5cd6ff", "#7be0c3", "#ffd25c"];

function lockedBy(order) {
  // order: up to three plane letters, primary first. Returns { Tx: rank, Ty, Tz, Rx, Ry, Rz }.
  const locks = {};
  const axes = ["X", "Y", "Z"];
  order.forEach((d, rank) => {
    const n = PLANES[d].normal;
    locks[`T${n}`] = rank;
    if (rank === 0) axes.filter((a) => a !== n).forEach((a) => (locks[`R${a}`] = 0));
    if (rank === 1) locks[`R${PLANES[order[0]].normal}`] = 1;
  });
  return locks;
}

export function DatumsPage() {
  useTitle("Datums and the 3-2-1 rule · GD&T · Engineer ToolFox");
  const [order, setOrder] = useState(["A", "B", "C"]);
  const [count, setCount] = useState(3);
  const used = order.slice(0, count);
  const locks = lockedBy(used);
  const rankOf = (d) => used.indexOf(d);

  // Isometric projection of a box 4 × 3 × 2.
  const s = 46, ox = 300, oy = 150;
  const P = (x, y, z) => [ox + (x - y) * Math.cos(Math.PI / 6) * s, oy + (x + y) * Math.sin(Math.PI / 6) * s - z * s];
  const poly = (list) => list.map((p) => P(...p).map((v) => v.toFixed(1)).join(",")).join(" ");
  const bx = 4, by = 3, bz = 2, g = 0.9;
  const planeA = [[-g, -g, 0], [bx + g, -g, 0], [bx + g, by + g, 0], [-g, by + g, 0]];
  const planeB = [[-g, 0, 0], [bx + g, 0, 0], [bx + g, 0, bz + g], [-g, 0, bz + g]];
  const planeC = [[0, -g, 0], [0, by + g, 0], [0, by + g, bz + g], [0, -g, bz + g]];
  const pointsFor = (d, rank) => {
    const n = [3, 2, 1][rank];
    const flat = {
      3: [[0.7, 0.6], [3.3, 0.8], [2, 2.5]],
      2: [[1, 1.5], [3, 1.5]],
      1: [[2, 1.5]],
    };
    const wallB = { 3: [[0.7, 0.5], [3.3, 0.6], [2, 1.6]], 2: [[0.8, 1], [3.2, 1]], 1: [[2, 1]] };
    const wallC = { 3: [[0.7, 0.5], [2.3, 0.5], [1.5, 1.6]], 2: [[0.8, 1], [2.2, 1]], 1: [[1.5, 1]] };
    if (d === "A") return flat[n].map(([x, y]) => [x, y, 0]);
    if (d === "B") return wallB[n].map(([x, z]) => [x, 0, z]);
    return wallC[n].map(([y, z]) => [0, y, z]);
  };
  const setRank = (rank, d) => {
    const next = [...order];
    const j = next.indexOf(d);
    [next[rank], next[j]] = [next[j], next[rank]];
    setOrder(next);
  };
  const DOF = [
    ["TX", "Slide along X"],
    ["TY", "Slide along Y"],
    ["TZ", "Slide up / down (Z)"],
    ["RX", "Tilt about X"],
    ["RY", "Tilt about Y"],
    ["RZ", "Spin about Z"],
  ];
  const free = DOF.filter(([k]) => locks[k] === undefined).length;

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <Head title="Datums and the 3-2-1 rule" lede="Datums are how the drawing says to hold the part before measuring. A block has six ways to move; three flat datums take them away in order: 3 points, then 2, then 1." />
      <div className="gd-grid">
        <section className="tf-card gd-stage">
          <svg className="gd-sheet" viewBox="0 0 640 380" role="img" aria-label="A block resting on three datum planes">
            {[["A", planeA], ["B", planeB], ["C", planeC]].map(([d, pl]) => {
              const rank = rankOf(d);
              return (
                <polygon key={d} points={poly(pl)} className={`gd-plane ${rank < 0 ? "is-off" : ""}`} style={rank >= 0 ? { "--gd-rank": RANK_COLORS[rank] } : undefined} />
              );
            })}
            <polygon points={poly([[0, 0, bz], [bx, 0, bz], [bx, by, bz], [0, by, bz]])} className="gd-iso is-top" />
            <polygon points={poly([[bx, 0, 0], [bx, by, 0], [bx, by, bz], [bx, 0, bz]])} className="gd-iso is-right" />
            <polygon points={poly([[0, by, 0], [bx, by, 0], [bx, by, bz], [0, by, bz]])} className="gd-iso is-left" />
            {used.map((d, rank) =>
              pointsFor(d, rank).map((p, i) => {
                const [x, y] = P(...p);
                return <circle key={`${d}${i}`} cx={x} cy={y} r={7} className="gd-contact" style={{ "--gd-rank": RANK_COLORS[rank] }} />;
              })
            )}
            {["A", "B", "C"].map((d) => {
              const at = { A: P(bx + g - 0.3, by + g - 0.2, 0), B: P(bx + g - 0.2, 0, bz + g - 0.3), C: P(0, -g + 0.2, bz + g - 0.2) }[d];
              const rank = rankOf(d);
              return (
                <g key={d}>
                  <rect x={at[0] - 13} y={at[1] - 13} width={26} height={26} className="gd-datum-box" />
                  <text x={at[0]} y={at[1] + 0.5} textAnchor="middle" dominantBaseline="central" className="gd-datum-text">
                    {d}
                  </text>
                  {rank >= 0 && (
                    <text x={at[0] + 18} y={at[1] + 5} className="gd-label is-dim">
                      {["primary", "secondary", "tertiary"][rank]}
                    </text>
                  )}
                </g>
              );
            })}
            <g className="gd-axes" transform="translate(70 330)">
              <line x1={0} y1={0} x2={34} y2={20} />
              <text x={40} y={28} className="gd-label is-dim">X</text>
              <line x1={0} y1={0} x2={-34} y2={20} />
              <text x={-50} y={28} className="gd-label is-dim">Y</text>
              <line x1={0} y1={0} x2={0} y2={-38} />
              <text x={-4} y={-44} className="gd-label is-dim">Z</text>
            </g>
          </svg>
          <div className="gd-dof">
            {DOF.map(([k, label]) => (
              <span key={k} className={`gd-dof-chip ${locks[k] !== undefined ? "is-locked" : ""}`} style={locks[k] !== undefined ? { "--gd-rank": RANK_COLORS[locks[k]] } : undefined}>
                {locks[k] !== undefined ? "Locked" : "Free"} · {label}
                {locks[k] !== undefined && <small> by {used[locks[k]]}</small>}
              </span>
            ))}
          </div>
          <p className={`gd-ok-line ${free ? "is-warn" : ""}`}>
            {free ? `${free} way${free > 1 ? "s" : ""} to move still free. Measurements that depend on those directions can't be repeated.` : "Fully held. Every measurement starts from the same place each time."}
          </p>
        </section>
        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>Datum reference frame</h2>
            <div className="gd-field">
              <span className="gd-field-label">Datums in the frame</span>
              <Segmented label="How many datums" small value={count} onChange={setCount} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
            </div>
            {RANKS.slice(0, count).map((rank, i) => (
              <label key={rank} className="gd-field">
                <span className="gd-field-label" style={{ color: RANK_COLORS[i] }}>
                  {rank[0].toUpperCase() + rank.slice(1)} ({[3, 2, 1][i]} point{i < 2 ? "s" : ""})
                </span>
                <select className="tf-select" value={order[i]} onChange={(e) => setRank(i, e.target.value)}>
                  {Object.entries(PLANES).map(([d, p]) => (
                    <option key={d} value={d}>
                      {d}: {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <FrameBox symbol="position" tol={0.25} dia mod="MMC" datums={used} fmtTol={(v) => v.toFixed(2)} scale={1.5} />
          </div>
          <div className="tf-card gd-panel">
            <h2>Why the order matters</h2>
            <p className="gd-help">
              The primary datum gets the most contact, so it should be the face the part really sits on in use, usually the biggest and most stable. Swap A and B and the part rests on a different face first: a slightly out-of-square part then measures differently, and a part that passed can fail.
            </p>
            <p className="gd-help">Datum features on real parts are never perfect, so the inspector holds the part on gauge surfaces (a surface plate, angle plate, pins) that simulate the perfect datums.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Material condition modifiers ------------------------------------------------

export function ModifiersPage({ prefsApi }) {
  useTitle("MMC, LMC and bonus tolerance · GD&T · Engineer ToolFox");
  const units = lengthUnits(prefsApi.prefs.system);
  const [kind, setKind] = useState("hole");
  const [mod, setMod] = useState("MMC");
  const [tol, setTol] = useState(0.2);
  const [size, setSize] = useState(10.05);
  const f = kind === "hole" ? HOLE : PIN;
  const lo = Math.min(f.lo, f.hi), hi = Math.max(f.lo, f.hi);
  const sz = Math.min(hi + 0.05, Math.max(lo - 0.05, size));
  const bonus = bonusFor(mod, f, sz);
  const allowed = tol + bonus;
  const ok = inSize(f, sz);
  const vc = virtualCondition(mod === "RFS" ? "MMC" : mod, f, tol);

  // Chart: allowed tolerance against actual size.
  const cw = 600, ch = 260, pl = 60, pr = 20, pt = 20, pb = 44;
  const xMin = lo - 0.04, xMax = hi + 0.04;
  const yMax = tol + (hi - lo) + 0.06;
  const X = (v) => pl + ((v - xMin) / (xMax - xMin)) * (cw - pl - pr);
  const Y = (v) => ch - pb - (v / yMax) * (ch - pt - pb);
  const line = (m) => [lo, hi].map((v) => [X(v), Y(tol + bonusFor(m, f, v))]);
  const lineD = (m) => line(m).map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];

  return (
    <div className="gd-page" style={{ "--tf-cat": DESIGN_HUE }}>
      <Head title="MMC, LMC and bonus tolerance" lede="A circled M after the tolerance says: this value applies when the feature has the most material. As a hole gets bigger (or a pin smaller) the mating part has more room, so the location tolerance grows by the same amount." />
      <div className="gd-grid">
        <section className="tf-card gd-stage">
          <div className="gd-frame-big">
            <FrameBox symbol="position" tol={tol} dia mod={mod} datums={["A", "B", "C"]} fmtTol={units.num} scale={2.2} />
            <span className="gd-size-tag">{f.label}</span>
          </div>
          <svg className="gd-sheet" viewBox={`0 0 ${cw} ${ch}`} role="img" aria-label="Allowed position tolerance against actual size">
            <rect x={X(xMin)} y={pt} width={X(lo) - X(xMin)} height={ch - pt - pb} className="gd-outsize" />
            <rect x={X(hi)} y={pt} width={X(xMax) - X(hi)} height={ch - pt - pb} className="gd-outsize" />
            <line x1={pl} x2={cw - pr} y1={ch - pb} y2={ch - pb} className="gd-axis" />
            <line x1={pl} x2={pl} y1={pt} y2={ch - pb} className="gd-axis" />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={X(t)} x2={X(t)} y1={ch - pb} y2={ch - pb + 6} className="gd-axis" />
                <text x={X(t)} y={ch - pb + 22} textAnchor="middle" className="gd-label is-dim">
                  ⌀{units.num(t)}
                </text>
              </g>
            ))}
            {[0, tol, tol + (hi - lo)].map((t) => (
              <text key={t} x={pl - 8} y={Y(t) + 5} textAnchor="end" className="gd-label is-dim">
                {units.num(t)}
              </text>
            ))}
            <text x={X(f.mmc)} y={pt + 14} textAnchor="middle" className="gd-label is-dim">MMC</text>
            <text x={X(f.lmc)} y={pt + 14} textAnchor="middle" className="gd-label is-dim">LMC</text>
            {["RFS", "MMC", "LMC"].map((m) => (
              <path key={m} d={lineD(m)} className={`gd-modline ${m === mod ? "is-on" : ""}`} />
            ))}
            <line x1={X(sz)} x2={X(sz)} y1={pt} y2={ch - pb} className="gd-sizeline" />
            <circle cx={X(sz)} cy={Y(ok ? allowed : tol)} r={7} className={`gd-dot ${ok ? "" : "is-bad"}`} />
            <text x={(pl + cw - pr) / 2} y={ch - 6} textAnchor="middle" className="gd-label is-dim">
              actual {kind} size
            </text>
          </svg>
          <div className={`gd-verdict ${ok ? "is-ok" : "is-bad"}`}>
            <div className="gd-verdict-top">
              <span className="gd-verdict-nums">
                {ok ? (
                  <>
                    At ⌀{units.num(sz)} the {kind} may be off true position by up to <strong>⌀{units.L(allowed)}</strong>
                    {bonus > 0 && <em> ({units.L(tol)} + {units.L(bonus)} bonus)</em>}.
                  </>
                ) : (
                  <>⌀{units.num(sz)} is outside the size limits, so the part is rejected for size. No bonus applies.</>
                )}
              </span>
            </div>
            {mod !== "LMC" && (
              <p className="gd-vc">
                Virtual condition ⌀{units.num(vc)} = {kind === "hole" ? "MMC − tol" : "MMC + tol"}. A {kind === "hole" ? "fixed gauge pin" : "fixed gauge ring"} this size, in the exact position, accepts every good part{mod === "RFS" ? " (with RFS there's no bonus, so a fixed gauge can't be used)" : ""}.
              </p>
            )}
          </div>
        </section>
        <aside className="gd-controls">
          <div className="tf-card gd-panel">
            <h2>Try it</h2>
            <Segmented label="Feature" small value={kind} onChange={(k) => (setKind(k), setSize(k === "hole" ? 10.05 : 10.0))} options={[{ value: "hole", label: `Hole ${HOLE.label}` }, { value: "pin", label: `Pin ${PIN.label}` }]} />
            <div className="gd-field">
              <span className="gd-field-label">Modifier</span>
              <Segmented label="Modifier" small value={mod} onChange={setMod} options={[{ value: "RFS", label: "RFS" }, { value: "MMC", label: "Ⓜ MMC" }, { value: "LMC", label: "Ⓛ LMC" }]} />
            </div>
            <Slider id="md-tol" label="Position tolerance" value={tol} min={0.02} max={0.5} step={0.01} units={units} onChange={setTol} />
            <Slider id="md-size" label={`Actual ${kind} size`} value={sz} min={lo - 0.05} max={hi + 0.05} step={0.005} units={units} onChange={setSize} />
          </div>
          <div className="tf-card gd-panel">
            <h2>Which one to use</h2>
            <p className="gd-help">
              <strong>MMC</strong> for clearance fits: bolts through holes, pins into plates. Assembly is what matters, and the gauge is cheap.
            </p>
            <p className="gd-help">
              <strong>LMC</strong> to protect material: minimum wall around a bore, edge distance, or a boss that gets machined later.
            </p>
            <p className="gd-help">
              <strong>RFS</strong> (no symbol) when the location must be held whatever the size: centring, balance, press fits.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
