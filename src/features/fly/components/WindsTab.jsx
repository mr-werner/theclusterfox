import { useEffect, useMemo, useState } from "react";
import { ArrowUp, LocateFixed, Snowflake } from "lucide-react";

import { fetchMetars, fetchStations, fetchTafs } from "../api";
import { FD_ALTITUDES_FT, fdRows, fetchWindsAloft, windAt } from "../../../services/weather/windsAloft";
import { pad3 } from "../model/nav";
import { AirportSearch, Cat, ErrorNote, Loading, MetarCard } from "./ui";
import { fmtAlt, fmtTime, zulu } from "./format";

// Winds aloft for any spot: the classic FB table for the hour you pick,
// an hour-by-hour grid, the freezing level, and the nearest airport's
// METAR and TAF.
const ALTS = [...FD_ALTITUDES_FT.slice(0, 4), 15000, ...FD_ALTITUDES_FT.slice(4)].sort((a, b) => a - b);
// The shared module's wind shape ({ speedKt }) in the short form this screen uses.
const windHere = (hour, alt, elevationFt) => {
  const w = windAt(hour, alt, { elevationFt });
  return w ? { dir: w.dir, kt: w.speedKt, tempC: w.tempC } : null;
};
const speedClass = kt => (kt < 10 ? "fy-s0" : kt < 20 ? "fy-s1" : kt < 35 ? "fy-s2" : kt < 55 ? "fy-s3" : kt < 80 ? "fy-s4" : "fy-s5");

