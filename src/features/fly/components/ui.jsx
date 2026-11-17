import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search, X } from "lucide-react";

import { searchAirports } from "../api";
import { ago, CATEGORY_TEXT, fmtAlt, fmtVis, fmtWind } from "./format";

export function Cat({ value, small }) {
  if (!value) return <span className={`fy-cat fy-cat--none${small ? " is-small" : ""}`}>No report</span>;
  return (
    <span className={`fy-cat fy-cat--${value}${small ? " is-small" : ""}`} title={CATEGORY_TEXT[value]}>
      {value}
    </span>
  );
}

const COVER = { FEW: "Few", SCT: "Scattered", BKN: "Broken", OVC: "Overcast", OVX: "Sky hidden", VV: "Vertical visibility", CLR: "Clear", SKC: "Clear", CAVOK: "Clear" };

/** A METAR with its key parts decoded. */
export function MetarCard({ metar, title, children }) {
  if (!metar) return null;
  const clouds = metar.clouds.filter(c => c.cover && c.base !== null);
  return (
    <article className="fy-metar">
      <header>
        <div>
          <strong>{title ?? metar.id}</strong>
          <span>{metar.name}</span>
        </div>
        <Cat value={metar.category} />
      </header>
      <dl className="fy-metar-grid">
        <div>
          <dt>Wind</dt>
          <dd>{fmtWind(metar.windDir, metar.windKt, metar.gustKt)}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{fmtVis(metar.visSm)}{metar.wx ? ` · ${metar.wx}` : ""}</dd>
        </div>
        <div>
          <dt>Ceiling</dt>
          <dd>{metar.ceilingFt === null ? "None" : fmtAlt(metar.ceilingFt)}</dd>
        </div>
        <div>
          <dt>Clouds</dt>
          <dd>{clouds.length ? clouds.map(c => `${COVER[c.cover] ?? c.cover} ${(c.base / 1000).toFixed(1).replace(/\.0$/, "")}k`).join(", ") : "Clear"}</dd>
        </div>
        <div>
          <dt>Temp / dew point</dt>
          <dd>{metar.tempC ?? "—"}° / {metar.dewC ?? "—"}°C</dd>
        </div>
        <div>
          <dt>Altimeter</dt>
          <dd>{metar.altimInHg?.toFixed(2) ?? "—"}</dd>
        </div>
      </dl>
      <p className="fy-raw" title="The raw report">
        {metar.raw} <em>{ago(metar.time)}</em>
      </p>
      {children}
    </article>
  );
}

/**
 * Find an airport by code (KDEN, APA) or by a place name (Boulder). Calls
 * onPick({ id, name, lat, lon, elevFt, magVar }).
 */
export function AirportSearch({ onPick, placeholder = "Airport code or city", autoFocus, compact }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ctl = useRef(null);

  useEffect(() => () => ctl.current?.abort(), []);

  async function run(e) {
    e?.preventDefault();
    if (text.trim().length < 2) return;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      const list = await searchAirports(text, { signal: ctl.current.signal });
      setResults(list);
      if (!list.length) setError("No airports with weather reports found there. Try an airport code like KDEN.");
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function pick(a) {
    onPick({ id: a.id, name: a.name, lat: a.lat, lon: a.lon, elevFt: a.elevFt ?? null, magVar: a.magVar ?? null });
    setResults(null);
    setText("");
  }

  return (
    <div className={`fy-search${compact ? " is-compact" : ""}`}>
      <form onSubmit={run} role="search">
        <Search size={16} aria-hidden="true" />
        <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} autoCapitalize="characters" spellCheck={false} />
        {busy ? <LoaderCircle size={16} className="fy-spin" aria-label="Searching" /> : text && (
          <button type="button" className="fy-icon-btn" onClick={() => { setText(""); setResults(null); }} aria-label="Clear">
            <X size={15} />
          </button>
        )}
        <button type="submit" className="fy-btn is-small">Find</button>
      </form>
      {error && <p className="fy-note is-warn">{error}</p>}
      {results?.length > 0 && (
        <ul className="fy-results">
          {results.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => pick(a)}>
                <strong>{a.id}</strong>
                <span>{a.name}{a.state ? `, ${a.state}` : ""}</span>
                {Number.isFinite(a.distNm) && <em><MapPin size={12} aria-hidden="true" /> {Math.round(a.distNm)} nm</em>}
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
    <p className="fy-loading">
      <LoaderCircle size={16} className="fy-spin" aria-hidden="true" /> {children}
    </p>
  );
}

export function ErrorNote({ children, onRetry }) {
  return (
    <p className="fy-note is-warn" role="alert">
      {children} {onRetry && <button type="button" className="fy-link" onClick={onRetry}>Try again</button>}
    </p>
  );
}
