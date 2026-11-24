import { useState } from "react";
import { BedDouble, Check, ExternalLink, MapPin, Star } from "lucide-react";

import { STAY_KINDS } from "../state/tripStore";
import { maxNightly, staysForNightly } from "../model/budget";
import { fmtMiles, fmtMoney } from "../model/geo";
import { LODGING, mapLink, stayLinks } from "../model/places";
import { Loading, MoneyInput, Segmented } from "./ui";

/** Where to sleep: what fits the budget, places nearby, and where to book them. */
export default function StayTab({ trip, setTrip, sources, context, go }) {
  const [all, setAll] = useState(false);
  const [shown, setShown] = useState(20);
  if (!trip.dest) {
    return (
      <section className="tx-card">
        <p>Pick where you're going first.</p>
        <button type="button" className="tx-btn" onClick={() => go("plan")}>
          Pick a place
        </button>
      </section>
    );
  }
  const fit = maxNightly(trip, context);
  const fits = fit != null ? staysForNightly(fit) : null;
  const kinds = LODGING[trip.stayKind] ?? [];
  const stays = sources.stays.value ?? [];
  const list = all ? stays : stays.filter(s => kinds.includes(s.kind));
  const pickKind = id => setTrip({ stayKind: id, nightly: STAY_KINDS.find(k => k.id === id).nightly });

  return (
    <div className="tx-stack">
      <section className="tx-card">
        <h2>Where you'll sleep</h2>
        <Segmented label="Kind of place" value={trip.stayKind} options={STAY_KINDS} onChange={pickKind} />
        {trip.stayKind !== "free" && (
          <MoneyInput
            label="Most you'd pay a night"
            value={trip.nightly}
            onChange={nightly => setTrip({ nightly: nightly ?? 0 })}
            hint={`For ${trip.rooms} room${trip.rooms > 1 ? "s" : ""}, before taxes and fees`}
          />
        )}
        {fit != null && (
          <div className={`tx-callout${fit < trip.nightly ? " is-warn" : ""}`}>
            {fit > 0 ? (
              <>
                <p>
                  To stay within your {fmtMoney(trip.budget)} budget, keep each night under <strong>{fmtMoney(fit)}</strong>
                  {trip.rooms > 1 ? " a room" : ""}.
                </p>
                {fits.length > 0 && <p className="tx-muted">That fits: {fits.map(k => k.name.toLowerCase()).join(", ")}.</p>}
                {fit < trip.nightly && (
                  <button type="button" className="tx-btn is-small" onClick={() => setTrip({ nightly: Math.max(0, fit) })}>
                    Use {fmtMoney(fit)} a night
                  </button>
                )}
              </>
            ) : (
              <p>Getting there, food and things to do already use your whole budget. Free camping or staying with friends keeps the nights at $0.</p>
            )}
          </div>
        )}
        {fit == null && !trip.budget && (
          <p className="tx-muted tx-small">
            Set a total on the{" "}
            <button type="button" className="tx-link" onClick={() => go("budget")}>
              budget
            </button>{" "}
            and TripFox works out what you can spend a night.
          </p>
        )}
        <ul className="tx-links">
          {stayLinks(trip, trip.stayKind === "free" ? 0 : Math.min(trip.nightly, fit ?? Infinity)).map(l => (
            <li key={l.id}>
              <a href={l.href} target="_blank" rel="noreferrer">
                {l.name} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span className="tx-muted">{l.note}</span>
            </li>
          ))}
        </ul>
        <p className="tx-muted tx-small">Prices change by the day, so the links open with your dates and group filled in.</p>
      </section>

      {trip.stay && (
        <section className="tx-card tx-picked-stay">
          <BedDouble size={20} aria-hidden="true" />
          <div>
            <p className="tx-label">Staying at</p>
            <strong>{trip.stay.name}</strong>
          </div>
          <button type="button" className="tx-link" onClick={() => setTrip({ stay: null })}>
            Remove
          </button>
        </section>
      )}

      <section className="tx-card">
        <header className="tx-card-head">
          <h2>
            Places near {trip.dest.name} <small>{stays.length ? `${list.length} of ${stays.length}` : ""}</small>
          </h2>
          <label className="tx-check">
            <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Every kind
          </label>
        </header>
        {sources.stays.status === "loading" && <Loading>Looking for places to stay…</Loading>}
        {sources.stays.status === "error" && <p className="tx-note">OpenStreetMap is busy right now, so the list can't load. The booking links above still work.</p>}
        {sources.stays.status === "ok" && !list.length && <p className="tx-note">{trip.stayKind === "free" ? "Free spots are rarely mapped. Try FreeCampsites.net above." : "None of that kind mapped nearby. Tick Every kind, or use the links above."}</p>}
        <ul className="tx-stays">
          {list.slice(0, shown).map(s => (
            <li key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <p className="tx-muted tx-small">
                  {s.label}
                  {s.stars && (
                    <>
                      {" "}
                      · {s.stars} <Star size={11} aria-label="stars" />
                    </>
                  )}
                  {s.free && " · free"} · {fmtMiles(s.miles)} from the center
                </p>
              </div>
              <div className="tx-thing-actions">
                {trip.stay?.id === s.id ? (
                  <span className="tx-added">
                    <Check size={14} aria-hidden="true" /> Your stay
                  </span>
                ) : (
                  <button type="button" className="tx-btn is-small" onClick={() => setTrip({ stay: { id: s.id, name: s.name, lat: s.lat, lon: s.lon, kind: s.kind, url: s.url } })}>
                    Stay here
                  </button>
                )}
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="tx-link">
                    Website <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
                <a href={mapLink(s.lat, s.lon, s.name)} target="_blank" rel="noreferrer" className="tx-link">
                  Map <MapPin size={12} aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
        {list.length > shown && (
          <button type="button" className="tx-btn is-quiet" onClick={() => setShown(n => n + 20)}>
            Show more
          </button>
        )}
        <p className="tx-muted tx-small">Places from OpenStreetMap. Not every place is mapped.</p>
      </section>
    </div>
  );
}
