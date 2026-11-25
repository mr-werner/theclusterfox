import { useEffect, useMemo, useState } from "react";
import { CloudRain, Layers, Pause, Play } from "lucide-react";

import { fetchRadar, fetchRouteForecast } from "../tripApi";
import { fmtMinutes } from "../model/nav";
import { alongAtTime, corridorGrid, flyingWeather, hourAt, pointAlong, weatherStretches } from "../model/trip";
import FlyMap from "./FlyMap";
import { ErrorNote, Loading } from "./ui";
import { fmtAlt, fmtTime } from "./format";

const LEVEL_NAME = ["Good flying", "Some clouds or wind", "Rain, low clouds or poor visibility", "Storms, snow or icing"];
const MAX_CENTER = 20;

/**
 * The weather you'd fly through, timed to the plan: drag the slider to a
 * moment of the trip and the map shows where you'd be and the forecast all
 * along the route for that hour. Today's radar can be laid on top too.
 */
export default function TripWeather({ route, routeKey, plan, samples, altitudeFt, departMs }) {
  const totalMin = Math.max(1, Math.round(plan.totalMin));
  const [rawMinute, setMinute] = useState(0);
  const minute = Math.min(rawMinute, totalMin);
  const [playing, setPlaying] = useState(false);
  const [fc, setFc] = useState({ state: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [radar, setRadar] = useState(null);
  const soon = departMs - Date.now() < 2 * 3600000;
  const [layers, setLayers] = useState({ forecast: true, radar: soon });

  // Forecast points: up to 20 along the route, each with a point 30 nm either side.
  const grid = useMemo(() => {
    if (!samples?.length) return [];
    const every = Math.max(1, Math.ceil(samples.length / MAX_CENTER));
    const center = samples.filter((_, i) => i % every === 0 || i === samples.length - 1);
    return corridorGrid(center, Math.min(30, Math.max(12, plan.totalNm / 12)));
  }, [samples, plan.totalNm]);

  const hoursAhead = (departMs - Date.now()) / 3600000;
  const needHours = Math.ceil(Math.max(0, hoursAhead) + plan.totalMin / 60 + 2);
  const tooFar = hoursAhead > 15 * 24;
  const fetchKey = `${routeKey}|${Math.round(departMs / 3600000)}|${Math.ceil(needHours / 6)}|${grid.length}|${attempt}`;
  useEffect(() => {
    if (!grid.length || tooFar) return undefined;
    const ctl = new AbortController();
    setFc(f => ({ ...f, state: "loading" }));
    fetchRouteForecast(grid, Math.ceil(needHours / 6) * 6, { signal: ctl.signal })
      .then(points => setFc({ state: "ready", points, key: routeKey }))
      .catch(e => e.name !== "AbortError" && setFc({ state: "error", error: e.message }));
    return () => ctl.abort();
  }, [fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctl = new AbortController();
    fetchRadar({ signal: ctl.signal })
      .then(setRadar)
      .catch(e => e.name !== "AbortError" && setRadar({ error: e.message }));
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const step = Math.max(5, Math.round(totalMin / 40));
    const id = setInterval(() => setMinute(m => Math.min(totalMin, m + step)), 450);
    return () => clearInterval(id);
  }, [playing, totalMin]);
  useEffect(() => {
    if (playing && minute >= totalMin) setPlaying(false);
  }, [playing, minute, totalMin]);

  const when = departMs + minute * 60000;
  const along = alongAtTime(plan, when);
  const here = pointAlong(route, along);
  const points = fc.state !== "error" && fc.key === routeKey ? fc.points ?? [] : [];

  // The forecast for the selected moment at every point, and right where you'd be.
  const cells = points.map((p, i) => {
    const w = flyingWeather(hourAt(p.hours, when), altitudeFt);
    return { id: `c${i}`, lat: p.lat, lon: p.lon, nm: Math.min(16, Math.max(7, plan.totalNm / 30)), className: `fy-wx fy-wx--${w.level ?? "none"}`, minPx: 7, title: w.flags.join(", ") || w.label, w };
  });
  const centerPts = points.filter(p => p.side === 0);
  const nearest = centerPts.reduce((b, p) => (!b || Math.abs(p.alongNm - along) < Math.abs(b.alongNm - along) ? p : b), null);
  const nowHere = nearest ? flyingWeather(hourAt(nearest.hours, when), altitudeFt) : null;
  const nowHour = nearest ? hourAt(nearest.hours, when) : null;
  const stretches = useMemo(() => (centerPts.length ? weatherStretches(centerPts, { plan, altitudeFt }) : []), [centerPts.length, fc.points, plan, altitudeFt]); // eslint-disable-line react-hooks/exhaustive-deps
  const watch = stretches.filter(s => s.level >= 2);
  const total = plan.totalNm || 1;

  const markers = [
    ...route.map((p, i) => ({ id: `wp-${p.id}-${i}`, lat: p.lat, lon: p.lon, waypoint: true, label: p.id, title: p.name })),
    ...(here ? [{ id: "you", kind: "plane", lat: here.lat, lon: here.lon, rotate: here.course, title: `You, ${fmtMinutes(minute)} into the flight` }] : []),
  ];
  const overlay = layers.radar && radar?.url ? { url: radar.url, maxZoom: 7, className: "is-radar" } : null;

  return (
    <section className="fy-card fy-tripwx">
      <div className="fy-row-between">
        <h2>Weather along your trip</h2>
        <div className="fy-toggle-row" role="group" aria-label="Map layers">
          <button type="button" className={`fy-chip${layers.forecast ? " is-on" : ""}`} aria-pressed={layers.forecast} onClick={() => setLayers(l => ({ ...l, forecast: !l.forecast }))}>
            <Layers size={14} aria-hidden="true" /> Forecast
          </button>
          <button type="button" className={`fy-chip${layers.radar ? " is-on" : ""}`} aria-pressed={layers.radar} onClick={() => setLayers(l => ({ ...l, radar: !l.radar }))} disabled={radar?.error}>
            <CloudRain size={14} aria-hidden="true" /> Radar now
          </button>
        </div>
      </div>
      <p className="fy-muted">Slide through the flight to see where you'd be and the forecast all along the route at that hour. The radar is a picture of right now, so it matters most for the first hour or two; the forecast shows what's expected later.</p>

      <div className="fy-scrub">
        <button type="button" className="fy-icon-btn" onClick={() => (minute >= totalMin ? (setMinute(0), setPlaying(true)) : setPlaying(p => !p))} aria-label={playing ? "Pause" : "Play the flight"}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input type="range" min={0} max={totalMin} step={1} value={minute} onChange={e => { setPlaying(false); setMinute(Number(e.target.value)); }} aria-label="Time into the flight" />
        <span className="fy-scrub-label">
          <strong>{fmtMinutes(minute)} in</strong>
          <small>{fmtTime(when, { weekday: "short" })} · {Math.round(along)} nm</small>
        </span>
      </div>

      <div className="fy-strip" aria-label="Forecast along the route at the time you'd pass each point">
        {stretches.map((s, i) => {
          const next = stretches[i + 1];
          const width = (((next ? next.fromNm : total) - s.fromNm) / total) * 100;
          return (
            <button
              key={i}
              type="button"
              className={`fy-strip-seg fy-wx-bg--${s.level ?? "none"}`}
              style={{ width: `${Math.max(1, width)}%` }}
              title={`${Math.round(s.fromNm)}–${Math.round(next ? next.fromNm : total)} nm: ${s.flags.join(", ") || s.label}`}
              onClick={() => { setPlaying(false); setMinute(Math.round(((s.fromAt ?? departMs) - departMs) / 60000)); }}
            />
          );
        })}
        <span className="fy-strip-you" style={{ left: `${Math.min(100, (along / total) * 100)}%` }} aria-hidden="true" />
      </div>

      <FlyMap fit={route} fitKey={routeKey} route={route} markers={markers} circles={layers.forecast ? cells : []} overlay={overlay} label="Weather along the route" height={380} />
      <p className="fy-legend">
        {LEVEL_NAME.map((n, i) => (
          <span key={n} className="fy-legend-item"><i className={`fy-wx-bg--${i}`} /> {n}</span>
        ))}
        {overlay && radar?.time ? <span className="fy-muted"> · Radar from {fmtTime(radar.time)} (RainViewer)</span> : null}
      </p>

      {tooFar && <p className="fy-note">Your departure is more than two weeks away, past the end of the forecast. Check back closer to the day.</p>}
      {fc.state === "loading" && !points.length && <Loading>Getting the forecast along the route…</Loading>}
      {fc.state === "error" && <ErrorNote onRetry={() => setAttempt(n => n + 1)}>{fc.error}</ErrorNote>}
      {radar?.error && <p className="fy-muted fy-small">{radar.error}</p>}

      {nowHere && (
        <div className={`fy-here fy-wx-edge--${nowHere.level ?? "none"}`}>
          <strong>
            At {fmtTime(when)} you'd be about {Math.round(along)} nm along: {nowHere.flags.length ? nowHere.flags.join(", ") : nowHere.label}
          </strong>
          {nowHour && (
            <span className="fy-muted">
              {nowHour.precipProb !== null ? `${nowHour.precipProb}% chance of rain · ` : ""}
              clouds {nowHour.cloud ?? "—"}% (low {nowHour.cloudLow ?? "—"}%)
              {nowHour.visM !== null ? ` · visibility ${nowHour.visM >= 16000 ? "10+" : Math.round(nowHour.visM / 1609)} mi` : ""}
              {nowHour.gustKt !== null ? ` · surface gusts ${Math.round(nowHour.gustKt)} kt` : ""}
              {nowHour.freezingFt !== null ? ` · freezing level ${fmtAlt(Math.round(nowHour.freezingFt / 100) * 100)}` : ""}
            </span>
          )}
        </div>
      )}

      {points.length > 0 && (
        watch.length ? (
          <>
            <h3>What to watch for on the way</h3>
            <ul className="fy-list fy-watch">
              {watch.map((s, i) => (
                <li key={i}>
                  <button type="button" className="fy-link" onClick={() => { setPlaying(false); setMinute(Math.round(((s.fromAt ?? departMs) - departMs) / 60000)); }}>
                    <strong>{s.flags.join(", ")}</strong>
                  </button>
                  <span className="fy-muted">
                    {fmtMinutes(((s.fromAt ?? departMs) - departMs) / 60000)}
                    {s.toAt && s.toAt !== s.fromAt ? `–${fmtMinutes((s.toAt - departMs) / 60000)}` : ""} in ({fmtTime(s.fromAt)}), {Math.round(s.fromNm)}
                    {s.toNm !== s.fromNm ? `–${Math.round(s.toNm)}` : ""} nm along
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="fy-note">No rain, low clouds or storms are forecast along the route at the times you'd pass. Forecasts change, so check again before you go.</p>
        )
      )}
      <p className="fy-muted fy-small">Forecast from Open-Meteo (weather models, not an aviation forecast). Use it to plan, then get an official briefing.</p>
    </section>
  );
}
