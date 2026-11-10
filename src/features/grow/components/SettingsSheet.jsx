import { useEffect, useRef, useState } from "react";
import { Search, LocateFixed, Loader2, Check } from "lucide-react";
import { searchPlaces } from "../../../services/weather/openMeteo";
import { zoneLabel, zoneRangeF } from "../model/climate";
import { THEMES } from "../state/growStore";
import { Sheet } from "./ui";

const ZONES = Array.from({ length: 26 }, (_, i) => 1 + i / 2);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Find your garden: search a town, use this device's location, or pick a zone.
export function PlaceSetup({ g, compact = false }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState({ q: "", list: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) return undefined;
    const controller = new AbortController();
    timer.current = setTimeout(() => {
      setBusy(true);
      searchPlaces(q, { signal: controller.signal })
        .then(r => {
          setFound({ q, list: r });
          setError(r.length ? null : "No places by that name.");
        })
        .catch(e => !controller.signal.aborted && setError(e.message))
        .finally(() => setBusy(false));
    }, 300);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [query]);

  const pick = p => {
    g.setPlace({ id: p.id, name: p.name, region: p.region, latitude: p.latitude, longitude: p.longitude });
    setQuery("");
  };
  const results = found.q === query.trim() && query.trim().length >= 2 ? found.list : [];

  const locate = () => {
    if (!navigator.geolocation) {
      setError("This browser can't share its location. Search for your town instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(false);
        const { latitude, longitude } = pos.coords;
        g.setPlace({ id: `${latitude.toFixed(2)},${longitude.toFixed(2)}`, name: "My location", region: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`, latitude, longitude });
      },
      () => {
        setBusy(false);
        setError("Couldn't get your location. Search for your town instead.");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  };

  return (
    <div className={`gf-place${compact ? " gf-place--compact" : ""}`}>
      <div className="gf-search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Town, city or ZIP" aria-label="Search for your town" />
        {busy && <Loader2 size={18} className="gf-spin" aria-hidden="true" />}
      </div>
      {results.length > 0 && (
        <ul className="gf-results">
          {results.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => pick(r)}>
                <strong>{r.name}</strong>
                <span>{r.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="gf-note gf-note--warn">{error}</p>}
      <div className="gf-place-alt">
        <button type="button" className="gf-btn gf-btn--ghost" onClick={locate}>
          <LocateFixed size={16} aria-hidden="true" /> Use my location
        </button>
        <button type="button" className="gf-btn gf-btn--ghost" onClick={() => setManual(m => !m)} aria-expanded={manual}>
          Pick my zone instead
        </button>
      </div>
      {manual && (
        <div className="gf-manual">
          <label>
            <span>Hardiness zone</span>
            <select value={g.data.manualZone ?? ""} onChange={e => g.patch({ manualZone: e.target.value ? Number(e.target.value) : null, place: null, climate: null })}>
              <option value="">Choose…</option>
              {ZONES.map(z => {
                const [lo, hi] = zoneRangeF(z);
                return (
                  <option key={z} value={z}>
                    Zone {zoneLabel(z)} ({lo} to {hi}°F winters)
                  </option>
                );
              })}
            </select>
          </label>
          <div className="gf-seg" role="group" aria-label="Hemisphere">
            {[
              ["N", "Northern hemisphere"],
              ["S", "Southern hemisphere"],
            ].map(([id, name]) => (
              <button key={id} type="button" className={g.data.hemisphere === id ? "on" : ""} onClick={() => g.patch({ hemisphere: id })}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClimateStatus({ g }) {
  const { state, error } = g.climateStatus;
  if (state === "loading") {
    return (
      <p className="gf-note">
        <Loader2 size={16} className="gf-spin" aria-hidden="true" /> Reading ten years of weather for {g.data.place?.name}…
      </p>
    );
  }
  if (state === "error" && !g.climate) {
    return (
      <p className="gf-note gf-note--warn">
        {error}{" "}
        <button type="button" className="gf-link" onClick={g.retryClimate}>
          Try again
        </button>
      </p>
    );
  }
  return null;
}

export default function SettingsSheet({ g, onClose }) {
  const { data, climate } = g;
  return (
    <Sheet title="Your garden" onClose={onClose}>
      <section className="gf-set">
        <h3>Place</h3>
        {data.place ? (
          <p className="gf-set-now">
            <strong>{data.place.name}</strong> {data.place.region && <span>{data.place.region}</span>}
            {climate && <em>Zone {zoneLabel(climate.zone)}</em>}
          </p>
        ) : climate ? (
          <p className="gf-set-now">
            <strong>Zone {zoneLabel(climate.zone)}</strong> <span>{data.hemisphere === "S" ? "Southern" : "Northern"} hemisphere, picked by hand</span>
          </p>
        ) : null}
        <ClimateStatus g={g} />
        <PlaceSetup g={g} compact />
      </section>

      {data.climate && (
        <section className="gf-set">
          <h3>Does your yard run colder or warmer?</h3>
          <p className="gf-hint">Weather data covers a few miles. Low spots and open hilltops run colder; city yards and sheltered walls run warmer. Each step moves your zone half a step and your frost dates about two weeks.</p>
          <div className="gf-seg" role="group" aria-label="Zone adjustment">
            {[
              [-1, "Much colder"],
              [-0.5, "Colder"],
              [0, "As measured"],
              [0.5, "Warmer"],
              [1, "Much warmer"],
            ].map(([v, name]) => (
              <button key={v} type="button" className={data.zoneShift === v ? "on" : ""} onClick={() => g.patch({ zoneShift: v })}>
                {name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="gf-set">
        <h3>Look</h3>
        <div className="gf-themes">
          {THEMES.map(t => (
            <button key={t.id} type="button" className={`gf-theme-pick${data.prefs.theme === t.id ? " on" : ""}`} data-swatch={t.id} onClick={() => g.setPrefs({ theme: t.id })} aria-pressed={data.prefs.theme === t.id}>
              <span className="gf-swatch" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>{t.name}</strong>
              <small>{t.hint}</small>
              {data.prefs.theme === t.id && <Check size={16} className="gf-theme-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      <section className="gf-set">
        <h3>Garden day</h3>
        <p className="gf-hint">Weekly jobs land on this day, so most of your garden work happens in one go.</p>
        <select value={data.prefs.gardenDay} onChange={e => g.setPrefs({ gardenDay: Number(e.target.value) })} aria-label="Garden day">
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </section>

      <section className="gf-set">
        <h3>Units</h3>
        <div className="gf-seg" role="group" aria-label="Units">
          {[
            ["us", "°F and inches"],
            ["metric", "°C and mm"],
          ].map(([id, name]) => (
            <button key={id} type="button" className={data.prefs.units === id ? "on" : ""} onClick={() => g.setPrefs({ units: id })}>
              {name}
            </button>
          ))}
        </div>
      </section>
    </Sheet>
  );
}
