import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Crosshair, Layers, Minus, Plus } from "lucide-react";

import { project, tilesFor, unproject } from "../../clocast/model/mapTiles";
import { LAYERS } from "../model/tiles";

// TrailFox's map: topo tiles placed by hand with an SVG layer for trails,
// your track, features and you. Drag to pan, wheel, pinch or buttons to
// zoom. It fits itself to `fit` whenever `fitKey` changes, and follows
// `me` while `follow` is on. Saved tiles come from the offline cache, so
// it works with no signal too.
const MIN_Z = 3;
const MAX_Z = 17;

function fitView(points, width, height) {
  if (!points.length) return { zoom: 4, center: project(39, -98, 4) };
  const lats = points.map(p => p[0]);
  const lons = points.map(p => p[1]);
  const mid = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2];
  for (let z = 16; z >= MIN_Z; z--) {
    const a = project(Math.max(...lats), Math.min(...lons), z);
    const b = project(Math.min(...lats), Math.max(...lons), z);
    if (b.x - a.x < width - 60 && b.y - a.y < height - 60) return { zoom: z, center: project(mid[0], mid[1], z) };
  }
  return { zoom: MIN_Z, center: project(mid[0], mid[1], MIN_Z) };
}

const GLYPH = { peak: "▲", saddle: "⌒", viewpoint: "◉", waterfall: "≋", water: "💧", hut: "⌂", camp: "⛺", toilets: "WC", trailhead: "P", waypoint: "•", end: "■", target: "✚" };

