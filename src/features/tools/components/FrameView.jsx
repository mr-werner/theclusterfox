import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Link2, MousePointer2, PenLine, Plus, RotateCcw, Star, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import ZoomPan from "./ZoomPan";
import { NumField, UnitSelect } from "./Fields";
import { SectionShape } from "./Visuals";
import { categoryById } from "../registry";
import { defaultUnit, fromSI, unitLabel, fmt } from "../model/units";
import { solveFrame, frameTemplate, FRAME_TEMPLATES, nextLabel, newId } from "../model/frame";
import { FRAME_MATERIALS, FRAME_SECTIONS, FRAME_SECTION_FAMILIES, frameMaterial, memberSection } from "../data/frameLibrary";
import { reportSnapshot } from "../model/projects";
import { captureFromPage } from "../model/capture";
import SaveToProject from "./SaveToProject";
import "./frame.css";

// The frame builder: draw joints and members on a grid, pick sizes, materials,
// connections and supports, load it, and read the axial, shear and moment
// diagrams, deflected shape, reactions and member checks.

const STORE = "toolfox-frame";
const FT = 0.3048;

const SUPPORTS = [
  { value: "free", label: "None" },
  { value: "pin", label: "Pinned" },
  { value: "rollerY", label: "Roller ↔" },
  { value: "rollerX", label: "Roller ↕" },
  { value: "fixed", label: "Fixed" },
];
const VIEWS = [
  { value: "model", label: "Model" },
  { value: "deflected", label: "Deflected" },
  { value: "N", label: "Axial" },
  { value: "V", label: "Shear" },
  { value: "M", label: "Moment" },
  { value: "util", label: "Stress" },
];
const VIEW_COLORS = { N: "#7be0c3", V: "#5cc8ff", M: "#ffc764" };
const DIRS = [
  { value: "down", label: "Down ↓" },
  { value: "right", label: "Right →" },
  { value: "perp", label: "Across member" },
];
const CUSTOM_SHAPES = [
  { value: "rect", label: "Solid rectangle", fields: [["b", "Width b"], ["h", "Depth h"]] },
  { value: "round", label: "Solid round", fields: [["D", "Diameter"]] },
  { value: "tube", label: "Round tube", fields: [["D", "Outside diameter"], ["t", "Wall"]] },
  { value: "rhs", label: "Rectangular tube", fields: [["H", "Depth H"], ["B", "Width B"], ["t", "Wall"]] },
  { value: "ibeam", label: "I-beam", fields: [["h", "Depth h"], ["b", "Flange width b"], ["tf", "Flange thickness"], ["tw", "Web thickness"]] },
  { value: "channel", label: "Channel", fields: [["h", "Depth h"], ["b", "Flange width b"], ["tf", "Flange thickness"], ["tw", "Web thickness"]] },
  { value: "tee", label: "Tee", fields: [["h", "Depth h"], ["b", "Flange width b"], ["tf", "Flange thickness"], ["tw", "Web thickness"]] },
  { value: "angle", label: "Angle", fields: [["h", "Leg h"], ["b", "Leg b"], ["t", "Thickness"]] },
];
const SYMMETRIC = new Set(["round", "tube"]);

const FRAME_UNITS = {
  si: { force: "kN", linearLoad: "kN/m", moment: "kNm" },
  us: { force: "kip", linearLoad: "kip/ft", moment: "kipft" },
};

// Model helpers --------------------------------------------------------------

function readSaved() {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function save(model) {
  try {
    localStorage.setItem(STORE, JSON.stringify(model));
  } catch {
    // Not saved; it still works on this page.
  }
}
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

function starter(us) {
  return { grid: us ? 2 * FT : 0.5, selfWeight: false, defaults: { sec: us ? "W12x26" : "IPE 240", mat: us ? "a992" : "s355" }, ...frameTemplate("portal", us) };
}
function valid(m) {
  return m && Array.isArray(m.nodes) && Array.isArray(m.members) && Array.isArray(m.loads);
}

const clean = (m) => ({
  ...m,
  // Drop loads pointing at things that no longer exist.
  loads: m.loads.filter((l) => (l.on === "node" ? m.nodes.some((n) => n.id === l.node) : m.members.some((x) => x.id === l.member))),
});

/** A tidy step for the deflected-shape magnification. */
function niceFactor(x) {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t };
};

// The page --------------------------------------------------------------------

