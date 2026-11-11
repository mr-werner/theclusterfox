import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, SlidersHorizontal, Trophy } from "lucide-react";

import { sportsLeaguesById, SPORTS_LEAGUES } from "../../../services/sports/leagues";
import { fetchSportsDay } from "../../../services/sports/sportsApi";
import { networksForServices } from "../../../services/watch/parse";
import { pickedNames } from "../state/sportsStore";
import { canWatch, dateKey, onDay } from "../model/schedule";
import { CardEvent, FieldEvent, ListingEvent, MatchRow, TennisEvent } from "./EventViews";
import GameDetail from "./GameDetail";
import LeaguePicker from "./LeaguePicker";

const DAYS = 7;

function upcomingDays() {
  const today = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : day.toLocaleDateString(undefined, { weekday: "short" });
    return { key: dateKey(day), label, sub: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
  });
}

function EventItem({ event, league, networkKeys, showOdds, onOpen }) {
  if (event.kind === "match") return <MatchRow game={event} networkKeys={networkKeys} showOdds={showOdds} onOpen={() => onOpen(event, league)} />;
  if (event.kind === "card") return <CardEvent event={event} networkKeys={networkKeys} />;
  if (event.kind === "field") return <FieldEvent event={event} networkKeys={networkKeys} />;
  if (event.kind === "tennis") return <TennisEvent event={event} networkKeys={networkKeys} />;
  return <ListingEvent event={event} networkKeys={networkKeys} />;
}

export default function SportsSchedule({ data, update, onPickServices }) {
  const [days] = useState(upcomingDays);
  const [day, setDay] = useState(days[0].key);
  const [onlyMine, setOnlyMine] = useState(false);
  const [only, setOnly] = useState(null);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null);
  const [reloads, setReloads] = useState(0);
  const [state, setState] = useState({ key: null, byLeague: {}, failed: [] });
  const networkKeys = useMemo(() => networksForServices(pickedNames(data)), [data]);
  // Keep the catalog's order (by sport) rather than the order they were picked.
  const leagues = SPORTS_LEAGUES.filter(league => data.leagues.includes(league.id));
  const focus = only && data.leagues.includes(only) ? only : null;
  const requestKey = `${day}|${leagues.map(l => l.id).join(",")}|${reloads}`;

  useEffect(() => {
    const controller = new AbortController();
    const [date, list] = requestKey.split("|");
    const ids = list.split(",").filter(Boolean);
    Promise.allSettled(ids.map(id => fetchSportsDay(id, date, { signal: controller.signal }))).then(results => {
      if (controller.signal.aborted) return;
      const byLeague = {};
      const failed = [];
      results.forEach((outcome, i) => {
        if (outcome.status === "fulfilled") byLeague[ids[i]] = outcome.value;
        else failed.push(ids[i]);
      });
      setState({ key: requestKey, byLeague, failed });
    });
    return () => controller.abort();
  }, [requestKey]);

  const loading = state.key !== requestKey;
  const hasServices = data.services.length > 0 || data.live.length > 0;
  const sections = leagues
    .filter(league => !focus || league.id === focus)
    .map(league => ({
      league,
      events: (state.byLeague[league.id] ?? []).map(e => onDay(e, day)).filter(e => e && (!onlyMine || canWatch(e, networkKeys))),
    }))
    .filter(section => section.events.length);

  if (editing) {
    return (
      <section className="wf-panel">
        <LeaguePicker data={data} update={update} onDone={() => setEditing(false)} />
      </section>
    );
  }

  return (
    <section className="wf-panel">
      <div className="sf-follow">
        <ul className="wf-chip-row" aria-label="Show one league">
          <li>
            <button type="button" className="wf-chip" aria-pressed={!focus} onClick={() => setOnly(null)}>
              All
            </button>
          </li>
          {leagues.map(league => (
            <li key={league.id}>
              <button type="button" className="wf-chip" aria-pressed={focus === league.id} onClick={() => setOnly(o => (o === league.id ? null : league.id))}>
                {league.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="wf-btn wf-btn--ghost sf-edit" onClick={() => setEditing(true)}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Leagues
          <span className="wf-count">{leagues.length}</span>
        </button>
      </div>

      <div className="wf-days" role="group" aria-label="Day">
        {days.map(item => (
          <button key={item.key} type="button" aria-pressed={day === item.key} onClick={() => setDay(item.key)}>
            <strong>{item.label}</strong>
            <span>{item.sub}</span>
          </button>
        ))}
      </div>

      <div className="wf-toolbar">
        {hasServices ? (
          <button type="button" className="wf-chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(v => !v)}>
            Only what I can watch
          </button>
        ) : (
          onPickServices && (
            <p className="wf-muted">
              <button type="button" className="wf-link-btn" onClick={onPickServices}>
                Pick your services
              </button>{" "}
              to see which games you can watch.
            </p>
          )
        )}
        <button type="button" className="wf-chip" aria-pressed={data.showOdds} onClick={() => update(current => ({ ...current, showOdds: !current.showOdds }))}>
          Betting lines
        </button>
        <button type="button" className="wf-link-btn" onClick={() => setReloads(n => n + 1)}>
          <RotateCcw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {!leagues.length && (
        <div className="wf-empty">
          <Trophy size={30} aria-hidden="true" />
          <p className="wf-muted">You aren’t following any leagues yet.</p>
          <button type="button" className="wf-btn" onClick={() => setEditing(true)}>
            Choose leagues
          </button>
        </div>
      )}

      {leagues.length > 0 && loading && (
        <p className="wf-muted wf-loading">
          <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading the schedule…
        </p>
      )}

      {!loading && state.failed.length > 0 && (
        <p className="wf-alert">
          Couldn’t load {state.failed.map(id => sportsLeaguesById.get(id)?.name).join(", ")}. Try refreshing.
        </p>
      )}

      {!loading && leagues.length > 0 && !sections.length && (
        <div className="wf-empty">
          <Trophy size={30} aria-hidden="true" />
          <p className="wf-muted">{onlyMine ? "Nothing on your services this day." : "Nothing scheduled this day."}</p>
        </div>
      )}

      {!loading &&
        sections.map(({ league, events }) => (
          <div key={league.id} className="wf-league">
            <h3>{league.name}</h3>
            <ul className="wf-games">
              {events.map(event => (
                <EventItem
                  key={event.id}
                  event={event}
                  league={league}
                  networkKeys={networkKeys}
                  showOdds={data.showOdds}
                  onOpen={(game, l) => setOpen({ game, league: l })}
                />
              ))}
            </ul>
          </div>
        ))}

      {open && (
        <GameDetail
          key={`${open.league.id}-${open.game.id}`}
          game={open.game}
          league={open.league}
          networkKeys={networkKeys}
          showOdds={data.showOdds}
          onClose={() => setOpen(null)}
        />
      )}

      <p className="wf-note">US TV listings from ESPN. Times are in your time zone. Tap a game for stats, leaders and standings.</p>
    </section>
  );
}
