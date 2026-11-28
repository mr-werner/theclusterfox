import { useState } from "react";
import { Check, Copy, Share2, UserMinus } from "lucide-react";

import { LIMITS, TEAMS, TEAM_NAMES, fmtTime } from "../model/game";

export default function Lobby({ game, room }) {
  const { me, settings } = room;
  const isHost = room.hostId === me.id;
  return (
    <div className="fb-lobby">
      <Invite game={game} room={room} />
      <Teams game={game} room={room} isHost={isHost} />
      {me.team && <Words key={`${settings.wordsPerPerson}-${room.myWords.join("|")}`} game={game} room={room} />}
      {isHost ? <HostSettings game={game} room={room} /> : <SettingsSummary settings={settings} />}
      {isHost ? (
        <div className="fb-card fb-center">
          <button className="fb-btn fb-btn--big" disabled={Boolean(room.startProblem)} onClick={() => game.send({ type: "start" })}>
            Start the game
          </button>
          <p className="fb-muted">{room.startProblem || "Everyone's in. Let's play!"}</p>
        </div>
      ) : (
        <p className="fb-muted fb-center">{room.startProblem || "Everyone's in. Waiting for the host to start."}</p>
      )}
    </div>
  );
}

function Invite({ game, room }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/fishbowl?room=${encodeURIComponent(room.roomName)}#pw=${encodeURIComponent(game.session.password)}`;
  async function share() {
    const text = `Join our Fishbowl game! Room: ${room.roomName}, password: ${game.session.password}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Fishbowl", text, url });
        return;
      }
    } catch {
      // Cancelled or not allowed: copy instead.
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link", url);
    }
  }
  return (
    <div className="fb-card fb-invite">
      <div>
        <span className="fb-label">Room</span>
        <b>{room.roomName}</b>
      </div>
      <div>
        <span className="fb-label">Password</span>
        <b>{game.session.password}</b>
      </div>
      <button className="fb-btn fb-btn--ghost" onClick={share}>
        {copied ? <Check size={18} /> : navigator.share ? <Share2 size={18} /> : <Copy size={18} />}
        {copied ? "Link copied" : "Invite"}
      </button>
    </div>
  );
}

function Teams({ game, room, isHost }) {
  const { me } = room;
  const unpicked = room.players.filter((p) => !p.team);
  return (
    <div className="fb-card">
      <h2>{me.team ? "Teams" : "Pick your team"}</h2>
      <div className="fb-teams">
        {TEAMS.map((team) => {
          const list = room.players.filter((p) => p.team === team);
          return (
            <div key={team} className={`fb-team fb-team--${team}${me.team === team ? " is-mine" : ""}`}>
              <button className="fb-team-pick" onClick={() => game.send({ type: "team", team })} disabled={me.team === team}>
                {me.team === team ? `You're on ${TEAM_NAMES[team]}` : `Join ${TEAM_NAMES[team]}`}
              </button>
              <ul>
                {list.map((p) => (
                  <Player key={p.id} p={p} room={room} isHost={isHost} game={game} />
                ))}
                {!list.length && <li className="fb-muted">Nobody yet</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {unpicked.length > 0 && (
        <p className="fb-muted">
          Still choosing:{" "}
          {unpicked.map((p, i) => (
            <span key={p.id}>
              {i ? ", " : ""}
              {p.name}
              {p.id === me.id ? " (you)" : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Player({ p, room, isHost, game }) {
  const you = p.id === room.me.id;
  return (
    <li>
      <span className={`fb-dot${p.ready ? " is-ready" : ""}`} title={p.ready ? "Words are in" : "Still writing words"}>
        {p.ready ? <Check size={12} /> : null}
      </span>
      <span className="fb-pname">
        {p.name}
        {you ? " (you)" : ""}
        {p.id === room.hostId ? " ★" : ""}
      </span>
      {isHost && !you && (
        <span className="fb-pactions">
          <button title={`Move to ${p.team === "red" ? "Blue" : "Red"}`} onClick={() => game.send({ type: "team", team: p.team === "red" ? "blue" : "red", playerId: p.id })}>
            ⇄
          </button>
          <button title="Remove from room" onClick={() => window.confirm(`Remove ${p.name}?`) && game.send({ type: "remove", playerId: p.id })}>
            <UserMinus size={15} />
          </button>
        </span>
      )}
    </li>
  );
}

function Words({ game, room }) {
  const n = room.settings.wordsPerPerson;
  const [words, setWords] = useState(() => Array.from({ length: n }, (_, i) => room.myWords[i] ?? ""));
  const [editing, setEditing] = useState(room.myWords.length !== n);
  const [saving, setSaving] = useState(false);
  const done = room.myWords.length === n && !editing;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await game.send({ type: "words", words });
    setSaving(false);
    if (ok) setEditing(false);
  }

  if (done) {
    return (
      <div className="fb-card fb-words-done">
        <h2>Your words are in the bowl</h2>
        <p className="fb-muted">Keep them secret! Only you can see this list.</p>
        <ul className="fb-chips">
          {room.myWords.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <button className="fb-link" onClick={() => setEditing(true)}>
          Change my words
        </button>
      </div>
    );
  }
  return (
    <form className="fb-card fb-form" onSubmit={submit}>
      <h2>
        Your {n} {n === 1 ? "word" : "words"}
      </h2>
      <p className="fb-muted">Things, people, places, movies, anything your family would know. Short phrases are fine. Nobody else sees these.</p>
      {words.map((w, i) => (
        <input
          key={i}
          value={w}
          maxLength={LIMITS.word}
          autoComplete="off"
          autoCapitalize="sentences"
          placeholder={["e.g. Pizza", "e.g. Grandma's dog", "e.g. The Eiffel Tower", "e.g. Roller coaster"][i % 4]}
          onChange={(e) => setWords((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
          required
        />
      ))}
      <button className="fb-btn" disabled={saving}>
        {saving ? "Adding…" : "Put them in the bowl"}
      </button>
    </form>
  );
}

function Stepper({ label, value, min, max, step = 1, format = (v) => v, onChange }) {
  return (
    <div className="fb-stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <b>{format(value)}</b>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
      </div>
    </div>
  );
}

function HostSettings({ game, room }) {
  const s = room.settings;
  const set = (patch) => game.send({ type: "settings", ...patch });
  return (
    <div className="fb-card">
      <h2>Game settings</h2>
      <Stepper label="Words per person" value={s.wordsPerPerson} min={LIMITS.wordsPerPerson[0]} max={LIMITS.wordsPerPerson[1]} onChange={(v) => set({ wordsPerPerson: v })} />
      <Stepper label="Turn length" value={s.turnSeconds} min={15} max={300} step={15} format={fmtTime} onChange={(v) => set({ turnSeconds: v })} />
      <Stepper label="Skips per turn" value={s.skipsPerTurn} min={LIMITS.skipsPerTurn[0]} max={LIMITS.skipsPerTurn[1]} onChange={(v) => set({ skipsPerTurn: v })} />
      <p className="fb-muted">Changing words per person asks everyone to fill in their words again.</p>
    </div>
  );
}

function SettingsSummary({ settings: s }) {
  return (
    <p className="fb-muted fb-center">
      {s.wordsPerPerson} {s.wordsPerPerson === 1 ? "word" : "words"} each · {fmtTime(s.turnSeconds)} turns · {s.skipsPerTurn} {s.skipsPerTurn === 1 ? "skip" : "skips"} a turn
    </p>
  );
}
