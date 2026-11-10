import { useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";

import { networkLink } from "../../../services/watch/links";
import { canWatchNetwork, isBroadcastNetwork } from "../../../services/watch/parse";
import { canWatch, eventTime } from "../model/schedule";

// How each kind of event looks in the schedule: team games, fight cards,
// golf and racing leaderboards, tennis matches and simple listings.

const clock = iso => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const shortDay = iso => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function Networks({ networks, networkKeys, compact = false }) {
  if (!networks?.length) return compact ? null : <ul className="wf-networks"><li className="wf-muted">No TV listing yet</li></ul>;
  return (
    <ul className="wf-networks" aria-label="Where it's on">
      {networks.map(network => {
        const mine = canWatchNetwork(network.name, networkKeys);
        const regional = network.market && network.market !== "national";
        const link = networkLink(network.name);
        const label = (
          <>
            {network.name}
            {regional && <span className="wf-net-tag">{network.market === "home" ? "home area" : "away area"}</span>}
            {!mine && isBroadcastNetwork(network.name) && <span className="wf-net-tag">free with antenna</span>}
          </>
        );
        return (
          <li key={`${network.name}-${network.market}`} className={mine ? "is-mine" : undefined}>
            {link ? (
              <a href={link} target="_blank" rel="noreferrer">
                {label}
              </a>
            ) : (
              label
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Time({ event }) {
  const time = eventTime(event);
  return <p className={`wf-game-time${time.live ? " is-live" : ""}`}>{time.text}</p>;
}

// The betting line in one quiet row under a game.
export function OddsLine({ odds, home, away }) {
  if (!odds) return null;
  const parts = [
    odds.details ? (odds.details === "EVEN" ? "Even" : odds.details) : null,
    odds.overUnder !== null && odds.overUnder !== undefined ? `O/U ${odds.overUnder}` : null,
    odds.awayMoneyline || odds.homeMoneyline ? `ML ${away?.abbreviation || "Away"} ${odds.awayMoneyline || "–"} · ${home?.abbreviation || "Home"} ${odds.homeMoneyline || "–"}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="sf-odds">
      <span className="sf-odds-tag">Line</span>
      {parts.join("  ·  ")}
      {odds.provider && <span className="sf-odds-by">{odds.provider}</span>}
    </p>
  );
}

export function MatchRow({ game, networkKeys, showOdds, onOpen }) {
  const showScore = game.state !== "pre" && game.home.score != null;
  return (
    <li className={`wf-game sf-match${canWatch(game, networkKeys) ? " is-mine" : ""}`}>
      <button type="button" className="sf-match-open" onClick={onOpen} aria-label={`Details for ${game.name || `${game.away.name} at ${game.home.name}`}`}>
        <Time event={game} />
        <div className="wf-game-teams">
          {[game.away, game.home].map((team, i) => (
            <p key={i}>
              {team.logo && <img src={team.logo} alt="" width="20" height="20" loading="lazy" />}
              <span>{team.name}</span>
              {team.record && !showScore && <small className="sf-record">{team.record}</small>}
              {showScore && <strong>{team.score}</strong>}
            </p>
          ))}
        </div>
        <ChevronRight size={18} className="sf-chevron" aria-hidden="true" />
      </button>
      <Networks networks={game.networks} networkKeys={networkKeys} />
      {showOdds && game.state === "pre" && <OddsLine odds={game.odds} home={game.home} away={game.away} />}
    </li>
  );
}

function Fighter({ fighter, right = false }) {
  return (
    <span className={`sf-fighter${right ? " is-right" : ""}${fighter.winner ? " is-winner" : ""}`}>
      {fighter.flag && <img src={fighter.flag} alt={fighter.country} width="18" height="12" loading="lazy" />}
      <span>
        <strong>{fighter.name}</strong>
        {fighter.record && <small>{fighter.record}</small>}
      </span>
    </span>
  );
}

function Bout({ bout, main = false }) {
  return (
    <li className={`sf-bout${main ? " is-main" : ""}`}>
      <p className="sf-bout-meta">
        {main && <span className="sf-odds-tag">Main event</span>}
        {bout.weight}
        {bout.rounds ? ` · ${bout.rounds} rounds` : ""}
        {bout.state !== "pre" && <span className="sf-bout-state">{bout.detail}</span>}
      </p>
      <div className="sf-bout-row">
        <Fighter fighter={bout.a} />
        <span className="sf-vs">vs</span>
        <Fighter fighter={bout.b} right />
      </div>
    </li>
  );
}

function Reveal({ count, open, onToggle, label }) {
  if (count <= 0) return null;
  return (
    <button type="button" className="wf-link-btn sf-reveal" aria-expanded={open} onClick={onToggle}>
      <ChevronDown size={15} aria-hidden="true" className={open ? "is-open" : undefined} />
      {open ? "Show less" : `${label} (${count} more)`}
    </button>
  );
}

export function CardEvent({ event, networkKeys }) {
  const [open, setOpen] = useState(false);
  const [main, ...rest] = event.bouts;
  return (
    <li className={`wf-game sf-block${canWatch(event, networkKeys) ? " is-mine" : ""}`}>
      <div className="sf-block-head">
        <Time event={event.state === "pre" && main?.start ? { ...event, start: main.start } : event} />
        <div>
          <h4>{event.name}</h4>
          {event.venue && (
            <p className="wf-muted sf-venue">
              <MapPin size={13} aria-hidden="true" /> {event.venue}
            </p>
          )}
        </div>
      </div>
      <Networks networks={event.networks} networkKeys={networkKeys} />
      {main && (
        <ul className="sf-bouts">
          <Bout bout={main} main />
          {open && rest.map(bout => <Bout key={bout.id} bout={bout} />)}
        </ul>
      )}
      <Reveal count={rest.length} open={open} onToggle={() => setOpen(v => !v)} label="Full fight card" />
    </li>
  );
}

export function FieldEvent({ event, networkKeys }) {
  const [open, setOpen] = useState(false);
  const leaders = event.leaderboard?.leaders ?? [];
  const started = event.state !== "pre";
  const shown = open ? leaders : leaders.slice(0, started ? 5 : 0);
  const dates = event.end && event.start && shortDay(event.end) !== shortDay(event.start) ? `${shortDay(event.start)} – ${shortDay(event.end)}` : "";
  return (
    <li className={`wf-game sf-block${canWatch(event, networkKeys) ? " is-mine" : ""}`}>
      <div className="sf-block-head">
        <Time event={event} />
        <div>
          <h4>{event.name}</h4>
          <p className="wf-muted sf-venue">
            {[dates, event.venue].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {event.sessions?.length > 0 && (
        <ul className="sf-sessions" aria-label="Sessions">
          {event.sessions.map(s => (
            <li key={`${s.name}-${s.start}`} className={s.state === "in" ? "is-live" : s.state === "post" ? "is-done" : undefined}>
              <strong>{s.name}</strong> {s.start ? `${new Date(s.start).toLocaleDateString(undefined, { weekday: "short" })} ${clock(s.start)}` : ""}
            </li>
          ))}
        </ul>
      )}
      <Networks networks={event.networks} networkKeys={networkKeys} />
      {shown.length > 0 && (
        <>
          {event.leaderboard.session && <p className="sf-bout-meta">{event.leaderboard.session} results</p>}
          <ol className="sf-board">
            {shown.map((p, i) => (
              <li key={`${p.name}-${i}`}>
                <span className="sf-pos">{p.position ?? i + 1}</span>
                <span className="sf-flag">{p.flag && <img src={p.flag} alt={p.country} width="18" height="12" loading="lazy" />}</span>
                <span className="sf-board-name">{p.name}</span>
                {p.score && <strong>{p.score}</strong>}
              </li>
            ))}
          </ol>
        </>
      )}
      {started && <Reveal count={leaders.length - shown.length} open={open} onToggle={() => setOpen(v => !v)} label="Leaderboard" />}
      {!started && event.leaderboard?.fieldSize > 0 && <p className="wf-muted">{event.leaderboard.fieldSize} in the field. The leaderboard fills in once play starts.</p>}
    </li>
  );
}

function Sets({ player }) {
  return (
    <span className="sf-sets">
      {player.sets.map((s, i) => (
        <span key={i}>
          {s.games ?? ""}
          {s.tiebreak !== null && s.tiebreak !== undefined && s.games !== null && s.games < 7 ? <sup>{s.tiebreak}</sup> : null}
        </span>
      ))}
    </span>
  );
}

const TENNIS_SHOWN = 6;

export function TennisEvent({ event, networkKeys }) {
  const [open, setOpen] = useState(false);
  const shown = open ? event.matches : event.matches.slice(0, TENNIS_SHOWN);
  return (
    <li className={`wf-game sf-block${canWatch(event, networkKeys) ? " is-mine" : ""}`}>
      <div className="sf-block-head">
        <span className="sf-dot" aria-hidden="true" />
        <div>
          <h4>{event.name}</h4>
          {event.venue && <p className="wf-muted sf-venue">{event.venue}</p>}
        </div>
      </div>
      <Networks networks={event.networks} networkKeys={networkKeys} compact />
      <ul className="sf-tennis">
        {shown.map(m => (
          <li key={m.id}>
            <p className="sf-bout-meta">
              {m.round}
              <span className={`sf-bout-state${m.state === "in" ? " is-live" : ""}`}>{eventTime(m).text}</span>
            </p>
            {[m.a, m.b].map((p, i) => (
              <p key={i} className={`sf-tennis-row${p.winner ? " is-winner" : ""}`}>
                <span className="sf-flag">{p.flag && <img src={p.flag} alt={p.country} width="18" height="12" loading="lazy" />}</span>
                <span className="sf-board-name">
                  {p.seed && <small className="sf-seed">({p.seed})</small>} {p.name}
                </span>
                <Sets player={p} />
              </p>
            ))}
          </li>
        ))}
      </ul>
      <Reveal count={event.matches.length - shown.length} open={open} onToggle={() => setOpen(v => !v)} label="More matches" />
    </li>
  );
}

export function ListingEvent({ event, networkKeys }) {
  return (
    <li className={`wf-game sf-block${canWatch(event, networkKeys) ? " is-mine" : ""}`}>
      <div className="sf-block-head">
        <Time event={event} />
        <div>
          <h4>{event.name}</h4>
          {event.venue && (
            <p className="wf-muted sf-venue">
              <MapPin size={13} aria-hidden="true" /> {event.venue}
            </p>
          )}
          {event.result && <p className="sf-result">{event.result}</p>}
        </div>
      </div>
      <Networks networks={event.networks} networkKeys={networkKeys} compact />
    </li>
  );
}
