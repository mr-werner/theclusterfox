import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Minus, Pause, Play, Plus } from "lucide-react";

// Free radar from RainViewer (the last two hours, every 10 minutes) over
// OpenStreetMap, darkened with a CSS filter to sit in the glass panels. Plain map tiles placed by hand, so no map library is needed.
// RainViewer's free tiles stop at zoom 7.
const FRAMES_URL = "https://api.rainviewer.com/public/weather-maps.json";
const BASE_URL = "https://tile.openstreetmap.org";
const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 7;

// Web Mercator: degrees to world pixels at a zoom level.
function project(latitude, longitude, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function tilesFor(center, zoom, width, height) {
  const count = 2 ** zoom;
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const tiles = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({ key: `${tx}/${ty}`, x: wrapped, y: ty, left: tx * TILE - left, top: ty * TILE - top });
    }
  }
  return tiles;
}

function clock(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function RadarMap({ place }) {
  const box = useRef(null);
  const drag = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(6);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [radar, setRadar] = useState({ status: "loading", host: "", frames: [] });
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(FRAMES_URL, { signal: controller.signal })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error("radar"))))
      .then(body => {
        const frames = [...(body.radar?.past ?? []), ...(body.radar?.nowcast ?? [])];
        setRadar({ status: frames.length ? "ready" : "error", host: body.host, frames });
        setFrame(Math.max(0, (body.radar?.past?.length ?? frames.length) - 1));
      })
      .catch(error => {
        if (error.name !== "AbortError") setRadar({ status: "error", host: "", frames: [] });
      });
    return () => controller.abort();
  }, []);

  // Loop through the frames, pausing on the latest one.
  useEffect(() => {
    if (!playing || radar.frames.length < 2) return undefined;
    const last = radar.frames.length - 1;
    const timer = window.setTimeout(() => setFrame(f => (f >= last ? 0 : f + 1)), frame === last ? 1500 : 500);
    return () => window.clearTimeout(timer);
  }, [playing, frame, radar.frames.length]);

  const here = project(place.latitude, place.longitude, zoom);
  const center = { x: here.x + offset.x, y: here.y + offset.y };
  const tiles = size.width ? tilesFor(center, zoom, size.width, size.height) : [];

  function changeZoom(step) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + step));
    if (next === zoom) return;
    const factor = 2 ** (next - zoom);
    setOffset(o => ({ x: o.x * factor, y: o.y * factor }));
    setZoom(next);
  }

  function onPointerDown(event) {
    if (event.target.closest("button")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    setOffset({ x: d.start.x - (event.clientX - d.x), y: d.start.y - (event.clientY - d.y) });
  }
  function onPointerUp() {
    drag.current = null;
  }

  const current = radar.frames[frame];
  const latest = radar.frames.length - 1;

  return (
    <div className="cc-radar">
      <div
        ref={box}
        className="cc-radar-map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        role="img"
        aria-label={`Rain radar around ${place.name}${current ? ` at ${clock(current.time)}` : ""}`}
      >
        {tiles.map(tile => (
          <img
            key={`base-${zoom}-${tile.key}`}
            className="cc-radar-tile cc-radar-base"
            src={`${BASE_URL}/${zoom}/${tile.x}/${tile.y}.png`}
            style={{ left: tile.left, top: tile.top }}
            alt=""
            draggable="false"
          />
        ))}
        {radar.frames.map((f, i) =>
          tiles.map(tile => (
            <img
              key={`${f.path}-${zoom}-${tile.key}`}
              className={`cc-radar-tile cc-radar-rain ${i === frame ? "is-on" : ""}`}
              src={`${radar.host}${f.path}/256/${zoom}/${tile.x}/${tile.y}/2/1_1.png`}
              style={{ left: tile.left, top: tile.top }}
              alt=""
              draggable="false"
              loading={Math.abs(i - frame) <= 1 || i === latest ? "eager" : "lazy"}
            />
          ))
        )}
        <span
          className="cc-radar-pin"
          style={{ left: size.width / 2 - offset.x, top: size.height / 2 - offset.y }}
          aria-hidden="true"
        />

        <div className="cc-radar-zoom">
          <button type="button" onClick={() => changeZoom(1)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => changeZoom(-1)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
            <Minus size={16} />
          </button>
        </div>

        {radar.status === "loading" && (
          <p className="cc-radar-status">
            <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading radar…
          </p>
        )}
        {radar.status === "error" && <p className="cc-radar-status">Radar isn’t available right now.</p>}
      </div>

      {radar.status === "ready" && (
        <div className="cc-radar-bar">
          <button type="button" className="cc-radar-play" onClick={() => setPlaying(p => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max={latest}
            value={frame}
            onChange={event => {
              setPlaying(false);
              setFrame(Number(event.target.value));
            }}
            aria-label="Radar time"
          />
          <span className="cc-radar-time">{current ? clock(current.time) : ""}</span>
        </div>
      )}
      <p className="cc-radar-credit">
        Radar <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a> · Map ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Drag to look around, double-tap to recenter
      </p>
    </div>
  );
}
