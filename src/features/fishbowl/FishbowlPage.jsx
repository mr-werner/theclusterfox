import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import AppBar from "../../components/AppBar";
import { useRoom } from "./state/useRoom";
import Start from "./components/Start";
import Lobby from "./components/Lobby";
import Play from "./components/Play";
import Results from "./components/Results";
import "./fishbowl.css";
import "./identity.css";

export default function FishbowlPage() {
  const game = useRoom();
  const { session, room, error, setError, offline } = game;
  const [params] = useSearchParams();
  useWakeLock(Boolean(session));

  const inRoom = session && room;
  const kickedOut = inRoom && !room.me;

  return (
    <div className="fb">
      <AppBar appId="fishbowl" />
      <main className="fb-wrap">
        {offline && <p className="fb-banner">Reconnecting…</p>}
        {error && (
          <p className="fb-error" role="alert" onClick={() => setError(null)}>
            {error}
          </p>
        )}
        {!session && <Start game={game} linkRoom={params.get("room") || ""} />}
        {session && !room && <p className="fb-muted fb-center">Joining {session.room}…</p>}
        {kickedOut && (
          <div className="fb-card fb-center">
            <p>You're not in {room.roomName} any more.</p>
            <button className="fb-btn" onClick={() => game.enter("join", session)}>
              Join again
            </button>
            <button className="fb-link" onClick={game.leaveLocal}>
              Pick another room
            </button>
          </div>
        )}
        {inRoom && room.me && (
          <>
            {room.phase === "lobby" && <Lobby game={game} room={room} />}
            {room.phase === "play" && <Play game={game} room={room} />}
            {(room.phase === "roundEnd" || room.phase === "done") && <Results game={game} room={room} />}
            <RoomFooter game={game} room={room} />
          </>
        )}
      </main>
    </div>
  );
}

function RoomFooter({ game, room }) {
  const isHost = room.hostId === room.me.id;
  return (
    <footer className="fb-foot">
      <span>
        Room <b>{room.roomName}</b> · {room.players.length} {room.players.length === 1 ? "player" : "players"}
        {isHost ? " · you're the host" : ""}
      </span>
      {!isHost && room.hostAway && (
        <button className="fb-link" onClick={() => game.send({ type: "makeHost" })}>
          The host's phone went quiet. Take over hosting
        </button>
      )}
      <button
        className="fb-link"
        onClick={() => {
          if (window.confirm("Leave this room?")) game.leave();
        }}
      >
        Leave room
      </button>
    </footer>
  );
}

// Keep the screen on while a game is going.
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return undefined;
    let lock = null;
    let gone = false;
    const get = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
        if (gone) lock?.release();
      } catch {
        // Not allowed here: the screen just sleeps as usual.
      }
    };
    get();
    document.addEventListener("visibilitychange", get);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", get);
      lock?.release().catch(() => {});
    };
  }, [on]);
}
