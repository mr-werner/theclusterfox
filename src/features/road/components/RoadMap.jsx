import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { project, tilesFor, unproject } from "../../clocast/model/mapTiles";
import { shrink } from "../model/geo";

// RoadFox's map: OpenStreetMap tiles placed by hand with an SVG layer for
// routes and stops. Drag to pan, wheel or buttons to zoom. It fits itself to
// `fit` whenever `fitKey` changes.
const BASE = "https://tile.openstreetmap.org";
const MIN_Z = 3;
const MAX_Z = 16;

function fitView(points, width, height) {
  if (!points.length) return { zoom: 4, center: project(39, -97, 4) };
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const mid = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
  for (let z = 13; z >= MIN_Z; z--) {
    const a = project(Math.max(...lats), Math.min(...lons), z);
    const b = project(Math.min(...lats), Math.max(...lons), z);
    if (b.x - a.x < width - 60 && b.y - a.y < height - 60) return { zoom: z, center: project(mid.lat, mid.lon, z) };
  }
  return { zoom: MIN_Z, center: project(mid.lat, mid.lon, MIN_Z) };
}

/**
 * routes: [{ id, points, active }]; markers: [{ id, lat, lon, kind, label,
 * title, onClick }] where kind is start, end, stop, night, fuel, ev or place.
 */
export default function RoadMap({ fit = [], fitKey, routes = [], markers = [], height = 380, onPick, label = "Trip map" }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  const [view, setView] = useState(() => fitView(fit, 600, height));
  const drag = useRef(null);

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
  }, [fitKey, size.w > 0 && Math.round(size.w / 200), size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Long routes have thousands of points; a few hundred draw the same.
  const lines = useMemo(() => routes.map(r => ({ ...r, points: r.points.length > 1500 ? shrink(r.points, 1500) : r.points })), [routes]);

  const { zoom, center } = view;
  const left = center.x - size.w / 2;
  const top = center.y - size.h / 2;
  const at = (lat, lon) => {
    const p = project(lat, lon, zoom);
    return { x: p.x - left, y: p.y - top };
  };
  const tiles = tilesFor(center, zoom, size.w, size.h);

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
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setView(v => ({ ...v, center: { x: d.cx - dx, y: d.cy - dy } }));
  }
  function onPointerUp(e) {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && onPick) {
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
      if (now - last < 180) return;
      last = now;
      const rect = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const ordered = [...lines].sort((a, b) => Number(a.active) - Number(b.active));

  return (
    <div className="rf-map" style={{ height }} ref={box} role="application" aria-label={label}>
      <div className="rf-map-surface" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (drag.current = null)}>
        {tiles.map(t => (
          <img key={t.key} className="rf-tile" src={`${BASE}/${t.z}/${t.x}/${t.y}.png`} alt="" draggable={false} style={{ left: t.left, top: t.top, width: t.size, height: t.size }} />
        ))}
        <svg className="rf-map-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {ordered.map(r => {
            const pts = r.points.map(p => at(p.lat, p.lon)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
            return (
              <g key={r.id} className={r.active ? "rf-line is-active" : "rf-line"}>
                <polyline className="rf-line-casing" points={pts} />
                <polyline className="rf-line-core" points={pts} />
                {r.active && <polyline className="rf-line-dash" points={pts} />}
              </g>
            );
          })}
          {markers.map(m => {
            const p = at(m.lat, m.lon);
            if (p.x < -40 || p.y < -40 || p.x > size.w + 40 || p.y > size.h + 40) return null;
            const click = m.onClick
              ? {
                  onPointerDown: e => e.stopPropagation(),
                  onPointerUp: e => {
                    e.stopPropagation();
                    m.onClick();
                  },
                  role: "button",
                  tabIndex: 0,
                  "aria-label": m.title,
                  onKeyDown: e => (e.key === "Enter" || e.key === " ") && m.onClick(),
                }
              : {};
            const r = m.kind === "place" ? 5 : m.kind === "fuel" || m.kind === "ev" ? 8 : 11;
            return (
              <g key={m.id} transform={`translate(${p.x} ${p.y})`} className={`rf-pin rf-pin--${m.kind}${m.selected ? " is-selected" : ""}`} {...click}>
                <title>{m.title}</title>
                <circle r={Math.max(r, 14)} className="rf-hit" />
                {m.kind === "night" ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx="3" className="rf-pin-dot" transform="rotate(45)" /> : <circle r={r} className="rf-pin-dot" />}
                {m.label && (
                  <text y="4" textAnchor="middle" className="rf-pin-label">
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="rf-map-zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>
      <a className="rf-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap
      </a>
    </div>
  );
}
