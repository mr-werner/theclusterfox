// Plays Fishbowl games through the same rules the server runs:
// node src/features/fishbowl/tests/validate.mjs
import assert from "node:assert/strict";
import { act, newGame, tick, view, roomCode, GameError, GRACE_MS } from "../model/game.js";

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let now = 1_000_000;
const play = (s, id, action) => act(s, id, action, { now, rand });
const fails = (fn, re) => assert.throws(fn, (e) => e instanceof GameError && re.test(e.message));

assert.equal(roomCode("  Werner   Family "), "werner family");

let s = newGame({ roomName: "Werner", hostId: "h", hostName: "Mom", now });
for (const [id, name] of [["a", "Dad"], ["b", "Sam"], ["c", "Kim"]]) s = play(s, id, { type: "join", name });
fails(() => play(s, "z", { type: "join", name: "dad" }), /already called/);
fails(() => play(s, "a", { type: "settings", turnSeconds: 30 }), /host/);
s = play(s, "h", { type: "settings", wordsPerPerson: 2, turnSeconds: 30, skipsPerTurn: 1 });
assert.deepEqual(s.settings, { wordsPerPerson: 2, turnSeconds: 30, skipsPerTurn: 1 });

fails(() => play(s, "h", { type: "start" }), /pick a team/);
s = play(s, "h", { type: "team", team: "red" });
s = play(s, "a", { type: "team", team: "blue" });
s = play(s, "b", { type: "team", team: "red" });
s = play(s, "c", { type: "team", team: "blue" });
fails(() => play(s, "h", { type: "start" }), /Waiting on words from Mom, Dad, Sam and Kim/);
fails(() => play(s, "h", { type: "words", words: ["cat"] }), /all 2/);
fails(() => play(s, "h", { type: "words", words: ["cat", "Cat"] }), /twice/);
const all = { h: ["cat", "pizza"], a: ["moon", "taco"], b: ["guitar", "beach"], c: ["robot", "snow"] };
for (const [id, w] of Object.entries(all)) s = play(s, id, { type: "words", words: w });
assert.equal(view(s, "a", now).startProblem, null);
assert.deepEqual(view(s, "a", now).myWords, ["moon", "taco"]);
assert.equal(JSON.stringify(view(s, "a", now)).includes("pizza"), false, "lobby hides others' words");

s = play(s, "h", { type: "start" });
assert.equal(s.phase, "play");
assert.equal(s.bowl.length, 8);
assert.equal(s.pool.length, 8);

const word = (st) => st.bowl[st.turn.word]?.text;
let rounds = 0;
let guard = 0;
const seenGivers = { red: [], blue: [] };
while (s.phase !== "done" && guard++ < 200) {
  if (s.phase === "roundEnd") {
    rounds++;
    assert.equal(s.pool.length, 0);
    s = play(s, "h", { type: "nextRound" });
    assert.equal(s.pool.length, 8, "every word goes back in the bowl");
    continue;
  }
  const t = s.turn;
  const giver = t.giverId;
  seenGivers[t.team].push(giver);
  const team = t.team;
  const opp = s.players.find((p) => p.team !== team && p.id !== "h").id;
  const mate = s.players.find((p) => p.team === team && p.id !== giver)?.id;
  fails(() => play(s, opp, { type: "startTurn" }), /not your turn/);
  s = play(s, giver, { type: "startTurn" });
  // Who sees the word while it's being clued.
  assert.equal(view(s, giver, now).turn.word.text, word(s));
  assert.equal(view(s, opp, now).turn.word.text, word(s));
  if (mate) assert.equal(view(s, mate, now).turn.word, null, "guessers can't see it");
  assert.equal(JSON.stringify(view(s, mate ?? opp, now)).includes('"pool"'), false);

  const before = { ...s.scores };
  s = play(s, giver, { type: "got", word: s.turn.word });
  assert.equal(s.scores[team], before[team] + 1);
  if (s.phase !== "play") continue;
  if (s.pool.length > 1) {
    const w = s.turn.word;
    s = play(s, giver, { type: "skip" });
    assert.notEqual(s.turn.word, w);
    fails(() => play(s, giver, { type: "skip" }), /No skips/);
  }
  // Time runs out with a word on the table: the other team may steal it.
  now = s.turn.endsAt + GRACE_MS;
  assert.equal(tick(s, now), true);
  assert.equal(s.turn.status, "steal");
  assert.equal(view(s, opp, now).turn.word, null, "stealers can't see it");
  const stolen = guard % 2 === 0;
  const oppBefore = s.scores[team === "red" ? "blue" : "red"];
  const left = s.pool.length;
  s = play(s, giver, { type: "steal", stolen });
  assert.equal(s.scores[team === "red" ? "blue" : "red"], oppBefore + (stolen ? 1 : 0));
  assert.equal(s.pool.length, left - (stolen ? 1 : 0));
  if (s.phase === "play") assert.equal(s.turn.team, team === "red" ? "blue" : "red", "teams alternate");
  now += 5000;
}
assert.equal(s.phase, "done");
assert.equal(rounds, 2);
assert.equal(s.roundScores.length, 3);
for (const r of s.roundScores) assert.equal(r.red + r.blue, 8, "each round scores every word once");
assert.equal(s.scores.red + s.scores.blue, 24);
// Clue-givers rotate inside each team.
assert.deepEqual([...new Set(seenGivers.red.slice(0, 2))].sort(), ["b", "h"]);
assert.deepEqual([...new Set(seenGivers.blue.slice(0, 2))].sort(), ["a", "c"]);

