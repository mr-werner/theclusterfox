import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { project, tilesFor, unproject } from "../../clocast/model/mapTiles";

// A light map for ClimbFox: OpenStreetMap tiles placed by hand with crag
// pins on top. Drag to pan, wheel or buttons to zoom. It refits to `fit`
// when `fitKey` changes and reports the visible box after each move so the
// page can load the crags inside it.
const BASE = "https://tile.openstreetmap.org";
const MIN_Z = 3;
const MAX_Z = 16;

function fitView(points, width, height, maxZ = 14) {
  if (!points.length) return { zoom: 4, center: project(39, -98, 4) };
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lng);
  const mid = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
  for (let z = maxZ; z >= MIN_Z; z--) {
    const a = project(Math.max(...lats), Math.min(...lons), z);
    const b = project(Math.min(...lats), Math.max(...lons), z);
    if (b.x - a.x < width - 60 && b.y - a.y < height - 60) return { zoom: z, center: project(mid.lat, mid.lon, z) };
  }
  return { zoom: MIN_Z, center: project(mid.lat, mid.lon, MIN_Z) };
}

export default function ClimbMap({ fit = [], fitKey, maxFitZoom = 14, pins = [], height = 360, onMove, label = "Map of crags" }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  const [view, setView] = useState(() => fitView(fit, 600, height, maxFitZoom));
  const drag = useRef(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitRef = useRef(fit);
  useEffect(() => {
    fitRef.current = fit;
  });
  useEffect(() => {
    setView(fitView(fitRef.current, size.w, size.h, maxFitZoom));
  }, [fitKey, size.w > 0 && Math.round(size.w / 200), size.h, maxFitZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const { zoom, center } = view;
  const left = center.x - size.w / 2;
  const top = center.y - size.h / 2;

  // Tell the page what's in view, once the map settles.
  const moveRef = useRef(onMove);
  useEffect(() => {
    moveRef.current = onMove;
  });
  useEffect(() => {
    if (!moveRef.current) return undefined;
    const t = setTimeout(() => {
      const nw = unproject(left, top, zoom);
      const se = unproject(left + size.w, top + size.h, zoom);
      moveRef.current({ bbox: [nw.longitude, se.latitude, se.longitude, nw.latitude], zoom });
    }, 450);
    return () => clearTimeout(t);
  }, [left, top, zoom, size.w, size.h]);

  const at = (lat, lng) => {
    const p = project(lat, lng, zoom);
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
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    setView(v => ({ ...v, center: { x: d.cx - (e.clientX - d.x), y: d.cy - (e.clientY - d.y) } }));
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

  // Bigger crags draw on top and get labels first.
  const shown = pins
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map(p => ({ ...p, ...at(p.lat, p.lng) }))
    .filter(p => p.x > -30 && p.y > -30 && p.x < size.w + 30 && p.y < size.h + 30)
    .sort((a, b) => (a.count ?? 0) - (b.count ?? 0));
  const labelled = new Set(shown.slice(-8).map(p => p.id));

  return (
    <div className="cb-map" style={{ height }} ref={box} role="application" aria-label={label}>
      <div className="cb-map-surface" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        {tiles.map(t => (
          <img key={t.key} className="cb-tile" src={`${BASE}/${t.z}/${t.x}/${t.y}.png`} alt="" draggable={false} style={{ left: t.left, top: t.top, width: t.size, height: t.size }} />
        ))}
        <svg className="cb-map-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {shown.map(p => {
            const r = p.here ? 9 : Math.max(6, Math.min(16, 4 + Math.sqrt(p.count ?? 1)));
            return (
              <g
                key={p.id}
                transform={`translate(${p.x} ${p.y})`}
                className={`cb-pin${p.selected ? " is-on" : ""}${p.here ? " is-here" : ""}${p.boulder ? " is-boulder" : ""}`}
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => {
                  e.stopPropagation();
                  p.onClick?.();
                }}
                role={p.onClick ? "button" : undefined}
                tabIndex={p.onClick ? 0 : undefined}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && p.onClick?.()}
              >
                <title>{p.title}</title>
                <circle r={r + 6} className="cb-hit" />
                <circle r={r} className="cb-dot" />
                {p.count > 0 && r >= 9 && (
                  <text className="cb-count" textAnchor="middle" dy="0.35em">
                    {p.count > 999 ? `${Math.round(p.count / 1000)}k` : p.count}
                  </text>
                )}
                {(labelled.has(p.id) || p.selected) && p.label && (
                  <text className="cb-label" textAnchor="middle" y={-r - 6}>
                    {p.label.length > 26 ? `${p.label.slice(0, 25)}…` : p.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="cb-map-zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>
      <a className="cb-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap
      </a>
    </div>
  );
}
