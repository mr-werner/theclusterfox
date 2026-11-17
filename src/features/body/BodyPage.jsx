import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronUp, Crosshair, Dumbbell, Eye, EyeOff, Layers, Loader2, RotateCcw, Scan, Search, SlidersHorizontal, Undo2, X,
} from "lucide-react";

import AppBar from "../../components/AppBar";
import AnatomyViewer from "./viewer/AnatomyViewer";
import { openInApp } from "../../lib/launchApp";
import { LAYERS, baseName, displayName, layerById, mirrorOf, searchParts, searchStructures, sideOf } from "./model/parts";
import { liftGroupFor, liftHref, partsInGroup } from "./model/liftLink";
import { KINDS, kindInfo } from "./data/kinds";
import { noteFor } from "./data/notes";
import AddToStudy from "../../components/AddToStudy";
import { muscleName } from "../lift/data/muscles";
import "./body.css";
import "./identity.css";

const STORE_KEY = "bodyfox-view-v1";
const DEFAULT_MODES = { skin: "off", muscles: "solid", skeleton: "solid", organs: "off", vessels: "off", nervous: "off" };
const MODE_ORDER = ["solid", "ghost", "off"];
const MODE_LABEL = { solid: "Show", ghost: "See-through", off: "Off" };

// Quick places to fly to, in body space (metres, the body's right side is -x).
const REGIONS = [
  { id: "head", name: "Head", box: [[-0.1, 1.4, -0.03], [0.1, 1.66, 0.2]] },
  { id: "chest", name: "Chest", box: [[-0.17, 1.0, -0.02], [0.17, 1.38, 0.22]] },
  { id: "belly", name: "Belly", box: [[-0.16, 0.86, 0], [0.16, 1.1, 0.2]] },
  { id: "pelvis", name: "Pelvis", box: [[-0.16, 0.72, -0.01], [0.16, 0.96, 0.16]] },
  { id: "arm", name: "Arm", box: [[-0.3, 0.8, -0.02], [-0.1, 1.36, 0.15]] },
  { id: "hand", name: "Hand", box: [[-0.34, 0.62, 0.0], [-0.2, 0.84, 0.2]] },
  { id: "leg", name: "Leg", box: [[-0.16, -0.03, 0.03], [-0.02, 0.85, 0.14]] },
  { id: "foot", name: "Foot", box: [[-0.17, -0.08, 0.0], [-0.03, 0.04, 0.24]] },
];
const VIEWS = [
  { id: "front", name: "Front" },
  { id: "back", name: "Back" },
  { id: "left", name: "Right side" },
  { id: "right", name: "Left side" },
];

function readSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!raw) return null;
    const modes = { ...DEFAULT_MODES };
    for (const l of LAYERS) if (MODE_ORDER.includes(raw.modes?.[l.id])) modes[l.id] = raw.modes[l.id];
    return { modes, detail: raw.detail === "high" || raw.detail === "light" ? raw.detail : "auto" };
  } catch {
    return null;
  }
}

function hasWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function wantsLite() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const small = window.innerWidth < 760;
  const lowMemory = (navigator.deviceMemory ?? 8) <= 4;
  return Boolean(coarse || small || lowMemory);
}

