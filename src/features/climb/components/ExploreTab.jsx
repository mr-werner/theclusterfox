import { useEffect, useState } from "react";
import { Bookmark, Clock, LocateFixed, MapPin, Mountain, Search, X } from "lucide-react";

import { searchPlaces } from "../../../services/weather/openMeteo";
import { cragsWithin, searchAreas } from "../api";
import { DESTINATIONS } from "../data/destinations";
import ClimbMap from "./ClimbMap";
import { ErrorNote, Spinner } from "./ui";

// Find somewhere to climb: search by crag or by town, browse the map, or
// start from a famous destination. Tapping a crag opens its area page.
export default function ExploreTab({ c, openArea }) {
  const { data } = c;
  const [text, setText] = useState("");
  const [results, setResults] = useState(null); // { areas, places, error }
  const [fit, setFit] = useState({ key: "start", points: [] });
  const [crags, setCrags] = useState({ view: null, list: [], error: null });
  const [view, setView] = useState(null);
  const [locating, setLocating] = useState(false);

  // Search areas and places as you type.
  useEffect(() => {
    const t = text.trim();
    if (t.length < 3) return undefined;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      Promise.allSettled([searchAreas(t, { signal: ctrl.signal }), searchPlaces(t, { signal: ctrl.signal })]).then(([a, p]) => {
        if (ctrl.signal.aborted) return;
        setResults({
          text: t,
          areas: a.status === "fulfilled" ? a.value.slice(0, 12) : [],
          places: p.status === "fulfilled" ? p.value.slice(0, 4) : [],
          error: a.status === "rejected" ? a.reason.message : null,
        });
      });
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [text]);

  // Load the crags in view once the map is zoomed in enough to matter.
  useEffect(() => {
    if (!view || view.zoom < 8) return undefined;
    const ctrl = new AbortController();
    cragsWithin(view.bbox, view.zoom, { signal: ctrl.signal })
      .then(list => setCrags({ view, list: list.filter(a => a.totalClimbs > 0), error: null }))
      .catch(e => e.name !== "AbortError" && setCrags({ view, list: [], error: e.message }));
    return () => ctrl.abort();
  }, [view]);

  function goTo(lat, lng, key) {
    setFit({ key, points: [{ lat: lat - 0.12, lng: lng - 0.15 }, { lat: lat + 0.12, lng: lng + 0.15 }] });
    setText("");
    setResults(null);
    document.querySelector(".cb-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function nearMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        goTo(pos.coords.latitude, pos.coords.longitude, `me${Date.now()}`);
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  const searching = text.trim().length >= 3;
  const shown = searching && results?.text === text.trim() ? results : null;
  const zoomedOut = !view || view.zoom < 8;
  const loadingCrags = !zoomedOut && crags.view !== view;
  // Keep showing the last crags while the next box loads.
  const list = zoomedOut ? [] : [...crags.list].sort((a, b) => b.totalClimbs - a.totalClimbs);

  return (
    <div className="cb-explore">
      <section className="cb-hero">
        <p className="cb-kicker">Climbing routes, packaged</p>
        <h1>Where are you climbing?</h1>
        <p className="cb-muted">Every route in OpenBeta's open database, with the week's climbing conditions, a gear list and a plan that lands on your calendar.</p>
        <div className="cb-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder="A crag, area or town: Muir Valley, Bishop, Boulder…" aria-label="Search crags and places" />
          {text && (
            <button type="button" onClick={() => setText("")} aria-label="Clear">
              <X size={16} />
            </button>
          )}
          <button type="button" className="cb-near" onClick={nearMe} disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" /> {locating ? "Finding you…" : "Near me"}
          </button>
        </div>

        {searching && !shown && <Spinner>Searching…</Spinner>}
        {shown && (
          <div className="cb-results">
            <ErrorNote error={shown.error} />
            {shown.areas.length > 0 && (
              <ul className="cb-list">
                {shown.areas.map(a => (
                  <li key={a.uuid}>
                    <button type="button" className="cb-row" onClick={() => openArea(a.uuid)}>
                      <Mountain size={16} aria-hidden="true" />
                      <span className="cb-row-main">
                        <strong>{a.name}</strong>
                        <small>{a.path.slice(0, -1).join(" › ")}</small>
                      </span>
                      <span className="cb-row-count">{a.totalClimbs.toLocaleString()} routes</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {shown.places.length > 0 && (
              <ul className="cb-list">
                {shown.places.map(p => (
                  <li key={p.id}>
                    <button type="button" className="cb-row" onClick={() => goTo(p.latitude, p.longitude, p.id)}>
                      <MapPin size={16} aria-hidden="true" />
                      <span className="cb-row-main">
                        <strong>Crags near {p.name}</strong>
                        <small>{p.region}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!shown.areas.length && !shown.places.length && !shown.error && <p className="cb-muted">Nothing by that name. Try a nearby town and browse the map.</p>}
          </div>
        )}
      </section>

      {(data.saved.length > 0 || data.recent.length > 0) && (
        <section className="cb-section">
          <div className="cb-chips">
            {data.saved.map(a => (
              <button type="button" key={`s${a.uuid}`} className="cb-chip is-saved" onClick={() => openArea(a.uuid)}>
                <Bookmark size={14} aria-hidden="true" /> {a.name}
              </button>
            ))}
            {data.recent
              .filter(r => !data.saved.some(s => s.uuid === r.uuid))
              .slice(0, 6)
              .map(a => (
                <button type="button" key={`r${a.uuid}`} className="cb-chip" onClick={() => openArea(a.uuid)}>
                  <Clock size={14} aria-hidden="true" /> {a.name}
                </button>
              ))}
          </div>
        </section>
      )}

      <section className="cb-section">
        <div className="cb-section-head">
          <h2>Map</h2>
          <span className="cb-muted">{zoomedOut ? "Zoom in, search a town or tap Near me to see crags." : loadingCrags ? "Loading crags…" : `${list.length} crags in view`}</span>
        </div>
        <ClimbMap
          fit={fit.points}
          fitKey={fit.key}
          maxFitZoom={11}
          height={420}
          onMove={setView}
          pins={
            zoomedOut
              ? DESTINATIONS.map(d => ({ id: d.uuid, lat: d.lat, lng: d.lng, count: 40, label: d.name, title: `${d.name}: ${d.style}`, onClick: () => openArea(d.uuid) }))
              : list.map(a => ({ id: a.uuid, lat: a.lat, lng: a.lng, count: a.totalClimbs, label: a.name, boulder: a.boulder, title: `${a.name}: ${a.totalClimbs} routes`, onClick: () => openArea(a.uuid) }))
          }
        />
        {!zoomedOut && <ErrorNote error={crags.error} />}
        {list.length > 0 && (
          <ul className="cb-list cb-list--grid">
            {list.slice(0, 24).map(a => (
              <li key={a.uuid}>
                <button type="button" className="cb-row" onClick={() => openArea(a.uuid)}>
                  <span className="cb-row-main">
                    <strong>{a.name}</strong>
                    <small>{a.path.slice(-3, -1).join(" › ")}</small>
                  </span>
                  <span className="cb-row-count">{a.totalClimbs}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cb-section">
        <h2>Famous destinations</h2>
        <div className="cb-dest">
          {DESTINATIONS.map(d => (
            <button type="button" key={d.uuid} className="cb-destcard" onClick={() => openArea(d.uuid)}>
              <strong>{d.name}</strong>
              <span>{d.where}</span>
              <small>{d.style}</small>
            </button>
          ))}
        </div>
      </section>

      <p className="cb-credit">
        Route data from <a href="https://openbeta.io" target="_blank" rel="noreferrer">OpenBeta</a>, the open climbing database (public domain). Know a route's beta? Add it there and it shows up here.
      </p>
    </div>
  );
}
