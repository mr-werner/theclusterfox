import { useMemo, useState } from "react";
import { MapPin, Search, Snowflake } from "lucide-react";

import { RESORTS } from "../data/resorts";
import { fetchSummaries, searchPlaces } from "../api";
import { useLoad } from "../model/useLoad";
import { REGIONS, fmtSnow, fmtTemp } from "../model/snow";
import { findSpot } from "../model/spots";
import { FavButton, Loading, Problem, SnowBars } from "./ui";
import WeatherIcon from "../../clocast/components/WeatherIcon";

// The snow report: your favorite mountains first, then a region's ski areas,
// each with snow in the last two days, the week ahead and a bar per day.
export default function MountainList({ s, open }) {
  const { data, patch } = s;
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState(null);
  const [sort, setSort] = useState("snow");
  const units = data.units;

  const favs = data.favorites.map(id => findSpot(id, data)).filter(Boolean);
  const q = query.trim().toLowerCase();
  const regional = q ? RESORTS.filter(r => `${r.name} ${r.state}`.toLowerCase().includes(q)) : RESORTS.filter(r => REGIONS.find(x => x.id === data.region)?.states.includes(r.state));
  const listed = regional.filter(r => !data.favorites.includes(r.id)).slice(0, 40);
  const spots = [...favs, ...listed];
  const key = spots.map(x => x.id).join(",");
  const sums = useLoad(spots.length ? `${key}|${units}` : null, signal => fetchSummaries(spots, { signal }));
  const byId = useMemo(() => Object.fromEntries((sums.data ?? []).map((v, i) => [spots[i]?.id, v])), [sums.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFav = id => patch(d => ({ favorites: d.favorites.includes(id) ? d.favorites.filter(f => f !== id) : [...d.favorites, id] }));

  const sorted = [...listed].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const A = byId[a.id];
    const B = byId[b.id];
    return (B ? B.next7 + B.past48 : -1) - (A ? A.next7 + A.past48 : -1);
  });

  async function findPlace(e) {
    e.preventDefault();
    if (q.length < 3) return;
    setPlaces("loading");
    try {
      setPlaces(await searchPlaces(query));
    } catch {
      setPlaces([]);
    }
  }

  function addPlace(p) {
    const id = `place-${p.id}`;
    patch(d => ({
      custom: [...d.custom.filter(c => c.id !== id), { id, name: p.name, state: p.region, lat: p.latitude, lon: p.longitude, base: 7000, summit: 9500, custom: true }],
      favorites: d.favorites.includes(id) ? d.favorites : [...d.favorites, id],
    }));
    setPlaces(null);
    setQuery("");
    open(id);
  }

  const row = r => (
    <MountainRow key={r.id} r={r} sum={byId[r.id]} units={units} fav={data.favorites.includes(r.id)} onFav={() => toggleFav(r.id)} onOpen={() => open(r.id)} />
  );

  return (
    <div className="sf-list">
      <form className="sf-search" onSubmit={findPlace} role="search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={e => { setQuery(e.target.value); setPlaces(null); }} placeholder="Find a ski area, or any mountain or town" aria-label="Find a mountain" />
        {q.length >= 3 && (
          <button type="submit" className="sf-btn is-quiet">
            Search places
          </button>
        )}
      </form>
      {places === "loading" && <Loading text="Looking up places…" />}
      {Array.isArray(places) && (
        <div className="sf-places">
          {places.length ? <p className="sf-muted">Not a ski area on the list? Add a place to check its mountain weather (you can set its elevations after).</p> : <p className="sf-muted">No places found with that name.</p>}
          {places.map(p => (
            <button key={p.id} type="button" className="sf-place" onClick={() => addPlace(p)}>
              <MapPin size={16} aria-hidden="true" /> {p.name}
              {p.region && <small>{p.region}</small>}
            </button>
          ))}
        </div>
      )}

      {!q && favs.length > 0 && (
        <section>
          <h2 className="sf-h2">Your mountains</h2>
          <div className="sf-rows">{favs.map(row)}</div>
        </section>
      )}

      <section>
        <div className="sf-list-head">
          <h2 className="sf-h2">{q ? `Ski areas matching “${query.trim()}”` : "Snow report"}</h2>
          <div className="sf-seg" role="group" aria-label="Sort">
            <button type="button" aria-pressed={sort === "snow"} onClick={() => setSort("snow")}>
              Most snow
            </button>
            <button type="button" aria-pressed={sort === "name"} onClick={() => setSort("name")}>
              A–Z
            </button>
          </div>
        </div>
        {!q && (
          <div className="sf-chips" role="group" aria-label="Region">
            {REGIONS.map(r => (
              <button key={r.id} type="button" aria-pressed={data.region === r.id} onClick={() => patch({ region: r.id })}>
                {r.name}
              </button>
            ))}
          </div>
        )}
        {sums.error && <Problem text={sums.error} />}
        {sums.loading && <Loading text="Checking snow at the top of each mountain…" />}
        <div className="sf-rows">{sorted.map(row)}</div>
        {!sorted.length && !favs.length && <p className="sf-muted">No ski areas match. Try “Search places” to add any mountain.</p>}
      </section>
      <p className="sf-credit">
        Snow totals are Open-Meteo model forecasts at each mountain's top-lift elevation, not the resort's own report.
      </p>
    </div>
  );
}

function MountainRow({ r, sum, units, fav, onFav, onOpen }) {
  return (
    <article className="sf-row">
      <button type="button" className="sf-row-main" onClick={onOpen}>
        <span className="sf-row-name">
          <strong>{r.name}</strong>
          <small>
            {r.state}
            {r.kind === "backcountry" || r.elev ? " · backcountry" : ""}
          </small>
        </span>
        {sum ? (
          <>
            <span className="sf-row-num" title="Snow in the last 48 hours">
              <b>{fmtSnow(sum.past48, units)}</b>
              <small>last 48h</small>
            </span>
            <span className={`sf-row-num${sum.next7 >= 25 ? " is-deep" : ""}`} title="Snow in the next 7 days">
              <b>
                {sum.next7 >= 25 && <Snowflake size={14} aria-hidden="true" />}
                {fmtSnow(sum.next7, units)}
              </b>
              <small>next 7 days</small>
            </span>
            <SnowBars days={sum.days} units={units} />
            <span className="sf-row-wx">
              <WeatherIcon code={sum.code} size={20} />
              <small>
                {fmtTemp(sum.high, units)} / {fmtTemp(sum.low, units)}
              </small>
            </span>
          </>
        ) : (
          <span className="sf-row-num sf-muted">…</span>
        )}
      </button>
      <FavButton on={fav} onToggle={onFav} name={r.name} />
    </article>
  );
}
