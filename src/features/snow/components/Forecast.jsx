import { CloudSnow, Gauge, Mountain, Thermometer, Users, Wind } from "lucide-react";

import WeatherIcon from "../../clocast/components/WeatherIcon";
import { describeWeather } from "../../../services/weather/openMeteo";
import { compass, crowdOutlook, fmtElev, fmtHour, fmtSnow, fmtTemp, fmtWind, M_PER_FT, scoreDay, windHold } from "../model/snow";
import { Card } from "./ui";

const dayName = (day, today) => (day === today ? "Today" : new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }));
const dateText = day => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The headline: snow that fell, snow coming, and how the top and base feel now. */
export function NowPanel({ spot, totals, nowTop, nowBase, units }) {
  return (
    <div className="sf-now">
      <div className="sf-now-snow">
        <div>
          <small>Last 24h</small>
          <b>{fmtSnow(totals.past24, units)}</b>
        </div>
        <div>
          <small>Last 72h</small>
          <b>{fmtSnow(totals.past72, units)}</b>
        </div>
        <div className="is-future">
          <small>Next 24h</small>
          <b>{fmtSnow(totals.next24, units)}</b>
        </div>
        <div className="is-future">
          <small>Next 72h</small>
          <b>{fmtSnow(totals.next72, units)}</b>
        </div>
        <div className="is-future">
          <small>Next 7 days</small>
          <b>{fmtSnow(totals.next7, units)}</b>
        </div>
      </div>
      <div className="sf-now-levels">
        {[
          { name: spot.highName, elev: spot.summit, h: nowTop },
          { name: spot.lowName, elev: spot.base, h: nowBase },
        ].map(l =>
          l.h ? (
            <div key={l.name} className="sf-level">
              <span className="sf-level-name">
                <Mountain size={14} aria-hidden="true" /> {l.name} <small>{fmtElev(l.elev, units)}</small>
              </span>
              <span className="sf-level-temp">
                <WeatherIcon code={l.h.code} size={26} isDay={l.h.localHour >= 7 && l.h.localHour < 18} />
                {fmtTemp(l.h.temp, units)}
              </span>
              <span className="sf-level-meta">
                {describeWeather(l.h.code)} · feels {fmtTemp(l.h.feels, units)} · {compass(l.h.dir)} {fmtWind(l.h.wind, units)}, gusts {fmtWind(l.h.gust, units)}
              </span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/** Ten days, each with snow, a score and the reason. */
export function DayPicker({ days, scores, picked, onPick, today, units }) {
  return (
    <div className="sf-days" role="tablist" aria-label="Pick a day">
      {days.map((d, i) => {
        const sc = scores[i];
        return (
          <button key={d.day} type="button" role="tab" aria-selected={d.day === picked} className={`sf-day sf-day--${(sc?.label ?? "").toLowerCase().replace(/\s/g, "-")}`} onClick={() => onPick(d.day)}>
            <span className="sf-day-name">
              {dayName(d.day, today)}
              <small>{dateText(d.day)}</small>
            </span>
            <WeatherIcon code={d.code} size={22} />
            <span className="sf-day-snow">{fmtSnow(d.snow, units)}</span>
            <span className="sf-day-temp">
              {fmtTemp(d.high, units)} <small>{fmtTemp(d.low, units)}</small>
            </span>
            {sc && <span className="sf-day-score">{sc.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Everything about one day: the score's reasons, wind holds, crowds, snow line and the hours. */
export function DayDetail({ spot, top, base, topHours, baseHours, units, kind }) {
  if (!top) return null;
  const sc = scoreDay(top, base);
  const hold = windHold(top.gust);
  const crowd = crowdOutlook(top.day, sc?.freshCm ?? 0);
  const freezeFt = Number.isFinite(top.freeze) ? top.freeze / M_PER_FT : null;
  const snowLine = freezeFt === null ? null : Math.max(0, freezeFt - 1000);
  const hours = topHours.filter(h => h.localDay === top.day && h.localHour >= 6 && h.localHour <= 18);
  const baseByHour = new Map(baseHours.filter(h => h.localDay === top.day).map(h => [h.localHour, h]));

  return (
    <Card
      title={`${new Date(`${top.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      icon={CloudSnow}
      aside={sc && <span className={`sf-score sf-score--${sc.label.toLowerCase().replace(/\s/g, "-")}`}>{sc.label} · {sc.score}</span>}
    >
      {sc?.reasons.length > 0 && (
        <ul className="sf-reasons">
          {sc.reasons.map(r => (
            <li key={r.text} className={r.good ? "is-good" : "is-bad"}>
              {r.text}
            </li>
          ))}
        </ul>
      )}
      <dl className="sf-facts">
        <div>
          <dt>
            <CloudSnow size={14} aria-hidden="true" /> Snow
          </dt>
          <dd>
            {fmtSnow(top.overnight, units)} overnight, {fmtSnow(top.openSnow, units)} while lifts run
          </dd>
        </div>
        {kind !== "backcountry" && (
          <div>
            <dt>
              <Wind size={14} aria-hidden="true" /> Lift holds
            </dt>
            <dd className={`sf-hold sf-hold--${hold.level}`}>
              {hold.label}
              {Number.isFinite(top.gust) ? ` (gusts ${fmtWind(top.gust, units)})` : ""}
            </dd>
          </div>
        )}
        {kind === "backcountry" && (
          <div>
            <dt>
              <Wind size={14} aria-hidden="true" /> Wind loading
            </dt>
            <dd>{Number.isFinite(top.wind) && top.wind * 2.237 >= 15 ? `Likely on lee slopes (${fmtWind(top.wind, units)} average, gusts ${fmtWind(top.gust, units)})` : `Light (${fmtWind(top.wind, units)})`}</dd>
          </div>
        )}
        <div>
          <dt>
            <Thermometer size={14} aria-hidden="true" /> Up top
          </dt>
          <dd>
            {fmtTemp(top.temp, units)} midday, feels as cold as {fmtTemp(top.feels, units)}
          </dd>
        </div>
        {snowLine !== null && (
          <div>
            <dt>
              <Gauge size={14} aria-hidden="true" /> Freezing level
            </dt>
            <dd>
              {fmtElev(Math.round(freezeFt / 100) * 100, units)}
              {snowLine < spot.base ? " (snow to the base)" : snowLine < spot.summit ? ` (rain below about ${fmtElev(Math.round(snowLine / 100) * 100, units)})` : " (rain up top)"}
            </dd>
          </div>
        )}
        {kind !== "backcountry" && (
          <div>
            <dt>
              <Users size={14} aria-hidden="true" /> Crowds (estimate)
            </dt>
            <dd>
              {crowd.label} <small>({crowd.why})</small>
            </dd>
          </div>
        )}
      </dl>
      {hours.length > 0 && (
        <div className="sf-hours" aria-label="Hour by hour, top of the mountain">
          <table>
            <thead>
              <tr>
                <th scope="row">Hour</th>
                {hours.map(h => (
                  <th key={h.localHour} scope="col">
                    {fmtHour(h.localHour)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Sky</th>
                {hours.map(h => (
                  <td key={h.localHour}>
                    <WeatherIcon code={h.code} size={18} isDay={h.localHour >= 7 && h.localHour < 18} />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{spot.highName.split(" ")[0]}</th>
                {hours.map(h => (
                  <td key={h.localHour}>{fmtTemp(h.temp, units)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">{spot.lowName}</th>
                {hours.map(h => (
                  <td key={h.localHour}>{fmtTemp(baseByHour.get(h.localHour)?.temp, units)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Snow</th>
                {hours.map(h => (
                  <td key={h.localHour} className={h.snow >= 1 ? "is-snow" : ""}>
                    {h.snow > 0.05 ? fmtSnow(h.snow, units) : ""}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Gusts</th>
                {hours.map(h => (
                  <td key={h.localHour} className={h.gust * 2.237 >= 38 ? "is-windy" : ""}>
                    {Math.round(units === "metric" ? h.gust * 3.6 : h.gust * 2.237)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <small className="sf-muted">Gusts in {units === "metric" ? "km/h" : "mph"}.</small>
        </div>
      )}
    </Card>
  );
}