export default function BodyPage() {
  const [saved] = useState(readSaved);
  const [webglOk] = useState(hasWebGL2);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);
  const viewerRef = useRef(null);
  const searchRef = useRef(null);

  const [index, setIndex] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [modes, setModes] = useState(saved?.modes ?? DEFAULT_MODES);
  const [detail, setDetail] = useState(saved?.detail ?? "auto");
  const [status, setStatus] = useState({});
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [explode, setExplode] = useState(0);
  const [hidden, setHidden] = useState([]);
  const [isolated, setIsolated] = useState(null); // { label, ids }
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadedTris, setLoadedTris] = useState(0);
  const [touched, setTouched] = useState(false);
  const sideRef = useRef(null);

  const lite = detail === "light" || (detail === "auto" && wantsLite());

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ modes, detail }));
    } catch {
      // Private mode: the view simply isn't remembered.
    }
  }, [modes, detail]);

  // The parts list: names, layers and where each part sits.
  useEffect(() => {
    let live = true;
    fetch("/anatomy/index.json")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => live && setIndex(data))
      .catch(() => live && setLoadError("The body couldn't load. Check your connection and try again."));
    return () => {
      live = false;
    };
  }, []);

  const parts = index?.parts ?? null;
  const partsById = useMemo(() => new Map((parts ?? []).map(p => [p.id, p])), [parts]);

  const onSelect = useCallback(part => {
    setSelected(part);
    viewerRef.current?.select(part);
  }, []);

  // Build the 3D view once the parts list is in. Rebuilt only if the detail level changes.
  useEffect(() => {
    if (!parts || !stageRef.current || !webglOk) return undefined;
    const viewer = new AnatomyViewer(stageRef.current, {
      parts,
      lite,
      onSelect,
      onHover: (part, x, y) => setHover(part ? { part, x, y } : null),
      onLayerStatus: (id, s) => {
        setStatus(prev => ({ ...prev, [id]: s }));
        if (s === "ready") setLoadedTris(viewer.stats().triangles);
      },
    });
    viewerRef.current = viewer;
    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [parts, lite, onSelect, webglOk]);

  // On phones the controls sit over the bottom of the view; frame the body above them.
  useEffect(() => {
    const side = sideRef.current;
    const v = viewerRef.current;
    if (!side || !v) return undefined;
    const measure = () => {
      const overlaid = getComputedStyle(side).position === "absolute";
      v.setInsetBottom(overlaid && !panelOpen ? side.offsetHeight : 0);
    };
    measure();
    v.view("front", { instant: true });
    const ro = new ResizeObserver(measure);
    ro.observe(side);
    return () => ro.disconnect();
    // Re-frame only when a new viewer is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, lite]);

  // Keep the viewer in step with the page's state.
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    for (const l of LAYERS) v.setLayerMode(l.id, modes[l.id]).catch(() => {});
  }, [modes, parts, lite]);

  useEffect(() => {
    viewerRef.current?.setExplode(explode);
  }, [explode]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    v.hidden = new Set(hidden);
    v.isolated = isolated ? new Set(isolated.ids) : null;
    v.select(selected);
    v.refreshAll();
  }, [hidden, isolated, selected, parts, lite]);

  const turnOn = useCallback(layerId => {
    setModes(m => (m[layerId] === "off" ? { ...m, [layerId]: "solid" } : m));
  }, []);

  const focusParts = useCallback(list => {
    viewerRef.current?.focusParts(list);
  }, []);

  const choose = useCallback(part => {
    turnOn(part.layer);
    setHidden(h => h.filter(id => id !== part.id));
    onSelect(part);
    setQuery("");
    setPanelOpen(false);
    // Give a newly switched-on layer a moment to arrive before flying.
    viewerRef.current?.ensureLayer(part.layer).then(() => focusParts([part])).catch(() => {});
  }, [turnOn, onSelect, focusParts]);

  // Links in: ?part=<id> opens a part, ?group=<LiftFox group> shows those muscles.
  const linkPart = params.get("part");
  const linkGroup = params.get("group");
  useEffect(() => {
    if (!parts || !viewerRef.current || (!linkPart && !linkGroup)) return;
    // Handled just after this render, once the viewer is in place.
    queueMicrotask(() => {
      if (linkPart && partsById.has(linkPart)) {
        choose(partsById.get(linkPart));
      } else if (linkGroup) {
        const group = partsInGroup(parts, linkGroup);
        if (group.length) {
          turnOn("muscles");
          setIsolated({ label: muscleName(linkGroup), ids: group.map(p => p.id) });
          viewerRef.current?.ensureLayer("muscles").then(() => focusParts(group)).catch(() => {});
        }
      }
      setParams({}, { replace: true });
    });
  }, [parts, partsById, linkPart, linkGroup, choose, turnOn, focusParts, setParams]);

  const results = useMemo(() => (parts && query.trim() ? searchParts(parts, query, 30) : []), [parts, query]);
  const structures = useMemo(() => (parts ? searchStructures(parts, query) : []), [parts, query]);

  function showStructure(structure) {
    const layersNeeded = [...new Set(structure.parts.map(p => p.layer))];
    setModes(m => {
      const next = { ...m };
      for (const id of layersNeeded) if (next[id] === "off") next[id] = "solid";
      return next;
    });
    setHidden(h => h.filter(id => !structure.parts.some(p => p.id === id)));
    setIsolated({ label: structure.name, ids: structure.parts.map(p => p.id) });
    onSelect(null);
    setQuery("");
    setPanelOpen(false);
    Promise.all(layersNeeded.map(id => viewerRef.current?.ensureLayer(id)))
      .then(() => focusParts(structure.parts))
      .catch(() => {});
  }

  function cycleMode(layerId) {
    setModes(m => ({ ...m, [layerId]: MODE_ORDER[(MODE_ORDER.indexOf(m[layerId]) + 1) % MODE_ORDER.length] }));
  }

  function hideSelected() {
    if (!selected) return;
    setHidden(h => [...h, selected.id]);
    onSelect(null);
  }

  function isolateSelected() {
    if (!selected) return;
    if (isolated) {
      setIsolated(null);
      return;
    }
    const mirror = mirrorOf(selected, parts);
    setIsolated({ label: displayName(selected.name), ids: [selected.id, ...(mirror ? [mirror.id] : [])] });
    // Peel the skin away so the part shows through.
    setModes(m => ({ ...m, skin: m.skin === "solid" ? "ghost" : m.skin }));
  }

  function resetAll() {
    setHidden([]);
    setIsolated(null);
    setExplode(0);
    onSelect(null);
    setModes(DEFAULT_MODES);
    viewerRef.current?.view("front");
  }

  const anyLoading = Object.values(status).includes("loading");

  return (
    <div className="bf">
      <AppBar appId="bodyfox" planTitle={selected ? `Study: ${displayName(selected.name)}` : "Study anatomy in BodyFox"} />

      <div className={`bf-main${selected ? " has-info" : ""}`}>
        <aside ref={sideRef} className={`bf-side${panelOpen ? " is-open" : ""}`} aria-label="Body controls">
          <button type="button" className="bf-grab" onClick={() => setPanelOpen(o => !o)} aria-expanded={panelOpen}>
            <span className="bf-grab-bar" aria-hidden="true" />
            <span className="bf-grab-label">
              <SlidersHorizontal size={15} aria-hidden="true" /> {panelOpen ? "Fewer controls" : "More controls"}
            </span>
            <ChevronUp size={16} className="bf-grab-chev" aria-hidden="true" />
          </button>

          <section className="bf-sec bf-search">
            <label className="bf-searchbox">
              <Search size={16} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Find a part: femur, liver, biceps…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setPanelOpen(true)}
                aria-label="Find a body part"
              />
              {query && (
                <button type="button" className="bf-icon-btn" onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </label>
            {query.trim() && (
              <ul className="bf-results" role="listbox" aria-label="Matching parts">
                {structures.map(st => (
                  <li key={st.id}>
                    <button type="button" className="bf-result-group" onClick={() => showStructure(st)}>
                      <Scan size={15} aria-hidden="true" />
                      <span className="bf-result-name">Show the {st.name.toLowerCase()}</span>
                      <span className="bf-result-layer">{st.parts.length} parts</span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && structures.length === 0 && <li className="bf-empty">No parts match "{query}".</li>}
                {results.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => choose(p)}>
                      <span className="bf-dot" style={{ background: layerById.get(p.layer).color }} aria-hidden="true" />
                      <span className="bf-result-name">{displayName(p.name)}</span>
                      <span className="bf-result-layer">{layerById.get(p.layer).short}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bf-sec">
            <h2 className="bf-h">
              <Layers size={15} aria-hidden="true" /> Layers
            </h2>
            <ul className="bf-layers">
              {LAYERS.map(l => {
                const mode = modes[l.id];
                const st = status[l.id];
                return (
                  <li key={l.id} className={`bf-layer is-${mode}`}>
                    <button type="button" className="bf-layer-name" onClick={() => cycleMode(l.id)} title={`${l.name}: ${MODE_LABEL[mode]}. Tap to change.`}>
                      <span className="bf-swatch" style={{ "--c": l.color }} aria-hidden="true" />
                      <span className="bf-layer-text">
                        <strong>{l.name}</strong>
                        <small>{st === "loading" ? "Loading…" : st === "error" ? "Couldn't load, tap to retry" : l.blurb}</small>
                      </span>
                      {st === "loading" && <Loader2 size={15} className="bf-spin" aria-hidden="true" />}
                      <span className="bf-chip-mode">{MODE_LABEL[mode]}</span>
                    </button>
                    <div className="bf-seg" role="radiogroup" aria-label={`${l.name} display`}>
                      {MODE_ORDER.map(m => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={mode === m}
                          className={mode === m ? "is-on" : ""}
                          onClick={() => setModes(prev => ({ ...prev, [l.id]: m }))}
                          title={MODE_LABEL[m]}
                        >
                          {m === "solid" ? <Eye size={14} /> : m === "ghost" ? <Scan size={14} /> : <EyeOff size={14} />}
                          <span className="bf-sr">{MODE_LABEL[m]}</span>
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="bf-sec bf-apart">
            <h2 className="bf-h">Take apart</h2>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explode}
              onChange={e => setExplode(+e.target.value)}
              aria-label="Take the body apart"
            />
            <div className="bf-apart-ends" aria-hidden="true">
              <span>Together</span>
              <span>Pulled apart</span>
            </div>
          </section>

          <section className="bf-sec bf-more">
            <h2 className="bf-h">Go to</h2>
            <div className="bf-pills">
              {REGIONS.map(r => (
                <button key={r.id} type="button" className="bf-pill" onClick={() => { viewerRef.current?.focusBox(r.box); setPanelOpen(false); }}>
                  {r.name}
                </button>
              ))}
            </div>
            <div className="bf-pills">
              {VIEWS.map(v => (
                <button key={v.id} type="button" className="bf-pill is-quiet" onClick={() => { viewerRef.current?.view(v.id); setPanelOpen(false); }}>
                  {v.name}
                </button>
              ))}
            </div>
          </section>

          <section className="bf-sec bf-more">
            <h2 className="bf-h">Detail</h2>
            <div className="bf-seg bf-seg-wide" role="radiogroup" aria-label="Model detail">
              {[["auto", "Auto"], ["light", "Light"], ["high", "High"]].map(([id, name]) => (
                <button key={id} type="button" role="radio" aria-checked={detail === id} className={detail === id ? "is-on" : ""} onClick={() => setDetail(id)}>
                  {name}
                </button>
              ))}
            </div>
            <p className="bf-fine">
              {lite ? "Light models for a quick, smooth phone view." : "Full-detail models."} {loadedTris > 0 && `${Math.round(loadedTris / 1000)}k triangles on screen.`}
            </p>
            <button type="button" className="bf-text-btn" onClick={resetAll}>
              <RotateCcw size={14} aria-hidden="true" /> Reset everything
            </button>
          </section>

          <p className="bf-credit bf-more">
            3D anatomy from <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noreferrer">BodyParts3D</a>, © The Database Center for Life Science, CC BY 4.0. Simplified for the web. For learning, not for diagnosis.
          </p>
        </aside>

        <div className="bf-stage-wrap">
          <div className="bf-stage" ref={stageRef} onPointerDown={() => setTouched(true)} />

          {(loadError || !webglOk) && (
            <div className="bf-overlay">
              <p>{loadError ?? "Your browser couldn't start 3D graphics (WebGL 2). Try another browser or turn on hardware acceleration."}</p>
            </div>
          )}
          {!index && !loadError && (
            <div className="bf-overlay">
              <Loader2 size={22} className="bf-spin" aria-hidden="true" />
              <p>Getting the body ready…</p>
            </div>
          )}

          <div className="bf-toasts">
            {anyLoading && (
              <span className="bf-toast">
                <Loader2 size={14} className="bf-spin" aria-hidden="true" /> Loading {LAYERS.filter(l => status[l.id] === "loading").map(l => l.short.toLowerCase()).join(", ")}
              </span>
            )}
            {isolated && (
              <span className="bf-toast is-action">
                Showing {isolated.label} only
                <button type="button" onClick={() => setIsolated(null)}>Show all</button>
              </span>
            )}
            {hidden.length > 0 && (
              <span className="bf-toast is-action">
                {hidden.length} hidden
                <button type="button" onClick={() => setHidden(h => h.slice(0, -1))} title="Bring back the last part you hid">
                  <Undo2 size={13} aria-hidden="true" /> Undo
                </button>
                <button type="button" onClick={() => setHidden([])}>Show all</button>
              </span>
            )}
          </div>

          {hover && !selected && (
            <div className="bf-tip" style={{ left: hover.x, top: hover.y }} role="status">
              {displayName(hover.part.name)}
            </div>
          )}

          {index && !selected && !touched && (
            <p className="bf-hint">
              Drag to turn · pinch or scroll to zoom · {wantsLite() ? "two fingers" : "right-drag"} to move · tap a part
            </p>
          )}
        </div>

        {selected && (
          <PartInfo
            part={selected}
            parts={parts}
            isolated={Boolean(isolated)}
            onClose={() => onSelect(null)}
            onFocus={() => focusParts([selected])}
            onHide={hideSelected}
            onIsolate={isolateSelected}
            onChoose={choose}
            onLift={group => openInApp("liftfox", liftHref(group), navigate)}
          />
        )}
      </div>
    </div>
  );
}

// A general write-up for parts the data doesn't classify.
function fallbackKind(part, base) {
  if (part.layer === "muscles") return /tendon/.test(base) ? null : KINDS["muscle organ"];
  if (part.layer === "vessels") return /vein|venous|sinus/.test(base) ? KINDS["systemic vein"] : /arter|aorta|trunk|arch/.test(base) ? KINDS["systemic artery"] : null;
  if (part.layer === "nervous" && /nerve/.test(base)) return KINDS.nerve;
  if (part.layer === "skeleton" && /ligament/.test(base)) return KINDS.ligament;
  return null;
}

function PartInfo({ part, parts, isolated, onClose, onFocus, onHide, onIsolate, onChoose, onLift }) {
  const base = baseName(part.name);
  const kind = kindInfo(part.kind) ?? fallbackKind(part, base);
  const note = noteFor(base);
  const layer = layerById.get(part.layer);
  const side = sideOf(part.name);
  const mirror = useMemo(() => mirrorOf(part, parts), [part, parts]);
  const group = liftGroupFor(part);

  return (
    <aside className="bf-info" aria-label={`About ${displayName(part.name)}`}>
      <div className="bf-info-head">
        <span className="bf-tag" style={{ "--c": layer.color }}>
          {layer.name}
        </span>
        {kind && <span className="bf-tag is-plain">{kind.label}</span>}
        <button type="button" className="bf-icon-btn bf-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <h2 className="bf-info-name">{displayName(part.name)}</h2>
      {side && <p className="bf-info-side">On the body's {side} side</p>}
      <div className="bf-info-body">
        {note && <p>{note}</p>}
        {kind && (!note || part.layer === "muscles") && <p className={note ? "bf-info-kind" : ""}>{kind.text}</p>}
        {!note && !kind && <p>Part of the {layer.name.toLowerCase()}. {layer.blurb}.</p>}
      </div>

      <div className="bf-actions">
        <button type="button" onClick={onFocus}>
          <Crosshair size={15} aria-hidden="true" /> Zoom to it
        </button>
        <button type="button" onClick={onIsolate}>
          <Scan size={15} aria-hidden="true" /> {isolated ? "Show everything" : "Show only this"}
        </button>
        <button type="button" onClick={onHide}>
          <EyeOff size={15} aria-hidden="true" /> Hide it
        </button>
        {mirror && (
          <button type="button" onClick={() => onChoose(mirror)}>
            Other side
          </button>
        )}
      </div>
      {part.layer !== "skin" && (
        <div className="bf-study">
          <small>Learn the {layer.name.toLowerCase()}</small>
          <AddToStudy app="bodyfox" deck={part.layer} title={layer.name} compact />
        </div>
      )}

      {group && (
        <div className="bf-lift">
          <div>
            <small>In LiftFox this is</small>
            <strong>{muscleName(group)}</strong>
          </div>
          <button type="button" onClick={() => onLift(group)}>
            <Dumbbell size={15} aria-hidden="true" /> Train it
          </button>
        </div>
      )}
    </aside>
  );
}
