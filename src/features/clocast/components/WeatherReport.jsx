import { Droplet, Droplets, Gauge, Leaf, Sun, Sunrise, Sunset, Thermometer, Wind } from "lucide-react";

import { aqiCategory, describeWeather } from "../../../services/weather/openMeteo";
import { formatHour, formatTemp, formatWind } from "../units";
import { dayName } from "../when";
import WeatherIcon from "./WeatherIcon";

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

/**
 * A traditional forecast: conditions for the chosen day, hour by hour, and
 * the week ahead. The hours you're planning for are highlighted.
 */
function formatPressure(hpa, units) {
  return units === "metric" ? `${Math.round(hpa)} hPa` : `${(hpa * 0.02953).toFixed(2)} inHg`;
}

const WEEK_DAYS = 10;

export default function WeatherReport({ forecast, units, place, dayIndex, highlight, next24, airNow, onPickDay }) {
  const { current, hours } = forecast;
  const days = forecast.days.slice(0, Math.max(WEEK_DAYS, dayIndex + 1));
  const day = days[dayIndex] ?? days[0];
  const isToday = dayIndex === 0 && current;
  const highlighted = new Set(highlight.map(hour => hour.time.getTime()));

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
              <span>{units === "metric" ? "°C" : "°F"}</span>
            </p>
            <p className="cc-report-desc">{describeWeather(isToday ? current.code : day.code)}</p>
          </div>
        </div>
        <div className="cc-report-hilo">
          <span>
            H <strong>{formatTemp(day.high, units, { unit: false })}</strong>
          </span>
          <span>
            L <strong>{formatTemp(day.low, units, { unit: false })}</strong>
          </span>
          {isToday && <span className="cc-muted">Feels like {formatTemp(current.apparent, units)}</span>}
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
            <dd>{current.rh}%</dd>
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
      <div className="cc-hourly" role="list">
        {strip.map((hour, index) => (
          <div
            key={hour.time.getTime()}
            role="listitem"
            className={`cc-hourly-cell ${highlighted.has(hour.time.getTime()) ? "is-picked" : ""}`}
            title={describeWeather(hour.code)}
          >
            <span className="cc-hourly-time">{isToday && index === 0 ? "Now" : formatHour(hour.localHour)}</span>
            <WeatherIcon code={hour.code} isDay={hour.isDay} size={22} />
            <strong>{formatTemp(hour.temp, units, { unit: false })}</strong>
            <span className={`cc-hourly-rain ${hour.precipProb >= 30 ? "is-likely" : ""}`}>
              <Droplet size={11} aria-hidden="true" />
              {hour.precipProb}%
            </span>
          </div>
        ))}
      </div>

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
