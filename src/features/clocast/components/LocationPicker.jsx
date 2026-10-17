import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, MapPin, Search, Star } from "lucide-react";

import { searchPlaces } from "../../../services/weather/openMeteo";

export default function LocationPicker({ place, savedPlaces, onPick, onToggleSaved, actions }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    const text = query.trim();
    clearTimeout(timer.current);
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(text, { signal: controller.signal });
        setResults(found);
        setMessage(found.length ? "" : "No places found with that name.");
      } catch (error) {
        if (error.name !== "AbortError") setMessage(error.message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage("This browser can't share your location. Search for a place instead.");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        choose({
          id: `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
          name: "My location",
          region: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
          latitude,
          longitude,
        });
      },
      () => {
        setLocating(false);
        setMessage("Couldn't get your location. Search for a place instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  const isSaved = place && savedPlaces.some(p => p.id === place.id);
  const showResults = query.trim().length >= 2 && results.length > 0;

  return (
    <div className="cc-location">
      <div className="cc-search">
        <span className="cc-search-box">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Search a city or town"
            aria-label="Search for a place"
            onChange={event => {
              setQuery(event.target.value);
              if (event.target.value.trim().length < 2) setResults([]);
            }}
          />
          {searching && <LoaderCircle size={16} className="spin" aria-label="Searching" />}
        </span>
        <span className="cc-search-actions">
          <button type="button" className="cc-btn cc-locate" onClick={useMyLocation} disabled={locating}>
            {locating ? <LoaderCircle size={16} className="spin" /> : <LocateFixed size={16} />}
            <span>Use my location</span>
          </button>
          {actions}
        </span>
      </div>

      {showResults && (
        <ul className="cc-suggestions" role="listbox" aria-label="Places">
          {results.map(result => (
            <li key={result.id}>
              <button type="button" onClick={() => choose(result)}>
                <MapPin size={15} aria-hidden="true" />
                <strong>{result.name}</strong>
                {result.region && <span>{result.region}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="cc-note">{message}</p>}

      {place && (
        <div className="cc-place">
          <MapPin size={16} aria-hidden="true" />
          <span>
            <strong>{place.name}</strong>
            {place.region && <span className="cc-muted"> · {place.region}</span>}
          </span>
          <button
            type="button"
            className={`cc-icon-btn ${isSaved ? "is-on" : ""}`}
            onClick={() => onToggleSaved(place)}
            aria-pressed={isSaved}
            title={isSaved ? "Remove from saved places" : "Save this place"}
          >
            <Star size={16} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
      )}

      {savedPlaces.length > 0 && (
        <div className="cc-chips" aria-label="Saved places">
          {savedPlaces.map(saved => (
            <button
              key={saved.id}
              type="button"
              className={`cc-chip ${place?.id === saved.id ? "is-active" : ""}`}
              onClick={() => choose(saved)}
            >
              <Star size={12} aria-hidden="true" /> {saved.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