export default function FrameView({ prefsApi }) {
  const { prefs, setUnit, toggleFavorite, touch } = prefsApi;
  const us = prefs.system === "us";
  // Structural sizes read better in kN and kips than in N and lbf.
  const unitFor = (dim) => prefs.units[dim] || FRAME_UNITS[prefs.system]?.[dim] || defaultUnit(dim, prefs.system);
  const [params, setParams] = useSearchParams();
  const [model, setModelState] = useState(() => {
    const shared = params.get("m");
    if (shared) {
      try {
        const m = JSON.parse(unb64(shared));
        if (valid(m)) return m;
      } catch {
        // Fall through.
      }
    }
    const saved = readSaved();
    return valid(saved) ? saved : starter(us);
  });
  const [history, setHistory] = useState([]);
  const [sel, setSel] = useState(null); // { kind: "node" | "member", id }
  const [mode, setMode] = useState("select");
  const [pending, setPending] = useState(null); // joint id a new member starts from
  const [view, setView] = useState("M");
  const [copied, setCopied] = useState(false);
  const pageRef = useRef(null);

  // Every edit is computed from the model on screen, and the old one goes on the undo stack.
  const setModel = (fn) => {
    const next = clean(typeof fn === "function" ? fn(model) : fn);
    setHistory((h) => [...h.slice(-49), model]);
    setModelState(next);
    return next;
  };
  const undo = () => {
    if (!history.length) return;
    setModelState(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setPending(null);
  };

  useEffect(() => save(model), [model]);
  useEffect(() => {
    touch("builder:frame");
    document.title = "Frame builder · Engineer ToolFox";
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [touch]);
  // A shared link loads once; after that the page keeps its own copy.
  useEffect(() => {
    if (params.get("m")) setParams({}, { replace: true });
  }, [params, setParams]);

  const result = useMemo(() => solveFrame(model), [model]);
  const cat = categoryById.mech;
  const fav = prefs.favorites.includes("builder:frame");

  const selNode = sel?.kind === "node" ? model.nodes.find((n) => n.id === sel.id) : null;
  const selMember = sel?.kind === "member" ? model.members.find((m) => m.id === sel.id) : null;

  function loadTemplate(id) {
    const t = id === "blank" ? { nodes: [], members: [], loads: [] } : frameTemplate(id, us);
    setModel((cur) => ({ ...cur, ...t }));
    setSel(null);
    setPending(null);
    if (id === "blank") setMode("draw");
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?m=${b64(JSON.stringify(model))}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {}
    );
  }

  /** The frame, its loads and its results as a project report snapshot. */
  function snapshot() {
    const q = (dim, x, sig = 4) => `${fmt(fromSI(x, dim, unitFor(dim)), sig)} ${unitLabel(dim, unitFor(dim))}`.trim();
    const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
    const root = pageRef.current;
    const results = root
      ? [...root.querySelectorAll(".fr-summary .tf-result")].map((el) => {
          const member = text(el.querySelector(".fr-member-link"));
          return { label: member ? `${text(el.querySelector("dt"))} (member ${member})` : text(el.querySelector("dt")), value: text(el.querySelector(".tf-result-num")), unit: "" };
        })
      : [];
    const primaryEl = root?.querySelector(".fr-summary .tf-primary:not(.is-empty)");
    const primary = primaryEl ? { label: text(primaryEl.querySelector(".tf-primary-label")), value: text(primaryEl.querySelector("output")), unit: text(primaryEl.querySelector(".tf-primary-value span")) } : null;
    const supports = model.nodes.filter((n) => n.sup && n.sup !== "free").map((n) => `${n.id} ${SUPPORTS.find((x) => x.value === n.sup)?.label.toLowerCase()}`);
    const loadText = (l) =>
      l.on === "node"
        ? [l.Fx && `Fx ${q("force", l.Fx)}`, l.Fy && `Fy ${q("force", l.Fy)}`, l.M && `M ${q("moment", l.M)}`].filter(Boolean).join(", ")
        : l.kind === "udl"
          ? q("linearLoad", l.w)
          : `${q("force", l.P)} at ${q("length", l.a ?? 0)}`;
    const captured = captureFromPage(root, { figures: [[".fr-canvas-card", `Frame, ${VIEWS.find((v) => v.value === view)?.label.toLowerCase()} view`]], tables: [[".fr-table-card", null]] });
    return reportSnapshot({
      inputs: [
        { label: "Joints", value: String(model.nodes.length), unit: "" },
        { label: "Members", value: String(model.members.length), unit: "" },
        { label: "Supports", value: supports.join(", ") || "None", unit: "" },
        { label: "Loads", value: String(model.loads.length), unit: "" },
        { label: "Self weight included", value: model.selfWeight ? "Yes" : "No", unit: "" },
      ],
      results,
      primary,
      warnings: result.ok ? result.warnings : [result.error],
      units: us ? "US customary" : "Metric (SI)",
      figures: captured.figures,
      tables: [
        { title: "Joints", head: ["Joint", `x (${unitLabel("length", unitFor("length"))})`, `y (${unitLabel("length", unitFor("length"))})`, "Support"], rows: model.nodes.map((n) => [n.id, fmt(fromSI(n.x, "length", unitFor("length")), 4), fmt(fromSI(n.y, "length", unitFor("length")), 4), SUPPORTS.find((x) => x.value === (n.sup || "free"))?.label || ""]) },
        { title: "Loads", head: ["Load", "On", "Type", "Direction", "Value"], rows: model.loads.map((l) => [l.id, l.on === "node" ? `Joint ${l.node}` : `Member ${l.member}`, l.on === "node" ? "Joint load" : l.kind === "udl" ? "Uniform" : "Point", l.on === "node" ? "—" : DIRS.find((d) => d.value === l.dir)?.label || "", loadText(l)]) },
        ...captured.tables,
      ],
      formula: [...(root?.querySelectorAll(".tf-about .tf-formulas code") || [])].map(text),
      about: text(root?.querySelector(".tf-about .tf-about-block:nth-of-type(2) p")),
      sources: text(root?.querySelector(".tf-about .tf-source")),
    });
  }

  // Editing actions.
  const updateNode = (id, patch) => setModel((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  const updateMember = (id, patch) => setModel((m) => ({ ...m, members: m.members.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const deleteNode = (id) => {
    setModel((m) => ({ ...m, nodes: m.nodes.filter((n) => n.id !== id), members: m.members.filter((x) => x.a !== id && x.b !== id) }));
    setSel(null);
  };
  const deleteMember = (id) => {
    setModel((m) => {
      const members = m.members.filter((x) => x.id !== id);
      // Joints left with nothing attached and nothing on them go too.
      const used = new Set(members.flatMap((x) => [x.a, x.b]));
      return { ...m, members, nodes: m.nodes.filter((n) => used.has(n.id) || (n.sup && n.sup !== "free")) };
    });
    setSel(null);
  };
  const setNodeLoad = (id, patch) =>
    setModel((m) => {
      const cur = m.loads.find((l) => l.on === "node" && l.node === id) || { id: newId("L"), on: "node", node: id, Fx: 0, Fy: 0, M: 0 };
      const next = { ...cur, ...patch };
      const rest = m.loads.filter((l) => l !== cur);
      return { ...m, loads: next.Fx || next.Fy || next.M ? [...rest, next] : rest };
    });

  /** Add a joint at (x, y), or split a member there. Returns the joint id. */
  function addJointAt(m, x, y, onMember) {
    const id = nextLabel(m.nodes, true);
    const nodes = [...m.nodes, { id, x, y, sup: "free" }];
    if (!onMember) return { m: { ...m, nodes }, id };
    const mem = m.members.find((q) => q.id === onMember);
    const a = m.nodes.find((n) => n.id === mem.a), b = m.nodes.find((n) => n.id === mem.b);
    const L = Math.hypot(b.x - a.x, b.y - a.y), cut = Math.hypot(x - a.x, y - a.y);
    const id2 = nextLabel([...m.members, { id: mem.id }], false);
    const m1 = { ...mem, b: id, hingeB: false }, m2 = { ...mem, id: id2, a: id, hingeA: false };
    const loads = m.loads.flatMap((l) => {
      if (l.on !== "member" || l.member !== mem.id) return [l];
      if (l.kind === "udl") return [l, { ...l, id: newId("L"), member: id2 }];
      const at = l.a ?? L / 2;
      return [at <= cut ? l : { ...l, member: id2, a: at - cut }];
    });
    return { m: { ...m, nodes, members: [...m.members.filter((q) => q !== mem), m1, m2], loads }, id };
  }

  function addMember(m, a, b) {
    if (a === b || m.members.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) return m;
    const d = m.defaults || {};
    const sec = d.sec || (us ? "W12x26" : "IPE 240");
    const mat = d.mat || frameSectionMat(sec);
    return { ...m, members: [...m.members, { id: nextLabel(m.members, false), a, b, sec, mat, axis: "strong", hingeA: false, hingeB: false, K: 1, ...(d.custom && sec === "custom" ? { custom: d.custom } : {}) }] };
  }

  function onCanvasTap(hit) {
    if (mode === "select") {
      setSel(hit.node ? { kind: "node", id: hit.node } : hit.member ? { kind: "member", id: hit.member } : null);
      return;
    }
    // Drawing: tap joints or grid points; each tap continues the chain from the last one.
    if (hit.node) {
      if (pending && pending !== hit.node) setModel((m) => addMember(m, pending, hit.node));
      setPending(pending === hit.node ? null : hit.node);
      return;
    }
    const r = addJointAt(model, hit.x, hit.y, hit.member);
    setModel(pending ? addMember(r.m, pending, r.id) : r.m);
    setPending(r.id);
  }

  const sectionOptions = useMemo(() => {
    const fams = us ? FRAME_SECTION_FAMILIES : [...FRAME_SECTION_FAMILIES.filter((f) => !/US/.test(f)), ...FRAME_SECTION_FAMILIES.filter((f) => /US/.test(f))];
    return fams.map((f) => ({ family: f, items: FRAME_SECTIONS.filter((s) => s.family === f) }));
  }, [us]);

  return (
    <article ref={pageRef} className="tf-calc tf-frame" style={{ "--tf-cat": cat.hue }}>
      <header className="tf-page-head">
        <Link to={`/tools/c/${cat.id}`} className="tf-crumb">
          <cat.icon size={15} aria-hidden="true" /> {cat.name}
        </Link>
        <div className="tf-title-row">
          <h1>Frame builder</h1>
          <div className="tf-actions">
            <button type="button" className={`tf-icon-btn ${fav ? "is-on" : ""}`} onClick={() => toggleFavorite("builder:frame")} aria-pressed={fav} title={fav ? "Remove from favorites" : "Add to favorites"}>
              <Star size={18} fill={fav ? "currentColor" : "none"} />
            </button>
            <button type="button" className="tf-icon-btn" onClick={copyLink} title="Copy a link to this frame">
              {copied ? <Check size={18} /> : <Link2 size={18} />}
            </button>
            <button type="button" className="tf-icon-btn" onClick={undo} disabled={!history.length} title="Undo">
              <Undo2 size={18} />
            </button>
            <button type="button" className="tf-icon-btn" onClick={() => (setModel(starter(us)), setSel(null), setPending(null))} title="Start over with the example frame">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
        <p className="tf-lede">Draw a 2D frame or truss from standard steel, aluminum and timber sizes, choose rigid or pinned connections and supports, load it, and see axial force, shear, moment, deflection and member checks.</p>
      </header>

      <div className="tf-export fr-save" role="group" aria-label="Save this frame">
        <SaveToProject
          tool={{ kind: "builder", id: "frame", name: "Frame builder", discipline: cat.name }}
          getReport={snapshot}
          getPath={() => `/tools/frame?m=${b64(JSON.stringify(model))}`}
        />
      </div>

      <div className="fr-toolbar">
        <label className="fr-template">
          <span className="tf-muted tf-small">Start from</span>
          <select className="tf-select" value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)}>
            <option value="">Template…</option>
            {FRAME_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="tf-segmented is-small" role="radiogroup" aria-label="Tool">
          <button type="button" role="radio" aria-checked={mode === "select"} onClick={() => (setMode("select"), setPending(null))}>
            <MousePointer2 size={14} aria-hidden="true" /> Select
          </button>
          <button type="button" role="radio" aria-checked={mode === "draw"} onClick={() => (setMode("draw"), setSel(null))}>
            <PenLine size={14} aria-hidden="true" /> Draw
          </button>
        </div>
        <div className="tf-segmented is-small fr-views" role="radiogroup" aria-label="Show">
          {VIEWS.map((v) => (
            <button key={v.value} type="button" role="radio" aria-checked={view === v.value} onClick={() => setView(v.value)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <p className="fr-hint tf-muted tf-small">
        {mode === "draw"
          ? pending
            ? `Drawing from joint ${pending}. Tap a grid point, a joint or a member to add the next member. Tap ${pending} again to stop.`
            : "Tap the grid to place a joint, then tap again to draw a member to the next point. Tapping a member adds a joint on it."
          : "Tap a joint or member to edit it. Pinch or use + to zoom; Fit shows the whole frame."}
      </p>

      <section className="tf-card fr-canvas-card" aria-label="Frame drawing">
        <FrameCanvas model={model} result={result} view={view} sel={sel} pending={pending} mode={mode} onTap={onCanvasTap} unitFor={unitFor} />
      </section>

      <div className="fr-grid">
        <section className="tf-card fr-inspector" aria-label="Edit">
          {selNode && (
            <NodeEditor
              key={selNode.id}
              node={selNode}
              model={model}
              result={result}
              unitFor={unitFor}
              setUnit={setUnit}
              update={(p) => updateNode(selNode.id, p)}
              setLoad={(p) => setNodeLoad(selNode.id, p)}
              remove={() => deleteNode(selNode.id)}
              close={() => setSel(null)}
            />
          )}
          {selMember && (
            <MemberEditor
              key={selMember.id}
              member={selMember}
              model={model}
              result={result}
              unitFor={unitFor}
              setUnit={setUnit}
              sectionOptions={sectionOptions}
              update={(p) => updateMember(selMember.id, p)}
              setModel={setModel}
              remove={() => deleteMember(selMember.id)}
              close={() => setSel(null)}
            />
          )}
          {!selNode && !selMember && <Settings model={model} setModel={setModel} unitFor={unitFor} setUnit={setUnit} sectionOptions={sectionOptions} us={us} />}
        </section>
        <Summary result={result} unitFor={unitFor} onPick={(id) => (setMode("select"), setSel({ kind: "member", id }))} />
      </div>

      {result.ok && <MemberTable result={result} unitFor={unitFor} sel={sel} onPick={(id) => (setMode("select"), setSel({ kind: "member", id }))} />}
      {result.ok && <Reactions result={result} unitFor={unitFor} />}

      <section className="tf-card tf-about">
        <div className="tf-about-block">
          <h2>Equations</h2>
          <div className="tf-formulas">
            <code>K u = F   (direct stiffness method, 3 degrees of freedom per joint)</code>
            <code>k = EA/L axially; 12EI/L³, 6EI/L², 4EI/L, 2EI/L in bending</code>
            <code>Pinned member ends: the end rotation is condensed out, so M = 0 there</code>
            <code>σ = |N| / A + |M| / S,   utilization = σ / Fy</code>
            <code>Pcr = π² E I_min / (K L)²</code>
          </div>
        </div>
        <div className="tf-about-block">
          <h2>Assumptions and limits</h2>
          <p>
            This is a linear-elastic, small-deflection analysis of a frame in one plane, for preliminary sizing. Each member is an Euler–Bernoulli frame element (shear deformation left out), split into short pieces so deflected shapes and diagrams are smooth. Connections are fully rigid or fully pinned; real bolted and welded connections fall somewhere between. There is one load case; combine your own factored loads into it. No P-delta (second-order) effects, no lateral-torsional buckling, no local buckling of thin walls, and no AISC, Eurocode or NDS design checks. Stress is the simple combined axial plus bending stress compared with yield (for wood, the reference bending value Fb). Buckling uses Euler's formula about the weakest axis with the effective length factor you set (1 for pinned ends; sway frames can need 2 or more), so it overstates the capacity of stocky members. Out-of-plane bracing is assumed where needed.
          </p>
        </div>
        <div className="tf-about-block">
          <h2>Sign conventions</h2>
          <p>
            Axial force is positive in tension. Moments are drawn on the tension side of each member. Members run left to right (or bottom to top), so for a beam a positive moment sags. Joint loads: horizontal is positive to the right, vertical positive down, moment positive clockwise. A load “across member” pushes toward the right-hand side of the member as you walk from its first joint to its second.
          </p>
        </div>
        <div className="tf-about-block">
          <h2>References</h2>
          <p className="tf-source">Kassimali, Matrix Analysis of Structures; McGuire, Gallagher &amp; Ziemian, Matrix Structural Analysis; AISC Steel Construction Manual (shape properties); EN 10365 (IPE, HEA); NDS Supplement (lumber).</p>
        </div>
        <div className="tf-related">
          <span>Related</span>
          <Link to="/tools/calc/beam" className="tf-chip">
            Beam deflection, shear and moment
          </Link>
          <Link to="/tools/calc/section-properties" className="tf-chip">
            Section properties
          </Link>
          <Link to="/tools/calc/buckling" className="tf-chip">
            Column buckling
          </Link>
        </div>
      </section>
    </article>
  );
}

function frameSectionMat(sec) {
  return FRAME_SECTIONS.find((s) => s.id === sec)?.mat || "a992";
}

// The drawing -----------------------------------------------------------------

function FrameCanvas({ model, result, view, sel, pending, mode, onTap, unitFor }) {
  const svgRef = useRef(null);
  const boxRef = useRef(null);
  // Drawn at about the card's own width, so labels stay readable on a phone.
  const [W, setW] = useState(800);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(Math.min(860, Math.max(340, e.contentRect.width - 4)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const maxH = Math.max(420, Math.min(900, W * 1.25)), minH = Math.max(260, W * 0.45);
  const grid = model.grid > 0 ? model.grid : 0.5;
  const { nodes, members, loads } = model;

  // World extents with room around the frame; more room while drawing.
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const margin = grid * (mode === "draw" ? 4 : 2) + (nodes.length ? 0 : grid * 8);
  const span = Math.max(xs.length ? Math.max(...xs) - Math.min(...xs) : 0, ys.length ? Math.max(...ys) - Math.min(...ys) : 0, grid * 6);
  const extra = Math.max(margin, span * 0.18);
  let minX = (xs.length ? Math.min(...xs) : 0) - extra, maxX = (xs.length ? Math.max(...xs) : 0) + extra;
  let minY = (ys.length ? Math.min(...ys) : 0) - extra, maxY = (ys.length ? Math.max(...ys) : 0) + extra;
  // Snap the extents to the grid so grid lines stay put.
  minX = Math.floor(minX / grid) * grid;
  maxX = Math.ceil(maxX / grid) * grid;
  minY = Math.floor(minY / grid) * grid;
  maxY = Math.ceil(maxY / grid) * grid;
  const pad = Math.round(Math.min(64, Math.max(44, W * 0.08))); // room for load arrows and labels at the edges
  let k = (W - 2 * pad) / (maxX - minX);
  let H = (maxY - minY) * k + 2 * pad;
  if (H > maxH) {
    k = (maxH - 2 * pad) / (maxY - minY);
    H = maxH;
    const cx = (minX + maxX) / 2, half = (W - 2 * pad) / k / 2;
    minX = cx - half;
    maxX = cx + half;
  }
  if (H < minH) {
    const cy = (minY + maxY) / 2, half = (minH - 2 * pad) / k / 2;
    minY = cy - half;
    maxY = cy + half;
    H = minH;
  }
  const X = (x) => pad + (x - minX) * k;
  const Y = (y) => pad + (maxY - y) * k;
  const node = (id) => nodes.find((n) => n.id === id);

  function toWorld(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const shown = svg.getBoundingClientRect().width / W; // screen px per SVG unit
    return { x: (p.x - pad) / k + minX, y: maxY - (p.y - pad) / k, tol: 18 / shown / k };
  }

  function onClick(e) {
    const { x, y, tol } = toWorld(e);
    let best = null;
    for (const n of nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < tol && (!best || d < best.d)) best = { d, node: n.id };
    }
    if (best) return onTap(best);
    const snap = (v) => Math.round(v / grid) * grid;
    for (const m of members) {
      const a = node(m.a), b = node(m.b);
      const s = segDist(x, y, a.x, a.y, b.x, b.y);
      if (s.d < tol * 0.8 && (!best || s.d < best.d)) best = { d: s.d, member: m.id, t: s.t, a, b };
    }
    if (best) {
      if (mode === "draw") {
        // Put the new joint on the member, at the nearest grid-friendly spot along it.
        const L = Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y);
        const along = Math.min(L - grid / 2, Math.max(grid / 2, Math.round((best.t * L) / (grid / 2)) * (grid / 2)));
        if (!(along > 0 && along < L)) return;
        const c = (best.b.x - best.a.x) / L, s = (best.b.y - best.a.y) / L;
        return onTap({ member: best.member, x: best.a.x + c * along, y: best.a.y + s * along });
      }
      return onTap({ member: best.member });
    }
    onTap({ x: snap(x), y: snap(y) });
  }

  // Grid.
  const gridLines = [];
  const gx0 = Math.ceil(minX / grid), gx1 = Math.floor(maxX / grid);
  const gy0 = Math.ceil(minY / grid), gy1 = Math.floor(maxY / grid);
  const every = Math.max(1, Math.ceil(((gx1 - gx0) / 60)));
  for (let i = gx0; i <= gx1; i += every) gridLines.push(<line key={`gx${i}`} x1={X(i * grid)} x2={X(i * grid)} y1={0} y2={H} className={i === 0 ? "fr-axis" : "fr-gridline"} />);
  for (let i = gy0; i <= gy1; i += every) gridLines.push(<line key={`gy${i}`} y1={Y(i * grid)} y2={Y(i * grid)} x1={0} x2={W} className={i === 0 ? "fr-axis" : "fr-gridline"} />);

  const ok = result.ok;
  const R = ok ? Object.fromEntries(result.members.map((r) => [r.id, r])) : {};
  const showDiagram = ok && ["N", "V", "M"].includes(view);
  const showDefl = ok && view === "deflected";
  const showUtil = ok && view === "util";

  // Diagram scale: the largest value in the frame draws 46 px off its member.
  let diagScale = 0;
  if (showDiagram) {
    const maxAbs = Math.max(...result.members.flatMap((r) => r.samples.map((p) => Math.abs(p[view]))), 1e-9);
    diagScale = 46 / maxAbs;
  }
  // Deflected shape magnification.
  let defl = 1;
  if (showDefl) {
    const maxD = Math.max(result.summary.maxDisp, 1e-12);
    defl = niceFactor((0.08 * Math.max(maxX - minX, maxY - minY)) / maxD);
  }
  const dU = unitFor(view === "N" || view === "V" ? "force" : "moment");
  const dDim = view === "N" || view === "V" ? "force" : "moment";

  const loadArrowLen = 34;
  const fmtF = (v, dim) => `${fmt(fromSI(v, dim, unitFor(dim)), 3)} ${unitLabel(dim, unitFor(dim))}`;

  return (
    <div ref={boxRef}>
    <ZoomPan width={W} label="frame drawing">
      <div className="fr-draw">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H.toFixed(1)}`} role="img" aria-label="Frame drawing" onClick={onClick} className={`fr-svg is-${mode}`}>
          <defs>
            <marker id="fr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fr-arrowhead" />
            </marker>
            <marker id="fr-arrow-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fr-arrowhead-r" />
            </marker>
          </defs>
          <rect x="0" y="0" width={W} height={H} className="fr-bg" />
          <g>{gridLines}</g>
          <text x={W - 8} y={16} textAnchor="end" className="fr-scale">
            grid {fmt(fromSI(grid, "length", unitFor("length")), 3)} {unitLabel("length", unitFor("length"))}
            {showDefl ? ` · deflection ×${fmt(defl, 2)}` : ""}
          </text>

          {/* Diagrams under the members. */}
          {showDiagram &&
            result.members.map((r) => {
              const ny = [-r.s, r.c]; // local +y in world
              const sign = view === "M" ? -1 : 1; // moments on the tension side
              const pts = r.samples.map((p) => {
                const bx = r.xa + r.c * p.x, by = r.ya + r.s * p.x;
                const off = (sign * p[view] * diagScale) / k;
                return [X(bx + ny[0] * off), Y(by + ny[1] * off)];
              });
              const a = [X(r.xa), Y(r.ya)], b = [X(r.xa + r.c * r.L), Y(r.ya + r.s * r.L)];
              const d = `M${a[0]},${a[1]} ` + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + ` L${b[0]},${b[1]} Z`;
              // Label the biggest value on the member.
              let pk = r.samples[0];
              for (const p of r.samples) if (Math.abs(p[view]) > Math.abs(pk[view])) pk = p;
              const lx = r.xa + r.c * pk.x, ly = r.ya + r.s * pk.x;
              const off = (sign * pk[view] * diagScale) / k;
              const big = Math.abs(pk[view]) > 1e-6 * Math.max(1, Math.abs(diagScale ? 46 / diagScale : 1));
              return (
                <g key={`d${r.id}`} className="fr-diagram" style={{ "--fr-c": VIEW_COLORS[view] }}>
                  <path d={d} />
                  {big && (
                    <text x={X(lx + ny[0] * off * 1.15) + 0} y={Y(ly + ny[1] * off * 1.15) + 4} textAnchor="middle" className="fr-peak">
                      {view === "N" ? (pk.N > 0 ? "T " : "C ") : ""}
                      {fmt(fromSI(Math.abs(pk[view]), dDim, dU), 3)}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Members. */}
          {members.map((m) => {
            const a = node(m.a), b = node(m.b);
            if (!a || !b) return null;
            const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
            const r = R[m.id];
            const u = showUtil && r ? r.util : null;
            const color = u === null ? undefined : u > 1 ? "#ff5c6c" : u > 0.9 ? "#ffa04c" : u > 0.6 ? "#ffd25c" : "#5fe08a";
            const isSel = sel?.kind === "member" && sel.id === m.id;
            const hinge = (n, dir) => <circle cx={X(n.x) + dir * ux * 13} cy={Y(n.y) - dir * uy * 13} r="5" className="fr-hinge" />;
            return (
              <g key={m.id} className={`fr-member ${isSel ? "is-sel" : ""} ${showDefl || showDiagram ? "is-ghost" : ""}`}>
                <line x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} style={color ? { stroke: color } : undefined} />
                {m.hingeA && hinge(a, 1)}
                {m.hingeB && hinge(b, -1)}
                <text x={(X(a.x) + X(b.x)) / 2 - uy * 14} y={(Y(a.y) + Y(b.y)) / 2 - ux * 14 + 4} textAnchor="middle" className="fr-mlabel">
                  {showUtil && r ? `${Math.round(r.util * 100)}%` : m.id}
                </text>
              </g>
            );
          })}

          {/* Deflected shape. */}
          {showDefl &&
            result.members.map((r) => {
              const ny = [-r.s, r.c];
              const d = r.samples
                .map((p, i) => {
                  const x = r.xa + r.c * (p.x + p.u * defl) + ny[0] * p.v * defl;
                  const y = r.ya + r.s * (p.x + p.u * defl) + ny[1] * p.v * defl;
                  return `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`;
                })
                .join(" ");
              return <path key={`f${r.id}`} d={d} className="fr-deflected" />;
            })}

          {/* Member loads. */}
          {view !== "util" &&
            loads
              .filter((l) => l.on === "member")
              .map((l) => {
                const m = members.find((q) => q.id === l.member);
                if (!m) return null;
                const a = node(m.a), b = node(m.b);
                const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const c = (b.x - a.x) / L, s = (b.y - a.y) / L;
                const val = l.kind === "udl" ? l.w : l.P;
                const sgn = val < 0 ? -1 : 1;
                let dx, dy; // screen direction the load pushes
                if (l.dir === "right") (dx = sgn), (dy = 0);
                else if (l.dir === "perp") (dx = sgn * s), (dy = sgn * c); // local −y in screen coords
                else (dx = 0), (dy = sgn);
                const tip = (x, y) => [X(x), Y(y)];
                if (l.kind === "point") {
                  const at = Math.min(Math.max(l.a ?? L / 2, 0), L);
                  const [tx, ty] = tip(a.x + c * at, a.y + s * at);
                  return (
                    <g key={l.id} className="fr-load">
                      <line x1={tx - dx * loadArrowLen * 1.4} y1={ty - dy * loadArrowLen * 1.4} x2={tx - dx * 4} y2={ty - dy * 4} markerEnd="url(#fr-arrow)" />
                      <text x={tx - dx * loadArrowLen * 1.4 + (dy ? 6 : 0)} y={ty - dy * loadArrowLen * 1.4 - (dx ? 6 : 0) - (dy > 0 ? 4 : -12)} className="fr-load-text" textAnchor={dy ? "start" : "middle"}>
                        {fmtF(Math.abs(val), "force")}
                      </text>
                    </g>
                  );
                }
                const n = Math.max(3, Math.min(14, Math.round((L * k) / 40)));
                const len = loadArrowLen * 0.7;
                const arrows = [];
                for (let i = 0; i <= n; i++) {
                  const [tx, ty] = tip(a.x + (c * L * i) / n, a.y + (s * L * i) / n);
                  arrows.push(<line key={i} x1={tx - dx * len} y1={ty - dy * len} x2={tx - dx * 3} y2={ty - dy * 3} markerEnd="url(#fr-arrow)" />);
                }
                const [sx0, sy0] = tip(a.x, a.y), [sx1, sy1] = tip(b.x, b.y);
                return (
                  <g key={l.id} className="fr-load is-udl">
                    <line x1={sx0 - dx * len} y1={sy0 - dy * len} x2={sx1 - dx * len} y2={sy1 - dy * len} />
                    {arrows}
                    <text x={(sx0 + sx1) / 2 - dx * (len + 10)} y={(sy0 + sy1) / 2 - dy * (len + 8) + (dy > 0 ? 0 : 12)} textAnchor="middle" className="fr-load-text">
                      {fmtF(Math.abs(val), "linearLoad")}
                    </text>
                  </g>
                );
              })}

          {/* Joint loads. */}
          {view !== "util" &&
            loads
              .filter((l) => l.on === "node")
              .map((l) => {
                const n = node(l.node);
                if (!n) return null;
                const x = X(n.x), y = Y(n.y);
                const out = [];
                const len = loadArrowLen * 1.4;
                if (l.Fx) {
                  const s = Math.sign(l.Fx);
                  out.push(<line key="x" x1={x - s * len} y1={y} x2={x - s * 9} y2={y} markerEnd="url(#fr-arrow)" />);
                  out.push(
                    <text key="xt" x={x - s * len} y={y - 8} textAnchor={s > 0 ? "start" : "end"} className="fr-load-text">
                      {fmtF(Math.abs(l.Fx), "force")}
                    </text>
                  );
                }
                if (l.Fy) {
                  const s = -Math.sign(l.Fy); // screen down for a downward load
                  out.push(<line key="y" x1={x} y1={y - s * len} x2={x} y2={y - s * 9} markerEnd="url(#fr-arrow)" />);
                  out.push(
                    <text key="yt" x={x + 6} y={y - s * len - (s > 0 ? 4 : -14)} className="fr-load-text">
                      {fmtF(Math.abs(l.Fy), "force")}
                    </text>
                  );
                }
                if (l.M) {
                  const cw = l.M < 0;
                  const r = 18;
                  out.push(<path key="m" d={`M${x - r},${y} A${r},${r} 0 1 ${cw ? 1 : 0} ${x},${y + (cw ? -r : r)}`} markerEnd="url(#fr-arrow)" />);
                  out.push(
                    <text key="mt" x={x + r + 4} y={y - r} className="fr-load-text">
                      {fmtF(Math.abs(l.M), "moment")}
                    </text>
                  );
                }
                return (
                  <g key={l.id} className="fr-load">
                    {out}
                  </g>
                );
              })}

          {/* Supports and joints. */}
          {nodes.map((n) => (
            <SupportSymbol key={`s${n.id}`} sup={n.sup} x={X(n.x)} y={Y(n.y)} />
          ))}

          {/* Reactions, in result views. */}
          {ok &&
            view !== "model" &&
            result.reactions.map((r) => {
              const n = node(r.node);
              if (!n) return null;
              const x = X(n.x), y = Y(n.y);
              const parts = [];
              const tol = Math.max(...result.reactions.map((q) => Math.max(Math.abs(q.Rx), Math.abs(q.Ry))), 1) * 1e-6;
              if (Math.abs(r.Ry) > tol) parts.push(`${r.Ry > 0 ? "↑" : "↓"} ${fmtF(Math.abs(r.Ry), "force")}`);
              if (Math.abs(r.Rx) > tol) parts.push(`${r.Rx > 0 ? "→" : "←"} ${fmtF(Math.abs(r.Rx), "force")}`);
              if (n.sup === "fixed" && Math.abs(r.M) > tol) parts.push(`${r.M > 0 ? "↺" : "↻"} ${fmtF(Math.abs(r.M), "moment")}`);
              return (
                <text key={`r${r.node}`} x={x} y={y + 44} textAnchor="middle" className="fr-reaction">
                  {parts.map((p, i) => (
                    <tspan key={i} x={x} dy={i ? 15 : 0}>
                      {p}
                    </tspan>
                  ))}
                </text>
              );
            })}

          {nodes.map((n) => {
            const isSel = sel?.kind === "node" && sel.id === n.id;
            const isPend = pending === n.id;
            return (
              <g key={n.id} className={`fr-node ${isSel ? "is-sel" : ""} ${isPend ? "is-pending" : ""}`}>
                <circle cx={X(n.x)} cy={Y(n.y)} r={isSel || isPend ? 8 : 6} />
                <text x={X(n.x) - 10} y={Y(n.y) - 10} textAnchor="end" className="fr-nlabel">
                  {n.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ZoomPan>
    </div>
  );
}

function SupportSymbol({ sup, x, y }) {
  if (!sup || sup === "free") return null;
  if (sup === "fixed")
    return (
      <g className="fr-support">
        <line x1={x - 18} x2={x + 18} y1={y + 2} y2={y + 2} className="fr-ground" />
        {[-16, -8, 0, 8, 16].map((d) => (
          <line key={d} x1={x + d} y1={y + 2} x2={x + d - 7} y2={y + 11} className="fr-hatch" />
        ))}
      </g>
    );
  if (sup === "rollerX")
    return (
      <g className="fr-support">
        <path d={`M${x},${y} L${x - 16},${y - 10} L${x - 16},${y + 10} Z`} />
        <circle cx={x - 21} cy={y - 5} r="4" />
        <circle cx={x - 21} cy={y + 5} r="4" />
        <line x1={x - 26} x2={x - 26} y1={y - 15} y2={y + 15} className="fr-ground" />
      </g>
    );
  return (
    <g className="fr-support">
      <path d={`M${x},${y} L${x - 11},${y + 16} L${x + 11},${y + 16} Z`} />
      {sup === "rollerY" ? (
        <>
          <circle cx={x - 6} cy={y + 21} r="4" />
          <circle cx={x + 6} cy={y + 21} r="4" />
          <line x1={x - 16} x2={x + 16} y1={y + 26} y2={y + 26} className="fr-ground" />
        </>
      ) : (
        <line x1={x - 16} x2={x + 16} y1={y + 16} y2={y + 16} className="fr-ground" />
      )}
    </g>
  );
}

// Editors ---------------------------------------------------------------------

function EditorHead({ title, sub, close, remove, removeLabel }) {
  return (
    <div className="fr-ed-head">
      <div>
        <h2>{title}</h2>
        {sub && <p className="tf-muted tf-small">{sub}</p>}
      </div>
      <div className="fr-ed-actions">
        {remove && (
          <button type="button" className="tf-icon-btn" onClick={remove} title={removeLabel}>
            <Trash2 size={17} />
          </button>
        )}
        <button type="button" className="tf-icon-btn" onClick={close} title="Done">
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="tf-field">
      <span className="tf-label">{label}</span>
      <div className="tf-segmented is-small fr-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NodeEditor({ node, model, result, unitFor, setUnit, update, setLoad, remove, close }) {
  const ld = model.loads.find((l) => l.on === "node" && l.node === node.id) || { Fx: 0, Fy: 0, M: 0 };
  const attached = model.members.filter((m) => m.a === node.id || m.b === node.id).length;
  const disp = result.ok ? result.nodes.find((n) => n.id === node.id) : null;
  const reac = result.ok ? result.reactions.find((r) => r.node === node.id) : null;
  const f = (dim, v) => `${fmt(fromSI(v, dim, unitFor(dim)), 4)} ${unitLabel(dim, unitFor(dim))}`;
  const num = (id, label, dim, value, onValue, hint) => (
    <NumField id={`fr-${node.id}-${id}`} label={label} hint={hint} dim={dim} value={value} unit={unitFor(dim)} onValue={(v) => Number.isFinite(v) && onValue(v)} onUnit={(u) => setUnit(dim, u)} />
  );
  return (
    <div className="fr-editor">
      <EditorHead title={`Joint ${node.id}`} sub={`${attached} member${attached === 1 ? "" : "s"} connected`} close={close} remove={remove} removeLabel="Delete this joint and its members" />
      <div className="fr-pair">
        {num("x", "X", "length", node.x, (v) => update({ x: v }))}
        {num("y", "Y", "length", node.y, (v) => update({ y: v }))}
      </div>
      <Seg label="Support" options={SUPPORTS} value={node.sup || "free"} onChange={(v) => update({ sup: v })} />
      <h3 className="fr-sub">Loads on this joint</h3>
      <div className="fr-pair">
        {num("fx", "Horizontal (→ +)", "force", ld.Fx || 0, (v) => setLoad({ Fx: v }))}
        {num("fy", "Vertical (↓ +)", "force", -(ld.Fy || 0), (v) => setLoad({ Fy: -v }))}
      </div>
      {num("m", "Moment (clockwise +)", "moment", -(ld.M || 0), (v) => setLoad({ M: -v }))}
      {disp && (
        <dl className="fr-readout">
          <div>
            <dt>Moves</dt>
            <dd>
              {f("smallLength", disp.dx)} →, {f("smallLength", -disp.dy)} ↓
            </dd>
          </div>
          {disp.rz !== null && (
            <div>
              <dt>Rotates</dt>
              <dd>{f("angle", -disp.rz)} clockwise</dd>
            </div>
          )}
          {reac && (
            <div>
              <dt>Reaction</dt>
              <dd>
                {f("force", reac.Rx)} →, {f("force", reac.Ry)} ↑{node.sup === "fixed" ? `, ${f("moment", -reac.M)} clockwise` : ""}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function SectionPicker({ value, onChange, sectionOptions, allowCustom = true }) {
  return (
    <select className="tf-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Section">
      {sectionOptions.map((g) => (
        <optgroup key={g.family} label={g.family}>
          {g.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      ))}
      {allowCustom && (
        <optgroup label="Your own">
          <option value="custom">Custom shape or properties…</option>
        </optgroup>
      )}
    </select>
  );
}

function CustomSection({ custom, onChange, unitFor, setUnit, idBase }) {
  const c = custom || { shape: "rect", dims: { b: 0.05, h: 0.15 } };
  const shapeDef = CUSTOM_SHAPES.find((s) => s.value === c.shape);
  return (
    <div className="fr-custom">
      <div className="tf-field">
        <label htmlFor={`${idBase}-shape`}>Custom section</label>
        <select id={`${idBase}-shape`} className="tf-select" value={c.shape} onChange={(e) => onChange(e.target.value === "props" ? { shape: "props", A: 0.005, I: 5e-5, S: 4e-4 } : { shape: e.target.value, dims: { ...(c.dims || {}) } })}>
          {CUSTOM_SHAPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value="props">Type in A, I and S</option>
        </select>
      </div>
      <div className="fr-pair">
        {c.shape === "props"
          ? [
              ["A", "Area A", "smallArea"],
              ["I", "Moment of inertia I", "inertia"],
              ["S", "Section modulus S", "sectionModulus"],
              ["Imin", "Weak-axis I (buckling, optional)", "inertia"],
            ].map(([k, label, dim]) => (
              <NumField key={k} id={`${idBase}-${k}`} label={label} dim={dim} value={c[k] ?? NaN} unit={unitFor(dim)} onValue={(v) => onChange({ ...c, [k]: Number.isFinite(v) ? v : undefined })} onUnit={(u) => setUnit(dim, u)} />
            ))
          : shapeDef?.fields.map(([k, label]) => (
              <NumField key={k} id={`${idBase}-${k}`} label={label} dim="smallLength" value={c.dims?.[k] ?? NaN} unit={unitFor("smallLength")} onValue={(v) => onChange({ ...c, dims: { ...c.dims, [k]: Number.isFinite(v) ? v : undefined } })} onUnit={(u) => setUnit("smallLength", u)} />
            ))}
      </div>
    </div>
  );
}

function MemberEditor({ member, model, result, unitFor, setUnit, sectionOptions, update, setModel, remove, close }) {
  const a = model.nodes.find((n) => n.id === member.a), b = model.nodes.find((n) => n.id === member.b);
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const sec = memberSection(member);
  const mat = frameMaterial(member.mat);
  const r = result.ok ? result.members.find((x) => x.id === member.id) : null;
  const myLoads = model.loads.filter((l) => l.on === "member" && l.member === member.id);
  const f = (dim, v) => `${fmt(fromSI(v, dim, unitFor(dim)), 4)} ${unitLabel(dim, unitFor(dim))}`;
  const idb = `fr-${member.id}`;
  const shape = member.sec === "custom" ? member.custom?.shape : FRAME_SECTIONS.find((s) => s.id === member.sec)?.shape;
  const setLoad = (id, patch) => setModel((m) => ({ ...m, loads: m.loads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLoad = (kind) =>
    setModel((m) => ({
      ...m,
      loads: [...m.loads, kind === "udl" ? { id: newId("L"), on: "member", member: member.id, kind, dir: "down", w: 5000 } : { id: newId("L"), on: "member", member: member.id, kind, dir: "down", P: 10000, a: L / 2 }],
    }));
  const removeLoad = (id) => setModel((m) => ({ ...m, loads: m.loads.filter((l) => l.id !== id) }));

  return (
    <div className="fr-editor">
      <EditorHead title={`Member ${member.id}`} sub={`Joint ${member.a} to ${member.b} · ${f("length", L)}`} close={close} remove={remove} removeLabel="Delete this member" />
      <div className="fr-section-row">
        <div className="tf-field">
          <label htmlFor={`${idb}-sec`}>Size</label>
          <SectionPicker
            value={member.sec}
            sectionOptions={sectionOptions}
            onChange={(v) => {
              const lib = FRAME_SECTIONS.find((s) => s.id === v);
              const curMat = frameMaterial(member.mat);
              const libMat = lib ? frameMaterial(lib.mat) : null;
              // Keep the material if it suits the new size (steel for steel, wood for wood).
              const keep = !libMat || libMat.kind === curMat.kind;
              update({ sec: v, ...(v === "custom" && !member.custom ? { custom: { shape: "rect", dims: { b: 0.05, h: 0.15 } } } : {}), ...(keep ? {} : { mat: lib.mat }) });
            }}
          />
        </div>
        {sec?.shape && sec.dims && (
          <svg viewBox="0 0 64 64" className="fr-shape" aria-hidden="true">
            <g transform={member.axis === "weak" ? "rotate(90 32 32)" : undefined}>
              <SectionShape shape={sec.shape} dims={sec.dims} cx={32} cy={32} size={52} className="tf-section-body" minWall={1.2} />
            </g>
          </svg>
        )}
      </div>
      {member.sec === "custom" && <CustomSection custom={member.custom} onChange={(c) => update({ custom: c })} unitFor={unitFor} setUnit={setUnit} idBase={idb} />}
      <div className="tf-field">
        <label htmlFor={`${idb}-mat`}>Material</label>
        <select id={`${idb}-mat`} className="tf-select" value={member.mat} onChange={(e) => update({ mat: e.target.value })}>
          {FRAME_MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {shape && !SYMMETRIC.has(shape) && shape !== "props" && (
        <Seg
          label="Bending about"
          options={[
            { value: "strong", label: "Strong axis" },
            { value: "weak", label: "Weak axis" },
          ]}
          value={member.axis || "strong"}
          onChange={(v) => update({ axis: v })}
        />
      )}
      <div className="fr-pair">
        <Seg
          label={`End at ${member.a}`}
          options={[
            { value: false, label: "Rigid" },
            { value: true, label: "Pinned" },
          ]}
          value={Boolean(member.hingeA)}
          onChange={(v) => update({ hingeA: v })}
        />
        <Seg
          label={`End at ${member.b}`}
          options={[
            { value: false, label: "Rigid" },
            { value: true, label: "Pinned" },
          ]}
          value={Boolean(member.hingeB)}
          onChange={(v) => update({ hingeB: v })}
        />
      </div>
      <p className="tf-hint">Rigid is a welded or moment connection that carries moment. Pinned is a bolted shear tab, clip angle or pin that lets the end rotate.</p>
      <NumField id={`${idb}-K`} label="Buckling length factor K" dim="none" value={member.K ?? 1} unit="-" onValue={(v) => Number.isFinite(v) && v > 0 && update({ K: v })} onUnit={() => {}} hint="1 for pinned ends, 0.65–0.8 fixed both ends, 2 for a free-standing post." />
      <button type="button" className="tf-export-btn fr-apply" onClick={() => setModel((m) => ({ ...m, members: m.members.map((x) => ({ ...x, sec: member.sec, mat: member.mat, axis: member.axis, custom: member.custom })) }))}>
        Use this size and material for every member
      </button>

      <h3 className="fr-sub">Loads on this member</h3>
      {myLoads.length === 0 && <p className="tf-muted tf-small">No loads. Add a uniform or point load below, or switch on self-weight with nothing selected.</p>}
      {myLoads.map((l) => (
        <div key={l.id} className="fr-load-row">
          <div className="fr-load-top">
            <strong>{l.kind === "udl" ? "Uniform load" : "Point load"}</strong>
            <button type="button" className="tf-icon-btn is-small" onClick={() => removeLoad(l.id)} title="Remove this load">
              <Trash2 size={15} />
            </button>
          </div>
          <Seg label="Direction" options={DIRS} value={l.dir || "down"} onChange={(v) => setLoad(l.id, { dir: v })} />
          <div className="fr-pair">
            {l.kind === "udl" ? (
              <NumField id={`${idb}-${l.id}-w`} label="Load per length" dim="linearLoad" value={l.w} unit={unitFor("linearLoad")} onValue={(v) => Number.isFinite(v) && setLoad(l.id, { w: v })} onUnit={(u) => setUnit("linearLoad", u)} />
            ) : (
              <>
                <NumField id={`${idb}-${l.id}-P`} label="Load" dim="force" value={l.P} unit={unitFor("force")} onValue={(v) => Number.isFinite(v) && setLoad(l.id, { P: v })} onUnit={(u) => setUnit("force", u)} />
                <NumField id={`${idb}-${l.id}-a`} label={`Distance from ${member.a}`} dim="length" value={l.a ?? L / 2} unit={unitFor("length")} onValue={(v) => Number.isFinite(v) && setLoad(l.id, { a: Math.min(Math.max(v, 0), L) })} onUnit={(u) => setUnit("length", u)} />
              </>
            )}
          </div>
        </div>
      ))}
      <div className="fr-add-row">
        <button type="button" className="tf-export-btn" onClick={() => addLoad("udl")}>
          <Plus size={15} aria-hidden="true" /> Uniform load
        </button>
        <button type="button" className="tf-export-btn" onClick={() => addLoad("point")}>
          <Plus size={15} aria-hidden="true" /> Point load
        </button>
      </div>

      {sec && (
        <dl className="fr-readout">
          <div>
            <dt>Section</dt>
            <dd>
              A {f("smallArea", sec.A)}, I {f("inertia", sec.I)}, S {f("sectionModulus", sec.S)}
            </dd>
          </div>
          <div>
            <dt>{mat.kind === "wood" ? "Bending strength Fb" : "Yield"}</dt>
            <dd>
              {f("stress", mat.Fy)}, E {f("modulus", mat.E)}
            </dd>
          </div>
          {r && (
            <>
              <div>
                <dt>Axial</dt>
                <dd>{r.Nmax > Math.abs(r.Nmin) ? `${f("force", r.Nmax)} tension` : r.Nmin < 0 ? `${f("force", -r.Nmin)} compression` : "none"}</dd>
              </div>
              <div>
                <dt>Max shear</dt>
                <dd>{f("force", r.Vabs)}</dd>
              </div>
              <div>
                <dt>Max moment</dt>
                <dd>{f("moment", r.Mabs)}</dd>
              </div>
              <div>
                <dt>Stress</dt>
                <dd className={r.util > 1 ? "is-bad" : ""}>
                  {f("stress", r.sigma)} ({Math.round(r.util * 100)}%)
                </dd>
              </div>
              <div>
                <dt>Deflection</dt>
                <dd>
                  {f("smallLength", r.defl)} {Number.isFinite(r.spanRatio) && r.defl > 0 ? `(L/${Math.round(r.spanRatio)})` : ""}
                </dd>
              </div>
              {r.compression > 0 && (
                <div>
                  <dt>Buckling</dt>
                  <dd className={r.bucklingRatio < 1 ? "is-bad" : ""}>
                    Pcr {f("force", r.Pcr)}, {fmt(r.bucklingRatio, 3)}× the load
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function Settings({ model, setModel, unitFor, setUnit, sectionOptions, us }) {
  const d = model.defaults || {};
  const grids = us ? [0.5, 1, 2, 5, 10].map((x) => ({ v: x * FT, label: `${x} ft` })) : [0.1, 0.25, 0.5, 1, 2, 5].map((x) => ({ v: x, label: `${x} m` }));
  const gridVal = grids.reduce((best, g) => (Math.abs(g.v - model.grid) < Math.abs(best.v - model.grid) ? g : best), grids[0]);
  const weight = model.members.reduce((t, m) => {
    const s = memberSection(m);
    const a = model.nodes.find((n) => n.id === m.a), b = model.nodes.find((n) => n.id === m.b);
    return s && a && b ? t + frameMaterial(m.mat).rho * s.A * Math.hypot(b.x - a.x, b.y - a.y) * 9.80665 : t;
  }, 0);
  return (
    <div className="fr-editor">
      <div className="fr-ed-head">
        <div>
          <h2>Frame settings</h2>
          <p className="tf-muted tf-small">
            {model.nodes.length} joints, {model.members.length} members. Tap a joint or member on the drawing to edit it.
          </p>
        </div>
      </div>
      <div className="tf-field">
        <label htmlFor="fr-grid">Grid spacing</label>
        <select id="fr-grid" className="tf-select" value={gridVal.label} onChange={(e) => setModel((m) => ({ ...m, grid: grids.find((g) => g.label === e.target.value).v }))}>
          {grids.map((g) => (
            <option key={g.label}>{g.label}</option>
          ))}
        </select>
      </div>
      <Seg
        label={`Self-weight (${fmt(fromSI(weight, "force", unitFor("force")), 3)} ${unitLabel("force", unitFor("force"))} total)`}
        options={[
          { value: false, label: "Leave out" },
          { value: true, label: "Include" },
        ]}
        value={Boolean(model.selfWeight)}
        onChange={(v) => setModel((m) => ({ ...m, selfWeight: v }))}
      />
      <h3 className="fr-sub">New members you draw</h3>
      <div className="tf-field">
        <label htmlFor="fr-def-sec">Size</label>
        <SectionPicker value={d.sec || (us ? "W12x26" : "IPE 240")} sectionOptions={sectionOptions} allowCustom={false} onChange={(v) => setModel((m) => ({ ...m, defaults: { ...d, sec: v, mat: frameSectionMat(v) } }))} />
      </div>
      <div className="tf-field">
        <label htmlFor="fr-def-mat">Material</label>
        <select id="fr-def-mat" className="tf-select" value={d.mat || frameSectionMat(d.sec)} onChange={(e) => setModel((m) => ({ ...m, defaults: { ...d, mat: e.target.value } }))}>
          {FRAME_MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fr-units">
        <span className="tf-muted tf-small">Units</span>
        {["length", "force", "linearLoad", "moment", "stress"].map((dim) => (
          <UnitSelect key={dim} dim={dim} unit={unitFor(dim)} onChange={(u) => setUnit(dim, u)} label={dim} compact />
        ))}
      </div>
    </div>
  );
}

// Results ---------------------------------------------------------------------

function Summary({ result, unitFor, onPick }) {
  const f = (dim, v, sig = 4) => (
    <>
      {fmt(fromSI(v, dim, unitFor(dim)), sig)} <small>{unitLabel(dim, unitFor(dim))}</small>
    </>
  );
  if (!result.ok)
    return (
      <section className="tf-card tf-results fr-summary" aria-live="polite">
        <div className="tf-primary is-empty">
          <span className="tf-primary-label">Result</span>
          <div className="tf-primary-value">
            <output>—</output>
          </div>
        </div>
        <p className="tf-warning">
          <TriangleAlert size={16} aria-hidden="true" />
          {result.error}
        </p>
      </section>
    );
  const s = result.summary;
  const g = s.governing;
  const item = (label, value, id) => (
    <div className="tf-result">
      <dt>{label}</dt>
      <dd>
        <span className="tf-result-num">{value}</span>
        {id && (
          <button type="button" className="fr-member-link" onClick={() => onPick(id)}>
            {id}
          </button>
        )}
      </dd>
    </div>
  );
  return (
    <section className="tf-card tf-results fr-summary" aria-live="polite" aria-label="Results">
      <div className="tf-primary">
        <span className="tf-primary-label">Highest stress ratio (member {g.id})</span>
        <div className="tf-primary-value">
          <output className={g.util > 1 ? "is-bad" : ""}>{Math.round(g.util * 100)}%</output>
          <span className="tf-muted tf-small">of {g.material.kind === "wood" ? "Fb" : "yield"}</span>
        </div>
      </div>
      <dl className="tf-result-list">
        {item("Largest joint movement", f("smallLength", s.maxJoint.d), null)}
        {s.worstDefl && s.worstDefl.defl > 0 && item("Worst member deflection", <>{f("smallLength", s.worstDefl.defl)} (L/{Math.round(s.worstDefl.spanRatio)})</>, s.worstDefl.id)}
        {item("Largest moment", f("moment", s.maxM.Mabs), s.maxM.id)}
        {item("Largest shear", f("force", s.maxV.Vabs), s.maxV.id)}
        {s.maxTension.Nmax > 0 && item("Largest tension", f("force", s.maxTension.Nmax), s.maxTension.id)}
        {s.maxCompression.compression > 0 && item("Largest compression", f("force", s.maxCompression.compression), s.maxCompression.id)}
        {s.worstBuckling && Number.isFinite(s.worstBuckling.bucklingRatio) && item("Lowest buckling margin", `${fmt(s.worstBuckling.bucklingRatio, 3)}× Pcr/P`, s.worstBuckling.id)}
        {item("Total applied load", <>{f("force", Math.hypot(s.totalLoad.Fx, s.totalLoad.Fy))}</>, null)}
        {item("Frame weight", f("force", s.weight), null)}
      </dl>
      {result.warnings.map((w) => (
        <p key={w} className="tf-warning">
          <TriangleAlert size={16} aria-hidden="true" />
          {w}
        </p>
      ))}
      {s.worstDefl && s.worstDefl.spanRatio < 360 && s.worstDefl.defl > 0 && (
        <p className="tf-hint">Beams are commonly limited to L/360 under live load and L/240 under total load; cantilevers use twice their length.</p>
      )}
    </section>
  );
}

function MemberTable({ result, unitFor, sel, onPick }) {
  const h = (label, dim) => (
    <th scope="col">
      {label}
      {dim && <small>{unitLabel(dim, unitFor(dim))}</small>}
    </th>
  );
  const v = (dim, x) => fmt(fromSI(x, dim, unitFor(dim)), 3);
  return (
    <section className="tf-card fr-table-card" aria-label="Member results">
      <h2 className="tf-inputs-title">Members</h2>
      <div className="fr-table-wrap">
        <table className="fr-table">
          <thead>
            <tr>
              {h("Member")}
              {h("Size")}
              {h("Length", "length")}
              {h("Axial", "force")}
              {h("Shear", "force")}
              {h("Moment", "moment")}
              {h("Stress", "stress")}
              {h("Ratio")}
              {h("Deflection")}
              {h("Buckling Pcr/P")}
            </tr>
          </thead>
          <tbody>
            {result.members.map((r) => {
              const N = r.Nmax > Math.abs(r.Nmin) ? r.Nmax : r.Nmin;
              return (
                <tr key={r.id} className={sel?.kind === "member" && sel.id === r.id ? "is-sel" : ""} onClick={() => onPick(r.id)}>
                  <th scope="row">{r.id}</th>
                  <td>{r.section.name}</td>
                  <td>{v("length", r.L)}</td>
                  <td>
                    {v("force", Math.abs(N))} {N > 0 ? "T" : N < 0 ? "C" : ""}
                  </td>
                  <td>{v("force", r.Vabs)}</td>
                  <td>{v("moment", r.Mabs)}</td>
                  <td>{v("stress", r.sigma)}</td>
                  <td className={r.util > 1 ? "is-bad" : r.util > 0.9 ? "is-warn" : ""}>{Math.round(r.util * 100)}%</td>
                  <td>{r.defl > 0 && Number.isFinite(r.spanRatio) ? `L/${Math.round(r.spanRatio)}` : "—"}</td>
                  <td className={r.bucklingRatio < 1 ? "is-bad" : r.bucklingRatio < 2 ? "is-warn" : ""}>{Number.isFinite(r.bucklingRatio) ? fmt(r.bucklingRatio, 3) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Reactions({ result, unitFor }) {
  const v = (dim, x) => fmt(fromSI(x, dim, unitFor(dim)), 4);
  return (
    <section className="tf-card fr-table-card" aria-label="Support reactions">
      <h2 className="tf-inputs-title">Support reactions</h2>
      <div className="fr-table-wrap">
        <table className="fr-table">
          <thead>
            <tr>
              <th scope="col">Joint</th>
              <th scope="col">Support</th>
              <th scope="col">
                Horizontal → <small>{unitLabel("force", unitFor("force"))}</small>
              </th>
              <th scope="col">
                Vertical ↑ <small>{unitLabel("force", unitFor("force"))}</small>
              </th>
              <th scope="col">
                Moment ↻ <small>{unitLabel("moment", unitFor("moment"))}</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.reactions.map((r) => (
              <tr key={r.node}>
                <th scope="row">{r.node}</th>
                <td>{SUPPORTS.find((s) => s.value === r.sup)?.label}</td>
                <td>{v("force", r.Rx)}</td>
                <td>{v("force", r.Ry)}</td>
                <td>{r.sup === "fixed" ? v("moment", -r.M) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
