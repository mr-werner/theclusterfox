// Fishbowl: the whole game as plain data and pure steps, so the server and
// the tests run exactly the same rules. The server keeps one state per room
// (api/apps/_fishbowl.js); every phone sees it through view().
//
// Rules: everyone puts the same number of words in the bowl. Three rounds use
// the same words: describe it, act it out, then one word only. Red and Blue
// take timed turns; the clue-giver marks each word got or skipped (a few skips
// a turn). When time runs out on a word, the other team gets one guess to
// steal it. A round ends when the bowl is empty, then every word goes back in.
//
// Not everyone needs a phone: any phone can add a player without one (a
// guest) with their team and words. On their turn they pick up any phone and
// confirm it's them; that phone shows the words for the turn.

export const TEAMS = ["red", "blue"];
export const TEAM_NAMES = { red: "Red", blue: "Blue" };
export const ROUNDS = [
  { n: 1, name: "Describe it", rule: "Say anything except the word itself (no spelling, no \"sounds like\")." },
  { n: 2, name: "Act it out", rule: "No talking or sounds. Act, point and mime." },
  { n: 3, name: "One word", rule: "Say exactly one word as your clue. Gestures are fine." },
];
export const LIMITS = {
  wordsPerPerson: [1, 10],
  turnSeconds: [15, 300],
  skipsPerTurn: [0, 10],
  players: 30,
  name: 20,
  word: 40,
};
export const DEFAULT_SETTINGS = { wordsPerPerson: 3, turnSeconds: 60, skipsPerTurn: 1 };
// The clue-giver's last tap can land just after the clock hits zero.
export const GRACE_MS = 1000;
// A host who hasn't been seen this long can be replaced by anyone in the room.
export const HOST_AWAY_MS = 2 * 60 * 1000;

/** 60 → "1 min", 45 → "45s", 90 → "1m 30s". */
export const fmtTime = (s) => (s % 60 ? `${Math.floor(s / 60) ? `${Math.floor(s / 60)}m ` : ""}${s % 60}s` : `${s / 60} min`);

export class GameError extends Error {}
const fail = (message) => {
  throw new GameError(message);
};

const clamp = (n, [lo, hi], fallback) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};
export const other = (team) => (team === "red" ? "blue" : "red");
export const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.name);
export const cleanWord = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.word);
/** A room's key: its name in lower case, single spaced. */
export const roomCode = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 30);

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame({ roomName, hostId, hostName, now }) {
  const name = cleanName(hostName);
  if (!name) fail("Type your name.");
  return {
    roomName: String(roomName).replace(/\s+/g, " ").trim().slice(0, 30),
    hostId,
    settings: { ...DEFAULT_SETTINGS },
    phase: "lobby",
    players: [{ id: hostId, name, team: null, seen: now }],
    words: {},
    bowl: [],
    pool: [],
    round: 0,
    scores: { red: 0, blue: 0 },
    roundScores: [],
    turn: null,
    nextGiver: { red: 0, blue: 0 },
    lastTurn: null,
    turnCount: 0,
  };
}

const findPlayer = (s, id) => s.players.find((p) => p.id === id);
const teamPlayers = (s, team) => s.players.filter((p) => p.team === team);
const isHost = (s, id) => s.hostId === id;

function giverFor(s, team) {
  const list = teamPlayers(s, team);
  if (!list.length) return null;
  return list[s.nextGiver[team] % list.length].id;
}

function newTurn(s, team) {
  s.turn = { team, giverId: giverFor(s, team), status: "ready", endsAt: null, word: null, skips: 0, got: [] };
}

function draw(s, rand, avoid = null) {
  if (!s.pool.length) return null;
  let i = Math.floor(rand() * s.pool.length);
  if (s.pool.length > 1 && s.pool[i] === avoid) i = (i + 1) % s.pool.length;
  return s.pool[i];
}

const takeFromPool = (s, id) => {
  s.pool = s.pool.filter((w) => w !== id);
};

function finishTurn(s, stolen) {
  const t = s.turn;
  s.lastTurn = {
    team: t.team,
    giverId: t.giverId,
    got: t.got.map((id) => s.bowl[id].text),
    stolen: stolen == null ? null : s.bowl[stolen].text,
    missed: t.word != null && stolen == null && t.status === "steal" ? s.bowl[t.word].text : null,
  };
  s.turnCount += 1;
  s.nextGiver[t.team] += 1;
}

function endRound(s) {
  s.roundScores.push({ ...s.roundTally });
  s.phase = s.round >= ROUNDS.length ? "done" : "roundEnd";
}

