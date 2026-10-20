import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plane } from "lucide-react";

import { searchAirports } from "../../../services/plan/planApi";

// Find a city (all its airports) or a single airport by name or code.
export default function AirportPicker({ label, placeholder, onPick }) {
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
        const found = await searchAirports(text, { signal: controller.signal });
        setResults(found);
        setMessage(found.length ? "" : "No airports found with that name.");
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

  function choose(place) {
    onPick({ code: place.code, name: place.name });
    setQuery("");
    setResults([]);
    setMessage("");
  }

  return (
    <div className="pf-airport">
      <div className="pf-inline-form">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} aria-label={label} />
        {busy && <LoaderCircle size={15} className="spin" aria-hidden="true" />}
      </div>
      {query.trim().length >= 2 && results.length > 0 && (
        <ul className="pf-airport-results">
          {results.map(place => (
            <li key={`${place.type}-${place.code}`}>
              <button type="button" onClick={() => choose(place)}>
                <Plane size={13} aria-hidden="true" />
                <span>
                  <strong>{place.name}</strong>
                  <span className="pf-muted">
                    {" "}
                    · {place.type === "city" ? "all airports" : place.city}
                    {place.country && `, ${place.country}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && message && <p className="pf-note">{message}</p>}
    </div>
  );
}
