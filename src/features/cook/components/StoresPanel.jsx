import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeDollarSign, Check, ExternalLink, LoaderCircle, LocateFixed, MapPin, Search, ShoppingBag, Store, Truck, X } from "lucide-react";
import { searchPlaces } from "../../../services/weather/openMeteo";
import { chainFor, compareStores, itemsToPrice, lookupUrl, MAX_COMPARE, milesText, money, orderItems, parsePrice, storeWebsite } from "../model/stores";
import { RADII, useStoresMemory } from "../state/storesMemory";
import "./stores.css";

const SHOWN = 8;

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "That didn't work. Try again in a moment.");
  return body;
}

// Finds grocery stores near you, compares what the shopping list costs at
// up to four of them and links out to order online.
export default function StoresPanel({ list }) {
  const [memory, update] = useStoresMemory();
  const [found, setFound] = useState({ key: null, stores: [], features: {}, error: "" });
  const [showAll, setShowAll] = useState(false);
  const [live, setLive] = useState({}); // storeId -> term -> products
  const asked = useRef(new Set()); // "storeId|term" already being fetched
  const [ordering, setOrdering] = useState("");
  const items = useMemo(() => itemsToPrice(list), [list]);
  const { place, radius, picked, typed, chosen } = memory;

  // Nearby stores, whenever the place or distance changes.
  const searchKey = place ? `${place.lat.toFixed(4)},${place.lon.toFixed(4)},${radius}` : null;
  const searching = Boolean(searchKey) && found.key !== searchKey;
  useEffect(() => {
    if (!searchKey) return undefined;
    const [lat, lon, r] = searchKey.split(",");
    const controller = new AbortController();
    getJson(`/api/cook/stores?lat=${lat}&lon=${lon}&radius=${r}`, { signal: controller.signal })
      .then(body =>
        setFound({ key: searchKey, stores: body.stores ?? [], features: body.features ?? {}, error: body.stores?.length ? "" : `No grocery stores are mapped within ${r} miles. Try a wider distance.` })
      )
      .catch(error => {
        if (error.name !== "AbortError") setFound({ key: searchKey, stores: [], features: {}, error: error.message });
      });
    return () => controller.abort();
  }, [searchKey]);

  // Live Kroger prices for compared Kroger-family stores.
  const terms = useMemo(() => [...new Set(items.map(i => i.term))], [items]);
  const livePrices = Boolean(found.features.livePrices);
  const waitingFor = s => livePrices && s.krogerId && terms.some(t => !live[s.id]?.[t]);
  useEffect(() => {
    if (!livePrices) return;
    for (const s of picked) {
      if (!s.krogerId) continue;
      const missing = terms.filter(t => !asked.current.has(`${s.id}|${t}`)).slice(0, 40);
      if (!missing.length) continue;
      for (const t of missing) asked.current.add(`${s.id}|${t}`);
      const fill = results => setLive(l => ({ ...l, [s.id]: { ...l[s.id], ...Object.fromEntries(missing.map(t => [t, results?.[t] ?? []])) } }));
      getJson(`/api/cook/prices?store=${encodeURIComponent(s.krogerId)}&terms=${encodeURIComponent(missing.join("|"))}`)
        .then(body => fill(body.results))
        .catch(() => fill({}));
    }
  }, [livePrices, picked, terms]);

  const isPicked = id => picked.some(s => s.id === id);
  const togglePick = store =>
    update(m => ({
      picked: isPicked(store.id) ? m.picked.filter(s => s.id !== store.id) : [...m.picked, store].slice(-MAX_COMPARE),
    }));

  const setTyped = (storeId, key, value) =>
    update(m => {
      const forStore = { ...(m.typed[storeId] ?? {}) };
      if (value === null) delete forStore[key];
      else forStore[key] = value;
      return { typed: { ...m.typed, [storeId]: forStore } };
    });
  const setChosen = (storeId, key, productId) => update(m => ({ chosen: { ...m.chosen, [storeId]: { ...(m.chosen[storeId] ?? {}), [key]: productId } } }));

  const result = useMemo(() => compareStores(items, picked, { typed, live, chosen }), [items, picked, typed, live, chosen]);
  const nameOf = id => picked.find(s => s.id === id)?.name ?? "";

  const orderOnInstacart = async () => {
    // Open the tab now, while the tap still counts, so popup blockers allow it.
    const tab = window.open("", "_blank");
    setOrdering("busy");
    try {
      const { url } = await getJson("/api/cook/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "CookFox shopping list", items: orderItems(items), back: `${window.location.origin}/cook?tab=shopping` }),
      });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setOrdering("");
    } catch (error) {
      tab?.close();
      setOrdering(error.message);
    }
  };

  const stores = showAll ? found.stores : found.stores.slice(0, SHOWN);
  const onlineStores = picked.filter(s => chainFor(s)?.online);

  return (
    <section className="ck-panel ck-stores" aria-labelledby="ck-stores-title">
      <div className="ck-panel-head">
        <h3 id="ck-stores-title">
          <Store size={20} aria-hidden="true" /> Compare stores near you
        </h3>
      </div>

      <PlacePicker place={place} onPick={p => update(() => ({ place: p }))} />

      {place && (
        <div className="ck-stores-radius">
          <span className="ck-muted">Within</span>
          {RADII.map(r => (
            <button key={r} type="button" className="ck-chip" aria-pressed={radius === r} onClick={() => update(() => ({ radius: r }))}>
              {r} mi
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="ck-muted ck-stores-status">
          <LoaderCircle className="ck-spin" size={16} aria-hidden="true" /> Finding grocery stores…
        </p>
      )}
      {!searching && found.error && <p className="ck-stores-status ck-stores-error">{found.error}</p>}

      {place && !searching && found.stores.length > 0 && (
        <>
          <p className="ck-muted ck-stores-hint">Pick up to {MAX_COMPARE} stores to compare what your list costs at each.</p>
          <ul className="ck-store-list">
            {stores.map(s => {
              const on = isPicked(s.id);
              const site = storeWebsite(s);
              return (
                <li key={s.id} className={on ? "is-on" : ""}>
                  <button type="button" className="ck-store-pick" aria-pressed={on} onClick={() => togglePick(s)} disabled={!on && picked.length >= MAX_COMPARE}>
                    <span className="ck-box" aria-hidden="true">
                      <Check size={15} />
                    </span>
                    <span className="ck-store-name">
                      <strong>{s.name}</strong>
                      <span className="ck-muted">
                        {milesText(s.distance)}
                        {s.address ? ` · ${s.address}` : ""}
                      </span>
                    </span>
                  </button>
                  {s.krogerId && found.features.livePrices && <span className="ck-store-tag">Live prices</span>}
                  {site && (
                    <a className="ck-icon-btn" href={site} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} website`}>
                      <ExternalLink size={16} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {found.stores.length > SHOWN && (
            <button type="button" className="ck-link" onClick={() => setShowAll(v => !v)}>
              {showAll ? "Show fewer" : `Show all ${found.stores.length} stores`}
            </button>
          )}
        </>
      )}

      {picked.length > 0 && items.length > 0 && (
        <div className="ck-compare">
          <h4>
            <BadgeDollarSign size={18} aria-hidden="true" /> What your list costs
          </h4>
          <Summary result={result} picked={picked} nameOf={nameOf} items={items} />
          <div className="ck-compare-scroll">
            <table className="ck-compare-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  {picked.map(s => (
                    <th key={s.id} scope="col">
                      <span className="ck-compare-store">{s.name}</span>
                      <button type="button" className="ck-icon-btn ck-icon-btn--tiny" aria-label={`Stop comparing ${s.name}`} onClick={() => togglePick(s)}>
                        <X size={13} />
                      </button>
                      {waitingFor(s) && <LoaderCircle className="ck-spin" size={13} aria-label="Getting prices" />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map(r => (
                  <tr key={r.item.key}>
                    <th scope="row">
                      {r.item.label}
                      {r.item.count > 1 && <span className="ck-muted"> × {r.item.count}</span>}
                    </th>
                    {picked.map((s, si) => (
                      <PriceCell
                        key={`${s.id}-${typed[s.id]?.[r.item.key] ?? ""}`}
                        store={s}
                        item={r.item}
                        cell={r.cells[si]}
                        cheapest={picked.length > 1 && r.cheapest === s.id}
                        products={live[s.id]?.[r.item.term]}
                        chosenId={chosen[s.id]?.[r.item.key]}
                        typedValue={typed[s.id]?.[r.item.key]}
                        onType={v => setTyped(s.id, r.item.key, v)}
                        onChoose={id => setChosen(s.id, r.item.key, id)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {result.totals.map(t => (
                    <td key={t.storeId}>
                      <strong>{t.priced ? money(t.total) : "—"}</strong>
                      {t.missing > 0 && <span className="ck-muted ck-compare-note">{t.missing} not priced</span>}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="ck-muted ck-compare-help">
            Type the price of one package as you see it on the store's site or shelf; "Look up" opens that item at the store.{" "}
            {found.features.livePrices ? "Kroger-family stores fill in their current shelf prices on their own." : ""} Your prices stay on this device.
          </p>
        </div>
      )}

      {items.length > 0 && (found.features.instacart || onlineStores.length > 0) && (
        <div className="ck-order">
          <h4>
            <Truck size={18} aria-hidden="true" /> Order online
          </h4>
          {found.features.instacart && (
            <div className="ck-order-row">
              <button type="button" className="ck-btn ck-btn--primary" onClick={orderOnInstacart} disabled={ordering === "busy"}>
                {ordering === "busy" ? <LoaderCircle className="ck-spin" size={16} aria-hidden="true" /> : <ShoppingBag size={16} aria-hidden="true" />} Send list to Instacart
              </button>
              <span className="ck-muted">Pick any store Instacart delivers from near you, see its prices and check out for delivery or pickup.</span>
            </div>
          )}
          {ordering && ordering !== "busy" && <p className="ck-stores-error">{ordering}</p>}
          {onlineStores.length > 0 && (
            <div className="ck-order-row">
              {onlineStores.map(s => (
                <a key={s.id} className="ck-btn" href={chainFor(s).site} target="_blank" rel="noopener noreferrer">
                  Shop {chainFor(s).name} online <ExternalLink size={14} aria-hidden="true" />
                </a>
              ))}
              <span className="ck-muted">Each "Look up" link above opens that item at the store, ready to add to your cart.</span>
            </div>
          )}
        </div>
      )}

      <p className="ck-muted ck-stores-credit">
        Store locations ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>{" "}
        contributors.{found.features.livePrices ? " Live prices from the Kroger API." : ""} Prices change often; check before you go.
      </p>
    </section>
  );
}

function Summary({ result, picked, nameOf, items }) {
  if (picked.length < 2) return <p className="ck-compare-summary">Add another store to see which is cheaper.</p>;
  if (!result.best) return <p className="ck-compare-summary">Add prices for the same items at each store to see which is cheaper.</p>;
  const everything = result.common === items.length;
  const split = result.split;
  return (
    <div className="ck-compare-summary">
      <p>
        <strong>{nameOf(result.best.storeId)}</strong> is cheapest{everything ? "" : ` for the ${result.common} item${result.common === 1 ? "" : "s"} priced everywhere`}: {money(result.best.total)}
        {result.best.savings > 0 ? `, ${money(result.best.savings)} less than the priciest.` : "."}
      </p>
      {split && split.stops.length > 1 && split.savings > 0.5 && (
        <p>
          Splitting the trip saves {money(split.savings)} more: {split.stops.map(s => `${s.count} at ${nameOf(s.storeId)}`).join(", ")}. The cheapest price in each row is highlighted.
        </p>
      )}
    </div>
  );
}

function PriceCell({ store, item, cell, cheapest, products, chosenId, typedValue, onType, onChoose }) {
  const [draft, setDraft] = useState(typedValue === undefined ? "" : typedValue.toFixed(2));
  const [bad, setBad] = useState(false);
  const commit = () => {
    const v = parsePrice(draft);
    setBad(v === undefined);
    if (v !== undefined && v !== (typedValue ?? null)) onType(v);
  };
  return (
    <td className={cheapest ? "is-cheapest" : ""}>
      {cell ? (
        <span className="ck-cell-cost">
          <strong>{money(cell.cost)}</strong>
          {item.count > 1 && <span className="ck-muted"> ({money(cell.price)} ea)</span>}
          {cell.sale && <span className="ck-store-tag ck-store-tag--sale">Sale</span>}
        </span>
      ) : (
        <span className="ck-muted ck-cell-cost">—</span>
      )}
      {products?.length > 0 && typedValue === undefined && (
        <select className="ck-cell-product" aria-label={`Product at ${store.name} for ${item.label}`} value={chosenId ?? products[0].id} onChange={e => onChoose(e.target.value)}>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {money(p.price)} · {p.name}
              {p.size ? ` (${p.size})` : ""}
            </option>
          ))}
        </select>
      )}
      <span className="ck-cell-entry">
        <input
          type="text"
          inputMode="decimal"
          className={bad ? "is-bad" : ""}
          placeholder={products?.length ? "Yours" : "$ each"}
          aria-label={`Price of one at ${store.name}: ${item.label}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
        />
        <a href={lookupUrl(store, item.term)} target="_blank" rel="noopener noreferrer">
          Look up
        </a>
      </span>
    </td>
  );
}

// Search for a town or ZIP code, or use the device's location.
function PlacePicker({ place, onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef(null);

  const search = async e => {
    e.preventDefault();
    const text = query.trim();
    if (text.length < 2) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setMessage("");
    try {
      const found = await searchPlaces(text, { signal: controller.current.signal });
      setResults(found);
      if (!found.length) setMessage("No places found. Try a town name or a ZIP code.");
      if (found.length === 1) choose(found[0]);
    } catch (error) {
      if (error.name !== "AbortError") setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const choose = r => {
    onPick({ name: [r.name, r.region].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude });
    setResults([]);
    setQuery("");
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
    <div className="ck-place">
      {place && (
        <p className="ck-place-current">
          <MapPin size={15} aria-hidden="true" /> Stores near <strong>{place.name}</strong>
        </p>
      )}
      <form className="ck-place-form" onSubmit={search}>
        <label className="ck-field">
          <span>{place ? "Somewhere else" : "Where do you shop?"}</span>
          <input type="search" placeholder="Town or ZIP code" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <button type="submit" className="ck-btn" disabled={busy || query.trim().length < 2}>
          <Search size={16} aria-hidden="true" /> Find
        </button>
        <button type="button" className="ck-btn ck-btn--quiet" onClick={locate} disabled={busy}>
          <LocateFixed size={16} aria-hidden="true" /> Use my location
        </button>
      </form>
      {message && <p className="ck-muted">{message}</p>}
      {results.length > 1 && (
        <ul className="ck-place-results">
          {results.map(r => (
            <li key={r.id}>
              <button type="button" className="ck-link ck-link--plain" onClick={() => choose(r)}>
                {r.name}
                {r.region ? <span className="ck-muted">, {r.region}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
