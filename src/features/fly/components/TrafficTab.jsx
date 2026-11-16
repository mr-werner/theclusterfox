import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LocateFixed, Pause, Play, Search } from "lucide-react";

import { fetchTraffic } from "../api";
import { pad3 } from "../model/nav";
import FlyMap from "./FlyMap";
import { AirportSearch, ErrorNote, Loading } from "./ui";
import { fmtAlt } from "./format";

// Live aircraft near a spot, or one flight by callsign, from the open
// adsb.lol network. Refreshes every 10 seconds while it's showing.
const RADII = [10, 25, 50];
const REFRESH_MS = 10000;

export default function TrafficTab({ f }) {
  const { data } = f;
  const [center, setCenter] = useState(() => (data.home ? { lat: data.home.lat, lon: data.home.lon, name: data.home.name } : null));
  const [radius, setRadius] = useState(25);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState(null); // { kind, value }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const tick = useRef(0);

  const params = useMemo(() => {
    if (lookup) return { [lookup.kind]: lookup.value };
    if (center) return { lat: center.lat.toFixed(3), lon: center.lon.toFixed(3), dist: radius };
    return null;
  }, [lookup, center, radius]);

  useEffect(() => {
    if (!params) return undefined;
    let ctl = new AbortController();
    let timer;
    const run = async () => {
      try {
        const body = await fetchTraffic(params, { signal: ctl.signal });
        setResult(body);
        setError(null);
        tick.current += 1;
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      }
      if (live && document.visibilityState !== "hidden") timer = setTimeout(() => { ctl = new AbortController(); run(); }, REFRESH_MS);
    };
    run();
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [params, live]);

  const aircraft = result?.aircraft ?? [];
  const sel = aircraft.find(a => a.hex === selected) ?? null;

  function find(e) {
    e.preventDefault();
    const v = query.trim().toUpperCase().replace(/\s+/g, "");
    if (!v) return;
    // Airline callsigns are three letters then a number (UAL123); US tails start N + digit;
    // most other registrations have a dash (C-FABC); six hex digits are a transponder code.
    const kind = /^[A-Z]{3}\d/.test(v) ? "callsign" : /^N\d/.test(v) || v.includes("-") ? "reg" : /^[0-9A-F]{6}$/.test(v) ? "hex" : "callsign";
    setLookup({ kind, value: v });
    setResult(null);
    setSelected(null);
    setFitKey(k => k + 1);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(pos => {
      setLookup(null);
      setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "My location" });
      setFitKey(k => k + 1);
    });
  }

  // One flight looked up: fit the map to it once it arrives.
  const fit = lookup ? aircraft.slice(0, 1).map(a => ({ lat: a.lat + 0.4, lon: a.lon + 0.4 })).concat(aircraft.slice(0, 1).map(a => ({ lat: a.lat - 0.4, lon: a.lon - 0.4 }))) : center ? [{ lat: center.lat + radius / 60, lon: center.lon }, { lat: center.lat - radius / 60, lon: center.lon }] : [];
  const lookupFit = lookup && aircraft.length ? `${fitKey}-found` : fitKey;

  return (
    <div className="fy-stack">
      <section className="fy-card fy-hero">
        <div className="fy-hero-text">
          <p className="fy-kicker">Flight tracker</p>
          <h1>{lookup ? `Looking for ${lookup.value}` : center ? `Traffic near ${center.name}` : "What's flying overhead"}</h1>
          <p>Live aircraft positions from the open ADS-B receiver network at adsb.lol. Search a flight (UAL123), a registration (N172SP) or pick a place.</p>
        </div>
        <div className="fy-hero-tools">
          <form className="fy-search" onSubmit={find} role="search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Flight or tail number" aria-label="Flight or tail number" autoCapitalize="characters" spellCheck={false} />
            <button type="submit" className="fy-btn is-small">Track</button>
          </form>
          <AirportSearch placeholder="Or traffic near an airport or city" onPick={a => { setLookup(null); setCenter({ lat: a.lat, lon: a.lon, name: a.name }); setFitKey(k => k + 1); }} />
          <button type="button" className="fy-btn is-ghost" onClick={locate}>
            <LocateFixed size={16} aria-hidden="true" /> Near me
          </button>
        </div>
      </section>

      {params && (
        <div className="fy-toolbar">
          {!lookup && (
            <div className="fy-seg" role="group" aria-label="Radius">
              {RADII.map(r => (
                <button key={r} type="button" className={r === radius ? "is-on" : ""} onClick={() => { setRadius(r); setFitKey(k => k + 1); }}>{r} nm</button>
              ))}
            </div>
          )}
          {lookup && <button type="button" className="fy-btn is-ghost is-small" onClick={() => { setLookup(null); setResult(null); setFitKey(k => k + 1); }}>Back to the area</button>}
          <button type="button" className="fy-btn is-ghost is-small" onClick={() => setLive(v => !v)}>
            {live ? <Pause size={14} /> : <Play size={14} />} {live ? "Live" : "Paused"}
          </button>
          <span className="fy-muted">{result ? `${aircraft.length} aircraft` : ""}</span>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {params && !result && !error && <Loading>Listening for aircraft…</Loading>}
      {!params && <p className="fy-muted fy-center">Pick a place or search a flight to start.</p>}

      {result && (
        <div className="fy-traffic">
          <section className="fy-card fy-map-card">
            <FlyMap
              fit={fit}
              fitKey={lookupFit}
              height={460}
              label="Live traffic map"
              circles={center && !lookup ? [{ id: "r", lat: center.lat, lon: center.lon, nm: radius }] : []}
              onPick={p => { if (!lookup) { setCenter({ ...p, name: "the spot you picked" }); } }}
              markers={aircraft.map(a => ({
                id: a.hex,
                kind: "plane",
                lat: a.lat,
                lon: a.lon,
                rotate: a.track ?? 0,
                ground: a.ground,
                selected: a.hex === selected,
                title: `${a.callsign ?? a.reg ?? a.hex} ${a.type ?? ""} ${a.ground ? "on the ground" : fmtAlt(a.altFt)}`,
                onClick: () => setSelected(a.hex),
              }))}
            >
              {sel && <AircraftCard a={sel} onClose={() => setSelected(null)} />}
            </FlyMap>
            {!lookup && <p className="fy-legend">Tap the map to look somewhere else. Aircraft on the ground are dimmed.</p>}
          </section>
          <section className="fy-card fy-traffic-list">
            {aircraft.length === 0 ? (
              <p className="fy-muted">{lookup ? `${lookup.value} isn't broadcasting a position right now. It may be on the ground, out of receiver range, or not flying today.` : "Nothing broadcasting in this area right now."}</p>
            ) : (
              <table className="fy-table fy-ac">
                <thead>
                  <tr>
                    <th>Flight</th>
                    <th>Type</th>
                    <th>Altitude</th>
                    <th>Speed</th>
                    {!lookup && <th>Away</th>}
                  </tr>
                </thead>
                <tbody>
                  {aircraft.slice(0, 80).map(a => (
                    <tr key={a.hex} className={a.hex === selected ? "is-on" : ""} onClick={() => setSelected(a.hex)}>
                      <th>{a.callsign ?? a.reg ?? a.hex.toUpperCase()}{a.emergency && <span className="fy-pill is-warn">{a.emergency}</span>}</th>
                      <td>{a.type ?? "—"}</td>
                      <td>{a.ground ? "Ground" : fmtAlt(a.altFt)}{a.vsFpm > 300 ? " ↑" : a.vsFpm < -300 ? " ↓" : ""}</td>
                      <td>{a.gsKt === null ? "—" : `${Math.round(a.gsKt)} kt`}</td>
                      {!lookup && <td>{a.distNm === null ? "—" : `${Math.round(a.distNm)} nm`}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AircraftCard({ a, onClose }) {
  return (
    <div className="fy-map-pop">
      <button type="button" className="fy-icon-btn fy-pop-close" onClick={onClose} aria-label="Close">×</button>
      <h3>{a.callsign ?? a.reg ?? a.hex.toUpperCase()}</h3>
      <p className="fy-muted">{[a.type, a.reg, a.category].filter(Boolean).join(" · ")}</p>
      <dl className="fy-metar-grid">
        <div><dt>Altitude</dt><dd>{a.ground ? "On the ground" : fmtAlt(a.altFt)}</dd></div>
        <div><dt>Groundspeed</dt><dd>{a.gsKt === null ? "—" : `${Math.round(a.gsKt)} kt`}</dd></div>
        <div><dt>Track</dt><dd>{a.track === null ? "—" : `${pad3(a.track)}°`}</dd></div>
        <div><dt>Climb</dt><dd>{a.vsFpm === null ? "—" : `${a.vsFpm > 0 ? "+" : ""}${Math.round(a.vsFpm / 10) * 10} fpm`}</dd></div>
        <div><dt>Squawk</dt><dd>{a.squawk ?? "—"}</dd></div>
        <div><dt>Last seen</dt><dd>{a.seen === null ? "—" : `${Math.round(a.seen)} s ago`}</dd></div>
      </dl>
      <a className="fy-link" href={`https://adsb.lol/?icao=${a.hex}`} target="_blank" rel="noreferrer">
        Full track on adsb.lol <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}
