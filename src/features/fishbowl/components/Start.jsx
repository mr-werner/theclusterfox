import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUNDS } from "../model/game";

const NAME_KEY = "fishbowl-name-v1";
const savedName = () => {
  try {
    return window.localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
};
const linkPassword = () => new URLSearchParams(window.location.hash.slice(1)).get("pw") || "";

export default function Start({ game, linkRoom }) {
  const [mode, setMode] = useState(linkRoom ? "join" : "host");
  const [room, setRoom] = useState(linkRoom);
  const [password, setPassword] = useState(linkPassword);
  const [name, setName] = useState(savedName);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // fine
    }
    const ok = await game.enter(mode === "host" ? "create" : "join", { room, password, name });
    // Drop the invite link's room and password from the address once in.
    if (ok && (window.location.hash || window.location.search)) navigate("/fishbowl", { replace: true });
  }

  return (
    <div className="fb-start">
      <section className="fb-hero">
        <div className="fb-bowl" aria-hidden="true">
          <span>🐟</span>
        </div>
        <h1>Fishbowl</h1>
        <p>The party game for the whole family. Everyone drops words in the bowl, then Red and Blue race the clock across three rounds.</p>
      </section>

      <form className="fb-card fb-form" onSubmit={submit}>
        <div className="fb-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "host"} className={mode === "host" ? "is-on" : ""} onClick={() => setMode("host")}>
            Host a game
          </button>
          <button type="button" role="tab" aria-selected={mode === "join"} className={mode === "join" ? "is-on" : ""} onClick={() => setMode("join")}>
            Join a game
          </button>
        </div>
        <label>
          <span>Room name</span>
          <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={30} autoCapitalize="words" autoComplete="off" placeholder="e.g. Werner Family" required />
        </label>
        <label>
          <span>Room password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="none" placeholder={mode === "host" ? "Make one up" : "Ask the host"} required />
        </label>
        <label>
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="What everyone calls you" required />
        </label>
        <button className="fb-btn fb-btn--big" disabled={game.busy}>
          {game.busy ? "One moment…" : mode === "host" ? "Create room" : "Join room"}
        </button>
        {mode === "host" && <p className="fb-muted">You'll pick the words per person, turn length and skips next. Tell everyone the room name and password, or send them the invite link.</p>}
      </form>

      <section className="fb-card fb-how">
        <h2>How it plays</h2>
        <ol>
          <li>Everyone joins on their phone and picks Red or Blue.</li>
          <li>Each person secretly writes the same number of words into the bowl.</li>
          <li>Teams take turns against the clock. The clue-giver sees a word and taps <b>Got it</b> or <b>Skip</b>.</li>
          <li>If time runs out mid-word, the other team gets one guess to steal it.</li>
          <li>When the bowl is empty, every word goes back in for the next round.</li>
        </ol>
        <div className="fb-rounds">
          {ROUNDS.map((r) => (
            <div key={r.n}>
              <b>
                Round {r.n}: {r.name}
              </b>
              <span>{r.rule}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
