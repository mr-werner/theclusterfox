import { useEffect, useMemo, useState } from "react";
import { BatteryCharging, ExternalLink, Fuel, Info, Zap } from "lucide-react";

import { fetchChargers, fetchGasPrices, fetchServices } from "../api";
import { STATE_BY_CODE } from "../data/states";
import shapes from "../data/stateShapes.json";
import { cumulative, fmtMiles, locate, pointAt, sampleEvery, shrink } from "../model/geo";
import { fuelCost, legRange, planStops, PLUGS, stopTargets, VEHICLE_PRESETS } from "../model/fuel";
import RoadMap from "./RoadMap";
import { Loading } from "./ui";
import { placeUrl } from "./links";

// A rough price for public DC fast charging, $/kWh, and how far a typical
// EV goes on one kWh. Used only for the trip cost estimate.
const DC_PRICE = 0.48;
const MI_PER_KWH = 3.3;

export default function FuelTab({ store, current, goPlan }) {
  const { data, patch } = store;
  const v = data.vehicle;
  const ev = v.kind === "ev";
  const [prices, setPrices] = useState(null);
  const [priceError, setPriceError] = useState(null);
  const [found, setFound] = useState({ key: null, state: "idle", list: [], source: null });

  useEffect(() => {
    const ctl = new AbortController();
    fetchGasPrices({ signal: ctl.signal })
      .then(setPrices)
      .catch(e => e.name !== "AbortError" && setPriceError(e.message));
    return () => ctl.abort();
  }, []);

  const route = current?.route;
  const range = legRange(v);
  const targetsKey = route ? `${current.id}|${Math.round(route.miles)}|${v.kind}|${Math.round(range.next)}|${v.plug}` : "";
  const needed = route ? stopTargets(route.miles, range).length : 0;
  const stations = found.key === targetsKey ? found : { state: needed ? "loading" : "none", list: [], source: null };
  const setStations = s => setFound({ ...s, key: targetsKey });

  // Stations near each spot you'll need one.
  useEffect(() => {
    if (!route || !needed) return undefined;
    const ctl = new AbortController();
    const signal = ctl.signal;
    const cum = cumulative(route.points);
    const targets = stopTargets(route.miles, range);
    const samples = sampleEvery(route.points, cum, Math.max(1, route.miles / 800));
    const place = list => list.map(s => ({ ...s, ...locate(samples, s) })).filter(s => s.off <= 3);
    (async () => {
      if (ev) {
        try {
          const line = shrink(route.points, 350).map(p => [p.lat, p.lon]);
          const list = await fetchChargers(line, v.plug, { signal });
          setStations({ state: "done", list: place(list.map(s => ({ ...s, kind: "ev" }))), source: "nrel" });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
      // OpenStreetMap: look along the stretch before each target.
      const windows = targets.map(t => {
        const pts = [];
        for (let m = Math.max(0, t - range.next * 0.5); m <= t; m += 4) pts.push(pointAt(route.points, cum, m));
        return { kind: ev ? "ev" : "fuel", points: pts, meters: ev ? 5000 : 2500 };
      });
      try {
        const list = await fetchServices(windows, { signal });
        setStations({ state: "done", list: place(list.filter(s => s.kind === (ev ? "ev" : "fuel"))), source: "osm" });
      } catch (e) {
        if (e.name !== "AbortError") setStations({ state: "error", list: [], source: null, error: e.message });
      }
    })();
    return () => ctl.abort();
  }, [targetsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const usable = useMemo(() => {
    let list = stations.list;
    if (ev) {
      const plug = PLUGS.find(p => p.id === v.plug)?.name.split(" ")[0];
      const fast = list.filter(s => s.fast > 0 && (!s.plugs.length || s.plugs.includes(plug)));
      list = fast.length ? fast : list;
    } else if (v.kind === "diesel") {
      const d = list.filter(s => s.diesel);
      list = d.length >= 3 ? d : list;
    }
    return list;
  }, [stations.list, ev, v.kind, v.plug]);

  const plan = useMemo(() => (route && stations.state === "done" ? planStops(route.miles, range, usable) : []), [route, usable, stations.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const cost = useMemo(() => (route && !ev ? fuelCost(route.points, v, prices?.[v.kind === "diesel" ? "diesel" : "gas"], shapes) : null), [route, v, prices, ev]);
  const evCost = route && ev ? (route.miles / MI_PER_KWH) * DC_PRICE : null;

  function setPreset(id) {
    const p = VEHICLE_PRESETS.find(x => x.id === id);
    if (p) patch({ vehicle: { ...v, ...p } });
  }
  const setV = (k, val) => patch({ vehicle: { ...v, id: "custom", [k]: val } });

  return (
    <div className="rf-fuel">
      <section className="rf-panel">
        <header className="rf-panel-head">
          <h2>Your vehicle</h2>
        </header>
        <div className="rf-vehicles" role="radiogroup" aria-label="Vehicle">
          {VEHICLE_PRESETS.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={v.id === p.id} className={v.id === p.id ? "is-on" : ""} onClick={() => setPreset(p.id)}>
              {p.kind === "ev" ? <Zap size={14} aria-hidden="true" /> : <Fuel size={14} aria-hidden="true" />} {p.name}
            </button>
          ))}
        </div>
        <div className="rf-fields">
          {ev ? (
            <>
              <label>
                <span>Range on a full charge</span>
                <input type="number" min="50" max="700" value={v.rangeMi} onChange={e => setV("rangeMi", Number(e.target.value) || 250)} /> <em>mi</em>
              </label>
              <label>
                <span>Plug</span>
                <select value={v.plug} onChange={e => setV("plug", e.target.value)}>
                  {PLUGS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Miles per gallon</span>
                <input type="number" min="3" max="150" value={v.mpg} onChange={e => setV("mpg", Number(e.target.value) || 25)} /> <em>mpg</em>
              </label>
              <label>
                <span>Tank size</span>
                <input type="number" min="3" max="200" value={v.tankGal} onChange={e => setV("tankGal", Number(e.target.value) || 15)} /> <em>gal</em>
              </label>
              <label>
                <span>Fuel</span>
                <select value={v.kind} onChange={e => setV("kind", e.target.value)}>
                  <option value="gas">Regular gas</option>
                  <option value="diesel">Diesel</option>
                </select>
              </label>
            </>
          )}
        </div>
        <p className="rf-muted rf-small">
          {ev ? `Stops are planned to arrive with about 15% left and charge to 80%, so about ${Math.round(range.next)} miles between chargers.` : `Stops are planned for when you're down to a quarter tank, about every ${Math.round(range.next)} miles.`}
        </p>
      </section>

      {!route ? (
        <section className="rf-panel rf-empty">
          <p>Plan a trip first, and this shows where to fill up {ev ? "and charge" : ""} along the way and what it'll cost.</p>
          <button type="button" className="rf-btn" onClick={goPlan}>
            Plan a trip
          </button>
          <GasPrices prices={prices} error={priceError} />
        </section>
      ) : (
        <>
          <section className="rf-panel rf-cost">
            <header className="rf-panel-head">
              <h2>
                {current.name} <small>{fmtMiles(route.miles)}</small>
              </h2>
            </header>
            {ev ? (
              <div className="rf-stats">
                <div>
                  <strong>${Math.round(evCost)}</strong>
                  <span>rough cost at fast chargers (${DC_PRICE.toFixed(2)}/kWh)</span>
                </div>
                <div>
                  <strong>{Math.round(route.miles / MI_PER_KWH)} kWh</strong>
                  <span>energy for the trip</span>
                </div>
                <div>
                  <strong>{plan.length}</strong>
                  <span>charging stop{plan.length === 1 ? "" : "s"}, about 30 min each</span>
                </div>
              </div>
            ) : (
              <div className="rf-stats">
                <div>
                  <strong>{cost?.cost ? `$${Math.round(cost.cost)}` : "—"}</strong>
                  <span>{cost?.cost ? `${v.kind === "diesel" ? "diesel" : "gas"} at this week's average prices` : priceError ? "prices unavailable right now" : "loading prices…"}</span>
                </div>
                <div>
                  <strong>{Math.round(cost?.gallons ?? 0)} gal</strong>
                  <span>at {v.mpg} mpg</span>
                </div>
                <div>
                  <strong>{plan.length}</strong>
                  <span>fuel stop{plan.length === 1 ? "" : "s"}</span>
                </div>
              </div>
            )}
            {!ev && cost?.byState.length > 0 && prices && (
              <ul className="rf-bystate">
                {cost.byState.filter(s => s.miles >= 5).map((s, i) => (
                  <li key={`${s.code}${i}`}>
                    <strong>{STATE_BY_CODE[s.code]?.name ?? "Outside the US"}</strong>
                    <span>{fmtMiles(s.miles)}</span>
                    <span>{Number.isFinite(s.price) ? `$${s.price.toFixed(2)}/gal avg` : "no price"}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="rf-muted rf-small rf-source">
              <Info size={13} aria-hidden="true" />
              {ev
                ? "Charging prices vary by network and time of day; check the station's app before you go."
                : `Prices are U.S. Energy Information Administration weekly averages${prices?.week ? ` for the week of ${new Date(`${prices.week}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}, for the state where EIA reports one and the region otherwise. Live prices at each station aren't available free, so check the pump.`}
            </p>
          </section>

          <section className="rf-panel">
            <header className="rf-panel-head">
              <h2>{ev ? "Where to charge" : "Where to fill up"}</h2>
            </header>
            {stations.state === "loading" && <Loading>{ev ? "Finding fast chargers along the route…" : "Finding gas stations along the route…"}</Loading>}
            {stations.state === "none" && <p className="rf-muted">You can make this whole drive without stopping{ev ? " to charge" : " for fuel"}. Start {ev ? "charged" : "with a full tank"}.</p>}
            {stations.state === "error" && <p className="rf-note is-warn">{stations.error}</p>}
            {stations.state === "done" && (
              <>
                <RoadMap
                  fit={shrink(route.points, 200)}
                  fitKey={targetsKey}
                  routes={[{ id: "r", points: route.points, active: true }]}
                  markers={plan.filter(p => p.station).map((p, i) => ({ id: p.station.id, kind: ev ? "ev" : "fuel", lat: p.station.lat, lon: p.station.lon, title: `${i + 1}. ${p.station.name}` }))}
                  height={300}
                  label="Map of fuel stops"
                />
                <ol className="rf-fuelstops">
                  {plan.map((p, i) => (
                    <li key={i}>
                      <span className="rf-fuel-icon">{ev ? <BatteryCharging size={16} aria-hidden="true" /> : <Fuel size={16} aria-hidden="true" />}</span>
                      {p.station ? (
                        <div className="rf-stop-body">
                          <strong>
                            {p.station.name}
                            {p.station.detail ? <span className="rf-muted"> · {p.station.detail}</span> : null}
                          </strong>
                          <span className="rf-muted">
                            Mile {Math.round(p.station.mile)}
                            {p.station.off >= 0.3 ? ` · ${p.station.off} mi off the route` : " · right on the route"}
                            {p.station.address ? ` · ${p.station.address}` : ""}
                          </span>
                          {ev && (
                            <span className="rf-muted">
                              {[p.station.network, p.station.fast ? `${p.station.fast} fast port${p.station.fast > 1 ? "s" : ""}` : null, p.station.plugs?.join(", "), p.station.pricing].filter(Boolean).join(" · ")}
                            </span>
                          )}
                          {!ev && (p.station.open24 || p.station.diesel) && <span className="rf-muted">{[p.station.open24 && "Open 24 hours", p.station.diesel && "Has diesel"].filter(Boolean).join(" · ")}</span>}
                          <span className="rf-stop-links">
                            <a href={placeUrl(p.station)} target="_blank" rel="noreferrer">
                              Map <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          </span>
                        </div>
                      ) : (
                        <div className="rf-stop-body">
                          <strong>Around mile {p.target}</strong>
                          <span className="rf-muted">No {ev ? "fast charger" : "station"} found in the map data right before here. {ev ? "Charge" : "Fill up"} earlier to be safe.</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="rf-muted rf-small rf-source">
                  <Info size={13} aria-hidden="true" />
                  {stations.source === "nrel" ? "Chargers from the U.S. Department of Energy's Alternative Fuels Data Center (NREL)." : "Stations from OpenStreetMap."}
                </p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function GasPrices({ prices, error }) {
  if (error) return null;
  if (!prices) return <Loading>Loading this week's gas prices…</Loading>;
  const rows = [
    ["NUS", "U.S. average"],
    ["R1X", "New England"],
    ["R1Y", "Central Atlantic"],
    ["R1Z", "Lower Atlantic"],
    ["R20", "Midwest"],
    ["R30", "Gulf Coast"],
    ["R40", "Rocky Mountain"],
    ["R5XCA", "West Coast (not CA)"],
    ["SCA", "California"],
  ];
  return (
    <div className="rf-prices">
      <h3>This week's average gas prices</h3>
      <ul className="rf-bystate">
        {rows.filter(([a]) => Number.isFinite(prices.gas[a])).map(([a, name]) => (
          <li key={a}>
            <strong>{name}</strong>
            <span>${prices.gas[a].toFixed(2)} regular</span>
            <span>{Number.isFinite(prices.diesel[a]) ? `$${prices.diesel[a].toFixed(2)} diesel` : ""}</span>
          </li>
        ))}
      </ul>
      <p className="rf-muted rf-small">U.S. Energy Information Administration, week of {prices.week}.</p>
    </div>
  );
}
