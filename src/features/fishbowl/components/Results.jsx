import { ROUNDS, TEAM_NAMES } from "../model/game";
import { Scoreboard } from "./Play";

export default function Results({ game, room }) {
  const isHost = room.hostId === room.me.id;
  const done = room.phase === "done";
  const next = ROUNDS[room.round];
  const { red, blue } = room.scores;
  const winner = red === blue ? null : red > blue ? "red" : "blue";
  const nextTeam = room.turn?.team;
  return (
    <div className="fb-results">
      <Scoreboard room={room} />
      <div className={`fb-card fb-center${done && winner ? ` fb-turn--${winner}` : ""}`}>
        {done ? (
          <>
            <span className="fb-label">Game over</span>
            <h2 className="fb-big">{winner ? `${TEAM_NAMES[winner]} wins!` : "It's a tie!"}</h2>
            <p>
              {red} to {blue}
            </p>
          </>
        ) : (
          <>
            <span className="fb-label">Round {room.round} done · the bowl is empty</span>
            <h2>
              Next: Round {next.n}, {next.name}
            </h2>
            <p>{next.rule}</p>
            <p className="fb-muted">All {room.bowlCount} words go back in the bowl. {nextTeam ? `${TEAM_NAMES[nextTeam]} goes first.` : ""}</p>
          </>
        )}
        <table className="fb-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Red</th>
              <th>Blue</th>
            </tr>
          </thead>
          <tbody>
            {room.roundScores.map((r, i) => (
              <tr key={i}>
                <td>
                  {i + 1}. {ROUNDS[i].name}
                </td>
                <td>{r.red}</td>
                <td>{r.blue}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isHost ? (
          done ? (
            <button className="fb-btn fb-btn--big" onClick={() => game.send({ type: "again" })}>
              Play again with new words
            </button>
          ) : (
            <button className="fb-btn fb-btn--big fb-btn--go" onClick={() => game.send({ type: "nextRound" })}>
              Start round {next.n}: {next.name}
            </button>
          )
        ) : (
          <p className="fb-muted">{done ? "The host can start a new game." : "Waiting for the host to start the next round."}</p>
        )}
      </div>
    </div>
  );
}
