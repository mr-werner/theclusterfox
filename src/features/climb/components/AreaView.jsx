import { useEffect, useMemo, useState } from "react";
import { Bookmark, CalendarPlus, ExternalLink, Navigation } from "lucide-react";

import { DEEP_LIMIT, getAllRoutes, getArea, openBetaArea } from "../api";
import { BANDS } from "../model/grades";
import { addRouteToTrip, areaSnap, newTrip, pushRecent } from "../state/climbStore";
import ClimbMap from "./ClimbMap";
import RouteList from "./RouteList";
import { directionsHref, localDay, TYPE_NAMES } from "./format";
import { Breadcrumbs, ConditionsStrip, DayDetail, ErrorNote, Spinner } from "./ui";
import { useConditions } from "./useConditions";

// One area: where it is, the week's climbing conditions, its walls and
// every route under it with filters, plus one tap to plan a day here.
export default function AreaView({ uuid, c, openArea, openRoute, openTrip }) {
  const { data, patch } = c;
  const [state, setState] = useState({ uuid: null, area: null, error: null });
  const [deep, setDeep] = useState({ uuid: null, routes: null, error: null });
  const [picked, setPicked] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    getArea(uuid, { signal: ctrl.signal })
      .then(area => {
        setState({ uuid, area, error: null });
        patch(d => ({ recent: pushRecent(d.recent, area) }));
      })
      .catch(e => e.name !== "AbortError" && setState({ uuid, area: null, error: e.message }));
    return () => ctrl.abort();
  }, [uuid, patch, retry]);

  const area = state.uuid === uuid ? state.area : null;
  const wantDeep = area && area.children.length > 0 && area.totalClimbs > 0 && area.totalClimbs <= DEEP_LIMIT;

  useEffect(() => {
    if (!wantDeep) return undefined;
    const ctrl = new AbortController();
    getAllRoutes(uuid, { signal: ctrl.signal })
      .then(routes => setDeep({ uuid, routes, error: null }))
      .catch(e => e.name !== "AbortError" && setDeep({ uuid, routes: null, error: e.message }));
    return () => ctrl.abort();
  }, [uuid, wantDeep]);

  const cond = useConditions(area?.lat, area?.lng, area?.path);
  const today = localDay();
  const bestDay = useMemo(() => (cond.days ?? []).slice(0, 7).reduce((b, d) => (!b || d.score > b.score ? d : b), null), [cond.days]);

  if (state.uuid !== uuid && !state.error) return <Spinner>Opening area…</Spinner>;
  if (!area) return <ErrorNote error={state.error} onRetry={() => setRetry(r => r + 1)} />;

  const saved = data.saved.some(s => s.uuid === uuid);
  const routes = area.children.length === 0 ? area.climbs.map(r => ({ ...r, wall: "" })) : deep.uuid === uuid ? deep.routes : null;
  const disciplines = Object.entries(area.disciplines).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const bandTotal = BANDS.reduce((a, b) => a + (area.bands[b.id] ?? 0), 0) || 1;
  const childPins = area.children.filter(ch => Number.isFinite(ch.lat));
  const myTodo = data.todo.filter(t => routes?.some(r => r.uuid === t.uuid) || t.areaUuid === uuid);

  function planDay() {
    const day = picked ?? (bestDay && bestDay.score >= 42 ? bestDay.day : null) ?? localDay(new Date(Date.now() + 864e5));
    const trip = newTrip(area, day, myTodo.slice(0, 12));
    patch(d => ({ trips: [...d.trips, trip] }));
    openTrip(trip.id);
  }

  function addToPlan(route) {
    const defaultDay = picked ?? bestDay?.day ?? localDay(new Date(Date.now() + 864e5));
    const { trips, trip } = addRouteToTrip(data.trips, route, area, today, defaultDay);
    patch({ trips });
    c.toast(`${route.name} is on your plan for ${area.name}`, trip.id);
  }

  const pickedDay = cond.days?.find(d => d.day === picked) ?? bestDay;

  return (
    <article className="cb-area">
      <header className="cb-area-head">
        <Breadcrumbs path={area.path} ancestors={area.ancestors} onArea={openArea} />
        <h1>{area.name}</h1>
        <p className="cb-stats">
          <strong>{area.totalClimbs.toLocaleString()}</strong> routes
          {disciplines.slice(0, 4).map(([k, n]) => (
            <span key={k}>
              {n.toLocaleString()} {(TYPE_NAMES[k === "boulder" ? "bouldering" : k] ?? k).toLowerCase()}
            </span>
          ))}
        </p>
        <div className="cb-actions">
          <button type="button" className="cb-btn" onClick={planDay}>
            <CalendarPlus size={16} aria-hidden="true" /> Plan a day here
          </button>
          <button type="button" className={`cb-btn cb-btn--ghost${saved ? " is-on" : ""}`} aria-pressed={saved} onClick={() => patch(d => ({ saved: saved ? d.saved.filter(s => s.uuid !== uuid) : [areaSnap(area), ...d.saved] }))}>
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" /> {saved ? "Saved" : "Save"}
          </button>
          {Number.isFinite(area.lat) && (
            <a className="cb-btn cb-btn--ghost" href={directionsHref(area.lat, area.lng)} target="_blank" rel="noreferrer">
              <Navigation size={16} aria-hidden="true" /> Directions
            </a>
          )}
          <a className="cb-btn cb-btn--ghost" href={openBetaArea(uuid)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> OpenBeta
          </a>
        </div>
      </header>

      {Number.isFinite(area.lat) && (
        <section className="cb-section">
          <div className="cb-section-head">
            <h2>Climbing conditions</h2>
            <button type="button" className="cb-link" onClick={() => patch(d => ({ units: d.units === "us" ? "metric" : "us" }))}>
              {data.units === "us" ? "°F" : "°C"}
            </button>
          </div>
          <ConditionsStrip cond={cond} units={data.units} onPick={setPicked} picked={pickedDay?.day} />
          <DayDetail day={pickedDay} units={data.units} sandstone={cond.sandstone} />
        </section>
      )}

      <div className="cb-area-grid">
        <section className="cb-section">
          <h2>Difficulty</h2>
          <div className="cb-bands">
            {BANDS.map(b => {
              const n = area.bands[b.id] ?? 0;
              return (
                <div key={b.id} className={`cb-bandrow cb-band--${b.id}`}>
                  <span>{b.name}</span>
                  <span className="cb-bar">
                    <i style={{ width: `${(n / bandTotal) * 100}%` }} />
                  </span>
                  <small>{n}</small>
                </div>
              );
            })}
          </div>
          {area.description && <p className="cb-prose">{area.description}</p>}
          {area.approach && (
            <>
              <h3>Getting there</h3>
              <p className="cb-prose">{area.approach}</p>
            </>
          )}
        </section>

        {area.children.length > 0 && (
          <section className="cb-section">
            <h2>
              {area.children.length} {area.children.every(ch => ch.leaf) ? "walls and boulders" : "areas"}
            </h2>
            {childPins.length > 1 && <ClimbMap fit={childPins} fitKey={uuid} maxFitZoom={16} height={260} pins={childPins.map(ch => ({ id: ch.uuid, lat: ch.lat, lng: ch.lng, count: ch.totalClimbs, label: ch.name, title: `${ch.name}: ${ch.totalClimbs} routes`, boulder: ch.boulder, onClick: () => openArea(ch.uuid) }))} label={`Map of ${area.name}`} />}
            <ul className="cb-list cb-list--compact">
              {area.children.map(ch => (
                <li key={ch.uuid}>
                  <button type="button" className="cb-row" onClick={() => openArea(ch.uuid)}>
                    <span className="cb-row-main">
                      <strong>{ch.name}</strong>
                    </span>
                    <span className="cb-row-count">{ch.totalClimbs}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="cb-section">
        <h2>Routes</h2>
        {routes ? (
          routes.length ? <RouteList routes={routes} c={c} openRoute={openRoute} showWall={area.children.length > 0} onAddToPlan={addToPlan} /> : <p className="cb-muted">No routes listed here yet.</p>
        ) : wantDeep ? (
          deep.error ? <ErrorNote error={deep.error} /> : <Spinner>Gathering all {area.totalClimbs.toLocaleString()} routes…</Spinner>
        ) : (
          <p className="cb-muted">This is a big region. Pick an area above to list its routes.</p>
        )}
      </section>
    </article>
  );
}
