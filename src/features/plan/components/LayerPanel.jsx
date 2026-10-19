import { useState } from "react";
import { Link2, LoaderCircle, Plus, Trash2, X } from "lucide-react";

import { LEAGUES } from "../../../services/watch/parse";
import { forgetFeed } from "../../../services/plan/planApi";
import { feedUrlLooksValid } from "../model/feeds";
import { COUNTRIES } from "../model/holidays";
import { LAYERS } from "../state/planStore";

// Layers people asked for that need a paid or keyed data source first.
const COMING = [
  { name: "Flight prices", why: "Needs a flight data provider (such as Duffel or Kiwi), which charges or needs approval." },
  { name: "Local events & concerts", why: "Needs a free Ticketmaster or SeatGeek key." },
  { name: "Traffic", why: "Needs a traffic data key (TomTom, HERE or Google)." },
  { name: "Road closures & city projects", why: "Each city publishes its own open data; most can be linked as a calendar below." },
];

const STATUS_TEXT = {
  loading: "Loading…",
  error: "Couldn't load",
  "no-key": "Needs a key",
  range: "Shown in month and agenda views",
};

export default function LayerPanel({ data, update, toggleLayer, status, errors, feedErrors, onClose }) {
  const [teamText, setTeamText] = useState("");
  const [feedName, setFeedName] = useState("");
  const [feedLink, setFeedLink] = useState("");
  const [feedMessage, setFeedMessage] = useState("");
  const groups = [...new Set(LAYERS.map(l => l.group))];

  function addTeam(event) {
    event.preventDefault();
    const name = teamText.trim();
    if (!name) return;
    update(current => ({ teams: [...new Set([...current.teams, name])] }));
    setTeamText("");
  }

  function addFeed(event) {
    event.preventDefault();
    const url = feedLink.trim();
    if (!feedUrlLooksValid(url)) {
      setFeedMessage("Paste a calendar link that starts with https:// or webcal://.");
      return;
    }
    update(current => ({
      feeds: [...current.feeds.filter(f => f.url !== url), { id: crypto.randomUUID(), name: feedName.trim() || "Linked calendar", url, updatedAt: new Date().toISOString() }],
      layers: { ...current.layers, feeds: true },
    }));
    setFeedName("");
    setFeedLink("");
    setFeedMessage("");
  }

  function removeFeed(feed) {
    forgetFeed(feed.url);
    update(current => ({ feeds: current.feeds.filter(f => f.id !== feed.id) }));
  }

  return (
    <section className="pf-panel pf-layers" aria-label="Layers">
      <header className="pf-day-head">
        <div>
          <p className="pf-eyebrow">WHAT SHOWS ON YOUR CALENDAR</p>
          <h2>Layers</h2>
        </div>
        <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close layers">
          <X size={18} />
        </button>
      </header>

      {groups.map(group => (
        <div key={group} className="pf-layer-group">
          <h3>{group}</h3>
          <ul>
            {LAYERS.filter(l => l.group === group).map(layer => {
              const state = data.layers[layer.id] ? status[layer.id] : null;
              return (
                <li key={layer.id}>
                  <label className={`pf-layer pf-l-${layer.id}`}>
                    <input type="checkbox" checked={data.layers[layer.id]} onChange={() => toggleLayer(layer.id)} />
                    <span className="pf-swatch" aria-hidden="true" />
                    <span>
                      <strong>{layer.name}</strong>
                      {layer.source && <span className="pf-muted"> · {layer.source}</span>}
                      {state && STATUS_TEXT[state] && (
                        <span className={`pf-layer-status is-${state}`} title={errors[layer.id] ?? undefined}>
                          {state === "loading" && <LoaderCircle size={12} className="spin" aria-hidden="true" />} {STATUS_TEXT[state]}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="pf-layer-group">
        <h3>Holidays for</h3>
        <select value={data.country} onChange={e => update({ country: e.target.value })} aria-label="Country">
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {data.layers.sports && (
        <div className="pf-layer-group">
          <h3>Sports</h3>
          <ul className="pf-chips" aria-label="Leagues">
            {LEAGUES.map(league => (
              <li key={league.id}>
                <button
                  type="button"
                  className="pf-chip"
                  aria-pressed={data.leagues.includes(league.id)}
                  onClick={() =>
                    update(current => ({
                      leagues: current.leagues.includes(league.id) ? current.leagues.filter(l => l !== league.id) : [...current.leagues, league.id],
                    }))
                  }
                >
                  {league.name}
                </button>
              </li>
            ))}
          </ul>
          <form className="pf-inline-form" onSubmit={addTeam}>
            <input value={teamText} onChange={e => setTeamText(e.target.value)} placeholder="Add a team, e.g. Bears" aria-label="Team name" maxLength={40} />
            <button type="submit" className="pf-btn">
              <Plus size={15} aria-hidden="true" /> Team
            </button>
          </form>
          {data.teams.length > 0 ? (
            <ul className="pf-chips" aria-label="Your teams">
              {data.teams.map(team => (
                <li key={team}>
                  <button type="button" className="pf-chip is-on" onClick={() => update(current => ({ teams: current.teams.filter(t => t !== team) }))} aria-label={`Remove ${team}`}>
                    {team} <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pf-note">Add your teams to see their games on the calendar. Other games stay as a count you can open.</p>
          )}
        </div>
      )}

      <div className="pf-layer-group">
        <h3>Linked calendars</h3>
        <p className="pf-note">
          School calendars, work, your team's schedule or your city's events. Paste the iCal or "subscribe" link (it ends in .ics or starts with webcal://). Google Calendar: Settings → your
          calendar → "Secret address in iCal format".
        </p>
        <ul className="pf-feeds">
          {data.feeds.map(feed => {
            const error = feedErrors.find(f => f.id === feed.id)?.error;
            return (
              <li key={feed.id}>
                <Link2 size={15} aria-hidden="true" />
                <span>
                  <strong>{feed.name}</strong>
                  {error && <span className="pf-layer-status is-error"> {error}</span>}
                </span>
                <button type="button" className="pf-icon-btn" onClick={() => removeFeed(feed)} aria-label={`Remove ${feed.name}`}>
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
        <form className="pf-feed-form" onSubmit={addFeed}>
          <input value={feedName} onChange={e => setFeedName(e.target.value)} placeholder="Name, e.g. School" aria-label="Calendar name" maxLength={60} />
          <input value={feedLink} onChange={e => setFeedLink(e.target.value)} placeholder="https://… or webcal://…" aria-label="Calendar link" inputMode="url" />
          <button type="submit" className="pf-btn">
            <Plus size={15} aria-hidden="true" /> Link
          </button>
        </form>
        {feedMessage && <p className="pf-note is-warn">{feedMessage}</p>}
      </div>

      <div className="pf-layer-group">
        <h3>Coming later</h3>
        <ul className="pf-coming">
          {COMING.map(c => (
            <li key={c.name}>
              <strong>{c.name}</strong>
              <span className="pf-muted"> · {c.why}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
