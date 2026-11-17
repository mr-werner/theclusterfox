// Winds aloft for one place: a profile of wind and temperature by altitude
// for the hour you pick, the FB-style codes for the next day, and the
// numbers a pilot checks before going up. Shared by SkyFox and any flying
// app. Colors come from --wa-* variables so it can sit in any theme.

import { useMemo, useState } from "react";
import { ArrowUp, CloudOff, LoaderCircle, RotateCcw } from "lucide-react";

import {
  bestAltitude,
  compass,
  densityAltitudeFt,
  fdCode,
  formatAltitude,
  formatWindKt,
  windAt,
  windComponents,
  zulu,
} from "../../services/weather/windsAloft";
import { useWindsAloft } from "./useWindsAloft";
import "./windsAloft.css";

// Altitudes in the profile: the FB levels plus a few in between for
// light airplanes, which mostly live below 12,000 ft.
const PROFILE_FT = [39000, 34000, 30000, 24000, 18000, 15000, 12000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000];
const LOW_FT = [12000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000];
const GRID_FT = [3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000];

const speedTone = kt => (kt >= 50 ? "jet" : kt >= 30 ? "strong" : kt >= 15 ? "fresh" : "light");
const localTime = hour => `${hour.localHour % 12 || 12} ${hour.localHour < 12 ? "AM" : "PM"}`;
const dayLabel = (hour, first) => (hour.localDay === first.localDay ? "" : "Tomorrow ");
const ft = n => `${Math.round(n / 100) * 100 >= 1000 ? (Math.round(n / 100) * 100).toLocaleString("en-US") : Math.round(n / 100) * 100} ft`;

function WindArrow({ dir, speedKt }) {
  if (speedKt < 3) return <span className="wa-calm" aria-hidden="true">•</span>;
  // The arrow points where the air is going: downwind.
  return <ArrowUp className="wa-arrow" size={16} style={{ transform: `rotate(${dir + 180}deg)` }} aria-hidden="true" />;
}