/** Move the clock along: a turn whose time ran out goes to the steal. */
export function tick(s, now) {
  const t = s.turn;
  if (s.phase !== "play" || !t || t.status !== "running") return false;
  if (now < t.endsAt + GRACE_MS) return false;
  if (t.word != null) {
    t.status = "steal";
  } else {
    finishTurn(s, null);
    newTurn(s, other(t.team));
  }
  return true;
}

function startRound(s, round, rand) {
  s.round = round;
  s.pool = shuffle(s.bowl.map((w) => w.id), rand);
  s.roundTally = { red: 0, blue: 0 };
  s.phase = "play";
}

function point(s, team) {
  s.scores[team] += 1;
  s.roundTally[team] += 1;
}

/**
 * Apply one player's action. Returns the new state (the input is not
 * changed). Throws GameError with a message to show when it isn't allowed.
 */
export function act(state, playerId, action, { now, rand = Math.random } = {}) {
  const s = structuredClone(state);
  tick(s, now);
  const me = findPlayer(s, playerId);
  const type = action?.type;

  if (type === "join") {
    const name = checkName(s, action.name, playerId);
    if (me) {
      me.name = name;
      me.seen = now;
      return s;
    }
    if (s.players.length >= LIMITS.players) fail("This room is full.");
    s.players.push({ id: playerId, name, team: null, seen: now });
    return s;
  }

  if (!me) fail("You're not in this room any more. Join again.");
  me.seen = now;
  const host = isHost(s, playerId);
  const needHost = () => host || fail("Only the host can do that.");

  switch (type) {
    case "ping":
      return s;

    case "team": {
      const team = action.team;
      if (!TEAMS.includes(team)) fail("Pick Red or Blue.");
      const target = action.playerId && action.playerId !== playerId ? findPlayer(s, action.playerId) : me;
      if (!target) fail("That player left.");
      if (target !== me && !(target.guest && target.by === playerId)) needHost();
      if (s.phase !== "lobby" && target === me && me.team && !host) fail("Teams are set once the game starts. Ask the host to move you.");
      if (s.turn && s.turn.giverId === target.id && s.turn.status !== "ready") fail("Wait until their turn ends.");
      // Keep the rotation fair: move to the end of the new team's order.
      s.players = s.players.filter((p) => p !== target);
      target.team = team;
      s.players.push(target);
      if (s.turn?.status === "ready") s.turn.giverId = giverFor(s, s.turn.team);
      return s;
    }

    case "settings": {
      needHost();
      if (s.phase !== "lobby") fail("Settings are locked once the game starts.");
      const next = { ...s.settings };
      if ("wordsPerPerson" in action) next.wordsPerPerson = clamp(action.wordsPerPerson, LIMITS.wordsPerPerson, next.wordsPerPerson);
      if ("turnSeconds" in action) next.turnSeconds = clamp(action.turnSeconds, LIMITS.turnSeconds, next.turnSeconds);
      if ("skipsPerTurn" in action) next.skipsPerTurn = clamp(action.skipsPerTurn, LIMITS.skipsPerTurn, next.skipsPerTurn);
      s.settings = next;
      return s;
    }

    case "words": {
      if (s.phase !== "lobby") fail("The bowl is closed. The game has started.");
      let target = me;
      if (action.for && action.for !== playerId) {
        target = findPlayer(s, action.for);
        if (!target?.guest) fail("You can only fill in words for players without a phone.");
        if (target.by !== playerId && !host) fail(`${target.name}'s words were added on another phone.`);
      }
      s.words[target.id] = checkWords(s, action.words);
      return s;
    }

    case "addGuest": {
      if (s.players.length >= LIMITS.players) fail("This room is full.");
      const name = checkName(s, action.name, null);
      if (!TEAMS.includes(action.team)) fail(`Pick a team for ${name}.`);
      const words = s.phase === "lobby" ? checkWords(s, action.words) : null;
      let id;
      do id = `guest-${Math.floor(rand() * 2 ** 40).toString(36)}`;
      while (findPlayer(s, id));
      s.players.push({ id, name, team: action.team, guest: true, by: playerId, seen: null });
      if (words) s.words[id] = words;
      if (s.turn?.status === "ready") s.turn.giverId = giverFor(s, s.turn.team);
      return s;
    }

    case "start": {
      needHost();
      if (s.phase !== "lobby") fail("The game has already started.");
      const problem = startProblem(s);
      if (problem) fail(problem);
      let id = 0;
      s.bowl = [];
      for (const p of s.players) for (const text of s.words[p.id]) s.bowl.push({ id: id++, text, by: p.id });
      s.scores = { red: 0, blue: 0 };
      s.roundScores = [];
      s.nextGiver = { red: 0, blue: 0 };
      s.turnCount = 0;
      s.lastTurn = null;
      startRound(s, 1, rand);
      newTurn(s, rand() < 0.5 ? "red" : "blue");
      return s;
    }

    case "startTurn": {
      const t = s.turn;
      if (s.phase !== "play" || !t || t.status !== "ready") fail("It isn't time to start a turn.");
      if (t.giverId === playerId) {
        // their own phone
      } else if (action.as && action.as === t.giverId) {
        // The clue-giver picked up this phone and confirmed it's them.
      } else if (action.as) {
        fail("The clue-giver changed. Have a look and try again.");
      } else if (host) {
        t.giverId = playerId; // the host steps in
      } else {
        fail("It's not your turn to give clues.");
      }
      t.phoneId = playerId;
      t.status = "running";
      t.endsAt = now + s.settings.turnSeconds * 1000;
      t.word = draw(s, rand);
      return s;
    }

    case "got":
    case "skip":
    case "stop": {
      const t = s.turn;
      if (s.phase !== "play" || !t || t.status !== "running") fail("Time's up for this turn.");
      if (phoneOf(t) !== playerId && !host) fail("Only the clue-giver's phone can mark words.");
      if (action.word != null && action.word !== t.word) fail("That word was already marked.");
      if (type === "got") {
        point(s, t.team);
        t.got.push(t.word);
        takeFromPool(s, t.word);
        if (!s.pool.length) {
          t.word = null;
          finishTurn(s, null);
          endRound(s);
          newTurn(s, other(t.team));
          return s;
        }
        t.word = draw(s, rand);
      } else if (type === "skip") {
        if (t.skips >= s.settings.skipsPerTurn) fail("No skips left this turn.");
        if (s.pool.length < 2) fail("That's the last word in the bowl. Keep going!");
        t.skips += 1;
        t.word = draw(s, rand, t.word);
      } else {
        t.word = null;
        finishTurn(s, null);
        newTurn(s, other(t.team));
      }
      return s;
    }

    case "steal": {
      const t = s.turn;
      if (s.phase !== "play" || !t || t.status !== "steal") fail("There's nothing to steal right now.");
      if (phoneOf(t) !== playerId && !host) fail("The clue-giver marks the steal.");
      const word = t.word;
      if (action.stolen) {
        point(s, other(t.team));
        takeFromPool(s, word);
        finishTurn(s, word);
      } else {
        finishTurn(s, null);
      }
      t.word = null;
      if (!s.pool.length) endRound(s);
      newTurn(s, other(t.team));
      return s;
    }

    case "passGiver": {
      needHost();
      const t = s.turn;
      if (!t || t.status !== "ready") fail("Wait until the turn is over.");
      s.nextGiver[t.team] += 1;
      t.giverId = giverFor(s, t.team);
      return s;
    }

    case "nextRound": {
      needHost();
      if (s.phase !== "roundEnd") fail("The round isn't over yet.");
      startRound(s, s.round + 1, rand);
      s.turn.giverId = giverFor(s, s.turn.team);
      return s;
    }

    case "again": {
      needHost();
      if (s.phase !== "done") fail("Finish this game first.");
      s.phase = "lobby";
      s.words = {};
      s.bowl = [];
      s.pool = [];
      s.round = 0;
      s.turn = null;
      s.lastTurn = null;
      s.roundScores = [];
      s.scores = { red: 0, blue: 0 };
      return s;
    }

    case "remove": {
      const target = findPlayer(s, action.playerId);
      if (!target) return s;
      if (!(target.guest && target.by === playerId)) needHost();
      if (target.id === s.hostId) fail("Make someone else host first.");
      if ((s.turn?.giverId === target.id || phoneOf(s.turn) === target.id) && s.turn.status !== "ready") fail("Wait until their turn ends.");
      s.players = s.players.filter((p) => p !== target);
      if (s.phase === "lobby") delete s.words[target.id];
      if (s.turn) s.turn.giverId = giverFor(s, s.turn.team);
      return s;
    }

    case "leave": {
      if ((s.turn?.giverId === playerId || phoneOf(s.turn) === playerId) && s.turn.status !== "ready") fail("Finish this turn first.");
      s.players = s.players.filter((p) => p !== me);
      if (s.phase === "lobby") delete s.words[playerId];
      if (s.hostId === playerId) s.hostId = s.players.find((p) => !p.guest)?.id ?? s.hostId;
      if (s.turn) s.turn.giverId = giverFor(s, s.turn.team);
      return s;
    }

    case "makeHost": {
      const target = findPlayer(s, action.playerId ?? playerId);
      if (!target) fail("That player left.");
      if (target.guest) fail(`${target.name} doesn't have a phone in the game.`);
      const away = !findPlayer(s, s.hostId) || now - (findPlayer(s, s.hostId).seen ?? 0) > HOST_AWAY_MS;
      if (!host && !(away && target === me)) fail("Only the host can hand over hosting.");
      s.hostId = target.id;
      return s;
    }

    default:
      fail("Unknown move.");
  }
}

