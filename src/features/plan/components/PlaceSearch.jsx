import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, MapPin, Search, X } from "lucide-react";

import { searchPlaces } from "../../../services/weather/openMeteo";

// Search for a town or city, or use the device's location.
export default function PlaceSearch({ place, onPick, placeholder = "Search a city or town", allowLocate = true, allowClear = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    const text = query.trim();
    clearTimeout(timer.current);
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await searchPlaces(text, { signal: controller.signal });
        setResults(found);
        setMessage(found.length ? "" : "No places found with that name.");
      } catch (error) {
        if (error.name !== "AbortError") setMessage(error.message);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [query]);

  function choose(next) {
    onPick(next);
    setQuery("");
    setResults([]);
    setMessage("");
  }

  function locate() {
    if (!navigator.geolocation) {
      setMessage("This browser can't share your location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBusy(false);
        choose({ id: "here", name: "My location", region: "", latitude: coords.latitude, longitude: coords.longitude });
      },
      () => {
        setBusy(false);
        setMessage("Couldn't get your location. Search for a place instead.");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  return (
    <div className="pf-place">
      {place && (
        <p className="pf-place-current">
          <MapPin size={15} aria-hidden="true" />
          <strong>{place.name}</strong>
          {place.region && <span className="pf-muted"> · {place.region}</span>}
          {allowClear && (
            <button type="button" className="pf-icon-btn" onClick={() => onPick(null)} aria-label="Remove place">
              <X size={14} />
            </button>
          )}
        </p>
      )}
      <div className="pf-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) setResults([]);
          }}
          placeholder={place ? "Change place" : placeholder}
          aria-label={placeholder}
        />
        {busy && <LoaderCircle size={16} className="spin" aria-label="Searching" />}
        {allowLocate && (
          <button type="button" className="pf-icon-btn" onClick={locate} aria-label="Use my location" title="Use my location">
            <LocateFixed size={16} />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul className="pf-suggestions" role="listbox" aria-label="Places">
          {results.map(result => (
            <li key={result.id}>
              <button type="button" onClick={() => choose(result)}>
                <strong>{result.name}</strong>
                {result.region && <span className="pf-muted"> · {result.region}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="pf-note">{message}</p>}
    </div>
  );
}
