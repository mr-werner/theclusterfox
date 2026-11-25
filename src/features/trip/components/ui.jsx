import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, MapPin, Minus, Plane, Plus, Search, X } from "lucide-react";

import { searchPlaces } from "../../../services/weather/openMeteo";
import { searchAirports } from "../../../services/plan/planApi";
import { placeName } from "../../../services/geo/reverse";
import WeatherIcon from "../../clocast/components/WeatherIcon";
import { shortDay } from "../model/days";
import { fmtTemp as temp } from "../model/geo";

/** Search as you type, after a short pause. */
function useSearch(query, search) {
  const [state, setState] = useState({ results: [], busy: false, message: "" });
  const timer = useRef(null);
  useEffect(() => {
    const text = query.trim();
    clearTimeout(timer.current);
    if (text.length < 2) return undefined;
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      setState(s => ({ ...s, busy: true }));
      try {
        const results = await search(text, { signal: controller.signal });
        setState({ results, busy: false, message: results.length ? "" : "Nothing found with that name." });
      } catch (error) {
        if (error.name !== "AbortError") setState({ results: [], busy: false, message: error.message });
      }
    }, 300);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
    // search is a fixed function for each field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return query.trim().length < 2 ? { results: [], busy: false, message: "" } : state;
}

const findPlaces = (text, opts) => searchPlaces(text, opts).then(list => list.map(p => ({ id: p.id, name: p.name, region: p.region, lat: p.latitude, lon: p.longitude })));

