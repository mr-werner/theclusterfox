import { useState } from "react";
import { AlertTriangle, CableCar, ExternalLink, Layers, ShieldAlert } from "lucide-react";

import { fetchAlerts, fetchAvalanche, fetchLifts, fetchSnotel } from "../api";
import { useLoad } from "../model/useLoad";
import { fmtDepth, fmtElev, hourAt } from "../model/snow";
import { Card, DangerChip, Loading, Problem } from "./ui";

const LIFT_WORD = { open: "Open", hold: "On hold", scheduled: "Opens later", closed: "Closed" };

/** Live lift status (from Liftie), and the honest word on wait times. */
export function LiftsCard({ spot }) {
  const live = useLoad(spot.liftie ? `lifts-${spot.liftie}` : null, signal => fetchLifts(spot.liftie, { signal }));
  const [all, setAll] = useState(false);
  const lifts = live.data?.lifts ?? [];
  const order = { open: 0, hold: 1, scheduled: 2, closed: 3 };
  const shown = [...lifts].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  return (
    <Card
      title="Lifts"
      icon={CableCar}
      aside={
        <a className="sf-link" href={spot.status} target="_blank" rel="noreferrer">
          Official status <ExternalLink size={13} aria-hidden="true" />
        </a>
      }
    >
      {!spot.liftie && <p className="sf-muted">Live lift status isn't tracked for {spot.name} yet. The resort's own page above has today's lifts and runs.</p>}
      {live.loading && <Loading text="Checking which lifts are spinning…" />}
      {live.error && (
        // Liftie turns away some server requests, but its widget loads fine
        // in a person's own browser, so show that instead.
        <iframe className="sf-liftie" title={`${spot.name} lift status`} src={`https://liftie.info/widget/resort/${spot.liftie}`} loading="lazy" referrerPolicy="no-referrer" />
      )}
      {live.data && (
        <>
          <div className="sf-lift-sum">
            <span className="is-open">
              <b>{live.data.open}</b> open
            </span>
            {live.data.hold > 0 && (
              <span className="is-hold">
                <b>{live.data.hold}</b> on hold
              </span>
            )}
            {live.data.scheduled > 0 && (
              <span className="is-scheduled">
                <b>{live.data.scheduled}</b> later today
              </span>
            )}
            <span className="is-closed">
              <b>{live.data.closed}</b> closed
            </span>
          </div>
          {lifts.length === 0 ? (
            <p className="sf-muted">No lifts reported yet (often before opening day).</p>
          ) : (
            <ul className={`sf-lifts${all ? " is-all" : ""}`}>
              {(all ? shown : shown.slice(0, 12)).map(l => (
                <li key={l.name} className={`is-${l.status}`}>
                  <i aria-hidden="true" />
                  {l.name}
                  <small>{LIFT_WORD[l.status]}</small>
                </li>
              ))}
            </ul>
          )}
          {lifts.length > 12 && (
            <button type="button" className="sf-btn is-quiet" onClick={() => setAll(v => !v)}>
              {all ? "Show fewer" : `Show all ${lifts.length} lifts`}
            </button>
          )}
        </>
      )}
      {(live.data || live.error) && <p className="sf-credit">Live status via Liftie, which reads the resort's own page.</p>}
      <p className="sf-note">
        <b>Lift lines:</b> no resort shares live wait times publicly (Vail shows some only inside its own app), so SnowFox can't show them. The crowd outlook above is an estimate from weekends, holidays and fresh snow.
      </p>
    </Card>
  );
}

/** Snow on the ground: the model's depth, and real SNOTEL sensors nearby. */
export function SnowpackCard({ spot, summitHours, units }) {
  const now = hourAt(summitHours);
  const us = spot.country === "US" && spot.state !== "NH" && spot.lon < -100;
  const sensors = useLoad(us ? `snotel-${spot.lat},${spot.lon}` : null, signal => fetchSnotel(spot, { signal }));
  return (
    <Card title="Snow on the ground" icon={Layers}>
      <dl className="sf-facts">
        <div>
          <dt>Model depth at the top</dt>
          <dd>{Number.isFinite(now?.depth) ? fmtDepth(now.depth, units) : "Not available here"}</dd>
        </div>
      </dl>
      {!us && <p className="sf-muted">SNOTEL snow sensors cover the western US and Alaska. Check the resort's report for measured depth.</p>}
      {sensors.loading && <Loading text="Reading nearby SNOTEL sensors…" />}
      {sensors.error && <Problem text={sensors.error} />}
      {sensors.data && sensors.data.length === 0 && <p className="sf-muted">No SNOTEL sensor within about 28 miles.</p>}
      {sensors.data?.length > 0 && (
        <div className="sf-snotel">
          {sensors.data.map(site => (
            <article key={site.id}>
              <header>
                <strong>{site.name}</strong>
                <small>
                  {fmtElev(site.elev, units)} · {units === "metric" ? `${site.km} km` : `${Math.round(site.km * 0.621)} mi`} away
                </small>
              </header>
              <dl>
                <div>
                  <dt>Depth</dt>
                  <dd>{site.depthIn === null ? "–" : units === "metric" ? `${Math.round(site.depthIn * 2.54)} cm` : `${Math.round(site.depthIn)}″`}</dd>
                </div>
                <div>
                  <dt>24h change</dt>
                  <dd>{site.depth24 === null ? "–" : `${site.depth24 > 0 ? "+" : ""}${units === "metric" ? Math.round(site.depth24 * 2.54) + " cm" : site.depth24 + "″"}`}</dd>
                </div>
                <div>
                  <dt>Water in snow</dt>
                  <dd>{site.sweIn === null ? "–" : units === "metric" ? `${Math.round(site.sweIn * 25.4)} mm` : `${site.sweIn}″`}</dd>
                </div>
                <div>
                  <dt>Temp</dt>
                  <dd>{site.tempF === null ? "–" : units === "metric" ? `${Math.round(((site.tempF - 32) * 5) / 9)}°C` : `${Math.round(site.tempF)}°F`}</dd>
                </div>
              </dl>
              {site.date && <small className="sf-muted">As of {site.date}</small>}
            </article>
          ))}
          <p className="sf-credit">
            Measured by USDA NRCS SNOTEL sensors (
            <a href="https://www.nrcs.usda.gov/wps/portal/wcc/home/" target="_blank" rel="noreferrer">
              National Water and Climate Center
            </a>
            ).
          </p>
        </div>
      )}
    </Card>
  );
}

/** The avalanche forecast zone this spot sits in. */
export function AvalancheCard({ spot, emphasize }) {
  const avy = useLoad(`avy-${spot.lat},${spot.lon}`, signal => fetchAvalanche(spot, { signal }));
  const a = avy.data;
  return (
    <Card title="Avalanche forecast" icon={ShieldAlert} className={emphasize ? "is-emphasized" : ""} aside={a && <DangerChip level={a.level} />}>
      {avy.loading && <Loading text="Finding the avalanche forecast…" />}
      {avy.error && <Problem text={avy.error} />}
      {!avy.loading && !avy.error && !a && <p className="sf-muted">No avalanche center forecasts this area.</p>}
      {a && (
        <>
          <p className="sf-avy-where">
            <strong>{a.center}</strong>
            {a.zone ? ` · ${a.zone}` : ""}
          </p>
          {a.bands?.length > 0 && (
            <ul className="sf-bands">
              {a.bands.map(b => (
                <li key={b.name}>
                  <span>{b.name}</span>
                  <DangerChip level={b.level} small />
                </li>
              ))}
            </ul>
          )}
          {a.warning && <p className="sf-problem">{a.warning}</p>}
          {a.level < 1 && <p className="sf-muted">{a.offSeason ? "This center is between seasons." : "No danger rating today: early or late season, or not issued yet."} Avalanches can still happen wherever there's snow on a slope.</p>}
          {a.advice && <p>{a.advice}</p>}
          <a className="sf-btn" href={a.link} target="_blank" rel="noreferrer">
            Read the full forecast <ExternalLink size={14} aria-hidden="true" />
          </a>
          {!emphasize && <p className="sf-note">Inside resort boundaries, ski patrol does avalanche control. This forecast matters if you head through a backcountry gate.</p>}
        </>
      )}
      <p className="sf-credit">From {spot.country === "CA" ? "Avalanche Canada" : "avalanche.org and the local avalanche center"}. Always carry a beacon, shovel and probe in the backcountry, and know how to use them.</p>
    </Card>
  );
}

/** NWS watches and warnings (US). */
export function AlertsCard({ spot }) {
  const alerts = useLoad(spot.country === "US" ? `nws-${spot.lat},${spot.lon}` : null, signal => fetchAlerts(spot, { signal }));
  const [open, setOpen] = useState(null);
  if (!alerts.data?.length) return null;
  return (
    <div className="sf-alerts">
      {alerts.data.map(a => (
        <article key={a.id} className={`sf-alert sf-alert--${(a.severity ?? "").toLowerCase()}`}>
          <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              <strong>{a.event}</strong>
              {a.ends && <small>Until {new Date(a.ends).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</small>}
            </span>
          </button>
          {open === a.id && (
            <div className="sf-alert-body">
              <p>{a.description}</p>
              {a.instruction && <p>{a.instruction}</p>}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
