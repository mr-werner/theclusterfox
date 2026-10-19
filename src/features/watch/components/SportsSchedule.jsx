import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, Trophy } from "lucide-react";

import { networkLink } from "../../../services/watch/links";
import { fetchGames } from "../../../services/watch/watchApi";
import { canWatchNetwork, isBroadcastNetwork, LEAGUES, leaguesById, networksForServices } from "../../../services/watch/parse";
import { pickedNames, toggleIn } from "../state/watchStore";

const DAYS = 7;

const dateKey = date =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

function upcomingDays() {
  const today = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : day.toLocaleDateString(undefined, { weekday: "short" });
    return { key: dateKey(day), label, sub: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
  });
}

function gameTime(game) {
  if (game.state === "in") return { text: game.detail || "Live", live: true };
  if (game.state === "post") return { text: game.detail || "Final" };
  if (!game.start) return { text: game.detail || "TBD" };
  return { text: new Date(game.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
}

function Game({ game, networkKeys }) {
  const time = gameTime(game);
  const watchable = game.networks.some(n => canWatchNetwork(n.name, networkKeys));
  const showScore = game.state !== "pre" && game.home.score != null;

  return (
    <li className={`wf-game${watchable ? " is-mine" : ""}`}>
      <p className={`wf-game-time${time.live ? " is-live" : ""}`}>{time.text}</p>
      <div className="wf-game-teams">
        {[game.away, game.home].map((team, i) => (
          <p key={i}>
            {team.logo && <img src={team.logo} alt="" width="20" height="20" loading="lazy" />}
            <span>{team.name}</span>
            {showScore && <strong>{team.score}</strong>}
          </p>
        ))}
      </div>
      <ul className="wf-networks" aria-label="Where it's on">
        {game.networks.length === 0 && <li className="wf-muted">No TV listing yet</li>}
        {game.networks.map(network => {
          const mine = canWatchNetwork(network.name, networkKeys);
          const regional = network.market !== "national";
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
    </li>
  );
}

export default function SportsSchedule({ data, update }) {
  const [days] = useState(upcomingDays);
  const [day, setDay] = useState(days[0].key);
  const [onlyMine, setOnlyMine] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [state, setState] = useState({ key: null, byLeague: {}, failed: [] });
  const networkKeys = useMemo(() => networksForServices(pickedNames(data)), [data]);
  const leagues = LEAGUES.filter(league => data.leagues.includes(league.id));
  const requestKey = `${day}|${data.leagues.join(",")}|${reloads}`;

  useEffect(() => {
    const controller = new AbortController();
    const ids = requestKey.split("|")[1].split(",").filter(Boolean);
    const date = requestKey.split("|")[0];
    Promise.allSettled(ids.map(id => fetchGames(id, date, { signal: controller.signal }))).then(results => {
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
    .map(league => {
      const games = (state.byLeague[league.id] ?? []).filter(
        game => !onlyMine || game.networks.some(n => canWatchNetwork(n.name, networkKeys))
      );
      return { league, games };
    })
    .filter(section => section.games.length);

  return (
    <section className="wf-panel">
      <ul className="wf-chip-row" aria-label="Leagues">
        {LEAGUES.map(league => (
          <li key={league.id}>
            <button
              type="button"
              className="wf-chip"
              aria-pressed={data.leagues.includes(league.id)}
              onClick={() => update(current => ({ ...current, leagues: toggleIn(current.leagues, league.id) }))}
            >
              {league.name}
            </button>
          </li>
        ))}
      </ul>

      <div className="wf-days" role="group" aria-label="Day">
        {days.map(item => (
          <button key={item.key} type="button" aria-pressed={day === item.key} onClick={() => setDay(item.key)}>
            <strong>{item.label}</strong>
            <span>{item.sub}</span>
          </button>
        ))}
      </div>

      <div className="wf-toolbar">
        {hasServices && (
          <button type="button" className="wf-chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(v => !v)}>
            Only games I can watch
          </button>
        )}
        <button type="button" className="wf-link-btn" onClick={() => setReloads(n => n + 1)}>
          <RotateCcw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {!leagues.length && <p className="wf-muted">Pick a league above to see its games.</p>}

      {leagues.length > 0 && loading && (
        <p className="wf-muted wf-loading">
          <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading games…
        </p>
      )}

      {!loading && state.failed.length > 0 && (
        <p className="wf-alert">
          Couldn’t load {state.failed.map(id => leaguesById.get(id)?.name).join(", ")}. Try refreshing.
        </p>
      )}

      {!loading && leagues.length > 0 && !sections.length && (
        <div className="wf-empty">
          <Trophy size={30} aria-hidden="true" />
          <p className="wf-muted">{onlyMine ? "No games on your services this day." : "No games scheduled this day."}</p>
        </div>
      )}

      {!loading &&
        sections.map(({ league, games }) => (
          <div key={league.id} className="wf-league">
            <h3>{league.name}</h3>
            <ul className="wf-games">
              {games.map(game => (
                <Game key={game.id} game={game} networkKeys={networkKeys} />
              ))}
            </ul>
          </div>
        ))}

      <p className="wf-note">US TV listings from ESPN. Times are in your time zone.</p>
    </section>
  );
}
