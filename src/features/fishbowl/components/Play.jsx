import { useEffect, useRef, useState } from "react";
import { Check, Eye, Megaphone, SkipForward, Timer } from "lucide-react";

import { ROUNDS, TEAM_NAMES, other } from "../model/game";
import { buzz, unlockSound, tickSound } from "./sound";

export default function Play({ game, room }) {
  const t = room.turn;
  const round = ROUNDS[room.round - 1];
  const nameOf = (id) => room.players.find((p) => p.id === id)?.name ?? "Someone";
  return (
    <div className="fb-play" onPointerDown={unlockSound}>
      <Scoreboard room={room} />
      <div className="fb-round">
        <span className="fb-label">
          Round {round.n} of 3 · {room.poolCount} of {room.bowlCount} words left in the bowl
        </span>
        <b>{round.name}</b>
        <span>{round.rule}</span>
      </div>
      {t && <Turn key={`${room.turnCount}-${t.status}`} game={game} room={room} nameOf={nameOf} />}
      {room.lastTurn && <LastTurn last={room.lastTurn} nameOf={nameOf} />}
    </div>
  );
}

export function Scoreboard({ room }) {
  const t = room.turn;
  return (
    <div className="fb-score">
      {["red", "blue"].map((team) => (
        <div key={team} className={`fb-score-team fb-team--${team}${t?.team === team && room.phase === "play" ? " is-up" : ""}${room.me.team === team ? " is-mine" : ""}`}>
          <span>
            {TEAM_NAMES[team]}
            {room.me.team === team ? " (you)" : ""}
          </span>
          <b>{room.scores[team]}</b>
        </div>
      ))}
    </div>
  );
}

function useClock(game, endsAt) {
  const [now, setNow] = useState(() => game.serverNow());
  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setNow(game.serverNow()), 200);
    return () => clearInterval(id);
  }, [endsAt, game]);
  return endsAt ? Math.max(0, endsAt - now) : 0;
}