/** A town or city: shows the one picked, or a search box. */
export function PlaceField({ label, place, onPick, placeholder = "Search a city or town", allowLocate = false }) {
  const [editing, setEditing] = useState(!place);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const { results, busy, message } = useSearch(query, findPlaces);
  const choose = p => {
    onPick(p);
    setQuery("");
    setEditing(false);
  };
  function locate() {
    if (!navigator.geolocation) return setLocError("This browser can't share your location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const named = await placeName(coords.latitude, coords.longitude);
        setLocating(false);
        choose({ id: "here", name: named?.name ?? "My location", region: named?.region ?? "", lat: coords.latitude, lon: coords.longitude });
      },
      () => {
        setLocating(false);
        setLocError("Couldn't get your location. Search instead.");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  }

  if (place && !editing) {
    return (
      <div className="tx-field">
        <span className="tx-label">{label}</span>
        <button type="button" className="tx-picked" onClick={() => setEditing(true)} title="Change">
          <MapPin size={15} aria-hidden="true" />
          <strong>{place.name}</strong>
          {place.region && <span className="tx-muted">{place.region}</span>}
          <span className="tx-change">Change</span>
        </button>
      </div>
    );
  }
  return (
    <div className="tx-field">
      <span className="tx-label">{label}</span>
      <div className="tx-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} aria-label={label} autoFocus={Boolean(place)} />
        {(busy || locating) && <LoaderCircle size={16} className="tx-spin" aria-label="Searching" />}
        {allowLocate && (
          <button type="button" className="tx-icon-btn" onClick={locate} aria-label="Use my location" title="Use my location">
            <LocateFixed size={16} />
          </button>
        )}
        {place && (
          <button type="button" className="tx-icon-btn" onClick={() => setEditing(false)} aria-label="Keep the current place">
            <X size={16} />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul className="tx-results" aria-label="Places">
          {results.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => choose(r)}>
                <strong>{r.name}</strong> <span className="tx-muted">{r.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(message || locError) && <p className="tx-note">{message || locError}</p>}
    </div>
  );
}

/** A city's airports or one airport, by name or code. */
export function AirportField({ label, airport, onPick, placeholder = "City or airport code" }) {
  const [editing, setEditing] = useState(!airport);
  const [query, setQuery] = useState("");
  const { results, busy, message } = useSearch(query, searchAirports);
  if (airport && !editing) {
    return (
      <div className="tx-field">
        <span className="tx-label">{label}</span>
        <button type="button" className="tx-picked" onClick={() => setEditing(true)} title="Change">
          <Plane size={15} aria-hidden="true" />
          <strong>{airport.name}</strong>
          <span className="tx-muted">{airport.code}</span>
          <span className="tx-change">Change</span>
        </button>
      </div>
    );
  }
  return (
    <div className="tx-field">
      <span className="tx-label">{label}</span>
      <div className="tx-search">
        <Plane size={16} aria-hidden="true" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} aria-label={label} />
        {busy && <LoaderCircle size={16} className="tx-spin" aria-label="Searching" />}
        {airport && (
          <button type="button" className="tx-icon-btn" onClick={() => setEditing(false)} aria-label="Keep the current airport">
            <X size={16} />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul className="tx-results" aria-label="Airports">
          {results.map(r => (
            <li key={`${r.type}-${r.code}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ code: r.code, name: r.name });
                  setQuery("");
                  setEditing(false);
                }}
              >
                <strong>{r.name}</strong> <span className="tx-muted">{r.type === "city" ? "all airports" : r.city}{r.country ? `, ${r.country}` : ""} · {r.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="tx-note">{message}</p>}
    </div>
  );
}

/** A small number with minus and plus buttons. */
export function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="tx-stepper" role="group" aria-label={label}>
      <span className="tx-label">{label}</span>
      <div>
        <button type="button" className="tx-icon-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus size={15} />
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" className="tx-icon-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

/** Pick one of a few. options: [{ id, name }]. */
export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="tx-segment" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.icon && <o.icon size={15} aria-hidden="true" />}
          {o.name}
        </button>
      ))}
    </div>
  );
}

/** A dollar amount box. Empty means "not set" (null). */
export function MoneyInput({ label, value, onChange, placeholder, hint }) {
  const shown = value == null ? "" : String(value);
  // What's typed, until the saved value changes underneath it.
  const [draft, setDraft] = useState({ from: shown, text: shown });
  const text = draft.from === shown ? draft.text : shown;
  const setText = t => setDraft({ from: shown, text: t });
  return (
    <label className="tx-field tx-money">
      <span className="tx-label">{label}</span>
      <span className="tx-money-box">
        <span aria-hidden="true">$</span>
        <input
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={e => setText(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => {
            const n = Number.parseFloat(text);
            onChange(Number.isFinite(n) ? n : null);
          }}
          onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
        />
      </span>
      {hint && <span className="tx-hint">{hint}</span>}
    </label>
  );
}

export function Loading({ children }) {
  return (
    <p className="tx-loading">
      <LoaderCircle size={15} className="tx-spin" aria-hidden="true" /> {children}
    </p>
  );
}


/** One day's weather, small: icon, high / low, chance of rain. */
export function DayWeather({ w, units, typical }) {
  if (!w) return null;
  return (
    <span className="tx-wx" title={typical ? "What's typical for this date" : "Forecast"}>
      <WeatherIcon code={w.code ?? 0} size={16} />
      <span>
        {temp(w.hi, units)} / {temp(w.lo, units)}
      </span>
      {w.rain >= 20 && <span className="tx-wx-rain">{w.rain}%</span>}
      {w.snow && <span className="tx-wx-rain">snow</span>}
    </span>
  );
}

/** The trip's days with their weather, in a row. */
export function WeatherStrip({ days, weather, units }) {
  if (!days.length || !weather?.days) return null;
  return (
    <ol className="tx-strip" aria-label="Weather each day">
      {days.slice(0, 14).map(d => {
        const w = weather.days[d];
        return (
          <li key={d}>
            <span className="tx-strip-day">{shortDay(d).split(",")[0]}</span>
            <span className="tx-strip-date">{shortDay(d).split(", ")[1]}</span>
            {w ? (
              <>
                <WeatherIcon code={w.code ?? 0} size={22} />
                <span className="tx-strip-temp">
                  {temp(w.hi, units)} <span className="tx-muted">{temp(w.lo, units)}</span>
                </span>
                <span className="tx-strip-rain">{w.snow ? "Snow" : w.rain >= 20 ? `${w.rain}%` : " "}</span>
              </>
            ) : (
              <span className="tx-muted">–</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
