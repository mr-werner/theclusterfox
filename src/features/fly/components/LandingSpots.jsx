import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Fuel, MapPin, Plus, RadioTower } from "lucide-react";

import { fetchThingsToDo } from "../tripApi";
import { fmtMinutes } from "../model/nav";
import { pickLandingSpots, timeAtAlong } from "../model/trip";
import { Cat, ErrorNote, Loading } from "./ui";
import { fmtTime } from "./format";

const LEVEL_TEXT = { good: "Good stop", ok: "Can land", short: "Runway too short", no: "Not open to you" };

/**
 * Realistic places to land along a planned route: one good airport for
 * each stretch (public, a runway long enough for your plane, fuel), when
 * you'd get there, and what there is to do nearby.
 */
export default function LandingSpots({ spots, plan, route, aircraft, departMs, loading, onAdd, onShow }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(null);
  const onRoute = new Set(route.map(p => p.id));
  const picks = pickLandingSpots(spots.filter(s => !onRoute.has(s.id)), plan.totalNm);
  const fits = spots.filter(s => !onRoute.has(s.id) && (s.landing?.level === "good" || s.landing?.level === "ok"));
  const list = showAll ? fits : picks;
  const ruledOut = spots.filter(s => s.landing?.level === "short" || s.landing?.level === "no").length;

  return (
    <section className="fy-card fy-land">
      <div className="fy-row-between">
        <h2>Places to land along the way</h2>
        {fits.length > picks.length && (
          <button type="button" className="fy-btn is-ghost is-small" onClick={() => setShowAll(v => !v)}>
            {showAll ? "Suggested stops only" : `All ${fits.length} that fit`}
          </button>
        )}
      </div>
      <p className="fy-muted">
        Public airports near your route with a runway long enough for the {aircraft.name ?? "aircraft"}, best first in each stretch of the trip. Tap one to see what's nearby.
        {ruledOut > 0 && ` ${ruledOut} nearby ${ruledOut === 1 ? "field was" : "fields were"} left out: runway too short, military or private.`}
      </p>
      {loading && !spots.some(s => s.landing) && <Loading>Checking runways along the route…</Loading>}
      {!loading && list.length === 0 && <p className="fy-muted">No public airports with weather reports and a long enough runway within 25 nm of this route. Try a route through bigger towns, or look at a sectional chart for smaller fields.</p>}
      <ul className="fy-land-list">
        {list.map(s => {
          const at = timeAtAlong(plan, s.alongNm);
          const isOpen = open === s.id;
          return (
            <li key={s.id} className={`fy-land-item is-${s.landing?.level ?? "unknown"}${isOpen ? " is-open" : ""}`}>
              <div className="fy-land-row">
                <button type="button" className="fy-land-main" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                  <span className="fy-land-when">
                    <strong>{at ? fmtMinutes((at - departMs) / 60000) : "—"}</strong>
                    <small>{at ? fmtTime(at) : ""}</small>
                  </span>
                  <span className="fy-land-name">
                    <strong>{s.id}</strong> {s.name}
                    <small className="fy-muted">
                      {Math.round(s.alongNm)} nm along{s.offNm >= 2 ? `, ${Math.round(s.offNm)} nm off course` : ""}
                    </small>
                  </span>
                  {isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                </button>
                <span className="fy-land-tags">
                  <span className={`fy-pill is-${s.landing?.level ?? "unknown"}`}>{LEVEL_TEXT[s.landing?.level] ?? "Checking…"}</span>
                  {s.landing?.longestFt && <span className="fy-pill">{s.landing.longestFt.toLocaleString()} ft {s.landing.paved ? "paved" : "unpaved"}</span>}
                  {s.fuel && <span className="fy-pill"><Fuel size={12} aria-hidden="true" /> Fuel</span>}
                  {s.towered && <span className="fy-pill"><RadioTower size={12} aria-hidden="true" /> Tower</span>}
                  <Cat value={s.category} small />
                </span>
              </div>
              {isOpen && <Nearby spot={s} onAdd={() => onAdd(s)} onShow={() => onShow(s.id)} />}
            </li>
          );
        })}
      </ul>
      <p className="fy-muted fy-small">Runway, fuel and tower details are from the FAA airport data on aviationweather.gov. Check the chart supplement and NOTAMs before you plan to land, and call ahead for fuel and transport.</p>
    </section>
  );
}

// Things to do near one airport, looked up when it's opened.
function Nearby({ spot, onAdd, onShow }) {
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setState({ status: "loading" });
    fetchThingsToDo(spot, { signal: ctl.signal })
      .then(r => setState({ status: "ready", ...r }))
      .catch(e => e.name !== "AbortError" && setState({ status: "error", error: e.message }));
    return () => ctl.abort();
  }, [spot.id, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const faa = spot.faaId ?? spot.id.replace(/^K(?=[A-Z0-9]{3}$)/, "");
  const maps = `https://www.google.com/maps/search/things+to+do/@${spot.lat},${spot.lon},12z`;
  return (
    <div className="fy-land-more">
      {spot.landing?.notes?.length > 0 && <p className="fy-muted">{spot.landing.notes.join(" · ")}</p>}
      <div className="fy-land-actions">
        <button type="button" className="fy-btn is-small" onClick={onAdd}>
          <Plus size={14} /> Add {spot.id} as a stop
        </button>
        <button type="button" className="fy-btn is-ghost is-small" onClick={onShow}>
          <MapPin size={14} /> Weather here
        </button>
        <a className="fy-btn is-ghost is-small" href={`https://www.airnav.com/airport/${faa}`} target="_blank" rel="noreferrer">
          FBOs, fuel prices, courtesy cars <ExternalLink size={13} />
        </a>
      </div>
      <h3>What's nearby</h3>
      {state.status === "loading" && <Loading>Looking for things to do near {spot.id}…</Loading>}
      {state.status === "error" && <ErrorNote onRetry={() => setAttempt(n => n + 1)}>{state.error}</ErrorNote>}
      {state.status === "ready" && state.places.length === 0 && <p className="fy-muted">Nothing listed close by. Try the map link below.</p>}
      {state.status === "ready" && state.places.length > 0 && (
        <ul className="fy-places">
          {state.places.map(p => (
            <li key={p.id}>
              {p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <span className={`fy-place-icon is-${p.kind.toLowerCase()}`} aria-hidden="true">{p.kind[0]}</span>}
              <div>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <strong>{p.name}</strong>
                  </a>
                ) : (
                  <strong>{p.name}</strong>
                )}
                <small className="fy-muted">
                  {p.kind} · {fmtMiles(p.distNm)} from the field{p.detail ? ` · ${p.detail}` : ""}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
      {state.status === "ready" && state.partial && <p className="fy-muted fy-small">One of the place lists didn't answer, so this may be short.</p>}
      <p className="fy-small">
        <a href={maps} target="_blank" rel="noreferrer">
          More things to do on the map <ExternalLink size={12} />
        </a>
        <span className="fy-muted"> · Places from Wikipedia and OpenStreetMap.</span>
      </p>
    </div>
  );
}

const fmtMiles = nm => {
  const mi = nm * 1.15078;
  return mi < 0.5 ? "a short walk" : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
};
