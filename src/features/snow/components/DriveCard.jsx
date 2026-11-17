import { useState } from "react";
import { Car, ExternalLink, LocateFixed, MapPin, ParkingSquare } from "lucide-react";

import { fetchDrive, fetchRoadPoints, searchPlaces } from "../api";
import { useLoad } from "../model/useLoad";
import { M_PER_FT, fmtElev, roadWeather, samplePath, worstRoad } from "../model/snow";
import { PARKING_CHECK, ROAD_SITES } from "../data/roads";
import { Card, Loading, Problem } from "./ui";

const hm = minutes => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
};

/**
 * Getting there: the usual drive time from home, road weather along the way
 * when you'd pass each point, the state's road-conditions site, live traffic
 * in Google Maps or Waze, and parking.
 */
export default function DriveCard({ spot, s, day, units }) {
  const { data, patch } = s;
  const home = data.home;
  const [leave, setLeave] = useState("07:00");
  const route = useLoad(home ? `drive-${home.lat},${home.lon}-${spot.id}` : null, signal => fetchDrive(home, spot, { signal }));
  const points = route.data ? samplePath(route.data.coords, 8) : [];
  const road = useLoad(route.data ? `road-${spot.id}-${home.lat}` : null, signal => fetchRoadPoints(points, { signal }));

  const departMs = new Date(`${day}T${leave}:00`).getTime();
  const total = points.length ? points[points.length - 1].km || 1 : 1;
  const legs = road.data
    ? points.map((p, i) => {
        const eta = departMs + (route.data.minutes * 60000 * p.km) / total;
        const near = (road.data[i] ?? []).filter(h => Math.abs(h.time - eta) <= 90 * 60000);
        return { ...p, eta, elev: road.data[i]?.[0]?.elev ?? null, ...roadWeather(near), noData: !near.length };
      })
    : [];
  const covered = legs.filter(l => !l.noData);
  const worst = covered.length ? worstRoad(covered) : null;
  const top = legs.reduce((m, l) => (Number.isFinite(l.elev) && (!m || l.elev > m.elev) ? l : m), null);
  const site = ROAD_SITES[spot.state];
  const gmaps = `https://www.google.com/maps/dir/?api=1${home ? `&origin=${home.lat},${home.lon}` : ""}&destination=${spot.lat},${spot.lon}&travelmode=driving`;

  return (
    <Card title="Getting there" icon={Car}>
      <HomePicker home={home} onSet={h => patch({ home: h })} />
      {route.loading && <Loading text="Finding the drive…" />}
      {route.error && <Problem text={route.error} />}
      {route.data && (
        <>
          <div className="sf-drive-sum">
            <div>
              <small>Usual drive</small>
              <b>{hm(route.data.minutes)}</b>
            </div>
            <div>
              <small>Distance</small>
              <b>{units === "metric" ? `${Math.round(route.data.km)} km` : `${Math.round(route.data.km * 0.621)} mi`}</b>
            </div>
            {top && (
              <div>
                <small>Highest point</small>
                <b>{fmtElev(Math.round(top.elev / M_PER_FT / 100) * 100, units)}</b>
              </div>
            )}
          </div>
          <label className="sf-inline">
            Leaving at
            <input type="time" value={leave} onChange={e => setLeave(e.target.value || "07:00")} />
          </label>
          {road.loading && <Loading text="Checking road weather along the way…" />}
          {legs.length > 0 && (
            <>
              <ol className="sf-road" aria-label="Road weather along the drive">
                {legs.map((l, i) => (
                  <li key={i} className={`is-${l.noData ? "none" : l.level}`} title={`${Math.round(units === "metric" ? l.km : l.km * 0.621)} ${units === "metric" ? "km" : "mi"}: ${l.noData ? "beyond the forecast" : l.text}`}>
                    <i aria-hidden="true" />
                    <small>{new Date(l.eta).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small>
                  </li>
                ))}
              </ol>
              <p className={`sf-road-worst is-${worst?.level ?? "none"}`}>{worst ? (worst.level === "ok" ? "Dry roads expected the whole way." : `Worst stretch: ${worst.text.toLowerCase()}.`) : "That day is past the 3-day road forecast. Check again closer to the trip."}</p>
            </>
          )}
          <p className="sf-note">This is the normal drive time without traffic. Open Google Maps or Waze for live traffic and crashes.</p>
        </>
      )}
      <div className="sf-links">
        <a className="sf-btn" href={gmaps} target="_blank" rel="noreferrer">
          Live traffic in Google Maps <ExternalLink size={14} aria-hidden="true" />
        </a>
        <a className="sf-btn is-quiet" href={`https://waze.com/ul?ll=${spot.lat},${spot.lon}&navigate=yes`} target="_blank" rel="noreferrer">
          Waze <ExternalLink size={14} aria-hidden="true" />
        </a>
        {site && (
          <a className="sf-btn is-quiet" href={site.url} target="_blank" rel="noreferrer">
            {site.name}: closures &amp; chain laws <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
      {spot.kind === "resort" && (
        <p className="sf-parking">
          <ParkingSquare size={16} aria-hidden="true" />
          <span>
            {PARKING_CHECK.has(spot.id) ? <b>Parking reservations or paid lots have applied here on busy days. </b> : null}
            Lots fill early on weekends and powder days. No resort shares live parking counts publicly, so check{" "}
            <a href={spot.status} target="_blank" rel="noreferrer">
              {spot.name}'s site
            </a>{" "}
            before you go.
          </span>
        </p>
      )}
    </Card>
  );
}

function HomePicker({ home, onSet }) {
  const [editing, setEditing] = useState(!home);
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  async function search(e) {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setError(null);
    try {
      setResults(await searchPlaces(text.trim()));
    } catch (err) {
      setError(err.message);
    }
  }
  function locate() {
    setError(null);
    navigator.geolocation?.getCurrentPosition(
      p => {
        onSet({ name: "My location", lat: p.coords.latitude, lon: p.coords.longitude });
        setEditing(false);
      },
      () => setError("Couldn't get your location. Search for your town instead.")
    );
  }

  if (!editing && home) {
    return (
      <p className="sf-home">
        <MapPin size={15} aria-hidden="true" /> From <b>{home.name}</b>
        <button type="button" className="sf-link" onClick={() => setEditing(true)}>
          Change
        </button>
      </p>
    );
  }
  return (
    <div className="sf-home-edit">
      <form onSubmit={search} className="sf-search is-small">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Where you drive from (town or zip)" aria-label="Where you drive from" />
        <button type="submit" className="sf-btn">
          Find
        </button>
        <button type="button" className="sf-btn is-quiet" onClick={locate} aria-label="Use my location">
          <LocateFixed size={16} aria-hidden="true" />
        </button>
      </form>
      {error && <Problem text={error} />}
      {results && (
        <div className="sf-places">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              className="sf-place"
              onClick={() => {
                onSet({ name: [p.name, p.region].filter(Boolean).join(", "), lat: p.latitude, lon: p.longitude });
                setEditing(false);
                setResults(null);
              }}
            >
              <MapPin size={15} aria-hidden="true" /> {p.name} {p.region && <small>{p.region}</small>}
            </button>
          ))}
          {!results.length && <p className="sf-muted">No match.</p>}
        </div>
      )}
    </div>
  );
}
