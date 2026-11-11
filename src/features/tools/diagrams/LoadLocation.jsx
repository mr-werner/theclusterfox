import { useRef, useState } from "react";
import { MapPin, RotateCcw, Search, X } from "lucide-react";
import { Choice } from "./kit";
import { show } from "./helpers";
import { searchPlaces } from "../../../services/weather/openMeteo";
import { fetchHourlyHistory } from "../../../services/weather/designHistory";
import { decodeLocation, designConditions, designInputs, encodeLocation } from "../model/designWeather";

// Where the building is. Picking a place pulls ten years of hourly weather and
// works out the ASHRAE-style design conditions: the worst-case winter
// temperature the heating must meet and the summer peak the cooling must meet.
// Those set the heating and cooling ΔT used by every room.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HEAT_PCT = [
  { value: "99.6", label: "99.6%: colder about 35 h a year" },
  { value: "99", label: "99%: colder about 88 h a year" },
];
const COOL_PCT = [
  { value: "0.4", label: "0.4%: hotter about 35 h a year" },
  { value: "1", label: "1%: hotter about 88 h a year" },
];
const near = (a, b) => Math.abs(a - b) < 0.05;

export default function LoadLocation({ values: v, set, unit }) {
  const loc = decodeLocation(v.loc);
  const [editing, setEditing] = useState(!loc);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const abort = useRef(null);

  const T = (x) => show(x, "temp", unit("temp"));
  const dT = (x) => show(x, "dtemp", unit("dtemp"));

  const apply = (next) => {
    set("loc", encodeLocation(next));
    for (const [k, x] of Object.entries(designInputs(next))) set(k, x);
  };

  async function search(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    setError("");
    setBusy("Looking up places…");
    try {
      const found = await searchPlaces(q, { signal: ctl.signal });
      setPlaces(found);
      if (!found.length) setError("No places matched. Try a city name, or a city and country.");
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Place search failed.");
    } finally {
      if (abort.current === ctl) setBusy("");
    }
  }

  async function choose(place) {
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    setError("");
    setBusy(`Reading ten years of hourly weather for ${place.name}…`);
    try {
      const h = await fetchHourlyHistory(place, { signal: ctl.signal });
      const dc = designConditions(h, { offset: h.offset, z: h.elevation });
      if (!dc) throw new Error("There isn't enough weather history for that spot.");
      const name = [place.name, place.region].filter(Boolean).join(", ");
      apply({ name, lat: place.latitude, lon: place.longitude, z: h.elevation, ...dc, hp: loc?.hp || "99.6", cp: loc?.cp || "0.4" });
      setPlaces(null);
      setQuery("");
      setEditing(false);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Couldn't read the weather history.");
    } finally {
      if (abort.current === ctl) setBusy("");
    }
  }

  const want = loc ? designInputs(loc) : null;
  const handEdited = loc && (!near(v.Twin, want.Twin) || !near(v.Tdb, want.Tdb) || (want.Twb !== undefined && !near(v.Twb, want.Twb)));
  const heatDT = v.Tih - v.Twin;
  const coolDT = v.Tdb - v.Ti;

  return (
    <section className="ld-loc" aria-label="Building location and design weather">
      <div className="ld-loc-head">
        <h3 className="ld-loc-title">
          <MapPin size={15} aria-hidden="true" /> {loc ? loc.name : "Where is the building?"}
        </h3>
        {loc && !editing && (
          <button type="button" className="ld-loc-btn" onClick={() => setEditing(true)}>
            <Search size={13} aria-hidden="true" /> Change location
          </button>
        )}
      </div>

      {loc && (
        <p className="tf-muted tf-small ld-loc-meta">
          {Math.abs(loc.lat).toFixed(2)}° {loc.lat >= 0 ? "N" : "S"}, {Math.abs(loc.lon).toFixed(2)}° {loc.lon >= 0 ? "E" : "W"} · elevation {show(loc.z, "length", unit("length"))} · design conditions from {Math.round(loc.years)} years of hourly weather
        </p>
      )}

      {(editing || !loc) && (
        <>
          {!loc && <p className="tf-muted tf-small">The location sets the worst-case winter and summer weather, so the heating and cooling loads are sized for that climate.</p>}
          <form className="ld-loc-search" onSubmit={search}>
            <label className="dg-pick ld-name">
              <span className="dg-num-label">City or town</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Minneapolis" aria-label="City or town" />
            </label>
            <button type="submit" className="ld-loc-btn" disabled={!query.trim() || Boolean(busy)}>
              <Search size={13} aria-hidden="true" /> Find
            </button>
            {loc && (
              <button type="button" className="ld-loc-btn" onClick={() => (setEditing(false), setPlaces(null), setError(""))}>
                <X size={13} aria-hidden="true" /> Cancel
              </button>
            )}
          </form>
          {places?.length > 0 && (
            <ul className="ld-loc-list">
              {places.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => choose(p)} disabled={Boolean(busy)}>
                    <strong>{p.name}</strong>
                    {p.region && <span>{p.region}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {busy && <p className="tf-muted tf-small" role="status">{busy}</p>}
      {error && <p className="ld-loc-error tf-small" role="alert">{error}</p>}

      {loc && (
        <div className="ld-loc-grid">
          <div className="ld-loc-tile is-heat">
            <span className="ld-loc-k">Winter design (heating)</span>
            <strong>{T(v.Twin)}</strong>
            <span className="ld-loc-dt">
              ΔT <b>{dT(heatDT)}</b> to {T(v.Tih)} inside
            </span>
            <Choice label="Design level" value={loc.hp} options={HEAT_PCT} onChange={(hp) => apply({ ...loc, hp })} />
          </div>
          <div className="ld-loc-tile is-cool">
            <span className="ld-loc-k">Summer design (cooling)</span>
            <strong>
              {T(v.Tdb)} <small>with {T(v.Twb)} wet bulb</small>
            </strong>
            <span className="ld-loc-dt">
              ΔT <b>{dT(coolDT)}</b> over {T(v.Ti)} inside
            </span>
            <Choice label="Design level" value={loc.cp} options={COOL_PCT} onChange={(cp) => apply({ ...loc, cp })} />
          </div>
          <div className="ld-loc-tile">
            <span className="ld-loc-k">Summer day</span>
            <strong>{dT(v.DR)} <small>daily swing</small></strong>
            <span className="ld-loc-dt">
              Hottest month {MONTHS[loc.month - 1]}
              {String(loc.month) !== String(v.month) && <> · cooling checked in {MONTHS[Number(v.month) - 1]}</>}
            </span>
          </div>
        </div>
      )}
      {handEdited && (
        <p className="tf-small ld-loc-note">
          The design temperatures under More settings were changed by hand, so they no longer match {loc.name}.{" "}
          <button type="button" className="ld-loc-link" onClick={() => apply(loc)}>
            <RotateCcw size={12} aria-hidden="true" /> Use the location's values
          </button>
        </p>
      )}
    </section>
  );
}
