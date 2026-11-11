import { ChevronDown } from "lucide-react";

import { leaguesForSport, SPORTS } from "../../../services/sports/leagues";
import { toggleIn } from "../state/sportsStore";

// Every league ScoreFox can follow, folded by sport so the list stays short.
// A sport you already follow starts open and shows how many you picked.
export default function LeaguePicker({ data, update, onDone }) {
  return (
    <div className="sf-picker">
      <div className="sf-picker-head">
        <div>
          <h3>Choose your leagues</h3>
          <p className="wf-muted">Pick as many as you like. Only these show in your schedule.</p>
        </div>
        <button type="button" className="wf-btn" onClick={onDone}>
          Done
        </button>
      </div>
      {SPORTS.map(sport => {
        const leagues = leaguesForSport(sport.id);
        const picked = leagues.filter(l => data.leagues.includes(l.id)).length;
        return (
          <details key={sport.id} className="sf-sport" open={picked > 0}>
            <summary>
              <span>{sport.name}</span>
              {picked > 0 && <span className="wf-count">{picked}</span>}
              <ChevronDown size={16} aria-hidden="true" className="sf-sport-chev" />
            </summary>
            <ul className="wf-chip-row">
              {leagues.map(league => (
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
          </details>
        );
      })}
      <p className="wf-note">
        Most sports come from ESPN. Boxing, BKFC, WWE, Formula E and winter sports come from TheSportsDB, which lists times and results but not TV channels.
      </p>
    </div>
  );
}
