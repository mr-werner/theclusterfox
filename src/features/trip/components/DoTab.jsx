import { useState } from "react";
import { Check, CloudRain, ExternalLink, MapPin } from "lucide-react";

import { fmtTime, shortDay } from "../model/days";
import { fmtMiles } from "../model/geo";
import { KINDS, kindName, mapLink } from "../model/places";
import { Loading } from "./ui";

const sourceNote = (name, s) => {
  if (s.status === "loading") return `${name}: looking…`;
  if (s.status === "error") return `${name}: not answering right now`;
  if (s.status === "no-key") return `${name}: not switched on for this site yet`;
  if (s.status === "ok") return `${name}: ${s.value.length} found`;
  return null;
};

/** Put a thing on a day (or the ideas list). */
function AddButton({ thing, days, planned, onAdd }) {
  if (planned) {
    return (
      <span className="tx-added">
        <Check size={14} aria-hidden="true" /> {planned.day ? shortDay(planned.day) : "In your ideas"}
      </span>
    );
  }
  if (thing.day) {
    return (
      <button type="button" className="tx-btn is-small" onClick={() => onAdd(thing, thing.day)}>
        Add to {shortDay(thing.day)}
      </button>
    );
  }
  return (
    <select className="tx-add-select" value="" aria-label={`Add ${thing.title} to a day`} onChange={e => e.target.value && onAdd(thing, e.target.value === "idea" ? null : e.target.value)}>
      <option value="">Add to…</option>
      <option value="idea">Ideas (any day)</option>
      {days.map(d => (
        <option key={d} value={d}>
          {shortDay(d)}
        </option>
      ))}
    </select>
  );
}

/** Things to do where you're going: landmarks, museums, parks, family fun and shows on your dates. */
export default function DoTab({ trip, sources, addThing, go }) {
  const [kind, setKind] = useState("all");
  const [rainy, setRainy] = useState(false);
  const [shown, setShown] = useState(24);
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
  const { wiki, osm, events, things, days } = sources;
  const list = things.filter(t => (kind === "all" || t.kind === kind || (kind === "family" && t.family)) && (!rainy || t.indoor));
  const loading = [wiki, osm, events].some(s => s.status === "loading");
  const notes = [sourceNote("Wikipedia", wiki), sourceNote("OpenStreetMap", osm), sourceNote("Ticketmaster events", events)].filter(Boolean);
  const plannedById = new Map(trip.plan.map(p => [p.id, p]));

  return (
    <div className="tx-stack">
      <section className="tx-card">
        <header className="tx-card-head">
          <h2>
            Things to do near {trip.dest.name} <small>{things.length ? `${things.length} ideas` : ""}</small>
          </h2>
        </header>
        <div className="tx-chips" role="group" aria-label="Kind">
          {[{ id: "all", name: "Everything" }, ...KINDS].map(k => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.name}
            </button>
          ))}
          <button type="button" aria-pressed={rainy} onClick={() => setRainy(v => !v)} title="Only things indoors">
            <CloudRain size={14} aria-hidden="true" /> Rainy day
          </button>
        </div>
        {trip.kids > 0 && <p className="tx-muted tx-small">Traveling with kids, so zoos, aquariums and family shows come first.</p>}
        <p className="tx-muted tx-small">{notes.join(" · ")}</p>
      </section>

      {loading && !things.length && <Loading>Finding things to do…</Loading>}
      {!loading && !things.length && <p className="tx-note">Nothing found nearby. If a source above isn't answering, try again in a minute.</p>}
      {things.length > 0 && !list.length && <p className="tx-note">Nothing of that kind nearby. Try another.</p>}

      <ul className="tx-things">
        {list.slice(0, shown).map(t => (
          <li key={t.id} className="tx-thing">
            {t.image && <img src={t.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => e.currentTarget.remove()} />}
            <div className="tx-thing-body">
              <p className="tx-thing-kind">
                {kindName(t.kind)}
                {t.indoor && " · indoors"}
                {t.miles != null && ` · ${fmtMiles(t.miles)}`}
              </p>
              <h3>{t.title}</h3>
              {t.day && (
                <p className="tx-small">
                  {shortDay(t.day)}
                  {t.time && ` at ${fmtTime(t.time)}`}
                  {t.price != null && ` · from $${Math.round(t.price)}`}
                </p>
              )}
              {t.about && <p className="tx-muted tx-small">{t.about}</p>}
              <div className="tx-thing-actions">
                <AddButton thing={t} days={days} planned={plannedById.get(t.id)} onAdd={addThing} />
                {t.url && (
                  <a href={t.url} target="_blank" rel="noreferrer" className="tx-link">
                    {t.kind === "events" ? "Tickets" : "Read more"} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
                {t.lat != null && (
                  <a href={mapLink(t.lat, t.lon, t.title)} target="_blank" rel="noreferrer" className="tx-link">
                    Map <MapPin size={12} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {list.length > shown && (
        <button type="button" className="tx-btn is-quiet" onClick={() => setShown(n => n + 24)}>
          Show more ({list.length - shown} left)
        </button>
      )}
      {!days.length && things.length > 0 && <p className="tx-note">Set your dates to put things on a day. Until then they go on your ideas list.</p>}
    </div>
  );
}