function Summary({ hour, elevationFt }) {
  const s = hour.surface;
  const density = s.pressureHpa != null && s.tempC != null ? densityAltitudeFt(s.pressureHpa, s.tempC) : null;
  const tiles = [
    { label: "Surface wind", value: formatWindKt(s.dir, s.speedKt), note: s.gustKt != null && s.gustKt - (s.speedKt ?? 0) >= 5 ? `gusts ${Math.round(s.gustKt)} kt` : null },
    hour.cloudBaseFt != null && { label: "Cloud base (est.)", value: `${ft(hour.cloudBaseFt)} AGL`, note: `spread ${Math.round(s.tempC - s.dewPointC)}°C` },
    hour.freezingLevelFt != null && {
      label: "Freezing level",
      value: hour.freezingLevelFt <= elevationFt + 100 ? "At the surface" : `${ft(hour.freezingLevelFt)} MSL`,
    },
    density != null && {
      label: "Density altitude",
      value: ft(density),
      note: density - elevationFt >= 2000 ? `${ft(density - elevationFt)} above the field` : null,
      tone: density - elevationFt >= 3000 ? "warn" : null,
    },
    s.qnhHpa != null && { label: "Altimeter", value: `${(s.qnhHpa * 0.02953).toFixed(2)} inHg`, note: `${Math.round(s.qnhHpa)} hPa` },
    { label: "Field elevation", value: ft(elevationFt) },
  ].filter(Boolean);
  return (
    <dl className="wa-stats">
      {tiles.map(t => (
        <div key={t.label} className={`wa-stat${t.tone ? ` is-${t.tone}` : ""}`}>
          <dt>{t.label}</dt>
          <dd>{t.value}</dd>
          {t.note && <dd className="wa-stat-note">{t.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Profile({ hour, elevationFt, course, highFlying }) {
  const altitudes = (highFlying ? PROFILE_FT : LOW_FT).filter(a => a >= elevationFt + 1000);
  const rows = altitudes.map(altitudeFt => ({ altitudeFt, wind: windAt(hour, altitudeFt, { elevationFt }) })).filter(r => r.wind);
  const best = course != null ? bestAltitude(hour, course, { elevationFt, altitudes }) : null;
  const max = Math.max(30, ...rows.map(r => r.wind.speedKt));
  const freezing = hour.freezingLevelFt;
  return (
    <ol className="wa-profile" aria-label="Wind by altitude">
      {rows.map((row, i) => {
        const { wind } = row;
        const next = rows[i + 1];
        const freezesHere = freezing != null && freezing > elevationFt + 100 && freezing <= row.altitudeFt && (!next || freezing > next.altitudeFt);
        const parts = course != null ? windComponents(wind.dir, wind.speedKt, course) : null;
        const isBest = best && best.altitudeFt === row.altitudeFt;
        return (
          <li key={row.altitudeFt} className={`wa-row is-${speedTone(wind.speedKt)}${isBest ? " is-best" : ""}${freezesHere ? " has-freeze" : ""}`}>
            <span className="wa-alt">{formatAltitude(row.altitudeFt)}</span>
            <WindArrow dir={wind.dir} speedKt={wind.speedKt} />
            <span className="wa-wind">
              <strong>{wind.speedKt < 3 ? "Calm" : `${Math.round(wind.speedKt)} kt`}</strong>
              {wind.speedKt >= 3 && <span className="wa-dir">from {String(Math.round(wind.dir) || 360).padStart(3, "0")}° {compass(wind.dir)}</span>}
            </span>
            <span className="wa-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (wind.speedKt / max) * 100)}%` }} />
            </span>
            <span className={`wa-temp${wind.tempC != null && wind.tempC <= 0 && wind.tempC >= -15 ? " is-icing" : ""}`}>
              {wind.tempC == null ? "–" : `${Math.round(wind.tempC)}°C`}
            </span>
            {parts && (
              <span className={`wa-comp ${parts.headwind > 0 ? "is-head" : "is-tail"}`}>
                {Math.abs(parts.headwind) < 1 ? "No head/tail" : `${Math.round(Math.abs(parts.headwind))} kt ${parts.headwind > 0 ? "head" : "tail"}`}
                {isBest && <em>Best</em>}
              </span>
            )}
            <code className="wa-code">{fdCode(wind, row.altitudeFt)}</code>
            {freezesHere && (
              <span className="wa-freeze">
                Freezing level {ft(freezing)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Grid({ data }) {
  const first = data.hours[0];
  const columns = data.hours.filter((h, i) => i % 3 === 0).slice(0, 9);
  const altitudes = GRID_FT.filter(a => a >= data.elevationFt + 1500);
  return (
    <>
    <div className="wa-grid-wrap">
      <table className="wa-grid">
        <thead>
          <tr>
            <th scope="col">Altitude</th>
            {columns.map(h => (
              <th key={h.time.getTime()} scope="col">
                {dayLabel(h, first)}
                {localTime(h)}
                <span>{zulu(h.time)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {altitudes.map(altitudeFt => (
            <tr key={altitudeFt}>
              <th scope="row">{formatAltitude(altitudeFt)}</th>
              {columns.map(h => {
                const wind = windAt(h, altitudeFt, { elevationFt: data.elevationFt });
                const showTemp = altitudeFt > 3000 && altitudeFt >= data.elevationFt + 2500;
                return (
                  <td key={h.time.getTime()} className={wind ? `is-${speedTone(wind.speedKt)}` : ""}>
                    {wind ? fdCode({ ...wind, tempC: showTemp ? wind.tempC : null }, altitudeFt) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      <p className="wa-note">
        Read <code>2715+05</code> as wind from 270° at 15 kt, +5°C. <code>9900</code> is light and variable. Above FL240 the minus sign is left off.
      </p>
    </>
  );
}

/**
 * place: { name, latitude, longitude }. course: optional true course in
 * degrees to show head and tailwinds against (also editable in the panel).
 */
export default function WindsAloft({ place, course: initialCourse = null, title = "Winds aloft" }) {
  const { status, data, error, at, reload } = useWindsAloft(place);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState("profile");
  const [course, setCourse] = useState(initialCourse == null ? "" : String(initialCourse));
  const [highFlying, setHighFlying] = useState(false);

  // Start at the hour we're in.
  const hours = useMemo(() => {
    if (!data) return [];
    const ahead = data.hours.filter(h => h.time.getTime() >= at - 3600_000);
    return ahead.length ? ahead : data.hours;
  }, [data, at]);
  const hour = hours[Math.min(index, hours.length - 1)];
  const courseDeg = course === "" ? null : ((Number(course) % 360) + 360) % 360;

  if (!place) return null;
  if (status === "loading" || status === "idle") {
    return (
      <section className="wa wa-empty">
        <LoaderCircle size={26} className="spin" aria-hidden="true" />
        <p>Getting winds aloft for {place.name}…</p>
      </section>
    );
  }
  if (status === "error" || !hour) {
    return (
      <section className="wa wa-empty">
        <CloudOff size={26} aria-hidden="true" />
        <p>{error || "No winds aloft for this place right now."}</p>
        <button type="button" className="wa-btn" onClick={reload}>
          <RotateCcw size={14} aria-hidden="true" /> Try again
        </button>
      </section>
    );
  }

  return (
    <section className="wa" aria-label={title}>
      <header className="wa-head">
        <div>
          <p className="wa-eyebrow">AVIATION</p>
          <h2>{title}</h2>
          <p className="wa-sub">
            {place.name} · field about {ft(data.elevationFt)}
          </p>
        </div>
        <div className="wa-segment" role="group" aria-label="View">
          {[
            ["profile", "By altitude"],
            ["grid", "Next 24 hours"],
          ].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {view === "profile" ? (
        <>
          <label className="wa-time">
            <span>
              Valid <strong>{dayLabel(hour, hours[0])}{localTime(hour)}</strong> local · {zulu(hour.time)}
            </span>
            <input type="range" min={0} max={hours.length - 1} value={Math.min(index, hours.length - 1)} onChange={e => setIndex(Number(e.target.value))} aria-label="Forecast hour" />
          </label>

          <Summary hour={hour} elevationFt={data.elevationFt} />

          <div className="wa-tools">
            <label className="wa-course">
              <span>Course</span>
              <input type="number" inputMode="numeric" min={0} max={360} step={5} placeholder="e.g. 090" value={course} onChange={e => setCourse(e.target.value.slice(0, 3))} />
              <span className="wa-muted">° true</span>
            </label>
            <label className="wa-check">
              <input type="checkbox" checked={highFlying} onChange={e => setHighFlying(e.target.checked)} />
              Show the flight levels (up to FL390)
            </label>
          </div>

          <Profile hour={hour} elevationFt={data.elevationFt} course={courseDeg} highFlying={highFlying} />
          {courseDeg == null && <p className="wa-note">Enter a course to see the head or tailwind at each altitude and the best one to fly.</p>}
        </>
      ) : (
        <Grid data={{ ...data, hours }} />
      )}

      <p className="wa-note wa-credit">
        Model forecast from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, interpolated from pressure levels. Cloud base is estimated from the temperature and dew point spread. For planning only: get an official briefing (1800wxbrief.com or aviationweather.gov) before you fly.
      </p>
    </section>
  );
}
