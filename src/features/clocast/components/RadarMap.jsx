import { useEffect, useRef, useState } from "react";
import { CloudRain, Flame, LoaderCircle, Minus, Pause, Play, Plus, Satellite, Wind } from "lucide-react";

import { fetchWindGrid } from "../../../services/weather/openMeteo";
import { project, satelliteFor, tileBbox, tilesFor, windGrid } from "../model/mapTiles";

// The weather map: OpenStreetMap, darkened to sit in the glass panels, with
// free layers on top. Tiles are placed by hand, so no map library is needed.
//   Rain      RainViewer radar, the last two hours every 10 minutes (to zoom 7)
//   Clouds    NASA GIBS geostationary infrared, the latest image (to zoom 6)
//   Wind      Open-Meteo wind right now on a grid of points, drawn as arrows
//   Fires     NASA GIBS VIIRS fire hotspots from the last two days
const FRAMES_URL = "https://api.rainviewer.com/public/weather-maps.json";
const BASE_URL = "https://tile.openstreetmap.org";
const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const FIRE_LAYER = "VIIRS_NOAA20_Thermal_Anomalies_375m_All";
const MIN_ZOOM = 3;
const MAX_ZOOM = 7;

const MAP_LAYERS = [
  { id: "rain", name: "Rain", icon: CloudRain },
  { id: "clouds", name: "Clouds", icon: Satellite },
  { id: "wind", name: "Wind", icon: Wind },
  { id: "fires", name: "Fires", icon: Flame },
];

function clock(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const utcDay = daysAgo => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

function fireUrl(tile, day) {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: FIRE_LAYER,
    STYLES: "",
    CRS: "EPSG:3857",
    BBOX: tileBbox(tile.z, tile.x, tile.y),
    WIDTH: "256",
    HEIGHT: "256",
    FORMAT: "image/png",
    TRANSPARENT: "true",
    TIME: day,
  });
  return `${GIBS_WMS}?${params}`;
}

const windColor = ms => (ms < 4 ? "#9ad8ff" : ms < 8 ? "#7fe0b0" : ms < 13 ? "#f2c14e" : ms < 18 ? "#f59f4a" : "#f27a6c");
const windNumber = (ms, units) => Math.round(units === "metric" ? ms * 3.6 : ms * 2.23694);

function Tiles({ tiles, className, src, style }) {
  return tiles.map(tile => (
    <img
      key={tile.key}
      className={`cc-radar-tile ${className}`}
      src={src(tile)}
      style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size, ...style }}
      alt=""
      draggable="false"
    />
  ));
}

