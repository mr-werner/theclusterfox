import { useEffect, useRef, useState } from "react";
import { Footprints, Gauge, Landmark, LoaderCircle, LocateFixed, MapPin, Mountain, Search, Shuffle, UtensilsCrossed, X } from "lucide-react";

import { findPlaces } from "../api";

export const THEME_ICONS = { fastest: Gauge, alt: Shuffle, scenic: Mountain, food: UtensilsCrossed, history: Landmark, outdoors: Footprints };

/** Pick a city or town. Calls onPick({ id, name, region, lat, lon }). */
export function PlaceInput({ label, value, onPick, allowHere, placeholder = "City or town" }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(!value);
  const ctl = useRef(null);

  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => setEditing(!value), [value?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(e) {
    e?.preventDefault();
    if (text.trim().length < 2) return;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      const list = await findPlaces(text.trim(), { signal: ctl.current.signal });
      setResults(list);
      if (!list.length) setError("No place by that name. Try a city or town.");
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function pick(p) {
    onPick(p);
    setResults(null);
    setText("");
    setEditing(false);
  }

  function here() {
    if (!navigator.geolocation) return setError("This browser can't share your location.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(false);
        pick({ id: "here", name: "My location", region: "", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setBusy(false);
        setError("Couldn't get your location. Type a town instead.");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  if (!editing && value) {
    return (
      <div className="rf-place is-set">
        <span className="rf-place-label">{label}</span>
        <button type="button" className="rf-place-value" onClick={() => setEditing(true)} title="Change">
          <MapPin size={16} aria-hidden="true" />
          <strong>{value.name}</strong>
          {value.region && <span>{value.region}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="rf-place">
      <span className="rf-place-label">{label}</span>
      <form onSubmit={run} role="search" className="rf-search">
        <Search size={16} aria-hidden="true" />
        <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} aria-label={`${label}: ${placeholder}`} spellCheck={false} />
        {busy ? (
          <LoaderCircle size={16} className="rf-spin" aria-label="Searching" />
        ) : (
          value && (
            <button type="button" className="rf-icon-btn" onClick={() => setEditing(false)} aria-label="Keep the current place">
              <X size={15} />
            </button>
          )
        )}
        {allowHere && (
          <button type="button" className="rf-icon-btn" onClick={here} aria-label="Use my location" title="Use my location">
            <LocateFixed size={16} />
          </button>
        )}
        <button type="submit" className="rf-btn is-small">Find</button>
      </form>
      {error && <p className="rf-note is-warn">{error}</p>}
      {results?.length > 0 && (
        <ul className="rf-results">
          {results.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)}>
                <strong>{p.name}</strong>
                <span>{p.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Loading({ children = "Loading…" }) {
  return (
    <p className="rf-loading">
      <LoaderCircle size={16} className="rf-spin" aria-hidden="true" /> {children}
    </p>
  );
}

/** Google Maps turn-by-turn for a trip (it takes up to nine stops in between). */
export function directionsUrl(from, to, stops = []) {
  const ll = p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  const qs = new URLSearchParams({ api: "1", origin: ll(from), destination: ll(to), travelmode: "driving" });
  if (stops.length) qs.set("waypoints", stops.slice(0, 9).map(ll).join("|"));
  return `https://www.google.com/maps/dir/?${qs}`;
}

export const placeUrl = p => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