export default function HikeMap({ layer = "otm", onLayer, fit = [], fitKey, lines = [], markers = [], me = null, follow = false, onFollow, onPick, height = 360, label = "Trail map", children }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  const [view, setView] = useState(() => fitView(fit, 600, height));
  const [layersOpen, setLayersOpen] = useState(false);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const L = LAYERS[layer] ?? LAYERS.otm;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    setView(fitView(fitRef.current, size.w, size.h));
  }, [fitKey, Math.round(size.w / 200), size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow your position.
  useEffect(() => {
    if (!follow || !me) return;
    setView(v => ({ zoom: Math.max(v.zoom, 14), center: project(me.lat, me.lon, Math.max(v.zoom, 14)) }));
  }, [follow, me?.lat, me?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const { zoom, center } = view;
  const left = center.x - size.w / 2;
  const top = center.y - size.h / 2;
  const at = (lat, lon) => {
    const p = project(lat, lon, zoom);
    return { x: p.x - left, y: p.y - top };
  };
  const tiles = tilesFor(center, zoom, size.w, size.h, L.maxNative);

  function zoomBy(dz, ox = size.w / 2, oy = size.h / 2) {
    setView(v => {
      const z = Math.max(MIN_Z, Math.min(MAX_Z, v.zoom + dz));
      if (z === v.zoom) return v;
      const f = 2 ** (z - v.zoom);
      const px = v.center.x - size.w / 2 + ox;
      const py = v.center.y - size.h / 2 + oy;
      return { zoom: z, center: { x: px * f - ox + size.w / 2, y: py * f - oy + size.h / 2 } };
    });
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y), moved: true };
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y, moved: false };
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.pinch) {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const span = Math.hypot(a.x - b.x, a.y - b.y);
      if (span / d.pinch > 1.5 || span / d.pinch < 0.67) {
        const rect = box.current.getBoundingClientRect();
        zoomBy(span > d.pinch ? 1 : -1, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        d.pinch = span;
      }
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      if (!d.moved && follow) onFollow?.(false);
      d.moved = true;
    }
    if (d.moved) setView(v => ({ ...v, center: { x: d.cx - dx, y: d.cy - dy } }));
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size) return;
    drag.current = null;
    if (d && !d.moved && !d.pinch && onPick) {
      const rect = box.current.getBoundingClientRect();
      const p = unproject(left + e.clientX - rect.left, top + e.clientY - rect.top, zoom);
      onPick({ lat: p.latitude, lon: p.longitude });
    }
  }

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let last = 0;
    const onWheel = e => {
      e.preventDefault();
      const now = Date.now();
      if (now - last < 160) return;
      last = now;
      const rect = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const meAt = me ? at(me.lat, me.lon) : null;
  const metresPerPx = me ? (156543.03 * Math.cos((me.lat * Math.PI) / 180)) / 2 ** zoom : 1;

  return (
    <div className="hk-map" style={{ height }} ref={box} role="application" aria-label={label}>
      <div className="hk-map-surface" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={e => { pointers.current.delete(e.pointerId); drag.current = null; }}>
        {tiles.map(t => (
          <img key={`${layer}/${t.key}`} className="hk-tile" src={L.url(t.z, t.x, t.y)} alt="" draggable={false} crossOrigin="anonymous" style={{ left: t.left, top: t.top, width: t.size, height: t.size }} />
        ))}
        <svg className="hk-map-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {lines.map(l => {
            if (!l.points || l.points.length < 2) return null;
            const pts = l.points.map(p => { const q = at(p[0], p[1]); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");
            const click = l.onClick ? { onPointerDown: e => e.stopPropagation(), onPointerUp: e => { e.stopPropagation(); l.onClick(); }, style: { cursor: "pointer" } } : {};
            return (
              <g key={l.id} className={`hk-line ${l.className ?? ""}`} {...click}>
                {l.title && <title>{l.title}</title>}
                {l.onClick && <polyline className="hk-line-hit" points={pts} />}
                <polyline className="hk-line-casing" points={pts} />
                <polyline className="hk-line-main" points={pts} />
              </g>
            );
          })}
          {markers.map(m => {
            const p = at(m.lat, m.lon);
            if (p.x < -40 || p.y < -40 || p.x > size.w + 40 || p.y > size.h + 40) return null;
            const click = m.onClick
              ? { onPointerDown: e => e.stopPropagation(), onPointerUp: e => { e.stopPropagation(); m.onClick(); }, role: "button", tabIndex: 0, onKeyDown: e => (e.key === "Enter" || e.key === " ") && m.onClick() }
              : {};
            return (
              <g key={m.id} transform={`translate(${p.x} ${p.y})`} className={`hk-mk hk-mk--${m.kind}${m.selected ? " is-on" : ""}`} {...click}>
                <title>{m.title ?? m.label}</title>
                <circle r="15" className="hk-hit" />
                <circle r={m.kind === "route" ? 7 : 10} className="hk-mk-dot" />
                {GLYPH[m.kind] && <text className="hk-mk-glyph" textAnchor="middle" dy="0.35em">{GLYPH[m.kind]}</text>}
                {m.label && <text className="hk-mk-label" y={-15} textAnchor="middle">{m.label}</text>}
              </g>
            );
          })}
          {meAt && (
            <g transform={`translate(${meAt.x} ${meAt.y})`} className="hk-me">
              {Number.isFinite(me.accuracy) && <circle r={Math.min(200, me.accuracy / metresPerPx)} className="hk-me-acc" />}
              {Number.isFinite(me.heading) && <path d="M0 -22 L7 -8 L-7 -8 Z" transform={`rotate(${me.heading})`} className="hk-me-dir" />}
              <circle r="8" className="hk-me-dot" />
            </g>
          )}
        </svg>
      </div>
      <div className="hk-map-tools">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in"><Plus size={16} /></button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out"><Minus size={16} /></button>
        {me && onFollow && (
          <button type="button" className={follow ? "is-on" : ""} onClick={() => onFollow(!follow)} aria-label="Follow my position" aria-pressed={follow}><Crosshair size={16} /></button>
        )}
        {onLayer && (
          <button type="button" onClick={() => setLayersOpen(o => !o)} aria-label="Map style" aria-expanded={layersOpen}><Layers size={16} /></button>
        )}
      </div>
      {layersOpen && onLayer && (
        <div className="hk-map-layers" role="menu">
          {Object.values(LAYERS).map(l => (
            <button key={l.id} type="button" role="menuitemradio" aria-checked={l.id === layer} className={l.id === layer ? "is-on" : ""} onClick={() => { onLayer(l.id); setLayersOpen(false); }}>
              {l.name}
              {l.usOnly && <small>U.S.</small>}
            </button>
          ))}
        </div>
      )}
      {children}
      <a className="hk-map-credit" href={L.credit.href} target="_blank" rel="noreferrer">{L.credit.text}</a>
    </div>
  );
}
