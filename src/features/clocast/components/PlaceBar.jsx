import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronDown, MapPin, Plus, Star, X } from "lucide-react";

import { fetchPlaceSummaries } from "../../../services/weather/openMeteo";
import { formatTemp } from "../units";
import LocationPicker from "./LocationPicker";
import WeatherIcon from "./WeatherIcon";

const coordKey = p => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;

// Temperature now, high/low and the sky for a list of places, in one request.
function usePlaceSummaries(places, enabled) {
  const key = enabled ? places.map(coordKey).join("|") : "";
  const [state, setState] = useState({ key: "", byKey: new Map() });
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    const points = key.split("|").map(k => {
      const [latitude, longitude] = k.split(",").map(Number);
      return { latitude, longitude };
    });
    fetchPlaceSummaries(points, { signal: controller.signal })
      .then(list => setState({ key, byKey: new Map(list.map((s, i) => [key.split("|")[i], s])) }))
      .catch(() => setState({ key, byKey: new Map() }));
    return () => controller.abort();
  }, [key]);
  return state.key === key ? state.byKey : null;
}

function Glance({ summary, units }) {
  if (summary === undefined) return <span className="cc-glance is-loading" aria-hidden="true" />;
  if (!summary) return <span className="cc-glance cc-muted">–</span>;
  return (
    <span className="cc-glance">
      <WeatherIcon code={summary.code} isDay={summary.isDay} size={22} />
      <strong>{formatTemp(summary.temp, units)}</strong>
      {summary.high != null && (
        <span className="cc-muted">
          H {formatTemp(summary.high, units, { unit: false })} · L {formatTemp(summary.low, units, { unit: false })}
        </span>
      )}
    </span>
  );
}

/**
 * The place you're looking at, at the top. Tap it to search for another
 * place or switch between your saved ones, each with a quick look at its
 * weather so you don't need the full forecast.
 */
export default function PlaceBar({ place, savedPlaces, units, onPick, onToggleSaved, reminderCount, onReminders, remindersOpen }) {
  const [open, setOpen] = useState(false);
  const isSaved = savedPlaces.some(p => p.id === place.id);
  const listed = useMemo(() => (isSaved ? savedPlaces : [place, ...savedPlaces]), [isSaved, place, savedPlaces]);
  const summaries = usePlaceSummaries(listed, open);

  const choose = next => {
    onPick(next);
    setOpen(false);
  };

  return (
    <section className={`cc-panel cc-placebar${open ? " is-open" : ""}`} aria-label="Place">
      <div className="cc-placebar-row">
        <button type="button" className="cc-placebar-current" onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <MapPin size={18} aria-hidden="true" />
          <span>
            <strong>{place.name}</strong>
            {place.region && <span className="cc-muted"> · {place.region}</span>}
          </span>
          <span className="cc-placebar-change">
            Change <ChevronDown size={15} className={open ? "is-flipped" : ""} aria-hidden="true" />
          </span>
        </button>
        {onReminders && (
          <button
            type="button"
            className="cc-icon-btn cc-bell"
            onClick={onReminders}
            aria-pressed={remindersOpen}
            aria-label={reminderCount ? `${reminderCount} daily reminders` : "Daily reminders"}
            title="Daily reminders"
          >
            <BellRing size={17} />
            {reminderCount > 0 && <span className="cc-bell-count">{reminderCount}</span>}
          </button>
        )}
      </div>

      {open && (
        <div className="cc-switcher">
          <LocationPicker place={place} savedPlaces={savedPlaces} onPick={choose} onToggleSaved={onToggleSaved} searchOnly autoFocus />

          <div className="cc-switcher-head">
            <h2>Your places</h2>
            {!isSaved && (
              <button type="button" className="cc-btn" onClick={() => onToggleSaved(place)}>
                <Plus size={15} aria-hidden="true" /> Add {place.name}
              </button>
            )}
          </div>
          <ul className="cc-places">
            {listed.map(p => {
              const current = p.id === place.id;
              const saved = savedPlaces.some(s => s.id === p.id);
              return (
                <li key={p.id} className={current ? "is-current" : ""}>
                  <button type="button" className="cc-places-main" onClick={() => choose(p)} aria-current={current ? "true" : undefined}>
                    <span className="cc-places-name">
                      <strong>{p.name}</strong>
                      <span className="cc-muted">{current ? "Showing now" : p.region || "Saved place"}</span>
                    </span>
                    <Glance summary={summaries ? summaries.get(coordKey(p)) ?? null : undefined} units={units} />
                  </button>
                  {saved ? (
                    <button type="button" className="cc-icon-btn" onClick={() => onToggleSaved(p)} aria-label={`Remove ${p.name} from your places`} title="Remove">
                      <X size={15} />
                    </button>
                  ) : (
                    <button type="button" className="cc-icon-btn" onClick={() => onToggleSaved(p)} aria-label={`Save ${p.name}`} title="Save">
                      <Star size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {savedPlaces.length === 0 && <p className="cc-muted cc-small">Save places you check often to switch between them in one tap.</p>}
        </div>
      )}
    </section>
  );
}
