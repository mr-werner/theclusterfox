import { useState } from "react";
import { Droplet, Droplets, Sun, Thermometer, Wind } from "lucide-react";

import { describeWeather } from "../../../services/weather/openMeteo";
import { formatHour, formatTemp, formatWind } from "../units";
import WeatherIcon from "./WeatherIcon";

const CELL = 62;
const BAND = 92; // height of the temperature band
const PAD = 20;

/**
 * Hour by hour as a scrollable graph: the temperature curve with each
 * hour's reading, rain chance as bars underneath, and a tap for details.
 */
export default function HourlyGraph({ hours, units, highlighted, firstIsNow }) {
  const [picked, setPicked] = useState(0);
  if (!hours.length) return null;
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
  const hour = hours[Math.min(picked, hours.length - 1)];
  const label = i => (firstIsNow && i === 0 ? "Now" : formatHour(hours[i].localHour));

  return (
    <div className="cc-graph">
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
                <circle cx={px} cy={py} r={i === picked ? 5 : 3} className={i === picked ? "is-picked" : ""} />
                <text x={px} y={py - 10} textAnchor="middle">
                  {formatTemp(hours[i].temp, units, { unit: false })}
                </text>
              </g>
            ))}
          </svg>
          <div className="cc-graph-cells" role="listbox" aria-label="Hourly forecast">
            {hours.map((h, i) => (
              <button
                key={h.time.getTime()}
                type="button"
                role="option"
                aria-selected={i === picked}
                className={`cc-graph-cell ${highlighted.has(h.time.getTime()) ? "is-window" : ""}`}
                onClick={() => setPicked(i)}
                aria-label={`${label(i)}: ${formatTemp(h.temp, units)}, ${describeWeather(h.code)}, ${h.precipProb}% chance of rain`}
              >
                <span className="cc-graph-time">{label(i)}</span>
                <WeatherIcon code={h.code} isDay={h.isDay} size={20} />
                <span className="cc-graph-gap" />
                <span className="cc-graph-rain" style={{ "--p": h.precipProb / 100 }}>
                  <span className="cc-graph-rain-bar" />
                  <span className={h.precipProb >= 30 ? "is-likely" : ""}>{h.precipProb}%</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <dl className="cc-graph-detail" aria-live="polite">
        <div className="cc-graph-detail-head">
          <dt>{label(Math.min(picked, hours.length - 1))}</dt>
          <dd>{describeWeather(hour.code)}</dd>
        </div>
        <div>
          <dt><Thermometer size={14} aria-hidden="true" /> Feels like</dt>
          <dd>{formatTemp(hour.apparent, units)}</dd>
        </div>
        <div>
          <dt><Wind size={14} aria-hidden="true" /> Wind</dt>
          <dd>{formatWind(hour.wind, units)}{hour.gust > hour.wind + 3 ? `, gusts ${formatWind(hour.gust, units)}` : ""}</dd>
        </div>
        <div>
          <dt><Droplets size={14} aria-hidden="true" /> Humidity</dt>
          <dd>{Math.round(hour.rh)}%</dd>
        </div>
        <div>
          <dt><Droplet size={14} aria-hidden="true" /> Rain</dt>
          <dd>{hour.precipProb}%{hour.precip > 0 ? ` · ${units === "metric" ? `${hour.precip.toFixed(1)} mm` : `${(hour.precip / 25.4).toFixed(2)} in`}` : ""}</dd>
        </div>
        <div>
          <dt><Sun size={14} aria-hidden="true" /> UV</dt>
          <dd>{Math.round(hour.uv)}</dd>
        </div>
      </dl>
    </div>
  );
}