export default function WindsTab({ f }) {
  const { data, patch } = f;
  const place = data.home;
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [hourIdx, setHourIdx] = useState(0);
  const [wx, setWx] = useState({ metar: null, taf: null, station: null });
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!place) return undefined;
    const ctl = new AbortController();
    setProfile(null);
    setError(null);
    fetchWindsAloft({ latitude: place.lat, longitude: place.lon }, { hours: 48, signal: ctl.signal })
      .then(p => {
        setProfile(p);
        const now = Date.now();
        const i = p.hours.findIndex(h => +h.time >= now - 30 * 60000);
        setHourIdx(Math.max(0, i));
      })
      .catch(e => e.name !== "AbortError" && setError(e.message));
    // Weather at this airport, or the closest one that reports.
    (async () => {
      try {
        let id = /^[A-Z0-9]{4}$/.test(place.id) ? place.id : null;
        let metars = id ? await fetchMetars([id], { signal: ctl.signal }) : [];
        if (!metars.length) {
          const d = 0.6;
          const st = await fetchStations([place.lat - d, place.lon - d, place.lat + d, place.lon + d], { signal: ctl.signal });
          const k = Math.cos((place.lat * Math.PI) / 180);
          const near = st.sort((a, b) => Math.hypot(a.lat - place.lat, (a.lon - place.lon) * k) - Math.hypot(b.lat - place.lat, (b.lon - place.lon) * k))[0];
          if (!near) return;
          id = near.id;
          metars = await fetchMetars([id], { signal: ctl.signal });
        }
        const tafs = await fetchTafs([id], { signal: ctl.signal }).catch(() => []);
        setWx({ metar: metars[0] ?? null, taf: tafs[0] ?? null, station: id });
      } catch {
        setWx({ metar: null, taf: null, station: null });
      }
    })();
    return () => ctl.abort();
  }, [place, attempt]);

  const hour = profile?.hours[hourIdx] ?? null;
  const rows = useMemo(
    () => (hour ? fdRows(hour, { elevationFt: profile.elevationFt, altitudes: ALTS }).filter(r => r.wind).map(r => ({ altFt: r.altitudeFt, dir: r.wind.dir, kt: r.wind.speedKt, tempC: r.wind.tempC, code: r.code })) : []),
    [hour, profile]
  );
  const fzl = hour?.freezingLevelFt ?? null;
  // Every third hour for the grid.
  const gridHours = useMemo(() => (profile ? profile.hours.filter((h, i) => i >= hourIdx && (i - hourIdx) % 3 === 0).slice(0, 10) : []), [profile, hourIdx]);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        patch({ home: { id: "HERE", name: "My location", lat: pos.coords.latitude, lon: pos.coords.longitude, elevFt: null, magVar: null } });
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  }

  const tz = profile?.timezone;
  const localTime = h => new Date(h.time).toLocaleString(undefined, { weekday: "short", hour: "numeric", timeZone: tz });

  return (
    <div className="fy-stack">
      <section className="fy-card fy-hero">
        <div className="fy-hero-text">
          <p className="fy-kicker">Winds aloft</p>
          <h1>{place ? place.name : "Wind at every altitude"}</h1>
          <p>{place ? `${place.id === "HERE" ? "" : `${place.id} · `}Forecast winds and temperatures from the surface to 39,000 ft, hour by hour for two days.` : "Pick an airport or a place to see the wind and temperature at each altitude, the way pilots read them on the winds-aloft forecast."}</p>
        </div>
        <div className="fy-hero-tools">
          <AirportSearch onPick={a => patch({ home: a })} />
          <button type="button" className="fy-btn is-ghost" onClick={locate} disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" /> {locating ? "Finding you…" : "Use my location"}
          </button>
        </div>
      </section>

      {!place && (
        <div className="fy-quick">
          {[
            { id: "KDEN", name: "Denver Intl", lat: 39.8617, lon: -104.6732, magVar: 8 },
            { id: "KJFK", name: "New York JFK", lat: 40.6398, lon: -73.7789, magVar: -13 },
            { id: "KORD", name: "Chicago O'Hare", lat: 41.9786, lon: -87.9048, magVar: -3 },
            { id: "KLAX", name: "Los Angeles Intl", lat: 33.9425, lon: -118.4081, magVar: 12 },
          ].map(a => (
            <button key={a.id} type="button" className="fy-chip" onClick={() => patch({ home: a })}>
              {a.id} · {a.name}
            </button>
          ))}
        </div>
      )}

      {place && error && <ErrorNote onRetry={() => setAttempt(n => n + 1)}>{error}</ErrorNote>}
      {place && !profile && !error && <Loading>Getting the winds aloft…</Loading>}

      {profile && hour && (
        <>
          <section className="fy-card">
            <div className="fy-row-between">
              <h2>{localTime(hour)} <small>{zulu(+hour.time)}</small></h2>
              <span className="fy-muted">Ground {fmtAlt(profile.elevationFt)} MSL</span>
            </div>
            <input
              type="range"
              className="fy-range"
              min={0}
              max={profile.hours.length - 1}
              value={hourIdx}
              onChange={e => setHourIdx(Number(e.target.value))}
              aria-label="Forecast hour"
            />
            <div className="fy-winds">
              <div className="fy-winds-col">
                <table className="fy-table fy-fb">
                  <thead>
                    <tr>
                      <th>Altitude</th>
                      <th>Wind</th>
                      <th>Temp</th>
                      <th>FB code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map(r => (
                      <tr key={r.altFt}>
                        <th>{(r.altFt / 1000).toFixed(0)},000</th>
                        <td>
                          <span className={`fy-arrow ${speedClass(r.kt)}`} style={{ transform: `rotate(${r.dir + 180}deg)` }} aria-hidden="true">
                            <ArrowUp size={14} />
                          </span>
                          {r.kt < 5 ? "Light" : `${pad3(r.dir)}° ${Math.round(r.kt)} kt`}
                        </td>
                        <td>{Math.round(r.tempC)}°C</td>
                        <td className="fy-mono">{r.code}</td>
                      </tr>
                    ))}
                    <tr className="is-surface">
                      <th>Surface</th>
                      <td>{hour.surface.speedKt === null ? "—" : `${pad3(hour.surface.dir ?? 0)}° ${Math.round(hour.surface.speedKt)} kt`}</td>
                      <td>{hour.surface.tempC === null ? "—" : `${Math.round(hour.surface.tempC)}°C`}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <WindProfile hour={hour} elevationFt={profile.elevationFt} fzl={fzl} />
            </div>
            <p className="fy-note">
              <Snowflake size={14} aria-hidden="true" /> Freezing level: <strong>{fzl === null ? "not available" : fzl <= profile.elevationFt + 200 ? "at the surface" : fmtAlt(Math.round(fzl / 100) * 100)}</strong>
              {" · "}Model forecast from Open-Meteo; check the official winds-aloft forecast on aviationweather.gov before you fly.
            </p>
          </section>

          <section className="fy-card">
            <h2>Next 30 hours</h2>
            <div className="fy-scroll-x">
              <table className="fy-table fy-grid">
                <thead>
                  <tr>
                    <th />
                    {gridHours.map(h => (
                      <th key={+h.time}>{new Date(h.time).toLocaleTimeString(undefined, { hour: "numeric", timeZone: tz })}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...ALTS].reverse().filter(a => a - profile.elevationFt >= 1500).map(alt => (
                    <tr key={alt}>
                      <th>{(alt / 1000).toFixed(0)}k</th>
                      {gridHours.map(h => {
                        const w = windHere(h, alt, profile.elevationFt);
                        if (!w) return <td key={+h.time}>—</td>;
                        return (
                          <td key={+h.time} className={`fy-cell ${speedClass(w.kt)}`} title={`${pad3(w.dir)}° at ${Math.round(w.kt)} kt, ${Math.round(w.tempC)}°C`}>
                            <span className="fy-arrow" style={{ transform: `rotate(${w.dir + 180}deg)` }} aria-hidden="true">
                              <ArrowUp size={11} />
                            </span>
                            {Math.round(w.kt)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fy-legend">
              Knots; arrows point where the wind blows to. <span className="fy-cell fy-s0">calm</span> <span className="fy-cell fy-s2">20–35</span> <span className="fy-cell fy-s4">55–80</span> <span className="fy-cell fy-s5">80+</span>
            </p>
          </section>
        </>
      )}

      {place && wx.metar && (
        <section className="fy-two">
          <MetarCard metar={wx.metar} title={wx.station === place.id ? "Weather here now" : `Nearest report · ${wx.station}`} />
          {wx.taf ? <TafCard taf={wx.taf} /> : <article className="fy-metar"><p className="fy-muted">No terminal forecast (TAF) for {wx.station}.</p></article>}
        </section>
      )}
    </div>
  );
}

export function TafCard({ taf }) {
  const [now] = useState(() => Date.now());
  return (
    <article className="fy-metar">
      <header>
        <div>
          <strong>Forecast (TAF)</strong>
          <span>{taf.id} · valid to {fmtTime(taf.to, { weekday: "short" })}</span>
        </div>
      </header>
      <ol className="fy-taf">
        {taf.periods
          .filter(p => !p.to || p.to > now)
          .slice(0, 6)
          .map((p, i) => (
            <li key={i}>
              <span className="fy-taf-time">{p.change === "TEMPO" ? "Temporarily " : p.change === "PROB" ? `${p.probability}% chance ` : ""}{fmtTime(p.from, { weekday: "short" })}</span>
              <Cat value={p.category} small />
              <span>
                {p.windKt ? `${p.windDir === "VRB" ? "Variable" : `${pad3(p.windDir)}°`} ${p.windKt}${p.gustKt ? `G${p.gustKt}` : ""} kt` : "Calm"}
                {" · "}
                {p.visSm === null ? "" : p.visSm >= 6 ? "6+ sm" : `${p.visSm} sm`}
                {p.ceilingFt !== null ? ` · ceiling ${p.ceilingFt.toLocaleString()} ft` : ""}
                {p.wx ? ` · ${p.wx}` : ""}
              </span>
            </li>
          ))}
      </ol>
      <p className="fy-raw">{taf.raw}</p>
    </article>
  );
}

// The wind and temperature with height, drawn: speed as bars, temperature as a line.
function WindProfile({ hour, elevationFt, fzl }) {
  const W = 260;
  const H = 300;
  const top = 40000;
  const bottom = Math.max(0, Math.floor(elevationFt / 1000) * 1000);
  const y = alt => H - 20 - ((alt - bottom) / (top - bottom)) * (H - 40);
  const pts = [];
  for (let a = Math.max(bottom + 1000, 1000); a <= top; a += 1000) {
    const w = windHere(hour, a, elevationFt);
    if (w) pts.push({ a, ...w });
  }
  const maxKt = Math.max(40, ...pts.map(p => p.kt));
  const x = kt => 40 + (kt / maxKt) * (W - 60);
  const tx = t => 40 + ((t + 60) / 90) * (W - 60);
  return (
    <figure className="fy-profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wind speed and temperature by altitude">
        {[0, 10000, 20000, 30000, 40000].filter(a => a >= bottom).map(a => (
          <g key={a}>
            <line x1="38" x2={W - 10} y1={y(a)} y2={y(a)} className="fy-gridline" />
            <text x="34" y={y(a) + 4} textAnchor="end" className="fy-axis">{a / 1000}k</text>
          </g>
        ))}
        {pts.map(p => (
          <rect key={p.a} x="40" y={y(p.a) - 3} width={Math.max(1, x(p.kt) - 40)} height="5" rx="2" className={`fy-bar ${speedClass(p.kt)}`} />
        ))}
        <polyline className="fy-temp" points={pts.map(p => `${tx(p.tempC)},${y(p.a)}`).join(" ")} />
        <line x1={tx(0)} x2={tx(0)} y1="10" y2={H - 20} className="fy-zero" />
        {fzl !== null && fzl > bottom && fzl < top && (
          <g>
            <line x1="38" x2={W - 10} y1={y(fzl)} y2={y(fzl)} className="fy-fzl" />
            <text x={W - 12} y={y(fzl) - 4} textAnchor="end" className="fy-axis is-fzl">0 °C</text>
          </g>
        )}
      </svg>
      <figcaption>
        <span><i className="fy-key is-bar" /> wind speed (max {Math.round(maxKt)} kt)</span>
        <span><i className="fy-key is-temp" /> temperature</span>
      </figcaption>
    </figure>
  );
}