export default function RadarMap({ place, units, layers, onLayers }) {
  const box = useRef(null);
  const drag = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(6);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [radar, setRadar] = useState({ status: "loading", host: "", frames: [] });
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Wind readings by grid point, kept while the map is open.
  const [wind, setWind] = useState({ status: "idle", points: {} });
  const on = new Set(layers);

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
  const animate = playing && on.has("rain") && radar.frames.length > 1;
  useEffect(() => {
    if (!animate) return undefined;
    const last = radar.frames.length - 1;
    const timer = window.setTimeout(() => setFrame(f => (f >= last ? 0 : f + 1)), frame === last ? 1500 : 500);
    return () => window.clearTimeout(timer);
  }, [animate, frame, radar.frames.length]);

  const here = project(place.latitude, place.longitude, zoom);
  const center = { x: here.x + offset.x, y: here.y + offset.y };
  const ready = size.width > 0;
  const tiles = ready ? tilesFor(center, zoom, size.width, size.height) : [];
  const satellite = satelliteFor(place.longitude);
  const cloudTiles = ready && satellite ? tilesFor(center, zoom, size.width, size.height, 6) : [];

  // Wind arrows: fetch the grid points we haven't seen yet, a moment after
  // the map stops moving.
  const grid = ready && on.has("wind") ? windGrid(center, zoom, size.width, size.height) : [];
  const missing = grid.filter(point => !(point.key in wind.points));
  const missingKey = missing.map(point => point.key).join("|");
  useEffect(() => {
    if (!missingKey) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setWind(w => ({ ...w, status: "loading" }));
      fetchWindGrid(missing, { signal: controller.signal })
        .then(results => {
          const found = Object.fromEntries(results.map((result, i) => [missing[i].key, result]));
          setWind(w => ({ status: "ready", points: { ...w.points, ...found } }));
        })
        .catch(error => {
          if (error.name !== "AbortError") setWind(w => ({ ...w, status: "error" }));
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

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

  const toggle = id => onLayers(on.has(id) ? layers.filter(layer => layer !== id) : [...layers, id]);
  const current = radar.frames[frame];
  const latest = radar.frames.length - 1;
  const shown = MAP_LAYERS.filter(layer => on.has(layer.id)).map(layer => layer.name.toLowerCase());

  return (
    <div className="cc-radar">
      <div className="cc-layer-chips cc-map-chips" role="group" aria-label="Show on the map">
        {MAP_LAYERS.map(layer => {
          const Icon = layer.icon;
          return (
            <button key={layer.id} type="button" aria-pressed={on.has(layer.id)} onClick={() => toggle(layer.id)}>
              <Icon size={14} aria-hidden="true" />
              {layer.name}
            </button>
          );
        })}
      </div>

      <div
        ref={box}
        className="cc-radar-map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        role="img"
        aria-label={`Weather map around ${place.name}${shown.length ? `, showing ${shown.join(", ")}` : ""}`}
      >
        <Tiles tiles={tiles} className="cc-radar-base" src={t => `${BASE_URL}/${t.z}/${t.x}/${t.y}.png`} />

        {on.has("clouds") && (
          <Tiles
            tiles={cloudTiles}
            className="cc-radar-clouds"
            src={t => `${GIBS_WMTS}/${satellite}/default/default/GoogleMapsCompatible_Level6/${t.z}/${t.y}/${t.x}.png`}
          />
        )}

        {on.has("rain") &&
          radar.frames.map((f, i) =>
            tiles.map(tile => (
              <img
                key={`${f.path}-${tile.key}`}
                className={`cc-radar-tile cc-radar-rain ${i === frame ? "is-on" : ""}`}
                src={`${radar.host}${f.path}/256/${tile.z}/${tile.x}/${tile.y}/2/1_1.png`}
                style={{ left: tile.left, top: tile.top }}
                alt=""
                draggable="false"
                loading={Math.abs(i - frame) <= 1 || i === latest ? "eager" : "lazy"}
              />
            ))
          )}

        {on.has("fires") && (
          <>
            <Tiles tiles={tiles.map(t => ({ ...t, key: `y-${t.key}` }))} className="cc-radar-fires" src={t => fireUrl(t, utcDay(1))} />
            <Tiles tiles={tiles.map(t => ({ ...t, key: `t-${t.key}` }))} className="cc-radar-fires" src={t => fireUrl(t, utcDay(0))} />
          </>
        )}

        {on.has("wind") && (
          <svg className="cc-radar-wind" width={size.width} height={size.height} aria-hidden="true">
            {grid.map(point => {
              const w = wind.points[point.key];
              if (!w || !Number.isFinite(w.speed) || !Number.isFinite(w.direction)) return null;
              const length = 10 + Math.min(16, w.speed * 1.4);
              const color = windColor(w.speed);
              // Wind is reported by where it comes from; the arrow points where it's going.
              return (
                <g key={point.key} transform={`translate(${point.left} ${point.top}) rotate(${w.direction + 180})`}>
                  <line x1="0" y1={length / 2} x2="0" y2={-length / 2} stroke={color} strokeWidth="2.4" strokeLinecap="round" />
                  <path d={`M-5 ${-length / 2 + 6} L0 ${-length / 2} L5 ${-length / 2 + 6}`} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <text transform={`rotate(${-(w.direction + 180)})`} y="22" textAnchor="middle">
                    {windNumber(w.speed, units)}
                  </text>
                </g>
              );
            })}
          </svg>
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

        {on.has("rain") && radar.status === "loading" && (
          <p className="cc-radar-status">
            <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading radar…
          </p>
        )}
        {on.has("rain") && radar.status === "error" && <p className="cc-radar-status">Rain radar isn’t available right now.</p>}
        {on.has("wind") && wind.status === "error" && <p className="cc-radar-status">Wind isn’t available right now.</p>}
        {on.has("clouds") && !satellite && (
          <p className="cc-radar-status">No live cloud satellite covers this part of the world yet.</p>
        )}
      </div>

      {on.has("rain") && radar.status === "ready" && (
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

      <ul className="cc-radar-key">
        {on.has("clouds") && <li>Clouds: latest infrared image. Bright and colored areas are high, cold cloud tops.</li>}
        {on.has("wind") && <li>Wind: arrows point where the wind is blowing, in {units === "metric" ? "km/h" : "mph"} right now.</li>}
        {on.has("fires") && <li>Fires: red dots are heat spots seen by satellite in the last two days.</li>}
      </ul>

      <p className="cc-radar-credit">
        {on.has("rain") && (
          <>
            Radar <a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a> ·{" "}
          </>
        )}
        {(on.has("clouds") || on.has("fires")) && (
          <>
            Satellite <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">NASA GIBS</a> ·{" "}
          </>
        )}
        {on.has("wind") && <>Wind Open-Meteo · </>}
        Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Drag to
        look around, double-tap to recenter
      </p>
    </div>
  );
}
