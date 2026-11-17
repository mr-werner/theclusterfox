import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FileUp, Mountain, Route } from "lucide-react";

import { findTrails, loadTrail, trailFromGpx } from "../api";
import { parseGpx } from "../model/gpx";
import { defaultLayer } from "../model/tiles";
import { upsertTrail } from "../state/hikeStore";
import { SAC_TEXT } from "../model/profile";
import HikeMap from "./HikeMap";
import { ErrorNote, Loading, PlaceSearch } from "./ui";

const RADII = [5, 12, 25];

// Find a trail: search a place (or use where you are), see the hiking
// routes and named trails around it from OpenStreetMap, and open one.
export default function FindTab({ h, f, openTrail }) {
  const { data, patch } = h;
  const place = data.place;
  const [radius, setRadius] = useState(12);
  const [state, setState] = useState({ status: "idle", trails: [], error: null });
  const [opening, setOpening] = useState(null);
  const [openError, setOpenError] = useState(null);
  const [layer, setLayer] = useState(() => (place ? defaultLayer(place.lat, place.lon) : "otm"));
  const [selected, setSelected] = useState(null);
  const ctl = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!place) return undefined;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setState(s => ({ ...s, status: "loading", error: null }));
    findTrails(place, radius, { signal: c.signal })
      .then(trails => setState({ status: "done", trails, error: null }))
      .catch(err => err.name !== "AbortError" && setState({ status: "error", trails: [], error: err.message }));
    return () => c.abort();
  }, [place?.lat, place?.lon, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(item) {
    setSelected(item.ref);
    setOpening(item.ref);
    setOpenError(null);
    try {
      const trail = await loadTrail(item);
      patch(d => ({ trails: upsertTrail(d.trails, { ...trail, viewedAt: new Date().toISOString() }) }));
      openTrail(trail.id);
    } catch (err) {
      setOpenError(err.message);
    } finally {
      setOpening(null);
    }
  }

  async function importGpx(file) {
    setOpenError(null);
    try {
      if (file.size > 15e6) throw new Error("That file is too big for a trail.");
      const gpx = parseGpx(await file.text());
      setOpening("gpx");
      const trail = await trailFromGpx(gpx);
      patch(d => ({ trails: upsertTrail(d.trails, { ...trail, saved: true, savedAt: new Date().toISOString(), viewedAt: new Date().toISOString() }) }));
      openTrail(trail.id);
    } catch (err) {
      setOpenError(err.message);
    } finally {
      setOpening(null);
    }
  }

  const trails = state.trails;
  const lines = useMemo(
    () =>
      trails
        .filter(t => t.line)
        .map(t => ({ id: t.ref, points: t.line, className: t.ref === selected ? "is-on" : "is-result", title: t.name, onClick: () => open(t) })),
    [trails, selected] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const markers = trails
    .filter(t => t.kind === "route")
    .map(t => ({ id: t.ref, lat: t.lat, lon: t.lon, kind: "route", label: t.name.length > 26 ? `${t.name.slice(0, 24)}…` : t.name, selected: t.ref === selected, onClick: () => open(t) }));
  const fit = place ? [[place.lat - radius / 160, place.lon - radius / 120], [place.lat + radius / 160, place.lon + radius / 120]] : [];

  return (
    <div className="hk-find">
      <section className="hk-hero">
        <p className="hk-kicker">Plan a hike</p>
        <h1>Find a trail, pick the best time to go and pack the right gear.</h1>
        <PlaceSearch onPick={p => { patch({ place: p }); setLayer(defaultLayer(p.lat, p.lon)); setSelected(null); }} />
        <div className="hk-find-extra">
          <button type="button" className="hk-link" onClick={() => fileRef.current?.click()}>
            <FileUp size={15} aria-hidden="true" /> Open a GPX file
          </button>
          <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden onChange={e => e.target.files?.[0] && importGpx(e.target.files[0])} />
          <span className="hk-muted">Have a route from another app or a friend? Open it here.</span>
        </div>
      </section>

      <ErrorNote>{openError}</ErrorNote>
      {opening && <Loading>{opening === "gpx" ? "Reading your GPX file…" : "Getting the trail, its elevation and what's along it…"}</Loading>}

      {place ? (
        <div className="hk-find-grid">
          <div className="hk-find-map">
            <HikeMap layer={layer} onLayer={setLayer} fit={fit} fitKey={`${place.lat},${place.lon},${radius}`} lines={lines} markers={markers} height={460} label={`Trails near ${place.name}`} />
          </div>
          <div className="hk-find-list">
            <div className="hk-find-head">
              <h2>
                Trails near {place.name}
                {state.status === "done" && <small>{trails.length}</small>}
              </h2>
              <div className="hk-seg" role="group" aria-label="Search radius">
                {RADII.map(r => (
                  <button key={r} type="button" className={r === radius ? "is-on" : ""} aria-pressed={r === radius} onClick={() => setRadius(r)}>
                    {f.distUnit === "mi" ? `${Math.round(r / 1.609)} mi` : `${r} km`}
                  </button>
                ))}
              </div>
            </div>
            {state.status === "loading" && <Loading>Looking up trails in OpenStreetMap…</Loading>}
            <ErrorNote onRetry={() => setRadius(r => r)}>{state.error}</ErrorNote>
            {state.status === "done" && !trails.length && <p className="hk-muted">No mapped trails here. Try a wider radius or a nearby park.</p>}
            <ul className="hk-results">
              {trails.map(t => (
                <li key={t.ref}>
                  <button type="button" className={`hk-result${t.ref === selected ? " is-on" : ""}`} onClick={() => open(t)} disabled={Boolean(opening)}>
                    <span className="hk-result-icon" aria-hidden="true">{t.kind === "route" ? <Route size={18} /> : <Mountain size={18} />}</span>
                    <span className="hk-result-text">
                      <strong>{t.name}</strong>
                      <span>
                        {[t.lengthM ? f.dist(t.lengthM) + (t.kind === "path" ? " one way" : "") : null, t.kind === "route" ? `${t.network ? `${t.network} ` : ""}hiking route` : "Trail", `${f.short(t.away)} away`].filter(Boolean).join(" · ")}
                      </span>
                      {t.sac && <small>{SAC_TEXT[t.sac] ?? t.sac}</small>}
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="hk-fine">Trails © OpenStreetMap contributors. Always check with the land manager for closures and permits.</p>
          </div>
        </div>
      ) : (
        <RecentTrails h={h} f={f} openTrail={openTrail} />
      )}
      {place && <RecentTrails h={h} f={f} openTrail={openTrail} compact />}
    </div>
  );
}

function RecentTrails({ h, openTrail, compact }) {
  const list = h.data.trails.slice(0, compact ? 6 : 8);
  if (!list.length)
    return (
      <section className="hk-empty">
        <Mountain size={28} aria-hidden="true" />
        <p>Search for a town, park or mountain to see the trails around it. TrailFox uses OpenStreetMap, so it covers trails around the world.</p>
      </section>
    );
  return (
    <section className="hk-recent">
      <h2>{compact ? "Your trails" : "Pick up where you left off"}</h2>
      <div className="hk-chips">
        {list.map(t => (
          <button key={t.id} type="button" className="hk-chip" onClick={() => openTrail(t.id)}>
            {t.name}
            {t.plan && <small>{new Date(`${t.plan.day}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
