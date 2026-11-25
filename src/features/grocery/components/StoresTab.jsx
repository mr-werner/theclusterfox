import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, LoaderCircle, LocateFixed, MapPin, Search, Star, Ticket, X } from "lucide-react";
import { searchPlaces } from "../../../services/weather/openMeteo";
import { fetchOsm, mergeStores } from "../../../../api/cook/_osm.js";
import { milesText, storeWebsite } from "../../cook/model/stores";
import { MAX_STORES, RADII } from "../state/groceryStore";
import { savingsFor } from "../data/savings";
import { getJson } from "../state/usePrices";

const SHOWN = 8;

export default function StoresTab({ data, change, go }) {
  const { place, radius, stores, preferred } = data;
  const [found, setFound] = useState({ key: null, stores: [], features: {}, error: "" });
  const [showAll, setShowAll] = useState(false);

  const searchKey = place ? `${place.lat.toFixed(4)},${place.lon.toFixed(4)},${radius}` : null;
  const searching = Boolean(searchKey) && found.key !== searchKey;
  useEffect(() => {
    if (!searchKey) return undefined;
    const [lat, lon, r] = searchKey.split(",").map(Number);
    const controller = new AbortController();
    Promise.allSettled([fetchOsm(lat, lon, r, { signal: controller.signal }), getJson(`/api/cook/stores?lat=${lat}&lon=${lon}&radius=${r}`, { signal: controller.signal })]).then(([osm, ours]) => {
      if (controller.signal.aborted) return;
      const list = mergeStores(osm.value ?? [], ours.value?.stores ?? [], { lat, lon }).filter(s => s.distance <= r);
      const error = list.length ? "" : osm.status === "rejected" ? osm.reason.message : `No grocery stores are mapped within ${r} miles. Try a wider distance.`;
      setFound({ key: searchKey, stores: list.slice(0, 80), features: ours.value?.features ?? {}, error });
    });
    return () => controller.abort();
  }, [searchKey]);

  const isMine = id => stores.some(s => s.id === id);
  const toggle = store =>
    change(d => {
      if (d.stores.some(s => s.id === store.id)) {
        const rest = d.stores.filter(s => s.id !== store.id);
        return { stores: rest, preferred: d.preferred === store.id ? null : d.preferred };
      }
      if (d.stores.length >= MAX_STORES) return null;
      return { stores: [...d.stores, store], preferred: d.preferred ?? (d.stores.length === 0 ? store.id : null) };
    });
  const prefer = id => change(d => ({ preferred: d.preferred === id ? null : id }));
  const shown = showAll ? found.stores : found.stores.slice(0, SHOWN);

  return (
    <section className="gx-panel" aria-labelledby="gx-stores-title">
      <div className="gx-head">
        <h2 id="gx-stores-title">Your stores</h2>
        <span className="gx-muted">{stores.length} of {MAX_STORES}</span>
      </div>

      {stores.length === 0 ? (
        <p className="gx-muted">Find the grocery stores near you and add up to {MAX_STORES}. Star the one you usually go to; GroceryFox tells you when another store would be cheaper.</p>
      ) : (
        <ul className="gx-mystores">
          {stores.map(s => {
            const site = storeWebsite(s);
            const savings = savingsFor(s);
            const star = preferred === s.id;
            return (
              <li key={s.id} className={star ? "is-preferred" : ""}>
                <button type="button" className="gx-star" aria-pressed={star} aria-label={star ? `${s.name} is your preferred store` : `Make ${s.name} your preferred store`} onClick={() => prefer(s.id)}>
                  <Star size={18} aria-hidden="true" />
                </button>
                <span className="gx-store-name">
                  <strong>{s.name}</strong>
                  <span className="gx-muted">
                    {star ? "Preferred · " : ""}
                    {s.distance !== null ? milesText(s.distance) : ""}
                    {s.address ? ` · ${s.address}` : ""}
                  </span>
                </span>
                <span className="gx-store-links">
                  {s.krogerId && found.features.livePrices && <span className="gx-tag">Live prices</span>}
                  <a className="gx-icon-btn" href={savings.coupons ?? savings.deals ?? savings.weeklyAd} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} coupons`} title="Coupons">
                    <Ticket size={16} />
                  </a>
                  {site && (
                    <a className="gx-icon-btn" href={site} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} website`} title="Website">
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button type="button" className="gx-icon-btn" aria-label={`Remove ${s.name}`} onClick={() => toggle(s)}>
                    <X size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {stores.length > 0 && (
        <button type="button" className="gx-btn gx-btn--primary gx-next" onClick={() => go("prices")}>
          Compare prices at {stores.length === 1 ? "this store" : `these ${stores.length} stores`}
        </button>
      )}

      <div className="gx-subhead">
        <h3>Stores near you</h3>
      </div>
      <PlacePicker place={place} onPick={p => change(() => ({ place: p }))} />

      {place && (
        <div className="gx-chips" role="group" aria-label="How far">
          <span className="gx-muted">Within</span>
          {RADII.map(r => (
            <button key={r} type="button" className="gx-chip" aria-pressed={radius === r} onClick={() => change(() => ({ radius: r }))}>
              {r} mi
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="gx-muted gx-status">
          <LoaderCircle className="gx-spin" size={16} aria-hidden="true" /> Finding grocery stores…
        </p>
      )}
      {!searching && found.error && <p className="gx-error">{found.error}</p>}

      {place && !searching && found.stores.length > 0 && (
        <>
          <ul className="gx-found">
            {shown.map(s => {
              const on = isMine(s.id);
              return (
                <li key={s.id} className={on ? "is-on" : ""}>
                  <button type="button" className="gx-pick" aria-pressed={on} onClick={() => toggle(s)} disabled={!on && stores.length >= MAX_STORES}>
                    <span className="gx-box" aria-hidden="true">
                      <Check size={15} />
                    </span>
                    <span className="gx-store-name">
                      <strong>{s.name}</strong>
                      <span className="gx-muted">
                        {milesText(s.distance)}
                        {s.address ? ` · ${s.address}` : ""}
                      </span>
                    </span>
                  </button>
                  {s.krogerId && found.features.livePrices && <span className="gx-tag">Live prices</span>}
                </li>
              );
            })}
          </ul>
          {found.stores.length > SHOWN && (
            <button type="button" className="gx-link" onClick={() => setShowAll(v => !v)}>
              {showAll ? "Show fewer" : `Show all ${found.stores.length} stores`}
            </button>
          )}
        </>
      )}

      <p className="gx-muted gx-credit">
        Store locations ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>{" "}
        contributors.{found.features.livePrices ? " Kroger-family stores come with live prices from the Kroger API." : ""}
      </p>
    </section>
  );
}

// Search for a town or ZIP code, or use the device's location.
function PlacePicker({ place, onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef(null);

  const choose = r => {
    onPick({ name: [r.name, r.region].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude });
    setResults([]);
    setQuery("");
  };

  const search = async e => {
    e.preventDefault();
    const text = query.trim();
    if (text.length < 2) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setMessage("");
    try {
      const list = await searchPlaces(text, { signal: controller.current.signal });
      setResults(list);
      if (!list.length) setMessage("No places found. Try a town name or a ZIP code.");
      if (list.length === 1) choose(list[0]);
    } catch (error) {
      if (error.name !== "AbortError") setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return setMessage("This browser can't share your location. Search for your town instead.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBusy(false);
        setMessage("");
        onPick({ name: "Near me", lat: coords.latitude, lon: coords.longitude });
      },
      () => {
        setBusy(false);
        setMessage("Couldn't get your location. Search for your town or ZIP code instead.");
      },
      { timeout: 10000, maximumAge: 600000 }
    );
  };

  return (
    <div className="gx-place">
      {place && (
        <p className="gx-place-now">
          <MapPin size={15} aria-hidden="true" /> Near <strong>{place.name}</strong>
        </p>
      )}
      <form className="gx-place-form" onSubmit={search}>
        <label className="gx-field">
          <span>{place ? "Somewhere else" : "Where do you shop?"}</span>
          <input type="search" placeholder="Town or ZIP code" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <button type="submit" className="gx-btn" disabled={busy || query.trim().length < 2}>
          <Search size={16} aria-hidden="true" /> Find
        </button>
        <button type="button" className="gx-btn gx-btn--quiet" onClick={locate} disabled={busy}>
          <LocateFixed size={16} aria-hidden="true" /> Use my location
        </button>
      </form>
      {message && <p className="gx-muted">{message}</p>}
      {results.length > 1 && (
        <ul className="gx-place-results">
          {results.map(r => (
            <li key={r.id}>
              <button type="button" className="gx-link" onClick={() => choose(r)}>
                {r.name}
                {r.region ? <span className="gx-muted">, {r.region}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
