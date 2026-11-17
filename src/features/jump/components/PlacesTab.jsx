import { useMemo, useState } from "react";
import { ExternalLink, LocateFixed, Plane, Search, Wind } from "lucide-react";

import FlyMap from "../../fly/components/FlyMap";
import { searchPlaces } from "../../../services/weather/openMeteo";
import { DROPZONES, PROGRAMS, TYPICAL_PRICES } from "../data/dropzones";
import { TUNNEL_PRICES, TUNNEL_TIPS, TUNNELS } from "../data/tunnels";
import { milesBetween } from "../model/jumpcheck";
import { fetchMappedPlaces } from "../model/osm";
import { HomeButton, Loading } from "./ui";

const USPA_LOCATOR = "https://www.uspa.org/dzlocator";

// Drop zones and wind tunnels on a map and in a list, nearest first once you
// search for a place or use your location.
export default function PlacesTab({ j, kind, setKind, openDz }) {
  const { data, patch } = j;
  const [center, setCenter] = useState(null); // { lat, lon, name }
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [mapped, setMapped] = useState({ status: "idle", list: [] });

  const list = useMemo(() => {
    const all = kind === "tunnels" ? TUNNELS : DROPZONES.filter(d => filter === "all" || d.programs.includes(filter));
    const withDist = all.map(d => ({ ...d, miles: center ? milesBetween(center, d) : null }));
    return center ? withDist.sort((a, b) => a.miles - b.miles) : withDist.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
  }, [kind, filter, center]);

  const sel = list.find(d => d.id === selected) ?? null;
  const fitPoints = center ? list.slice(0, 6).concat([{ lat: center.lat, lon: center.lon }]) : list;

  async function lookAround(c) {
    setMapped({ status: "loading", list: [] });
    try {
      const found = await fetchMappedPlaces(c, kind === "tunnels" ? "tunnel" : "dz");
      const known = kind === "tunnels" ? TUNNELS : DROPZONES;
      setMapped({ status: "ready", list: found.filter(f => !known.some(k => milesBetween(k, f) < 3)) });
    } catch (e) {
      setMapped({ status: "error", list: [], error: e.message });
    }
  }

  function go(c) {
    setCenter(c);
    setSelected(null);
    setMapped({ status: "idle", list: [] });
  }

  const markers = [
    ...list.map(d => ({ id: d.id, lat: d.lat, lon: d.lon, category: kind === "tunnels" ? "tunnel" : d.size === "big" ? "big" : "dz", title: d.name, label: selected === d.id ? d.name : undefined, selected: selected === d.id, onClick: () => setSelected(d.id) })),
    ...mapped.list.map(m => ({ id: m.id, lat: m.lat, lon: m.lon, category: "osm", title: m.name })),
    ...(center ? [{ id: "me", lat: center.lat, lon: center.lon, category: "me", title: center.name, waypoint: true }] : []),
  ];

  return (
    <div className="jf-stack">
      <section className="jf-card jf-hero">
        <div className="jf-hero-text">
          <p className="jf-kicker">{kind === "tunnels" ? "Indoor skydiving" : "Drop zones"}</p>
          <h1>{kind === "tunnels" ? "Wind tunnels near you" : "Where to jump"}</h1>
          <p>
            {kind === "tunnels"
              ? "Fly in a vertical wind tunnel: the best way to learn body flight between jumps, or to try it with no plane at all."
              : "What each drop zone offers (tandems, AFF, static line, the planes they fly) and today's winds there."}
          </p>
        </div>
        <div className="jf-hero-tools">
          <div className="jf-segment" role="group" aria-label="Show">
            <button type="button" aria-pressed={kind !== "tunnels"} onClick={() => { setKind("dz"); setSelected(null); setMapped({ status: "idle", list: [] }); }}>
              <Plane size={14} aria-hidden="true" /> Drop zones
            </button>
            <button type="button" aria-pressed={kind === "tunnels"} onClick={() => { setKind("tunnels"); setSelected(null); setMapped({ status: "idle", list: [] }); }}>
              <Wind size={14} aria-hidden="true" /> Wind tunnels
            </button>
          </div>
          <PlaceSearch onPick={go} />
        </div>
      </section>

      {kind !== "tunnels" && (
        <div className="jf-chips" role="group" aria-label="Filter">
          {[["all", "All"], ...Object.entries(PROGRAMS).map(([id, p]) => [id, p.name])].map(([id, name]) => (
            <button key={id} type="button" className={`jf-chip-btn${filter === id ? " is-on" : ""}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="jf-places">
        <div className="jf-stack is-tight">
          <FlyMap fit={fitPoints} fitKey={`${kind}|${filter}|${center?.lat ?? ""}`} markers={markers} height={420} label={kind === "tunnels" ? "Map of wind tunnels" : "Map of drop zones"} />
          <p className="jf-legend">
            <i className="is-big" /> Big DZ <i className="is-dz" /> {kind === "tunnels" ? "Tunnel" : "Drop zone"} <i className="is-osm" /> Also on OpenStreetMap
          </p>
          {sel && <Detail d={sel} kind={kind} data={data} patch={patch} openDz={openDz} />}
          {center && (
            <div className="jf-card is-plain">
              <p>
                Not every {kind === "tunnels" ? "tunnel" : "DZ"} is in JumpFox yet.{" "}
                {kind !== "tunnels" && <a href={USPA_LOCATOR} target="_blank" rel="noreferrer">USPA's drop zone locator</a>}
                {kind !== "tunnels" && " lists every member DZ. "}
                {mapped.status === "idle" && (
                  <button type="button" className="jf-link" onClick={() => lookAround(center)}>
                    Look on OpenStreetMap near {center.name}
                  </button>
                )}
              </p>
              {mapped.status === "loading" && <Loading>Searching the map…</Loading>}
              {mapped.status === "error" && <p className="jf-note is-warn">{mapped.error}</p>}
              {mapped.status === "ready" && (
                mapped.list.length ? (
                  <ul className="jf-plain-list">
                    {mapped.list.slice(0, 12).map(m => (
                      <li key={m.id}>
                        <strong>{m.name}</strong> <span className="jf-muted">{Math.round(milesBetween(center, m))} mi</span> {m.website && <a href={m.website} target="_blank" rel="noreferrer">website</a>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="jf-muted">Nothing else mapped near there.</p>
                )
              )}
            </div>
          )}
        </div>

        <ul className="jf-place-list" aria-label={kind === "tunnels" ? "Wind tunnels" : "Drop zones"}>
          {list.map(d => (
            <li key={d.id}>
              <button type="button" className={selected === d.id ? "is-on" : ""} onClick={() => setSelected(d.id)}>
                <span className="jf-place-name">
                  <strong>{d.name}</strong>
                  {data.homeDz === d.id && <span className="jf-tag">Home</span>}
                  {d.size === "big" && <span className="jf-tag is-big">Destination</span>}
                  {d.kind === "sport" && <span className="jf-tag">Sport flyers</span>}
                </span>
                <span className="jf-muted">
                  {d.city}, {d.state}
                  {d.miles != null && ` · ${Math.round(d.miles)} mi`}
                </span>
                {d.programs && <span className="jf-place-progs">{d.programs.map(p => PROGRAMS[p].name).join(" · ")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {kind === "tunnels" ? <TunnelPrices /> : <DzPrices />}
    </div>
  );
}

function Detail({ d, kind, data, patch, openDz }) {
  if (kind === "tunnels") {
    return (
      <section className="jf-card">
        <h2>{d.name}</h2>
        <p className="jf-muted">{d.city}, {d.state} · {d.kind === "sport" ? "Mostly licensed flyers and coaching; beginners welcome by booking" : "First-time flyers welcome"}</p>
        {d.note && <p>{d.note}</p>}
        <a className="jf-btn is-small" href={d.website} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden="true" /> Book or see prices
        </a>
      </section>
    );
  }
  const near = d.programs.includes("tunnel") ? null : TUNNELS.map(t => ({ t, mi: milesBetween(d, t) })).sort((a, b) => a.mi - b.mi)[0];
  return (
    <section className="jf-card">
      <div className="jf-row-between">
        <h2>{d.name}</h2>
        <HomeButton isHome={data.homeDz === d.id} onClick={() => patch({ homeDz: data.homeDz === d.id ? null : d.id })} />
      </div>
      <p className="jf-muted">{d.city}, {d.state} · field about {d.elevFt.toLocaleString("en-US")} ft</p>
      {d.note && <p>{d.note}</p>}
      <dl className="jf-facts">
        <div>
          <dt>Programs</dt>
          <dd>{d.programs.map(p => PROGRAMS[p].name).join(", ")}</dd>
        </div>
        <div>
          <dt>Aircraft</dt>
          <dd>{d.aircraft.map(a => (a === "turbine" ? "Turbine aircraft" : a)).join(", ")}</dd>
        </div>
        {near && near.mi < 120 && (
          <div>
            <dt>Nearest tunnel</dt>
            <dd>{near.t.name}, {Math.round(near.mi)} mi</dd>
          </div>
        )}
      </dl>
      <div className="jf-row">
        <button type="button" className="jf-btn is-small" onClick={() => openDz(d.id)}>
          <Wind size={14} aria-hidden="true" /> Can I jump there?
        </button>
        <a className="jf-btn is-small is-ghost" href={d.website} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden="true" /> Prices and booking
        </a>
      </div>
      <p className="jf-muted jf-small">Planes and programs change with the season. The DZ's site has their current fleet and prices.</p>
    </section>
  );
}

function PlaceSearch({ onPick }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(e) {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const [p] = await searchPlaces(text.trim());
      if (!p) setError("Couldn't find that place.");
      else onPick({ lat: p.latitude, lon: p.longitude, name: p.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    navigator.geolocation?.getCurrentPosition(pos => onPick({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "you" }), () => setError("Couldn't get your location."), { timeout: 10000, maximumAge: 600000 });
  }
  return (
    <>
      <form className="jf-search" onSubmit={run} role="search">
        <Search size={16} aria-hidden="true" />
        <input value={text} onChange={e => setText(e.target.value)} placeholder="City or zip" aria-label="City or zip" />
        <button type="submit" className="jf-btn is-small" disabled={busy}>{busy ? "…" : "Find"}</button>
      </form>
      <button type="button" className="jf-link" onClick={locate}>
        <LocateFixed size={14} aria-hidden="true" /> Near me
      </button>
      {error && <p className="jf-note is-warn">{error}</p>}
    </>
  );
}

function DzPrices() {
  return (
    <section className="jf-card">
      <h2>What jumping costs</h2>
      <p className="jf-muted">Typical US prices. Each DZ sets its own, so check their site before you go.</p>
      <PriceTable rows={TYPICAL_PRICES} />
      <div className="jf-programs">
        {Object.entries(PROGRAMS).map(([id, p]) => (
          <div key={id}>
            <strong>{p.name}</strong>
            <p className="jf-muted">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TunnelPrices() {
  return (
    <section className="jf-card">
      <h2>What tunnel time costs</h2>
      <p className="jf-muted">Typical US prices. Every tunnel posts its own on its site.</p>
      <PriceTable rows={TUNNEL_PRICES} />
      <h3>Getting the most from it</h3>
      <ul className="jf-ticks">{TUNNEL_TIPS.map(t => <li key={t}>{t}</li>)}</ul>
    </section>
  );
}

export function PriceTable({ rows }) {
  return (
    <dl className="jf-prices">
      {rows.map(r => (
        <div key={r.id ?? r.label}>
          <dt>
            {r.label}
            {r.note && <small>{r.note}</small>}
          </dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

