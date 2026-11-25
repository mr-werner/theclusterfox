import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BookmarkPlus, Fuel, Plane, Plus, Route, Trash2, Wind } from "lucide-react";

import { fetchHazards, fetchMetars, fetchMetarsInBox, fetchTafs } from "../api";
import { fetchAirportDetails } from "../tripApi";
import { fetchWindsAloft } from "../../../services/weather/windsAloft";
import { airportsAlong, bestStop, corridorBoxes, courseDeg, distanceNm, fmtMinutes, fuelStops, hazardsOnRoute, isNight, pad3, planFlight, reserveMinutes, samplePoints } from "../model/nav";
import { assessLanding } from "../model/trip";
import { AIRCRAFT_PRESETS } from "../state/flyStore";
import FlyMap from "./FlyMap";
import LandingSpots from "./LandingSpots";
import TripWeather from "./TripWeather";
import { AirportSearch, Cat, ErrorNote, Loading, MetarCard } from "./ui";
import { fmtAlt, fmtTime, fmtVis, fmtWind } from "./format";
import { TafCard } from "./WindsTab";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Local "YYYY-MM-DDTHH:MM" for a datetime-local input.
const toLocalInput = ms => {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const nextHour = () => {
  const d = new Date(Date.now() + 60 * 60000);
  d.setMinutes(0, 0, 0);
  return +d;
};

/** VFR hemispheric altitudes for a magnetic course (above 3,000 AGL). */
export function vfrAltitudes(magCourse) {
  const east = magCourse >= 0 && magCourse < 180;
  return east ? [3500, 5500, 7500, 9500, 11500, 13500, 15500, 17500] : [4500, 6500, 8500, 10500, 12500, 14500, 16500];
}

export default function PlanTab({ f, openFlight }) {
  const { data, patch } = f;
  // Opened from TaskFox: load that saved flight.
  useEffect(() => {
    if (openFlight) patch({ route: openFlight.route, altitudeFt: openFlight.altitudeFt, departAt: openFlight.departAt && Date.parse(openFlight.departAt) > Date.now() ? openFlight.departAt : null });
  }, [openFlight?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const route = data.route;
  const aircraft = data.aircraft;
  const departMs = data.departAt ? Date.parse(data.departAt) : nextHour();
  const [res, setRes] = useState({ state: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(false);
  const [allAlong, setAllAlong] = useState(false);

  const routeKey = route.map(p => p.id).join("-");
  const total = useMemo(() => route.slice(1).reduce((s, p, i) => s + distanceNm(route[i], p), 0), [route]);
  const magVar = route[0]?.magVar ?? route[route.length - 1]?.magVar ?? 0;
  const magCourse = route.length >= 2 ? (courseDeg(route[0], route[route.length - 1]) - magVar + 360) % 360 : 0;
  const night = isNight(departMs, route[0]?.lat ?? 40, route[0]?.lon ?? -100);

  // Fetch everything the plan needs whenever the route, time or altitude changes.
  useEffect(() => {
    if (route.length < 2) {
      setRes({ state: "idle" });
      return undefined;
    }
    const ctl = new AbortController();
    const signal = ctl.signal;
    setRes(r => (r.routeKey === routeKey ? { ...r, state: "loading" } : { state: "loading" }));
    setSaved(false);
    // The shared winds-aloft request takes up to 50 points.
    let step = Math.max(20, total / 40);
    let samples = samplePoints(route, step);
    while (samples.length > 50) {
      step *= 1.25;
      samples = samplePoints(route, step);
    }
    const hoursAhead = (departMs - Date.now()) / 3600000;
    const estHours = total / Math.max(60, aircraft.tas - 30);
    const windHours = Math.ceil(Math.max(0, hoursAhead) + estHours + 3);

    (async () => {
      const ids = route.map(p => p.id).filter(id => /^[A-Z0-9]{4}$/.test(id));
      const winds = windHours <= 72 ? fetchWindsAloft(samples.map(p => ({ latitude: p.lat, longitude: p.lon })), { hours: windHours, signal }).catch(e => (e.name === "AbortError" ? Promise.reject(e) : null)) : Promise.resolve(null);
      const boxes = corridorBoxes(route, 25, 3).slice(0, 10);
      const along = Promise.all(boxes.map(b => fetchMetarsInBox(b, { signal }).catch(() => []))).then(list => {
        const seen = new Set();
        return list.flat().filter(m => (seen.has(m.id) ? false : seen.add(m.id)));
      });
      const [profiles, metarsAlong, routeMetars, tafs, hazards] = await Promise.all([
        winds,
        along,
        ids.length ? fetchMetars(ids, { signal }).catch(() => []) : [],
        ids.length ? fetchTafs(ids, { signal }).catch(() => []) : [],
        fetchHazards({ signal }).catch(() => []),
      ]);
      return { samples, profiles, metarsAlong, routeMetars, tafs, hazards };
    })()
      .then(r => setRes({ state: "ready", routeKey, ...r }))
      .catch(e => e.name !== "AbortError" && setRes({ state: "error", error: e.message }));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, departMs, attempt]);

  const ready = Boolean(res.samples) && res.routeKey === routeKey;
  const plan = useMemo(() => {
    if (!ready || route.length < 2) return null;
    return planFlight({ waypoints: route, aircraft, altitudeFt: data.altitudeFt, departAt: departMs, samples: res.samples, profiles: res.profiles });
  }, [ready, res.samples, res.profiles, route, aircraft, data.altitudeFt, departMs]);

  // The highest ground along the route, from the forecast model's terrain (a smoothed grid, so real peaks run higher).
  const groundFt = useMemo(() => {
    if (!ready) return 0;
    const fromModel = (res.profiles ?? []).map(p => p.elevationFt ?? 0);
    return Math.max(0, ...route.map(p => p.elevFt ?? 0), ...fromModel);
  }, [ready, res.profiles, route]);
  // How long the trip takes at each VFR altitude, with the same winds.
  const altitudeOptions = useMemo(() => {
    if (!ready || !res.profiles || route.length < 2) return [];
    const floor = groundFt + 1000;
    return vfrAltitudes(magCourse)
      .filter(a => a >= floor && a <= 17500)
      .slice(0, 6)
      .map(a => ({ alt: a, ...planFlight({ waypoints: route, aircraft, altitudeFt: a, departAt: departMs, samples: res.samples, profiles: res.profiles }) }));
  }, [ready, res.samples, res.profiles, route, aircraft, departMs, magCourse, groundFt]);
  const fastest = altitudeOptions.reduce((b, o) => (!b || o.totalMin < b.totalMin ? o : b), null);

  const along = useMemo(() => {
    if (!ready) return [];
    return airportsAlong(route, res.metarsAlong, { maxOffNm: 25, skip: [] });
  }, [ready, res.metarsAlong, route]);

  // Runways, fuel and tower for every airport along the way, so stops can be ones you can really use.
  const [details, setDetails] = useState({ key: "", byId: new Map(), state: "idle" });
  const alongKey = along.map(c => c.id).join(",");
  useEffect(() => {
    if (!alongKey) return undefined;
    const ctl = new AbortController();
    setDetails(d => ({ ...d, state: "loading" }));
    fetchAirportDetails(alongKey.split(","), { signal: ctl.signal })
      .then(list => setDetails({ key: alongKey, byId: new Map(list.map(a => [a.id, a])), state: "ready" }))
      .catch(e => e.name !== "AbortError" && setDetails(d => ({ ...d, state: "error" })));
    return () => ctl.abort();
  }, [alongKey]);
  const candidates = useMemo(
    () =>
      along.map(c => {
        const a = details.byId.get(c.id);
        if (!a) return c;
        return { ...c, faaId: a.faaId, fuel: a.fuel, towered: a.towered, runways: a.runways, elevFt: a.elevFt ?? c.elevFt, landing: assessLanding(a, aircraft) };
      }),
    [along, details.byId, aircraft]
  );

  const stops = useMemo(() => {
    if (!plan) return [];
    const ids = new Set(route.map(p => p.id));
    // Leave out fields you can't use: runway too short, military or private.
    const pool = candidates.filter(c => !ids.has(c.id) && c.landing?.level !== "short" && c.landing?.level !== "no");
    return fuelStops(plan, aircraft, { night }).map(s => ({ ...s, airport: bestStop(pool, s.alongNm) }));
  }, [plan, aircraft, night, candidates, route]);

  const onRoute = useMemo(() => (ready ? hazardsOnRoute(res.samples, res.hazards, data.altitudeFt) : []), [ready, res.samples, res.hazards, data.altitudeFt]);
  const metarById = useMemo(() => new Map([...(res.metarsAlong ?? []), ...(res.routeMetars ?? [])].map(m => [m.id, m])), [res.metarsAlong, res.routeMetars]);

  const setRoute = next => patch({ route: next });
  const addPoint = p => {
    if (route.some(r => r.id === p.id)) return;
    setRoute([...route, p]);
  };
  const insertStop = airport => {
    const at = airportsAlong(route, [airport])[0]?.alongNm ?? 0;
    let along = 0;
    let index = route.length - 1;
    for (let i = 0; i < route.length - 1; i++) {
      along += distanceNm(route[i], route[i + 1]);
      if (at <= along) {
        index = i + 1;
        break;
      }
    }
    const p = { id: airport.id, name: airport.name, lat: airport.lat, lon: airport.lon, elevFt: airport.elevFt ?? null, magVar: null };
    setRoute([...route.slice(0, index), p, ...route.slice(index)]);
  };
  const move = (i, d) => {
    const next = [...route];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRoute(next);
  };

  function saveFlight() {
    const title = `${route[0].id} → ${route[route.length - 1].id}`;
    patch(d => ({ flights: [{ id: newId(), title, route, altitudeFt: d.altitudeFt, departAt: new Date(departMs).toISOString(), minutes: plan ? Math.round(plan.totalMin) : null, createdAt: new Date().toISOString() }, ...d.flights].slice(0, 50) }));
    setSaved(true);
  }

  const markers = [
    ...candidates
      .filter(c => !route.some(r => r.id === c.id))
      .map(c => ({ id: c.id, lat: c.lat, lon: c.lon, category: c.category, label: c.id, title: `${c.id} ${c.name}: ${c.category}`, onClick: () => setSelected(c.id), selected: selected === c.id })),
    ...route.map((p, i) => ({ id: `wp-${p.id}`, lat: p.lat, lon: p.lon, waypoint: true, category: metarById.get(p.id)?.category, label: p.id, title: `${i === 0 ? "Departure" : i === route.length - 1 ? "Destination" : "Stop"}: ${p.name}`, onClick: () => setSelected(p.id), selected: selected === p.id })),
  ];
  const selectedMetar = selected ? metarById.get(selected) : null;
  const selectedCand = selected ? candidates.find(c => c.id === selected) : null;

  return (
    <div className="fy-stack">
      <section className="fy-card fy-planner">
        <div className="fy-plan-head">
          <div>
            <p className="fy-kicker">Flight planner</p>
            <h1>{route.length >= 2 ? `${route[0].id} to ${route[route.length - 1].id}` : "Plan a flight"}</h1>
            <p className="fy-muted">Winds aloft along the way, the weather at each airport you pass, hazards on the route, where to stop for fuel, places worth landing and the forecast timed to where you'll be.</p>
          </div>
          {route.length > 0 && (
            <button type="button" className="fy-btn is-ghost is-small" onClick={() => setRoute([])}>
              Start over
            </button>
          )}
        </div>

        <ol className="fy-route-list">
          {route.map((p, i) => (
            <li key={`${p.id}-${i}`}>
              <span className="fy-wp-tag">{i === 0 ? "From" : i === route.length - 1 ? "To" : "Stop"}</span>
              <strong>{p.id}</strong>
              <span className="fy-wp-name">{p.name}</span>
              {i > 0 && <em className="fy-muted">{Math.round(distanceNm(route[i - 1], p))} nm</em>}
              <span className="fy-wp-tools">
                <button type="button" className="fy-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.id} earlier`}><ArrowUp size={15} /></button>
                <button type="button" className="fy-icon-btn" onClick={() => move(i, 1)} disabled={i === route.length - 1} aria-label={`Move ${p.id} later`}><ArrowDown size={15} /></button>
                <button type="button" className="fy-icon-btn" onClick={() => setRoute(route.filter((_, j) => j !== i))} aria-label={`Remove ${p.id}`}><Trash2 size={15} /></button>
              </span>
            </li>
          ))}
        </ol>
        {route.length < 12 && (
          <div className="fy-add-wp">
            <Plus size={16} aria-hidden="true" />
            <AirportSearch compact onPick={addPoint} placeholder={route.length === 0 ? "Departure airport (code or city)" : route.length === 1 ? "Destination airport" : "Add another airport"} />
          </div>
        )}
        {route.length === 0 && (
          <div className="fy-quick">
            <span className="fy-muted">Try:</span>
            <button type="button" className="fy-chip" onClick={() => setRoute([
              { id: "KAPA", name: "Centennial", lat: 39.5701, lon: -104.8493, elevFt: 5885, magVar: 8 },
              { id: "KCOS", name: "Colorado Springs", lat: 38.8058, lon: -104.7008, elevFt: 6187, magVar: 8 },
            ])}>KAPA → KCOS</button>
            <button type="button" className="fy-chip" onClick={() => setRoute([
              { id: "KFRG", name: "Republic, Farmingdale", lat: 40.7288, lon: -73.4134, elevFt: 82, magVar: -13 },
              { id: "KBOS", name: "Boston Logan", lat: 42.3656, lon: -71.0096, elevFt: 20, magVar: -15 },
            ])}>KFRG → KBOS</button>
            <button type="button" className="fy-chip" onClick={() => setRoute([
              { id: "KAUS", name: "Austin-Bergstrom", lat: 30.1945, lon: -97.6699, elevFt: 542, magVar: 4 },
              { id: "KPHX", name: "Phoenix Sky Harbor", lat: 33.4343, lon: -112.0116, elevFt: 1135, magVar: 10 },
            ])}>KAUS → KPHX (fuel stop)</button>
          </div>
        )}

        <div className="fy-settings">
          <label>
            <span>Aircraft</span>
            <select
              value={AIRCRAFT_PRESETS.some(a => a.id === aircraft.id) ? aircraft.id : "custom"}
              onChange={e => {
                const a = AIRCRAFT_PRESETS.find(x => x.id === e.target.value);
                if (a) patch({ aircraft: { ...a } });
              }}
            >
              {AIRCRAFT_PRESETS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              <option value="custom">My own numbers</option>
            </select>
          </label>
          <NumField label="Cruise TAS" unit="kt" value={aircraft.tas} onChange={v => patch(d => ({ aircraft: { ...d.aircraft, id: "custom", name: "Custom", tas: v } }))} min={40} max={600} />
          <NumField label="Fuel burn" unit="gph" value={aircraft.gph} step={0.5} onChange={v => patch(d => ({ aircraft: { ...d.aircraft, id: "custom", name: "Custom", gph: v } }))} min={1} max={400} />
          <NumField label="Usable fuel" unit="gal" value={aircraft.usableGal} onChange={v => patch(d => ({ aircraft: { ...d.aircraft, id: "custom", name: "Custom", usableGal: v } }))} min={5} max={5000} />
          <NumField label="Cruise altitude" unit="ft MSL" value={data.altitudeFt} step={500} onChange={v => patch({ altitudeFt: v })} min={1000} max={45000} />
          <label>
            <span>Departure</span>
            <input type="datetime-local" value={toLocalInput(departMs)} onChange={e => e.target.value && patch({ departAt: new Date(e.target.value).toISOString() })} />
          </label>
        </div>
        {route.length >= 2 && (
          <p className="fy-note">
            Magnetic course about {pad3(magCourse)}°: VFR cruising altitudes are {magCourse < 180 ? "odd thousands + 500 (3,500, 5,500…)" : "even thousands + 500 (4,500, 6,500…)"}.
            {night ? " Departure is after dark: 45-minute fuel reserve." : " Daytime departure: 30-minute fuel reserve."}
          </p>
        )}
      </section>

      {res.state === "error" && <ErrorNote onRetry={() => setAttempt(n => n + 1)}>{res.error}</ErrorNote>}
      {res.state === "loading" && !res.samples && <Loading>Checking winds and weather along the route…</Loading>}

      {plan && (
        <>
          <section className="fy-summary">
            <Stat icon={Route} label="Distance" value={`${Math.round(plan.totalNm)} nm`} />
            <Stat icon={Plane} label="Time en route" value={fmtMinutes(plan.totalMin)} sub={`Arrive ${fmtTime(plan.arriveAt, { weekday: "short" })}`} />
            <Stat icon={Fuel} label="Fuel" value={`${plan.fuelGal.toFixed(1)} gal`} sub={plan.fuelLeftGal >= (aircraft.gph * reserveMinutes(night)) / 60 ? `${plan.fuelLeftGal.toFixed(1)} gal left on landing` : "Needs a fuel stop"} warn={stops.length > 0} />
            <Stat icon={Wind} label="Average wind effect" value={(() => { const d = (plan.totalNm / plan.totalMin) * 60 - aircraft.tas; return `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))} kt`; })()} sub={res.profiles ? `at ${fmtAlt(data.altitudeFt)}` : (departMs - Date.now()) / 3600000 + plan.totalMin / 60 > 70 ? "No wind forecast that far out" : "Wind forecast unavailable right now"} />
          </section>

          <section className="fy-card fy-map-card">
            <FlyMap fit={route} fitKey={routeKey} route={route} markers={markers} hazards={onRoute.map(h => h.hazard)} label="Route map" height={420}>
              {(selectedMetar || selectedCand) && (
                <div className="fy-map-pop">
                  <button type="button" className="fy-icon-btn fy-pop-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
                  {selectedMetar ? <MetarCard metar={selectedMetar} /> : <p>{selectedCand?.name}</p>}
                  {selectedCand && !route.some(r => r.id === selectedCand.id) && (
                    <button type="button" className="fy-btn is-small" onClick={() => { insertStop(selectedCand); setSelected(null); }}>
                      <Plus size={14} /> Add {selectedCand.id} as a stop
                    </button>
                  )}
                </div>
              )}
            </FlyMap>
            <p className="fy-legend">
              <Cat value="VFR" small /> <Cat value="MVFR" small /> <Cat value="IFR" small /> <Cat value="LIFR" small /> Tap an airport for its weather. Shaded areas are hazards on your route.
            </p>
          </section>

          {groundFt > 0 && data.altitudeFt < groundFt + 1000 && (
            <section className="fy-card fy-callout is-hazard">
              <h2><AlertTriangle size={18} aria-hidden="true" /> {fmtAlt(data.altitudeFt)} is too low for this route</h2>
              <p className="fy-muted">The ground along the way rises to about {fmtAlt(Math.round(groundFt / 100) * 100)} MSL, and real peaks run higher than the forecast model's terrain. Pick a higher cruise altitude below, and check a sectional chart for the maximum elevation figures.</p>
            </section>
          )}

          {stops.length > 0 && (
            <section className="fy-card fy-callout is-fuel">
              <h2><Fuel size={18} aria-hidden="true" /> {stops.length === 1 ? "You'll need a fuel stop" : `You'll need ${stops.length} fuel stops`}</h2>
              <p className="fy-muted">With {aircraft.usableGal} gallons at {aircraft.gph} gph and a {reserveMinutes(night)}-minute reserve, you reach the reserve about {stops.map(s => `${Math.round(s.alongNm)} nm`).join(" and ")} along the route.</p>
              <ul className="fy-list">
                {stops.map((s, i) => (
                  <li key={i}>
                    {s.airport ? (
                      <>
                        <div>
                          <strong>{s.airport.id}</strong> {s.airport.name}
                          <span className="fy-muted"> · {Math.round(s.airport.alongNm)} nm along, {Math.round(s.airport.offNm)} nm off course</span>
                        </div>
                        <Cat value={s.airport.category} small />
                        <button type="button" className="fy-btn is-small" onClick={() => insertStop(s.airport)}>
                          <Plus size={14} /> Add stop
                        </button>
                      </>
                    ) : (
                      <span>No reporting airport near the {Math.round(s.alongNm)} nm mark — add a stop yourself.</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {onRoute.length > 0 && (
            <section className="fy-card fy-callout is-hazard">
              <h2><AlertTriangle size={18} aria-hidden="true" /> Hazards on this route</h2>
              <ul className="fy-list">
                {onRoute.map(h => (
                  <li key={h.hazard.id}>
                    <div>
                      <strong>{h.hazard.label}</strong> <span className="fy-muted">({h.hazard.kind}{h.hazard.severity ? `, ${h.hazard.severity.toLowerCase()}` : ""}{h.hazard.dueTo ? `, ${h.hazard.dueTo.toLowerCase()}` : ""})</span>
                      <div className="fy-muted">
                        From {Math.round(h.fromNm)} to {Math.round(h.toNm)} nm along
                        {h.hazard.baseFt !== null || h.hazard.topFt !== null ? ` · ${h.hazard.baseFt === 0 ? "surface" : fmtAlt(h.hazard.baseFt)} to ${fmtAlt(h.hazard.topFt)}` : ""}
                        {h.hazard.to ? ` · until ${fmtTime(h.hazard.to)}` : ""}
                      </div>
                    </div>
                    <span className={`fy-pill ${h.atAltitude ? "is-warn" : ""}`}>{h.atAltitude ? "At your altitude" : "Not at your altitude"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="fy-card">
            <div className="fy-row-between">
              <h2>Navigation log</h2>
              <button type="button" className="fy-btn is-small" onClick={saveFlight} disabled={saved}>
                <BookmarkPlus size={15} /> {saved ? "Saved — it's on your TaskFox calendar" : "Save flight"}
              </button>
            </div>
            <div className="fy-scroll-x">
              <table className="fy-table fy-navlog">
                <thead>
                  <tr>
                    <th>Leg</th>
                    <th>Course</th>
                    <th>Wind</th>
                    <th>Heading</th>
                    <th>GS</th>
                    <th>Dist</th>
                    <th>Time</th>
                    <th>Fuel</th>
                    <th>Arrive</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.legs.map((l, i) => (
                    <tr key={i}>
                      <th>{l.from.id} → {l.to.id}</th>
                      <td>{pad3(l.tc)}°T</td>
                      <td>{l.wind ? `${pad3(l.wind.dir)}° ${Math.round(l.wind.kt)} kt` : "—"}</td>
                      <td>{pad3(l.heading)}°T{l.magHeading !== null ? <small> / {pad3(l.magHeading)}°M</small> : null}</td>
                      <td>{Math.round(l.gs)} kt</td>
                      <td>{Math.round(l.distNm)} nm</td>
                      <td>{fmtMinutes(l.minutes)}</td>
                      <td>{l.fuelGal.toFixed(1)} gal</td>
                      <td>{fmtTime(l.arriveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {altitudeOptions.length > 1 && (
              <>
                <h3>Which altitude is fastest?</h3>
                <div className="fy-alts">
                  {altitudeOptions.map(o => (
                    <button key={o.alt} type="button" className={`fy-alt${o.alt === data.altitudeFt ? " is-on" : ""}${o === fastest ? " is-best" : ""}`} onClick={() => patch({ altitudeFt: o.alt })}>
                      <strong>{o.alt.toLocaleString()} ft</strong>
                      <span>{fmtMinutes(o.totalMin)}</span>
                      {o === fastest && <em>Fastest</em>}
                    </button>
                  ))}
                </div>
                <p className="fy-muted">Same aircraft and departure time, using the forecast winds at each VFR cruising altitude at least 1,000 ft above the highest ground along the route (about {fmtAlt(Math.round(groundFt / 100) * 100)}). Higher can be smoother and faster, but check charts, clouds, oxygen and the freezing level.</p>
              </>
            )}
          </section>

          <LandingSpots
            spots={candidates}
            plan={plan}
            route={route}
            aircraft={aircraft}
            departMs={departMs}
            loading={details.state === "loading"}
            onAdd={insertStop}
            onShow={id => {
              setSelected(id);
              document.querySelector(".fy-map-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />

          <TripWeather route={route} routeKey={routeKey} plan={plan} samples={res.samples} altitudeFt={data.altitudeFt} departMs={departMs} />

          <section className="fy-card">
            <h2>Airport weather along the way</h2>
            {candidates.length === 0 ? (
              <p className="fy-muted">No airports with weather reports within 25 nm of the route.</p>
            ) : (
              <ul className="fy-along">
                {(allAlong ? candidates : shortList(candidates, route)).map(c => (
                  <li key={c.id} className={route.some(r => r.id === c.id) ? "is-waypoint" : ""}>
                    <span className="fy-along-nm">{Math.round(c.alongNm)} nm</span>
                    <Cat value={c.category} small />
                    <button type="button" className="fy-link" onClick={() => setSelected(c.id)}>
                      <strong>{c.id}</strong> {c.name}
                    </button>
                    <span className="fy-muted fy-along-wx">
                      {fmtWind(c.windDir, c.windKt, c.gustKt)} · {fmtVis(c.visSm)}{c.ceilingFt !== null ? ` · ceiling ${c.ceilingFt.toLocaleString()}` : ""}
                      {c.offNm >= 2 ? ` · ${Math.round(c.offNm)} nm off` : ""}
                    </span>
                    {!route.some(r => r.id === c.id) && (
                      <button type="button" className="fy-icon-btn" onClick={() => insertStop(c)} aria-label={`Add ${c.id} as a stop`} title="Add as a stop">
                        <Plus size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!allAlong && candidates.length > 14 && (
              <button type="button" className="fy-btn is-ghost is-small" onClick={() => setAllAlong(true)}>
                Show all {candidates.length} airports
              </button>
            )}
          </section>

          <section className="fy-two">
            {[route[0], route[route.length - 1]].map((p, i) => {
              const m = metarById.get(p.id);
              const t = res.tafs?.find(x => x.id === p.id);
              return (
                <div key={p.id + i} className="fy-stack is-tight">
                  {m ? <MetarCard metar={m} title={`${i === 0 ? "Departure" : "Destination"} · ${p.id}`} /> : <article className="fy-metar"><p className="fy-muted">{p.id}: no current weather report.</p></article>}
                  {t && <TafCard taf={t} />}
                </div>
              );
            })}
          </section>
          <p className="fy-disclaimer">For planning and learning. Get an official weather briefing (1800wxbrief.com or 1-800-WX-BRIEF), check NOTAMs and TFRs, and use current charts before every flight.</p>
        </>
      )}

      {data.flights.length > 0 && (
        <section className="fy-card">
          <h2>Saved flights</h2>
          <ul className="fy-list">
            {data.flights.map(fl => (
              <li key={fl.id}>
                <button type="button" className="fy-link" onClick={() => patch({ route: fl.route, altitudeFt: fl.altitudeFt, departAt: fl.departAt && Date.parse(fl.departAt) > Date.now() ? fl.departAt : null })}>
                  <strong>{fl.route.map(p => p.id).join(" → ")}</strong>
                </button>
                <span className="fy-muted">{fl.departAt ? new Date(fl.departAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : ""}{fl.minutes ? ` · ${fmtMinutes(fl.minutes)}` : ""}</span>
                <button type="button" className="fy-icon-btn" onClick={() => patch(d => ({ flights: d.flights.filter(x => x.id !== fl.id) }))} aria-label="Delete saved flight"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// About a dozen airports spread evenly along the route, always keeping your own stops.
function shortList(list, route, max = 14) {
  if (list.length <= max) return list;
  const ids = new Set(route.map(p => p.id));
  const span = (list[list.length - 1].alongNm - list[0].alongNm) / (max - 1) || 1;
  const out = [];
  let next = -Infinity;
  for (const c of list) {
    if (ids.has(c.id) || c.alongNm >= next) {
      out.push(c);
      if (!ids.has(c.id)) next = c.alongNm + span;
    }
  }
  return out;
}

function Stat({ icon: Icon, label, value, sub, warn }) {
  return (
    <div className={`fy-stat${warn ? " is-warn" : ""}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function NumField({ label, unit, value, onChange, min, max, step = 1 }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label>
      <span>{label}</span>
      <span className="fy-num">
        <input
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(v) && v >= min && v <= max) onChange(v);
          }}
        />
        <em>{unit}</em>
      </span>
    </label>
  );
}
