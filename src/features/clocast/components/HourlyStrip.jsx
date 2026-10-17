import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";

import { describeWeather } from "../../../services/weather/openMeteo";
import { formatHour, formatTemp, formatWind } from "../units";

function WeatherIcon({ code, isDay, size = 20 }) {
  const props = { size, "aria-hidden": true };
  if (code >= 95) return <CloudLightning {...props} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnow {...props} />;
  if (code >= 51) return <CloudRain {...props} />;
  if (code >= 45) return <CloudFog {...props} />;
  if (code === 3) return <Cloud {...props} />;
  if (code >= 1) return isDay ? <CloudSun {...props} /> : <Cloud {...props} />;
  return isDay ? <Sun {...props} /> : <Moon {...props} />;
}

export default function HourlyStrip({ plan, units }) {
  const { rows, summary, wardrobe } = plan;
  const maxNeed = Math.max(1, ...rows.map(row => row.need.clo));

  return (
    <section className="cc-panel" aria-labelledby="cc-hours-title">
      <div className="cc-panel-head">
        <div>
          <p className="cc-eyebrow">THE WEATHER</p>
          <h2 id="cc-hours-title">
            {formatTemp(summary.low, units, { unit: false })}
            {Math.round(summary.low) !== Math.round(summary.high) && `–${formatTemp(summary.high, units, { unit: false })}`}
            {units === "metric" ? "C" : "F"}
          </h2>
        </div>
        <ul className="cc-facts">
          <li>Feels like {formatTemp(summary.feelsLow, units)}{Math.round(summary.feelsLow) !== Math.round(summary.feelsHigh) && ` to ${formatTemp(summary.feelsHigh, units)}`}</li>
          <li>Wind up to {formatWind(summary.wind, units)}{summary.gust > summary.wind + 3 && `, gusts ${formatWind(summary.gust, units)}`}</li>
          <li>{summary.rainChance}% chance of rain</li>
          {summary.uv >= 1 && <li>UV {Math.round(summary.uv)}</li>}
        </ul>
      </div>

      <div className="cc-hours" role="list">
        {rows.map(row => (
          <div key={row.time.getTime()} className="cc-hour" role="listitem">
            <span className="cc-hour-time">{formatHour(row.localHour)}</span>
            <WeatherIcon code={row.code} isDay={row.isDay} />
            <span className="cc-hour-temp" title={describeWeather(row.code)}>
              {formatTemp(row.temp, units, { unit: false })}
            </span>
            <span className="cc-hour-bar" title={`${row.need.clo.toFixed(2)} clo needed`}>
              <span style={{ height: `${Math.max(4, (row.need.clo / maxNeed) * 100)}%` }} />
            </span>
            <span className="cc-hour-outfit">{row.outfit.level + 1}</span>
            {row.precipProb >= 20 && <span className="cc-hour-rain">{row.precipProb}%</span>}
          </div>
        ))}
      </div>
      <p className="cc-note">
        Bars show how much insulation you need each hour; the number under each is the{" "}
        {wardrobe === "active" ? "active-wear" : "everyday"} outfit level that covers it.
      </p>
    </section>
  );
}
