import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { project, tilesFor } from "../../clocast/model/mapTiles";

// A light pan-and-zoom map: OpenTopoMap terrain tiles (OpenStreetMap data
// with contours and hillshade) placed by hand, with an SVG layer on top that
// the caller draws with draw(at, zoom). It fits `fit` points when fitKey changes.
const TILES = { topo: "https://tile.opentopomap.org", street: "https://tile.openstreetmap.org" };
const MAX_TILE = { topo: 17, street: 19 };
const MIN_Z = 3;
const MAX_Z = 17;

function fitView(points, width, height, maxZ) {
  if (!points.length) return { zoom: 4, center: project(42, -105, 4) };
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const mid = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
  for (let z = maxZ; z >= MIN_Z; z--) {
    const a = project(Math.max(...lats), Math.min(...lons), z);
    const b = project(Math.min(...lats), Math.max(...lons), z);
    if (b.x - a.x < width - 40 && b.y - a.y < height - 40) return { zoom: z, center: project(mid.lat, mid.lon, z) };
  }
  return { zoom: MIN_Z, center: project(mid.lat, mid.lon, MIN_Z) };
}

export default function SnowMap({ fit = [], fitKey, maxFitZoom = 15, height = 380, base = "topo", draw, label = "Map", children }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 600, h: height });
  const [view, setView] = useState(() => fitView(fit, 600, height, maxFitZoom));
  const drag = useRef(null);
  const pinch = useRef(new Map());

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Refit when asked (new place) or when the map gets its real size.
  const fitSig = `${fitKey}|${Math.round(size.w / 150)}|${size.h}|${maxFitZoom}`;
  const [fitted, setFitted] = useState(null);
  if (fitted !== fitSig) {
    setFitted(fitSig);
    setView(fitView(fit, size.w, size.h, maxFitZoom));
  }

  const { zoom, center } = view;
  const left = center.x - size.w / 2;
  const top = center.y - size.h / 2;
  const at = (lat, lon) => {
    const p = project(lat, lon, zoom);
    return { x: p.x - left, y: p.y - top };
  };
  const tiles = tilesFor(center, zoom, size.w, size.h, MAX_TILE[base]);

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
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      drag.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.pinch && pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist / d.pinch > 1.5 || dist / d.pinch < 0.67) {
        const rect = box.current.getBoundingClientRect();
        zoomBy(dist > d.pinch ? 1 : -1, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        d.pinch = dist;
      }
      return;
    }
    if (d.pinch) return;
    setView(v => ({ ...v, center: { x: d.cx - (e.clientX - d.x), y: d.cy - (e.clientY - d.y) } }));
  }
  function onPointerUp(e) {
    pinch.current.delete(e.pointerId);
    if (pinch.current.size === 0) drag.current = null;
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

  const host = TILES[base];
  return (
    <div className="sf-map" style={{ height }} ref={box} role="application" aria-label={label}>
      <div className="sf-map-surface" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {tiles.map(t => (
          <img key={t.key} className="sf-tile" src={`${host}/${t.z}/${t.x}/${t.y}.png`} alt="" draggable={false} style={{ left: t.left, top: t.top, width: t.size, height: t.size }} />
        ))}
        <svg className="sf-map-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {draw?.(at, zoom)}
        </svg>
      </div>
      <div className="sf-map-zoom">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
      </div>
      {children}
      <a className="sf-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap{base === "topo" ? ", SRTM · OpenTopoMap (CC-BY-SA)" : ""}
      </a>
    </div>
  );
}
