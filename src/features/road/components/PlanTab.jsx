import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, BedDouble, BookmarkCheck, BookmarkPlus, CloudSun, ExternalLink, Flag, Navigation, Plus, Route, X } from "lucide-react";

import { fetchDailyWeather, fetchServices } from "../api";
import { THEMES, THEME_BY_ID } from "../data/themes";
import { fmtMiles, fmtMinutes, miles, shrink } from "../model/geo";
import { splitDays } from "../model/route";
import { addDays } from "../state/roadStore";
import { describeWeather } from "../../../services/weather/openMeteo";
import RoadMap from "./RoadMap";
import { Loading, PlaceInput } from "./ui";
import { directionsUrl, placeUrl, THEME_ICONS } from "./links";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayName = day => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** The best town to sleep in near a spot: big and close wins. */
function nightTown(towns, p) {
  let best = null;
  let bestScore = -Infinity;
  for (const t of towns) {
    const d = miles(t, p);
    if (d > 30) continue;
    const score = Math.log10((t.pop || (t.size === "city" ? 50000 : 5000)) + 10) * 6 - d;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

export default function PlanTab({ store, trip, selectedId, setSelectedId, savedTrip, openDay }) {
  const { data, patch } = store;
  const { from, to } = data;
  const routes = trip.routes;
  const current = routes.find(r => r.id === selectedId) ?? routes[0] ?? null;
  const [focus, setFocus] = useState(null);
  const [explore, setExplore] = useState("scenic");
  const [towns, setTowns] = useState({});
  const [weatherFor, setWeatherFor] = useState({ key: null, list: null });
  const [savedId, setSavedId] = useState(null);

  const days = useMemo(() => (current ? splitDays(current.route, current.stops, data.hoursPerDay) : []), [current, data.hoursPerDay]);
  const ends = days.filter(d => d.end).map(d => d.end);
  const endsKey = ends.map(e => `${e.lat.toFixed(2)},${e.lon.toFixed(2)}`).join("|");

  // Towns to sleep in, near where each day ends.
  useEffect(() => {
    if (!ends.length || ends.every(e => towns[`${e.lat.toFixed(2)},${e.lon.toFixed(2)}`] !== undefined)) return undefined;
    const ctl = new AbortController();
    fetchServices(ends.map(e => ({ kind: "town", points: [e], meters: 45000 })), { signal: ctl.signal })
      .then(list => {
        const found = {};
        for (const e of ends) found[`${e.lat.toFixed(2)},${e.lon.toFixed(2)}`] = nightTown(list, e);
        setTowns(t => ({ ...t, ...found }));
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [endsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Weather where you'll be each night and at the end, if the trip is within two weeks.
  const start = data.departDate;
  const weatherSpots = start && to ? [...ends, to] : [];
  const weatherKey = `${start}|${endsKey}|${to?.id}`;
  useEffect(() => {
    if (!start || !weatherSpots.length) return undefined;
    const ahead = (Date.parse(`${start}T00:00:00`) - Date.now()) / 86400000;
    if (ahead > 15 || ahead < -2) return undefined;
    const ctl = new AbortController();
    fetchDailyWeather(weatherSpots, { signal: ctl.signal })
      .then(list => setWeatherFor({ key: weatherKey, list }))
      .catch(() => {});
    return () => ctl.abort();
  }, [weatherKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const weather = weatherFor.key === weatherKey ? weatherFor.list : null;
  const townFor = e => (e ? towns[`${e.lat.toFixed(2)},${e.lon.toFixed(2)}`] : null);

  const fit = useMemo(() => (current ? shrink(current.route.points, 200) : from && to ? [from, to] : []), [current, from, to]);
  const mapRoutes = routes.map(r => ({ id: r.id, points: r.route.points, active: r.id === current?.id }));
  const stopIds = new Set(current?.stops.map(s => s.id));
  const nearby = useMemo(() => trip.places.filter(p => p.theme === explore && !stopIds.has(p.id)).sort((a, b) => b.score - b.off * 0.35 - (a.score - a.off * 0.35)).slice(0, 30).sort((a, b) => a.baseMile - b.baseMile), [trip.places, explore, current]); // eslint-disable-line react-hooks/exhaustive-deps
  const markers = [
    ...(from ? [{ id: "from", kind: "start", lat: from.lat, lon: from.lon, label: "A", title: `Start: ${from.name}` }] : []),
    ...(to ? [{ id: "to", kind: "end", lat: to.lat, lon: to.lon, label: "B", title: `End: ${to.name}` }] : []),
    ...nearby.map(p => ({ id: `n:${p.id}`, kind: "place", lat: p.lat, lon: p.lon, title: `${p.name} (${p.label}), tap to see it`, onClick: () => setFocus(p.id) })),
    ...ends.map((e, i) => ({ id: `night${i}`, kind: "night", lat: e.lat, lon: e.lon, title: `Night ${i + 1}${townFor(e) ? `: ${townFor(e).name}` : ""}` })),
    ...(current?.stops ?? []).map((s, i) => ({ id: `s:${s.id}`, kind: "stop", lat: s.lat, lon: s.lon, label: String(i + 1), title: `${i + 1}. ${s.name}`, selected: focus === s.id, onClick: () => setFocus(s.id) })),
  ];

  function swap() {
    patch({ from: to, to: from });
  }

  function save() {
    if (!current || !from || !to) return;
    const id = newId();
    const t = {
      id,
      title: `${from.name} to ${to.name}${current.theme !== "fastest" ? `, ${THEME_BY_ID[current.theme]?.name.toLowerCase()}` : ""}`,
      from,
      to,
      theme: current.theme,
      departDate: data.departDate,
      hoursPerDay: data.hoursPerDay,
      miles: current.route.miles,
      minutes: current.route.minutes,
      line: shrink(current.route.points, 400).map(p => [Math.round(p.lat * 1e4) / 1e4, Math.round(p.lon * 1e4) / 1e4]),
      stops: current.stops.map(s => ({ id: s.id, name: s.name, region: "", lat: s.lat, lon: s.lon, label: s.label, theme: s.theme, mile: s.mile, minutes: s.minutes, wiki: s.wiki })),
      days: days.map(d => ({ driveMinutes: d.driveMinutes, stopMinutes: d.stopMinutes, miles: d.toMile - d.fromMile, endName: townFor(d.end)?.name ?? "", stopNames: d.stops.map(s => s.name) })),
      createdAt: new Date().toISOString(),
    };
    patch(d => ({ trips: [t, ...d.trips].slice(0, 40) }));
    setSavedId(id);
  }

  function removeStop(id) {
    trip.restop(current.id, current.stops.filter(s => s.id !== id));
  }
  function addStop(p) {
    trip.restop(current.id, [...current.stops, p]);
    setFocus(p.id);
  }

  const fastest = routes.find(r => r.id === "fastest");
  const busy = trip.status === "routing" || trip.status === "stops";
  const canPlan = from && to && !busy;

  return (
    <div className="rf-plan">
      <section className="rf-hero">
        <p className="rf-kicker">It's the journey, not the destination</p>
        <h1>Where are we headed?</h1>
        <div className="rf-endpoints">
          <PlaceInput label="From" value={from} onPick={p => patch({ from: p })} allowHere />
          <button type="button" className="rf-swap" onClick={swap} aria-label="Swap start and end" disabled={!from && !to}>
            <ArrowDownUp size={16} />
          </button>
          <PlaceInput label="To" value={to} onPick={p => patch({ to: p })} />
        </div>
        <div className="rf-options">
          <label>
            <span>Leaving</span>
            <input type="date" value={data.departDate ?? ""} min={today()} onChange={e => patch({ departDate: e.target.value || null })} />
          </label>
          <label className="rf-hours">
            <span>Drive up to {data.hoursPerDay} h a day</span>
            <input type="range" min="2" max="12" step="1" value={data.hoursPerDay} onChange={e => patch({ hoursPerDay: Number(e.target.value) })} />
          </label>
          <button type="button" className="rf-btn is-go" disabled={!canPlan} onClick={trip.run}>
            <Route size={17} aria-hidden="true" /> {routes.length && !savedTrip ? "Plan again" : "Find my routes"}
          </button>
        </div>
      </section>

      {trip.status === "idle" && !savedTrip && <Intro />}
      {trip.status === "routing" && <Loading>Finding roads…</Loading>}
      {trip.error && <p className="rf-note is-warn" role="alert">{trip.error}</p>}
      {savedTrip && (
        <p className="rf-note">
          This is your saved trip, ready offline. <button type="button" className="rf-link" onClick={trip.run} disabled={!canPlan}>Re-plan with today's roads and stops</button>
        </p>
      )}

      {routes.length > 0 && (
        <>
          <div className="rf-cards" role="list" aria-label="Routes">
            {routes.map(r => {
              const Icon = THEME_ICONS[r.id] ?? THEME_ICONS[r.theme] ?? Route;
              const extra = fastest && r.id !== "fastest" ? r.route.minutes + r.stops.reduce((s, p) => s + p.minutes, 0) - fastest.route.minutes : 0;
              return (
                <button key={r.id} type="button" role="listitem" className={`rf-card rf-card--${r.theme}${r.id === current?.id ? " is-on" : ""}`} onClick={() => setSelectedId(r.id)} aria-pressed={r.id === current?.id}>
                  <span className="rf-card-top">
                    <Icon size={18} aria-hidden="true" />
                    <strong>{r.name}</strong>
                    {r.edited && <em>edited</em>}
                  </span>
                  <span className="rf-card-nums">
                    {fmtMinutes(r.route.minutes)} · {fmtMiles(r.route.miles)}
                  </span>
                  <span className="rf-card-sub">
                    {r.stops.length ? `${r.stops.length} stop${r.stops.length > 1 ? "s" : ""}${extra > 5 ? ` · about +${fmtMinutes(extra)} with visits` : ""}` : r.id === "alt" ? `${extra >= 0 ? "+" : "−"}${fmtMinutes(Math.abs(extra))} vs fastest` : r.id === "saved" ? "Saved trip" : "No detours"}
                  </span>
                  {r.stops.length > 0 && <span className="rf-card-stops">{r.stops.map(s => s.name).join(" · ")}</span>}
                </button>
              );
            })}
            {trip.status === "stops" && (
              <div className="rf-card is-pending" role="listitem">
                <Loading>Looking for great stops along the way…</Loading>
              </div>
            )}
          </div>

          <RoadMap fit={fit} fitKey={`${trip.key}|${current?.id}`} routes={mapRoutes} markers={markers} height={420} label="Map of your routes and stops" />
          <p className="rf-legend">
            <span className="rf-key rf-key--stop" /> Stops <span className="rf-key rf-key--night" /> Overnight <span className="rf-key rf-key--place" /> More to see ({THEME_BY_ID[explore].name.toLowerCase()})
          </p>

          {current && (
            <div className="rf-split">
              <section className="rf-panel rf-days" aria-label="Day by day">
                <header className="rf-panel-head">
                  <h2>
                    {current.name} <small>{days.length > 1 ? `${days.length} days` : "One day"}</small>
                  </h2>
                  <div className="rf-actions">
                    <a className="rf-btn is-ghost" href={directionsUrl(from ?? savedTrip.from, to ?? savedTrip.to, current.stops)} target="_blank" rel="noreferrer">
                      <Navigation size={15} aria-hidden="true" /> Navigate
                    </a>
                    {current.id !== "saved" && (
                      <button type="button" className="rf-btn" onClick={save} disabled={savedId !== null && data.trips.some(t => t.id === savedId)}>
                        {savedId && data.trips.some(t => t.id === savedId) ? <BookmarkCheck size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}
                        {savedId && data.trips.some(t => t.id === savedId) ? "Saved" : "Save trip"}
                      </button>
                    )}
                  </div>
                </header>
                {current.stops.length > 9 && <p className="rf-note">Google Maps takes nine stops at a time, so Navigate includes the first nine.</p>}
                <ol className="rf-daylist">
                  {days.map((d, i) => {
                    const day = start ? addDays(start, i) : null;
                    const town = townFor(d.end);
                    const w = weather?.[d.end ? ends.indexOf(d.end) : weatherSpots.length - 1]?.days?.[day];
                    return (
                      <li key={i} className={openDay === i + 1 ? "is-open" : ""}>
                        <div className="rf-day-head">
                          <span className="rf-day-num">Day {i + 1}</span>
                          {day && <span className="rf-muted">{dayName(day)}</span>}
                          <span className="rf-day-nums">
                            {fmtMinutes(d.driveMinutes)} driving · {fmtMiles(d.toMile - d.fromMile)}
                            {d.stopMinutes ? ` · ${fmtMinutes(d.stopMinutes)} at stops` : ""}
                          </span>
                        </div>
                        <ul className="rf-stops">
                          {d.stops.map(s => {
                            const n = current.stops.indexOf(s) + 1;
                            return (
                              <li key={s.id} className={focus === s.id ? "is-focus" : ""}>
                                <button type="button" className="rf-stop-num" onClick={() => setFocus(s.id)} aria-label={`Show ${s.name} on the map`}>
                                  {n}
                                </button>
                                <div className="rf-stop-body">
                                  <strong>{s.name}</strong>
                                  <span className="rf-muted">
                                    <span className={`rf-chip rf-chip--${s.theme}`}>{s.label}</span> mile {Math.round(s.mile)}
                                    {Number.isFinite(s.off) && s.off >= 1 ? ` · ${s.off} mi off the fastest road` : ""} · plan {fmtMinutes(s.minutes)}
                                  </span>
                                  <span className="rf-stop-links">
                                    {s.wiki && (
                                      <a href={s.wiki} target="_blank" rel="noreferrer">
                                        About <ExternalLink size={12} aria-hidden="true" />
                                      </a>
                                    )}
                                    <a href={placeUrl(s)} target="_blank" rel="noreferrer">
                                      Map <ExternalLink size={12} aria-hidden="true" />
                                    </a>
                                  </span>
                                </div>
                                {current.id !== "saved" && (
                                  <button type="button" className="rf-icon-btn" onClick={() => removeStop(s.id)} aria-label={`Skip ${s.name}`} title="Skip this stop" disabled={trip.busy === current.id}>
                                    <X size={15} />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                          <li className="rf-night">
                            {d.end ? <BedDouble size={16} aria-hidden="true" /> : <Flag size={16} aria-hidden="true" />}
                            <div className="rf-stop-body">
                              <strong>{d.end ? (town ? `Sleep in or near ${town.name}` : `Sleep around mile ${d.toMile}`) : `Arrive in ${(to ?? savedTrip.to).name}`}</strong>
                              {w && (
                                <span className="rf-muted rf-weather">
                                  <CloudSun size={13} aria-hidden="true" /> {describeWeather(w.code)}, {Math.round(w.hi)}° / {Math.round(w.lo)}°{w.rain >= 30 ? `, ${w.rain}% chance of rain` : ""}
                                </span>
                              )}
                              {d.end && town && (
                                <span className="rf-stop-links">
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hotels near ${town.name}`)}`} target="_blank" rel="noreferrer">
                                    Places to stay <ExternalLink size={12} aria-hidden="true" />
                                  </a>
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`campgrounds near ${town.name}`)}`} target="_blank" rel="noreferrer">
                                    Campgrounds <ExternalLink size={12} aria-hidden="true" />
                                  </a>
                                </span>
                              )}
                            </div>
                          </li>
                        </ul>
                      </li>
                    );
                  })}
                </ol>
                {trip.busy === current.id && <Loading>Re-routing…</Loading>}
              </section>

              {current.id !== "saved" && trip.places.length > 0 && (
                <section className="rf-panel rf-explore" aria-label="More along the way">
                  <header className="rf-panel-head">
                    <h2>More along the way</h2>
                  </header>
                  <div className="rf-chips" role="tablist">
                    {THEMES.filter(t => t.id !== "fastest").map(t => {
                      const Icon = THEME_ICONS[t.id];
                      return (
                        <button key={t.id} type="button" role="tab" aria-selected={explore === t.id} className={explore === t.id ? "is-on" : ""} onClick={() => setExplore(t.id)}>
                          <Icon size={14} aria-hidden="true" /> {t.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="rf-muted rf-small">{THEME_BY_ID[explore].blurb} Within about {Math.round(THEME_BY_ID[explore].radiusKm * 0.62)} miles of the fastest road.</p>
                  {nearby.length === 0 ? (
                    <p className="rf-muted">Nothing like this found along this route.</p>
                  ) : (
                    <ul className="rf-nearby">
                      {nearby.map(p => (
                        <li key={p.id} className={focus === p.id ? "is-focus" : ""}>
                          <div className="rf-stop-body">
                            <strong>{p.name}</strong>
                            <span className="rf-muted">
                              {p.label} · mile {Math.round(p.baseMile)} · {p.off < 1 ? "right on the way" : `${p.off} mi off`}
                              {p.town ? ` · ${p.town}` : ""}
                            </span>
                            <span className="rf-stop-links">
                              {p.wiki && (
                                <a href={p.wiki} target="_blank" rel="noreferrer">
                                  About <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              )}
                              {p.website && (
                                <a href={p.website} target="_blank" rel="noreferrer">
                                  Website <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              )}
                              <a href={placeUrl(p)} target="_blank" rel="noreferrer">
                                Map <ExternalLink size={12} aria-hidden="true" />
                              </a>
                            </span>
                          </div>
                          <button type="button" className="rf-btn is-small is-ghost" onClick={() => addStop(p)} disabled={trip.busy === current.id || current.stops.length >= 20}>
                            <Plus size={14} aria-hidden="true" /> Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Intro() {
  return (
    <section className="rf-intro">
      {THEMES.map(t => {
        const Icon = THEME_ICONS[t.id];
        return (
          <article key={t.id} className={`rf-intro-card rf-card--${t.id}`}>
            <Icon size={20} aria-hidden="true" />
            <h3>{t.name}</h3>
            <p>{t.blurb}</p>
          </article>
        );
      })}
      <p className="rf-muted rf-small rf-intro-note">Pick where you're starting and where you're going. RoadFox finds the fastest way, another way, and a route for each kind of trip with real places to stop, then splits it into days with a town to sleep in each night.</p>
    </section>
  );
}