function checkWords(s, raw) {
  const words = (Array.isArray(raw) ? raw : []).map(cleanWord);
  if (words.length !== s.settings.wordsPerPerson || words.some((w) => !w)) {
    fail(`Fill in all ${s.settings.wordsPerPerson} words.`);
  }
  const seen = new Set();
  for (const w of words) {
    if (seen.has(w.toLowerCase())) fail(`"${w}" is in there twice.`);
    seen.add(w.toLowerCase());
  }
  return words;
}

function checkName(s, raw, exceptId) {
  const name = cleanName(raw);
  if (!name) fail("Type a name.");
  const clash = s.players.find((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
  if (clash) fail(`Someone here is already called ${clash.name}. Add an initial.`);
  return name;
}

/** The phone a turn is played on: the clue-giver's own, or one they picked up. */
export const phoneOf = (t) => (t ? (t.phoneId ?? t.giverId) : null);

/** Why the host can't start yet, or null when everyone's ready. */
export function startProblem(s) {
  const noTeam = s.players.filter((p) => !p.team);
  if (noTeam.length) return `${names(noTeam)} still need${noTeam.length === 1 ? "s" : ""} to pick a team.`;
  for (const team of TEAMS) if (!teamPlayers(s, team).length) return `${TEAM_NAMES[team]} needs at least one player.`;
  const waiting = s.players.filter((p) => (s.words[p.id]?.length ?? 0) !== s.settings.wordsPerPerson);
  if (waiting.length) return `Waiting on words from ${names(waiting)}.`;
  return null;
}

function names(list) {
  const n = list.map((p) => p.name);
  return n.length <= 2 ? n.join(" and ") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}

/**
 * What one phone gets to see. Nobody sees the words still in the bowl. The
 * word being clued shows to the clue-giver and the team watching; during a
 * steal it hides from the team trying to steal it.
 */
export function view(s, playerId, now) {
  const me = findPlayer(s, playerId) || null;
  const t = s.turn;
  let turn = null;
  if (t) {
    let word = null;
    if (t.word != null) {
      const giver = phoneOf(t) === playerId;
      const myTeam = me?.team;
      const canSee =
        t.status === "running" ? giver || myTeam !== t.team : t.status === "steal" ? giver || myTeam === t.team || !myTeam : false;
      if (canSee) word = { id: t.word, text: s.bowl[t.word].text };
    }
    turn = {
      team: t.team,
      giverId: t.giverId,
      phoneId: phoneOf(t),
      status: t.status,
      endsAt: t.endsAt,
      skips: t.skips,
      got: t.got.length,
      word,
      hasWord: t.word != null,
    };
  }
  const host = s.players.find((p) => p.id === s.hostId);
  return {
    roomName: s.roomName,
    hostId: s.hostId,
    hostAway: !host || now - (host.seen ?? 0) > HOST_AWAY_MS,
    me: me ? { id: me.id, name: me.name, team: me.team } : null,
    settings: s.settings,
    phase: s.phase,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      guest: Boolean(p.guest),
      by: p.by ?? null,
      ready: (s.words[p.id]?.length ?? 0) === s.settings.wordsPerPerson,
    })),
    myWords: s.words[playerId] ?? [],
    // Words for the players without a phone that this phone added.
    guestWords: Object.fromEntries(s.players.filter((p) => p.guest && p.by === playerId).map((p) => [p.id, s.words[p.id] ?? []])),
    round: s.round,
    bowlCount: s.bowl.length,
    poolCount: s.pool.length,
    scores: s.scores,
    roundScores: s.roundScores,
    roundTally: s.roundTally ?? { red: 0, blue: 0 },
    turn,
    lastTurn: s.lastTurn,
    turnCount: s.turnCount,
    startProblem: s.phase === "lobby" ? startProblem(s) : null,
  };
}
