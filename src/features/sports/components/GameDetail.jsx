import { useEffect, useRef, useState } from "react";
import { BarChart3, LoaderCircle, Newspaper, Scale, Trophy, Users, X } from "lucide-react";

import { fetchGameSummary } from "../../../services/sports/sportsApi";
import { eventTime } from "../model/schedule";
import { Networks } from "./EventViews";

// One game, opened from the schedule: the score, then each part folded
// behind its own button so the sheet starts short. Box score, leaders,
// betting line, standings and headlines all come from ESPN's game summary.

const SECTIONS = [
  { id: "stats", name: "Team stats", icon: BarChart3 },
  { id: "leaders", name: "Leaders", icon: Users },
  { id: "odds", name: "Betting line", icon: Scale },
  { id: "standings", name: "Standings", icon: Trophy },
  { id: "news", name: "Headlines", icon: Newspaper },
];

function has(summary, id) {
  if (!summary) return false;
  if (id === "stats") return summary.teamStats.length > 0;
  if (id === "leaders") return summary.leaders.length > 0;
  if (id === "odds") return Boolean(summary.odds);
  if (id === "standings") return summary.standings.length > 0;
  if (id === "news") return summary.news.length > 0;
  return false;
}

function TeamStats({ summary, game }) {
  return (
    <table className="sf-table sf-table--stats">
      <thead>
        <tr>
          <th scope="col">{game.away.abbreviation || game.away.short}</th>
          <th scope="col" className="sf-table-label" aria-label="Stat" />
          <th scope="col">{game.home.abbreviation || game.home.short}</th>
        </tr>
      </thead>
      <tbody>
        {summary.teamStats.map(row => (
          <tr key={row.label}>
            <td>{row.away}</td>
            <th scope="row" className="sf-table-label">
              {row.label}
            </th>
            <td>{row.home}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Leaders({ summary }) {
  return (
    <div className="sf-leaders">
      {summary.leaders.map(group => (
        <div key={group.team}>
          <h4>
            {group.logo && <img src={group.logo} alt="" width="20" height="20" />} {group.team}
          </h4>
          <ul>
            {group.items.map(item => (
              <li key={item.category}>
                {item.headshot ? <img src={item.headshot} alt="" width="40" height="40" loading="lazy" /> : <span className="sf-headshot" aria-hidden="true" />}
                <span>
                  <small>{item.category}</small>
                  <strong>{item.name}</strong>
                  <span className="wf-muted">{item.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const cell = s => (s ? [s.line, s.odds].filter(Boolean).join(" ") : "–");

function Odds({ summary, game }) {
  const { odds } = summary;
  const rows = [
    odds.spread && { label: "Spread", a: odds.spread.away, b: odds.spread.home },
    odds.moneyline && { label: "Moneyline", a: odds.moneyline.away, b: odds.moneyline.home },
    odds.total && { label: "Total", a: odds.total.over, b: odds.total.under, aName: "Over", bName: "Under" },
  ].filter(Boolean);
  return (
    <div>
      {odds.details && (
        <p className="sf-odds-big">
          {odds.details === "EVEN" ? "Even" : odds.details}
          {odds.overUnder !== null && <span> · O/U {odds.overUnder}</span>}
        </p>
      )}
      {rows.length > 0 && (
        <table className="sf-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Side</th>
              <th scope="col">Open</th>
              <th scope="col">Now</th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap(row => [
              <tr key={`${row.label}-a`}>
                <th scope="row" rowSpan={2}>
                  {row.label}
                </th>
                <td>{row.aName ?? game.away.abbreviation}</td>
                <td>{cell(row.a.open)}</td>
                <td>{cell(row.a.close)}</td>
              </tr>,
              <tr key={`${row.label}-b`}>
                <td>{row.bName ?? game.home.abbreviation}</td>
                <td>{cell(row.b.open)}</td>
                <td>{cell(row.b.close)}</td>
              </tr>,
            ])}
          </tbody>
        </table>
      )}
      <p className="wf-note">
        Lines from {odds.provider || "the sportsbook"} via ESPN, for information only. Must be 21+ where betting is legal. Gambling problem? Call 1-800-GAMBLER.
      </p>
    </div>
  );
}

function Standings({ summary }) {
  return (
    <div className="sf-standings">
      {summary.standings.map(group => (
        <div key={group.header}>
          <h4>{group.header}</h4>
          <table className="sf-table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                {group.rows[0].cols.map(c => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map(row => (
                <tr key={row.id || row.team}>
                  <th scope="row">{row.team}</th>
                  {row.values.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {summary.standingsLink && (
        <a className="wf-link-btn" href={summary.standingsLink} target="_blank" rel="noreferrer">
          Full standings on ESPN
        </a>
      )}
    </div>
  );
}

function News({ summary }) {
  return (
    <ul className="sf-news">
      {summary.news.map(item => (
        <li key={item.headline}>
          {item.link ? (
            <a href={item.link} target="_blank" rel="noreferrer">
              {item.headline}
            </a>
          ) : (
            item.headline
          )}
        </li>
      ))}
    </ul>
  );
}

function Team({ team }) {
  return (
    <div className="sf-score-team">
      {team.logo ? <img src={team.logo} alt="" width="56" height="56" /> : <span className="sf-headshot" aria-hidden="true" />}
      <strong>{team.short || team.name}</strong>
      {team.record && <small className="wf-muted">{team.record}</small>}
    </div>
  );
}

export default function GameDetail({ game, league, networkKeys, showOdds, onClose }) {
  const dialogRef = useRef(null);
  const [state, setState] = useState({ key: null, summary: null, error: "" });
  const [open, setOpen] = useState(null);
  const key = `${league.id}-${game.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchGameSummary(league.id, game.id, { signal: controller.signal })
      .then(summary => setState({ key, summary, error: "" }))
      .catch(error => {
        if (error.name !== "AbortError") setState({ key, summary: null, error: error.message });
      });
    return () => controller.abort();
  }, [league.id, game.id, key]);

  const loading = state.key !== key;
  const { summary } = state;
  const sections = SECTIONS.filter(s => has(summary, s.id) && (s.id !== "odds" || showOdds));
  const time = eventTime(game);
  const showScore = game.state !== "pre" && game.home.score != null;

  return (
    <dialog
      ref={dialogRef}
      className="wf wf-detail sf-detail"
      aria-label={game.name}
      onClose={onClose}
      onClick={event => event.target === dialogRef.current && dialogRef.current.close()}
    >
      <div className="wf-detail-inner">
        <button type="button" className="wf-detail-close" aria-label="Close" onClick={() => dialogRef.current.close()}>
          <X size={20} />
        </button>

        <header className="sf-detail-head">
          <p className="wf-eyebrow">{league.name}</p>
          <div className="sf-scoreline">
            <Team team={game.away} />
            <div className="sf-score-mid">
              {showScore ? (
                <p className="sf-score-big">
                  {game.away.score} <span>–</span> {game.home.score}
                </p>
              ) : (
                <p className="sf-score-big sf-score-at">at</p>
              )}
              <p className={`wf-game-time${time.live ? " is-live" : ""}`}>{time.text}</p>
            </div>
            <Team team={game.home} />
          </div>
          {(summary?.venue || game.venue) && <p className="wf-muted sf-venue">{summary?.venue || game.venue}</p>}
          <Networks networks={game.networks} networkKeys={networkKeys} />
        </header>

        <div className="sf-detail-body">
          {loading && (
            <p className="wf-muted wf-loading">
              <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading game details…
            </p>
          )}
          {!loading && state.error && <p className="wf-alert">{state.error}</p>}
          {!loading && summary && !sections.length && <p className="wf-muted">No stats for this game yet. Check back once it starts.</p>}

          {sections.length > 0 && (
            <div className="sf-sections" role="group" aria-label="Game details">
              {sections.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.id} type="button" className="wf-chip" aria-pressed={open === s.id} onClick={() => setOpen(o => (o === s.id ? null : s.id))}>
                    <Icon size={15} aria-hidden="true" /> {s.name}
                  </button>
                );
              })}
            </div>
          )}

          {summary && open === "stats" && has(summary, "stats") && <TeamStats summary={summary} game={game} />}
          {summary && open === "leaders" && has(summary, "leaders") && <Leaders summary={summary} />}
          {summary && open === "odds" && showOdds && has(summary, "odds") && <Odds summary={summary} game={game} />}
          {summary && open === "standings" && has(summary, "standings") && <Standings summary={summary} />}
          {summary && open === "news" && has(summary, "news") && <News summary={summary} />}

          <p className="wf-note">Box scores, leaders, standings and headlines from ESPN.</p>
        </div>
      </div>
    </dialog>
  );
}
