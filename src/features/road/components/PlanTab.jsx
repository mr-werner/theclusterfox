import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, BookmarkCheck, BookmarkPlus, ExternalLink, Navigation, Plus, Route } from "lucide-react";

import { fetchCorridor, fetchHourlyAlong } from "../api";
import { THEMES, THEME_BY_ID } from "../data/themes";
import { cumulative, fmtMiles, fmtMinutes, miles, sampleEvery, shrink } from "../model/geo";
import { gasPlan, roadHazard, threePlans, timeline, weatherAlong } from "../model/days";
import { legRange } from "../model/fuel";
import { placeOnRoute } from "../model/stays";
import { addDays } from "../state/roadStore";
import RoadMap from "./RoadMap";
import { Loading, PlaceInput } from "./ui";
import { directionsUrl, placeUrl, THEME_ICONS } from "./links";
import DayPlan from "./DayPlan";
import DriveDay from "./DriveDay";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const corridorCache = new Map();
const NONE = [];
const routeKey = c => (c ? `${c.id}|${c.route.miles.toFixed(1)}|${c.route.points.length}` : "");
const dateMs = day => Date.parse(`${day}T00:00:00Z`);

export default function PlanTab({ store, trip, selectedId, setSelectedId, savedTrip, openDay }) {
  const { data, patch } = store;
  const { from, to } = data;
  const routes = trip.routes;
  const current = routes.find(r => r.id === selectedId) ?? routes[0] ?? null;
  const [focus, setFocus] = useState(null);
  const [explore, setExplore] = useState("scenic");
  const [corridorFor, setCorridorFor] = useState({ key: null, state: "idle", items: [], progress: null, error: null });
  const [weatherFor, setWeatherFor] = useState({ key: null, list: [] });
  const [savedId, setSavedId] = useState(null);

  // Towns, places to stay and gas along the route you're looking at.
  const rKey = current?.id === "saved" ? "" : routeKey(current);
  useEffect(() => {
    if (!rKey) return undefined;
    if (corridorCache.has(rKey)) return undefined;
    const ctl = new AbortController();
    fetchCorridor(current.route.points, { signal: ctl.signal, onPart: (items, progress) => setCorridorFor({ key: rKey, state: "loading", items, progress, error: null }) })
      .then(items => {
        corridorCache.set(rKey, items);
        setCorridorFor({ key: rKey, state: "done", items, progress: null, error: null });
      })
      .catch(e => e.name !== "AbortError" && setCorridorFor(c => ({ ...c, key: rKey, state: c.items.length ? "done" : "error", error: e.message })));
    return () => ctl.abort();
  }, [rKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const corridor = useMemo(
    () => (corridorCache.has(rKey) ? { state: "done", items: corridorCache.get(rKey), progress: null } : corridorFor.key === rKey ? corridorFor : { state: rKey ? "loading" : "idle", items: NONE, progress: null }),
    [rKey, corridorFor]
  );

  const samples = useMemo(() => (current ? sampleEvery(current.route.points, cumulative(current.route.points), Math.max(0.5, current.route.miles / 700)) : []), [current]);
  const placed = useMemo(() => (current && corridor.items.length ? placeOnRoute(corridor.items, samples) : []), [corridor.items, samples]); // eslint-disable-line react-hooks/exhaustive-deps

  const plans = useMemo(() => (current ? threePlans(current.route, current.stops, { drive: data.drive, hoursPerDay: data.hoursPerDay, days: data.dayTimes, places: placed }) : null), [current, data.drive, data.hoursPerDay, data.dayTimes, placed]);
  const planId = plans?.[data.plan] ? data.plan : "planned";
  const days = plans ? plans[planId].days : NONE;
  const nights = plans ? plans[planId].nights : NONE;
  const ends = days.filter(d => d.end).map(d => d.end);
  const townName = useMemo(() => {
    const towns = placed.filter(p => p.kind === "town");
    return p => {
      let best = null;
      let bestD = 15;
      for (const t of towns) {
        const dd = miles(t, p);
        if (dd < bestD) {
          best = t;
          bestD = dd;
        }
      }
      return best ? `${bestD > 4 ? "near " : ""}${best.name}` : null;
    };
  }, [placed]);

  // Gas: fill up where you're already stopping, before you run low.
  const gas = useMemo(() => {
    if (!current || data.vehicle.kind === "ev" || !placed.length) return [];
    let stations = placed.filter(p => p.kind === "fuel" && p.off <= 3);
    if (data.vehicle.kind === "diesel") stations = stations.filter(s => s.diesel).length >= 3 ? stations.filter(s => s.diesel) : stations;
    const anchors = [...current.stops.map(s => ({ mile: s.mile, name: s.name })), ...nights.filter(n => n?.pick).map(n => ({ mile: n.pick.mile, name: n.pick.name, night: true }))];
    return gasPlan(current.route.miles, legRange(data.vehicle), stations, anchors);
  }, [current, placed, nights, data.vehicle]);

  // The forecast for where you'll be, hour by hour, up to 16 days out.
  const start = data.departDate;
  const points = useMemo(() => (current && start ? timeline(current.route, days) : []), [current, start, days]);
  const weatherKey = start && points.length ? `${start}|${points.map(p => `${p.lat.toFixed(2)},${p.lon.toFixed(2)},${p.minutes}`).join(";")}` : "";
  useEffect(() => {
    if (!weatherKey) return undefined;
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const last = new Date(today + 15 * 86400000).toISOString().slice(0, 10);
    const lastDay = addDays(start, days.length);
    if (dateMs(start) > dateMs(last) || dateMs(lastDay) < today - 86400000) return undefined;
    const from = dateMs(start) < today ? new Date(today).toISOString().slice(0, 10) : start;
    const to = dateMs(lastDay) > dateMs(last) ? last : lastDay;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetchHourlyAlong(points, from, to, { signal: ctl.signal })
        .then(bodies => setWeatherFor({ key: weatherKey, list: weatherAlong(points, bodies, start) }))
        .catch(e => e.name !== "AbortError" && setWeatherFor({ key: weatherKey, list: points.map(p => ({ ...p, weather: null, failed: true })) }));
    }, 500);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [weatherKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const weather = weatherFor.key === weatherKey ? weatherFor.list : points.map(p => ({ ...p, weather: null }));

  const fit = useMemo(() => (current ? shrink(current.route.points, 200) : from && to ? [from, to] : []), [current, from, to]);
  const mapRoutes = routes.map(r => ({ id: r.id, points: r.route.points, active: r.id === current?.id }));
  const stopIds = new Set(current?.stops.map(s => s.id));
  const nearby = useMemo(() => trip.places.filter(p => p.theme === explore && !stopIds.has(p.id)).sort((a, b) => b.score - b.off * 0.35 - (a.score - a.off * 0.35)).slice(0, 30).sort((a, b) => a.baseMile - b.baseMile), [trip.places, explore, current]); // eslint-disable-line react-hooks/exhaustive-deps
  const markers = [
    ...(from ? [{ id: "from", kind: "start", lat: from.lat, lon: from.lon, label: "A", title: `Start: ${from.name}` }] : []),
    ...(to ? [{ id: "to", kind: "end", lat: to.lat, lon: to.lon, label: "B", title: `End: ${to.name}` }] : []),
    ...nearby.map(p => ({ id: `n:${p.id}`, kind: "place", lat: p.lat, lon: p.lon, title: `${p.name} (${p.label}), tap to see it`, onClick: () => setFocus(p.id) })),
    ...ends.map((e, i) => ({ id: `night${i}`, kind: "night", lat: nights[i]?.pick?.lat ?? e.lat, lon: nights[i]?.pick?.lon ?? e.lon, title: `Night ${i + 1}${nights[i]?.pick ? `: ${nights[i].pick.name}` : ""}` })),
    ...gas.filter(g => g.station).map((g, i) => ({ id: `gas${i}`, kind: "fuel", lat: g.station.lat, lon: g.station.lon, title: `Gas: ${g.station.name}, mile ${g.mile}` })),
    ...weather.filter(w => w.weather && roadHazard(w.weather)).map((w, i) => ({ id: `wx${i}`, kind: "wx", lat: w.lat, lon: w.lon, label: "!", title: `${roadHazard(w.weather)} around mile ${w.mile}` })),
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
      days: days.map((d, i) => ({ driveMinutes: d.driveMinutes, stopMinutes: d.stopMinutes, miles: d.toMile - d.fromMile, endName: nights[i]?.pick?.name ?? "", stopNames: d.stops.map(s => s.name) })),
      pack: data.pack,
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
          <button type="button" className="rf-btn is-go" disabled={!canPlan} onClick={trip.run}>
            <Route size={17} aria-hidden="true" /> {routes.length && !savedTrip ? "Plan again" : "Find my routes"}
          </button>
        </div>
        <DriveDay data={data} patch={patch} />
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
                <Loading>Looking for great stops along the way…{trip.progress ? ` ${trip.places.length} found so far (${trip.progress.done} of ${trip.progress.total})` : ""}</Loading>
              </div>
            )}
          </div>

          <RoadMap fit={fit} fitKey={`${trip.key}|${current?.id}`} routes={mapRoutes} markers={markers} height={420} label="Map of your routes and stops" />
          <p className="rf-legend">
            <span className="rf-key rf-key--stop" /> Stops <span className="rf-key rf-key--night" /> Overnight <span className="rf-key rf-key--fuel" /> Gas <span className="rf-key rf-key--wx" /> Weather to watch <span className="rf-key rf-key--place" /> More to see ({THEME_BY_ID[explore].name.toLowerCase()})
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
                {plans && (
                  <DayPlan
                    route={current}
                    plans={plans}
                    planId={planId}
                    setPlan={id => patch({ plan: id })}
                    start={start}
                    to={to ?? savedTrip.to}
                    data={data}
                    patch={patch}
                    places={placed}
                    corridor={current.id === "saved" ? { state: "idle" } : corridor}
                    gas={gas}
                    weather={weather}
                    focus={focus}
                    setFocus={setFocus}
                    onRemove={current.id !== "saved" ? removeStop : null}
                    canEdit={current.id !== "saved"}
                    busy={trip.busy === current.id}
                    openDay={openDay}
                    townName={townName}
                  />
                )}
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
      <p className="rf-muted rf-small rf-intro-note">Pick where you're starting and where you're going. RoadTripFox finds the fastest way, another way, and a route for each kind of trip with real places to stop, then splits it into days with a town to sleep in each night. Tell it how long you're staying and the Pack tab lists what to bring for the weather there.</p>
    </section>
  );
}
