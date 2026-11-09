import { useMemo } from "react";
import { ArrowUp, Cloud, Droplet, Droplets, Leaf, Sun, Thermometer, TreePine, Wind } from "lucide-react";

import { aqiCategory, describeWeather } from "../../../services/weather/openMeteo";
import { feelsLike } from "../model/feels";
import { formatHour, formatTemp } from "../units";
import WeatherIcon from "./WeatherIcon";

const CELL = 62;
const BAND = 92; // height of the temperature band
const PAD = 20;

const windNumber = (ms, units) => Math.round(units === "metric" ? ms * 3.6 : ms * 2.23694);

// Extra rows that can be switched on under the graph. Rain is drawn as bars
// inside the graph itself; the rest are a line of values each.
const LAYERS = [
  { id: "rain", name: "Precip", icon: Droplets },
  { id: "feels", name: "Feels like", icon: Thermometer },
  { id: "shade", name: "In the shade", icon: TreePine },
  { id: "wind", name: "Wind", icon: Wind },
  { id: "humidity", name: "Humidity", icon: Droplet },
  { id: "dew", name: "Dew point", icon: Droplet },
  { id: "aqi", name: "Air quality", icon: Leaf },
  { id: "uv", name: "UV", icon: Sun },
  { id: "cloud", name: "Clouds", icon: Cloud },
];

function layerCaption(id, units) {
  if (id === "wind") return units === "metric" ? "Wind · km/h" : "Wind · mph";
  if (id === "humidity") return "Humidity · %";
  if (id === "cloud") return "Cloud cover · %";
  if (id === "aqi") return "Air quality · US AQI";
  if (id === "uv") return "UV index";
  return LAYERS.find(layer => layer.id === id).name;
}

function LayerValue({ id, hour, units }) {
  switch (id) {
    case "feels":
      return formatTemp(hour.feels.sun, units, { unit: false });
    case "shade":
      return formatTemp(hour.feels.shade, units, { unit: false });
    case "wind":
      return (
        <span className="cc-layer-wind">
          {Number.isFinite(hour.windDir) && (
            // Wind is reported by where it comes from; the arrow shows where it's going.
            <ArrowUp size={12} style={{ transform: `rotate(${hour.windDir + 180}deg)` }} aria-hidden="true" />
          )}
          {windNumber(hour.wind, units)}
          {hour.gust > hour.wind + 3 && <small>g{windNumber(hour.gust, units)}</small>}
        </span>
      );
    case "humidity":
      return Math.round(hour.rh);
    case "dew":
      return formatTemp(hour.dewPoint, units, { unit: false });
    case "aqi": {
      const air = aqiCategory(hour.aqi);
      return air ? <span className={`cc-aqi is-${air.tone}`}>{Math.round(hour.aqi)}</span> : "–";
    }
    case "uv":
      return Math.round(hour.uv);
    case "cloud":
      return Number.isFinite(hour.cloud) ? Math.round(hour.cloud) : "–";
    default:
      return null;
  }
}

/**
 * Hour by hour as a scrollable graph: the temperature curve with each
 * hour's reading, then whichever extra rows are switched on.
 */
export default function HourlyGraph({ hours: rawHours, units, place, firstIsNow, layers, onLayers }) {
  const hours = useMemo(() => rawHours.map(hour => ({ ...hour, feels: feelsLike(hour, place) })), [rawHours, place]);
  if (!hours.length) return null;
  const on = new Set(layers);
  const rows = LAYERS.filter(layer => layer.id !== "rain" && on.has(layer.id));

  const temps = hours.map(h => h.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(1, hi - lo);
  const y = t => PAD + (1 - (t - lo) / span) * (BAND - PAD * 2);
  const x = i => i * CELL + CELL / 2;
  const points = hours.map((h, i) => [x(i), y(h.temp)]);
  // A smooth path through the points (Catmull-Rom as cubic Béziers).
  const path = points
    .map(([px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [x0, y0] = points[Math.max(0, i - 2)];
      const [x1, y1] = points[i - 1];
      const [x3, y3] = points[Math.min(points.length - 1, i + 1)];
      const c1 = [x1 + (px - x0) / 6, y1 + (py - y0) / 6];
      const c2 = [px - (x3 - x1) / 6, py - (y3 - y1) / 6];
      return `C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${px},${py}`;
    })
    .join(" ");
  const width = hours.length * CELL;
  const label = i => (firstIsNow && i === 0 ? "Now" : formatHour(hours[i].localHour));
  const toggle = id => onLayers(on.has(id) ? layers.filter(layer => layer !== id) : [...layers, id]);

  return (
    <div className="cc-graph">
      <div className="cc-layer-chips" role="group" aria-label="Show in the hourly forecast">
        {LAYERS.map(layer => {
          const Icon = layer.icon;
          return (
            <button key={layer.id} type="button" aria-pressed={on.has(layer.id)} onClick={() => toggle(layer.id)}>
              <Icon size={14} aria-hidden="true" />
              {layer.name}
            </button>
          );
        })}
      </div>

      <div className="cc-graph-scroll">
        <div className="cc-graph-track" style={{ width }}>
          <svg className="cc-graph-svg" width={width} height={BAND} viewBox={`0 0 ${width} ${BAND}`} aria-hidden="true">
            <defs>
              <linearGradient id="cc-graph-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L${x(hours.length - 1)},${BAND} L${x(0)},${BAND} Z`} fill="url(#cc-graph-fill)" />
            <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            {points.map(([px, py], i) => (
              <g key={i}>
                <circle cx={px} cy={py} r={i === 0 && firstIsNow ? 5 : 3} className={i === 0 && firstIsNow ? "is-picked" : ""} />
                <text x={px} y={py - 10} textAnchor="middle">
                  {formatTemp(hours[i].temp, units, { unit: false })}
                </text>
              </g>
            ))}
          </svg>
          <ol className={`cc-graph-cells ${on.has("rain") ? "" : "no-rain"}`} aria-label="Hourly forecast">
            {hours.map((h, i) => (
              <li
                key={h.time.getTime()}
                className="cc-graph-cell"
                aria-label={`${label(i)}: ${formatTemp(h.temp, units)}, ${describeWeather(h.code)}, ${h.precipProb}% chance of rain`}
              >
                <span className="cc-graph-time">{label(i)}</span>
                <WeatherIcon code={h.code} isDay={h.isDay} size={20} />
                <span className="cc-graph-gap" />
                {on.has("rain") && (
                  <span className="cc-graph-rain" style={{ "--p": h.precipProb / 100 }}>
                    <span className="cc-graph-rain-bar" />
                    <span className={h.precipProb >= 30 ? "is-likely" : ""}>{h.precipProb}%</span>
                  </span>
                )}
              </li>
            ))}
          </ol>

          {rows.map(layer => (
            <div key={layer.id} className="cc-layer-row">
              <span className="cc-layer-name">{layerCaption(layer.id, units)}</span>
              <div className="cc-layer-values">
                {hours.map(h => (
                  <span key={h.time.getTime()}>
                    <LayerValue id={layer.id} hour={h} units={units} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