// A turn that ends with no word left on the table passes straight on.
s = play(s, "h", { type: "again" });
assert.equal(s.phase, "lobby");
assert.deepEqual(s.words, {});
for (const [id, w] of Object.entries(all)) s = play(s, id, { type: "words", words: w });
s = play(s, "h", { type: "start" });
const first = s.turn.team;
s = play(s, s.turn.giverId, { type: "startTurn" });
s = play(s, s.turn.giverId, { type: "stop" });
assert.equal(s.turn.team, first === "red" ? "blue" : "red");
assert.equal(s.pool.length, 8);

// Host can pass a missing clue-giver, and a late joiner can pick a team.
const g = s.turn.giverId;
s = play(s, "h", { type: "passGiver" });
assert.notEqual(s.turn.giverId, g);
s = play(s, "n", { type: "join", name: "Grandpa" });
s = play(s, "n", { type: "team", team: "red" });
fails(() => play(s, "n", { type: "team", team: "blue" }), /Teams are set/);

// An away host can be replaced.
fails(() => play(s, "a", { type: "makeHost" }), /Only the host/);
now += 3 * 60 * 1000;
s = act(s, "a", { type: "makeHost" }, { now, rand });
assert.equal(s.hostId, "a");

// Players without a phone: added from someone's phone, clue on any phone.
{
  now = 5_000_000;
  let g = newGame({ roomName: "Guests", hostId: "h", hostName: "Mom", now });
  g = play(g, "a", { type: "join", name: "Dad" });
  g = play(g, "h", { type: "settings", wordsPerPerson: 1 });
  g = play(g, "h", { type: "team", team: "red" });
  g = play(g, "a", { type: "team", team: "blue" });
  fails(() => play(g, "a", { type: "addGuest", name: "Grandma", team: "red", words: [] }), /Fill in all 1/);
  fails(() => play(g, "a", { type: "addGuest", name: "mom", team: "red", words: ["x"] }), /already called/);
  g = play(g, "a", { type: "addGuest", name: "Grandma", team: "red", words: ["Bingo"] });
  const gid = g.players.find((p) => p.name === "Grandma").id;
  assert.equal(g.players.find((p) => p.id === gid).guest, true);
  assert.deepEqual(view(g, "a", now).guestWords, { [gid]: ["Bingo"] });
  assert.deepEqual(view(g, "h", now).guestWords, {}, "only the phone that added her sees her words");
  fails(() => play(g, "x", { type: "words", for: gid, words: ["Nope"] }), /not in this room/);
  g = play(g, "a", { type: "words", for: gid, words: ["Bingo night"] });
  fails(() => play(g, "a", { type: "words", for: "h", words: ["Nope"] }), /without a phone/);
  fails(() => play(g, "a", { type: "makeHost", playerId: gid }), /Only the host|phone/);
  fails(() => play(g, "h", { type: "makeHost", playerId: gid }), /doesn't have a phone/);
  g = play(g, "h", { type: "words", words: ["Pie"] });
  g = play(g, "a", { type: "words", words: ["Golf"] });
  // Make red go first, with Grandma as the clue-giver.
  let r = 0;
  do g = act(newStart(g), "h", { type: "start" }, { now, rand: () => [0.1, 0.2, 0.3, 0.4, 0.1][r++ % 5] });
  while (g.turn.team !== "red");
  g.nextGiver.red = 1;
  g.turn.giverId = gid;
  // Grandma has no phone: Dad (the other team!) can't just start it...
  fails(() => play(g, "a", { type: "startTurn" }), /not your turn/);
  // ...but anyone can hand theirs over once she's confirmed it's her.
  g = play(g, "a", { type: "startTurn", as: gid });
  assert.equal(g.turn.phoneId, "a");
  assert.equal(g.turn.giverId, gid);
  assert.ok(view(g, "a", now).turn.word, "the phone she's holding shows the word");
  assert.equal(view(g, "a", now).turn.phoneId, "a");
  fails(() => play(g, "a", { type: "leave" }), /Finish this turn/);
  g = play(g, "a", { type: "got", word: g.turn.word });
  assert.equal(g.scores.red, 1, "the point goes to Grandma's team, not the phone owner's");
  g = play(g, "a", { type: "stop" });
  assert.equal(g.turn.team, "blue");
  assert.equal(g.lastTurn.giverId, gid);
}
function newStart(st) {
  const c = structuredClone(st);
  c.phase = "lobby";
  return c;
}

console.log("fishbowl ok");
