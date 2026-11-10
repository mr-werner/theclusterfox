import { useState } from "react";
import { ChevronDown, Droplet, Droplets, Gauge, Leaf, Radar, Sun, Sunrise, Sunset, Thermometer, Wind } from "lucide-react";

import { aqiCategory, describeWeather } from "../../../services/weather/openMeteo";
import { formatTemp, formatWind } from "../units";
import { dayName } from "../when";
import WeatherIcon from "./WeatherIcon";
import HourlyGraph from "./HourlyGraph";
import AttireBadge from "./AttireBadge";
import RadarMap from "./RadarMap";
import { feelsLike } from "../model/feels";

function clockTime(time) {
  if (!time) return "–";
  const h = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${h}:${String(time.minute).padStart(2, "0")} ${time.hour < 12 ? "AM" : "PM"}`;
}

function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function formatPressure(hpa, units) {
  return units === "metric" ? `${Math.round(hpa)} hPa` : `${(hpa * 0.02953).toFixed(2)} inHg`;
}

const WEEK_DAYS = 10;

// Feels like in the sun and in the shade: right now, or at the warmest hour
// of another day.
function FeelsLine({ forecast, place, units, isToday, next24, day }) {
  const { current, hours } = forecast;
  let feels;
  if (isToday) {
    const hour = next24[0] ?? {};
    feels = feelsLike({ ...hour, temp: current.temp, rh: current.rh ?? hour.rh, wind: current.wind }, place);
  } else {
    const dayHours = hours.filter(h => h.localDay === day.day);
    if (!dayHours.length) return null;
    feels = feelsLike(dayHours.reduce((a, b) => (b.temp > a.temp ? b : a)), place);
  }
  const sun = formatTemp(feels.sun, units);
  const shade = formatTemp(feels.shade, units);
  const prefix = isToday ? "Feels like" : "Feels up to";
  if (sun === shade) return <span className="cc-feels">{prefix} {shade}</span>;
  return (
    <span className="cc-feels">
      {prefix} {sun} in the sun
      <strong>{shade} in the shade</strong>
    </span>
  );
}

/**
 * The forecast in one pane: now (with what to wear), hour by hour, radar,
 * and the days ahead.
 */
export default function WeatherReport({
  forecast,
  units,
  place,
  dayIndex,
  next24,
  airNow,
  onPickDay,
  plan,
  attire,
  attireWhen,
  onAttire,
  layers,
  onLayers,
  onUnits,
}) {
  const { current, hours } = forecast;
  const [radarOpen, setRadarOpen] = useState(false);
  const days = forecast.days.slice(0, Math.max(WEEK_DAYS, dayIndex + 1));
  const day = days[dayIndex] ?? days[0];
  const isToday = dayIndex === 0 && current;

  // Today shows the next 24 hours; other days show their own daytime hours.
  const strip = isToday
    ? next24
    : hours.filter(hour => hour.localDay === day.day && hour.localHour >= 5);

  // Air quality now, or the worst hour of another day while it's forecast.
  const dayAqi = hours.filter(h => h.localDay === day.day && Number.isFinite(h.aqi)).map(h => h.aqi);
  const aqi = isToday && airNow ? airNow.aqi : dayAqi.length ? Math.max(...dayAqi) : null;
  const air = aqiCategory(aqi);

  const weekLow = Math.min(...days.map(d => d.low));
  const weekHigh = Math.max(...days.map(d => d.high));
  const span = Math.max(1, weekHigh - weekLow);

  return (
    <section className="cc-panel cc-report" aria-labelledby="cc-report-title">
      <div className="cc-report-top">
        <div className="cc-report-now">
          <WeatherIcon code={isToday ? current.code : day.code} isDay={isToday ? current.isDay : true} size={64} className="cc-report-icon" />
          <div>
            <p className="cc-eyebrow" id="cc-report-title">
              {place.name.toUpperCase()} · {isToday ? "NOW" : dayName(day.day, dayIndex).toUpperCase()}
            </p>
            <p className="cc-report-temp">
              {formatTemp(isToday ? current.temp : day.high, units, { unit: false })}
              <span className="cc-temp-units" role="group" aria-label="Units">
                {[["us", "°F"], ["metric", "°C"]].map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={units === value} onClick={() => onUnits(value)}>
                    {label}
                  </button>
                ))}
              </span>
            </p>
            <p className="cc-report-desc">{describeWeather(isToday ? current.code : day.code)}</p>
          </div>
        </div>
        {plan && <AttireBadge plan={plan} mode={attire} when={attireWhen} onSwitch={onAttire} />}
        <div className="cc-report-hilo">
          <span>
            H <strong>{formatTemp(day.high, units, { unit: false })}</strong>
          </span>
          <span>
            L <strong>{formatTemp(day.low, units, { unit: false })}</strong>
          </span>
          <FeelsLine forecast={forecast} place={place} units={units} isToday={Boolean(isToday)} next24={next24} day={day} />
        </div>
      </div>

      <dl className="cc-stats">
        <div>
          <dt><Droplets size={15} aria-hidden="true" /> Precip</dt>
          <dd>{day.precipProb}%</dd>
        </div>
        <div>
          <dt><Wind size={15} aria-hidden="true" /> Wind</dt>
          <dd>{formatWind(isToday ? current.wind : day.wind, units)}</dd>
        </div>
        {isToday && current.rh != null && (
          <div>
            <dt><Droplet size={15} aria-hidden="true" /> Humidity</dt>
            <dd>{Math.round(current.rh)}%</dd>
          </div>
        )}
        <div>
          <dt><Sun size={15} aria-hidden="true" /> UV index</dt>
          <dd>
            {Math.round(day.uv)} <small>{uvLabel(day.uv)}</small>
          </dd>
        </div>
        {air && (
          <div>
            <dt><Leaf size={15} aria-hidden="true" /> Air quality{isToday ? "" : " (worst)"}</dt>
            <dd>
              {Math.round(aqi)} <small className={`cc-aqi is-${air.tone}`}>{air.short ?? air.label}</small>
            </dd>
          </div>
        )}
        {isToday && Number.isFinite(current.dewPoint) && (
          <div>
            <dt><Thermometer size={15} aria-hidden="true" /> Dew point</dt>
            <dd>{formatTemp(current.dewPoint, units)}</dd>
          </div>
        )}
        {isToday && Number.isFinite(current.pressure) && (
          <div>
            <dt><Gauge size={15} aria-hidden="true" /> Pressure</dt>
            <dd>{formatPressure(current.pressure, units)}</dd>
          </div>
        )}
        <div>
          <dt><Sunrise size={15} aria-hidden="true" /> Sunrise</dt>
          <dd>{clockTime(day.sunrise)}</dd>
        </div>
        <div>
          <dt><Sunset size={15} aria-hidden="true" /> Sunset</dt>
          <dd>{clockTime(day.sunset)}</dd>
        </div>
      </dl>

      <h3 className="cc-subhead">Hourly</h3>
      <HourlyGraph
        key={`${day.day}-${strip.length}`}
        hours={strip}
        units={units}
        place={place}
        firstIsNow={Boolean(isToday)}
        layers={layers}
        onLayers={onLayers}
      />

      <button
        type="button"
        className="cc-radar-toggle"
        aria-expanded={radarOpen}
        onClick={() => setRadarOpen(open => !open)}
      >
        <Radar size={16} aria-hidden="true" />
        Radar
        <ChevronDown size={16} className={radarOpen ? "is-flipped" : ""} aria-hidden="true" />
      </button>
      {radarOpen && <RadarMap place={place} />}

      <h3 className="cc-subhead">{days.length}-day forecast</h3>
      <ul className="cc-week">
        {days.map((d, index) => (
          <li key={d.day}>
            <button
              type="button"
              className={index === dayIndex ? "is-picked" : ""}
              onClick={() => onPickDay(index)}
              aria-pressed={index === dayIndex}
            >
              <span className="cc-week-day">{dayName(d.day, index)}</span>
              <WeatherIcon code={d.code} size={22} />
              <span className={`cc-week-rain ${d.precipProb >= 30 ? "is-likely" : ""}`}>
                {d.precipProb >= 10 ? `${d.precipProb}%` : ""}
              </span>
              <span className="cc-week-low">{formatTemp(d.low, units, { unit: false })}</span>
              <span className="cc-week-bar" aria-hidden="true">
                <span
                  style={{
                    left: `${((d.low - weekLow) / span) * 100}%`,
                    right: `${((weekHigh - d.high) / span) * 100}%`,
                  }}
                />
              </span>
              <span className="cc-week-high">{formatTemp(d.high, units, { unit: false })}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
