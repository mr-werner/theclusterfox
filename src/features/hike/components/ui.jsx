import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";

import { searchPlaces } from "../api";

export function Loading({ children = "Loading…" }) {
  return (
    <p className="hk-loading" role="status">
      <LoaderCircle size={16} className="hk-spin" aria-hidden="true" /> {children}
    </p>
  );
}

export function ErrorNote({ children, onRetry }) {
  if (!children) return null;
  return (
    <div className="hk-error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="hk-link" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Your position once, as { lat, lon, accuracy }. */
export function locateOnce({ highAccuracy = true, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, alt: p.coords.altitude, time: p.timestamp / 1000 }),
      e => reject(new Error(e.code === 1 ? "Location is turned off for this site. Allow it in your browser settings." : "Couldn't get a GPS fix. Step into the open and try again.")),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: 30000 }
    );
  });
}

/** Search for a town, park or mountain; or use where you are. Calls onPick({ name, lat, lon }). */
export function PlaceSearch({ onPick, placeholder = "Town, park or mountain" }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);

  async function run(e) {
    e?.preventDefault();
    if (text.trim().length < 2) return;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      const r = await searchPlaces(text.trim(), { signal: ctl.current.signal });
      setResults(r);
      if (r.length === 1) pick(r[0]);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function pick(p) {
    setResults(null);
    setText(p.name);
    onPick({ name: [p.name, p.region].filter(Boolean).join(", "), lat: p.latitude, lon: p.longitude });
  }
  async function nearMe() {
    setBusy(true);
    setError(null);
    try {
      const p = await locateOnce({ highAccuracy: false });
      setText("");
      onPick({ name: "Near you", lat: p.lat, lon: p.lon });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hk-search">
      <form onSubmit={run} className="hk-search-row" role="search">
        <label className="hk-search-box">
          <Search size={17} aria-hidden="true" />
          <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} aria-label="Search for a place" enterKeyHint="search" />
          {busy && <LoaderCircle size={16} className="hk-spin" aria-hidden="true" />}
        </label>
        <button type="submit" className="hk-btn">Search</button>
        <button type="button" className="hk-btn hk-btn--ghost" onClick={nearMe} title="Trails near you">
          <LocateFixed size={16} aria-hidden="true" />
          <span>Near me</span>
        </button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      {results && results.length > 1 && (
        <ul className="hk-search-results">
          {results.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r)}>
                <MapPin size={15} aria-hidden="true" />
                <strong>{r.name}</strong>
                <span>{r.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && !results.length && <p className="hk-muted">No places found. Try a nearby town.</p>}
    </div>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="hk-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export const DIFF_CLASS = { easy: "hk-diff--easy", moderate: "hk-diff--moderate", hard: "hk-diff--hard", strenuous: "hk-diff--strenuous", very: "hk-diff--very" };

export function Difficulty({ value }) {
  if (!value) return null;
  return <span className={`hk-diff ${DIFF_CLASS[value.id] ?? ""}`}>{value.name}</span>;
}

export function download(name, text, type = "application/gpx+xml") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
