import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { project, tilesFor, unproject } from "../../clocast/model/mapTiles";

// A light map for FlyFox: OpenStreetMap tiles placed by hand with an SVG
// layer on top for routes, airports, hazards and aircraft. Drag to pan,
// wheel or buttons to zoom. It fits itself to `fit` whenever `fitKey` changes.
const BASE = "https://tile.openstreetmap.org";
const MIN_Z = 3;
const MAX_Z = 13;

function fitView(points, width, height) {
  if (!points.length) return { zoom: 4, center: project(39, -98, 4) };
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const mid = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
  for (let z = MAX_Z - 2; z >= MIN_Z; z--) {
    const a = project(Math.max(...lats), Math.min(...lons), z);
    const b = project(Math.min(...lats), Math.max(...lons), z);
    if (b.x - a.x < width - 70 && b.y - a.y < height - 70) return { zoom: z, center: project(mid.lat, mid.lon, z) };
  }
  return { zoom: MIN_Z, center: project(mid.lat, mid.lon, MIN_Z) };
}

// overlay: an optional tile layer on top of the map, { url(tile), maxZoom, className },
// stretched from maxZoom when the map is zoomed in further (radar stops at 7).
export default function FlyMap({ fit = [], fitKey, route = [], markers = [], hazards = [], circles = [], overlay = null, height = 380, onPick, children, label = "Map" }) {
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

  // Refit when asked (new route, new search) or when the map first gets its real size.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    setView(fitView(fitRef.current, size.w, size.h));
  }, [fitKey, size.w > 0 && Math.round(size.w / 200), size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const { zoom, center } = view;
  const left = center.x - size.w / 2;
  const top = center.y - size.h / 2;
  const at = (lat, lon) => {
    const p = project(lat, lon, zoom);
    // Wrap so the point lands nearest the view.
    const world = 256 * 2 ** zoom;
    let x = p.x - left;
    if (x < -world / 2) x += world;
    if (x > world / 2 + size.w) x -= world;
    return { x, y: p.y - top };
  };
  const tiles = tilesFor(center, zoom, size.w, size.h);
  const overlayTiles = overlay ? tilesFor(center, zoom, size.w, size.h, overlay.maxZoom ?? zoom) : [];

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

  const routePts = route.map(p => at(p.lat, p.lon));
  const nmPx = (256 * 2 ** zoom) / (360 * 60); // pixels per nm at the equator, scaled below

  return (
    <div className="fy-map" style={{ height }} ref={box} role="application" aria-label={label}>
      <div className="fy-map-surface" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => (drag.current = null)}>
        {tiles.map(t => (
          <img key={t.key} className="fy-tile" src={`${BASE}/${t.z}/${t.x}/${t.y}.png`} alt="" draggable={false} style={{ left: t.left, top: t.top, width: t.size, height: t.size }} />
        ))}
        {overlayTiles.map(t => (
          <img key={`o-${t.key}`} className={`fy-tile fy-tile-overlay ${overlay.className ?? ""}`} src={overlay.url(t)} alt="" draggable={false} style={{ left: t.left, top: t.top, width: t.size, height: t.size }} />
        ))}
        <svg className="fy-map-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {hazards.map(h => (
            <polygon key={h.id} className={`fy-hz fy-hz--${h.hazard}`} points={h.coords.map(([la, lo]) => { const p = at(la, lo); return `${p.x},${p.y}`; }).join(" ")}>
              <title>{h.label}</title>
            </polygon>
          ))}
          {circles.map(c => {
            const p = at(c.lat, c.lon);
            const r = c.nm * nmPx / Math.cos((c.lat * Math.PI) / 180);
            return (
              <circle key={c.id} cx={p.x} cy={p.y} r={Math.max(c.minPx ?? 0, r)} className={`fy-ring ${c.className ?? ""}`}>
                {c.title && <title>{c.title}</title>}
              </circle>
            );
          })}
          {routePts.length > 1 && (
            <>
              <polyline className="fy-route-casing" points={routePts.map(p => `${p.x},${p.y}`).join(" ")} />
              <polyline className="fy-route" points={routePts.map(p => `${p.x},${p.y}`).join(" ")} />
            </>
          )}
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
                  onKeyDown: e => (e.key === "Enter" || e.key === " ") && m.onClick(),
                }
              : {};
            if (m.kind === "plane") {
              return (
                <g key={m.id} transform={`translate(${p.x} ${p.y}) rotate(${m.rotate ?? 0})`} className={`fy-plane${m.selected ? " is-selected" : ""}${m.ground ? " is-ground" : ""}`} {...click}>
                  <title>{m.title}</title>
                  <circle r="13" className="fy-hit" />
                  <path d="M0 -9 L2 -3 L9 1 L9 3 L2 1.5 L1.5 6 L4 8 L4 9.5 L0 8.5 L-4 9.5 L-4 8 L-1.5 6 L-2 1.5 L-9 3 L-9 1 L-2 -3 Z" />
                </g>
              );
            }
            return (
              <g key={m.id} transform={`translate(${p.x} ${p.y})`} className={`fy-apt fy-cat--${m.category ?? "none"}${m.selected ? " is-selected" : ""}${m.waypoint ? " is-waypoint" : ""}`} {...click}>
                <title>{m.title}</title>
                <circle r="14" className="fy-hit" />
                <circle r={m.waypoint ? 7 : 5.5} className="fy-apt-dot" />
                {m.label && (
                  <text y={m.waypoint ? -12 : -10} textAnchor="middle" className="fy-apt-label">
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="fy-map-zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>
      {children}
      <a className="fy-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap
      </a>
    </div>
  );
}