function Turn({ game, room, nameOf }) {
  const t = room.turn;
  const me = room.me;
  const isHost = room.hostId === me.id;
  const giving = t.giverId === me.id;
  const myTeamUp = me.team === t.team;
  const giverName = nameOf(t.giverId);
  const teamName = TEAM_NAMES[t.team];
  const otherName = TEAM_NAMES[other(t.team)];
  const left = useClock(game, t.status === "running" ? t.endsAt : null);
  const secs = Math.ceil(left / 1000);
  const [pending, setPending] = useState(false);
  const lastSecs = useRef(null);

  // Sounds: a tick for the last five seconds on the clue-giver's phone, and
  // a buzzer for everyone when time runs out.
  useEffect(() => {
    if (t.status !== "running") return;
    if (lastSecs.current !== null && secs !== lastSecs.current) {
      if (secs === 0) buzz();
      else if (secs <= 5 && giving) tickSound();
    }
    lastSecs.current = secs;
  }, [secs, t.status, giving]);

  async function send(action) {
    if (pending) return;
    setPending(true);
    await game.send(action);
    setPending(false);
  }

  if (t.status === "ready") {
    return (
      <div className={`fb-card fb-turn fb-turn--${t.team}`}>
        <span className="fb-label">{teamName} team is up</span>
        {giving ? (
          <>
            <h2>You're giving clues!</h2>
            <p>Hold your phone so your team can't see it. You'll have {room.settings.turnSeconds} seconds{room.settings.skipsPerTurn ? ` and ${room.settings.skipsPerTurn} ${room.settings.skipsPerTurn === 1 ? "skip" : "skips"}` : ""}.</p>
            <button className="fb-btn fb-btn--big fb-btn--go" disabled={pending} onClick={() => send({ type: "startTurn" })}>
              <Timer size={22} /> Start my turn
            </button>
          </>
        ) : (
          <>
            <h2>{giverName ? `${giverName} gives clues` : "Waiting for a clue-giver"}</h2>
            <p className="fb-muted">{myTeamUp ? "Get ready to guess!" : `Your team watches. If ${teamName} runs out of time mid-word, you get a chance to steal it.`}</p>
            {isHost && (
              <div className="fb-host-row">
                <button className="fb-link" onClick={() => send({ type: "passGiver" })}>
                  Skip {giverName}, next {teamName} player
                </button>
                <button className="fb-link" onClick={() => send({ type: "startTurn" })}>
                  Give clues myself
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (t.status === "running") {
    const low = secs <= 10;
    const skipsLeft = room.settings.skipsPerTurn - t.skips;
    return (
      <div className={`fb-card fb-turn fb-turn--${t.team} is-running`}>
        <div className={`fb-clock${low ? " is-low" : ""}`}>
          <Timer size={20} /> {secs}s
        </div>
        <span className="fb-label">
          {giverName} · {teamName} · {t.got} so far
        </span>
        {giving ? (
          <>
            <div className="fb-word" aria-live="polite">
              {t.word?.text ?? "…"}
            </div>
            <div className="fb-actions">
              <button className="fb-btn fb-btn--big fb-btn--go" disabled={pending || !t.word} onClick={() => send({ type: "got", word: t.word.id })}>
                <Check size={24} /> Got it
              </button>
              <button
                className="fb-btn fb-btn--skip"
                disabled={pending || !t.word || skipsLeft <= 0 || room.poolCount < 2}
                onClick={() => send({ type: "skip", word: t.word.id })}
              >
                <SkipForward size={20} /> Skip{room.settings.skipsPerTurn ? ` (${Math.max(0, skipsLeft)} left)` : ""}
              </button>
            </div>
            <button className="fb-link" onClick={() => window.confirm("End your turn now? The word goes back in the bowl.") && send({ type: "stop" })}>
              End my turn early
            </button>
          </>
        ) : myTeamUp ? (
          <div className="fb-guess">
            <Megaphone size={40} />
            <h2>Guess!</h2>
            <p>{giverName} is giving clues.</p>
          </div>
        ) : (
          <div className="fb-watch">
            <span className="fb-label">
              <Eye size={14} /> The word is
            </span>
            <div className="fb-word fb-word--small">{t.word?.text ?? "…"}</div>
            <p className="fb-muted">Keep it quiet! You're watching {teamName}. If time runs out on this word, {otherName === TEAM_NAMES[me.team] ? "you" : otherName} can steal it.</p>
          </div>
        )}
        {isHost && !giving && (
          <button className="fb-link" onClick={() => window.confirm(`End ${giverName}'s turn now?`) && send({ type: "stop" })}>
            End this turn (host)
          </button>
        )}
      </div>
    );
  }

  // Steal.
  const stealer = other(t.team);
  const stealing = me.team === stealer;
  const canMark = giving || isHost;
  return (
    <div className={`fb-card fb-turn fb-turn--${stealer} is-steal`}>
      <span className="fb-label">Time's up!</span>
      <h2>{stealing ? "Steal it! One guess for a point." : `${TEAM_NAMES[stealer]} can steal it`}</h2>
      {t.word && <div className="fb-word fb-word--small">{t.word.text}</div>}
      {stealing && !canMark && <p>Talk it over and give {giverName} one answer.</p>}
      {canMark ? (
        <>
          <p className="fb-muted">Did {TEAM_NAMES[stealer]} guess it?</p>
          <div className="fb-actions">
            <button className={`fb-btn fb-btn--big fb-btn--${stealer}`} disabled={pending} onClick={() => send({ type: "steal", stolen: true })}>
              Yes, {TEAM_NAMES[stealer]} stole it (+1)
            </button>
            <button className="fb-btn fb-btn--ghost" disabled={pending} onClick={() => send({ type: "steal", stolen: false })}>
              No steal, it goes back in the bowl
            </button>
          </div>
        </>
      ) : (
        !stealing && <p className="fb-muted">{giverName} will mark whether they got it.</p>
      )}
    </div>
  );
}

function LastTurn({ last, nameOf }) {
  const n = last.got.length;
  return (
    <div className="fb-card fb-last">
      <span className="fb-label">Last turn</span>
      <p>
        {nameOf(last.giverId)} got {n} for {TEAM_NAMES[last.team]}
        {n ? ":" : "."}
      </p>
      {n > 0 && (
        <ul className="fb-chips">
          {last.got.map((w, i) => (
            <li key={`${w}-${i}`}>{w}</li>
          ))}
        </ul>
      )}
      {last.stolen && (
        <p>
          {TEAM_NAMES[other(last.team)]} stole <b>{last.stolen}</b>!
        </p>
      )}
      {last.missed && <p className="fb-muted">Nobody got the last one. It's back in the bowl.</p>}
    </div>
  );
}
