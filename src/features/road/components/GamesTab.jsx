import { useMemo, useState } from "react";
import { BadgeCheck, CaseSensitive, Grid3x3, HelpCircle, MessageCircle, RotateCcw, Shuffle, Undo2, UserPlus, X } from "lucide-react";

import { STATES } from "../data/states";
import { ALPHABET_RULES, bingoCard, bingoLines, shuffle, TALK_CARDS, triviaQuestion, WOULD_YOU_RATHER } from "../data/games";

const GAMES = [
  { id: "plates", name: "License plates", icon: BadgeCheck },
  { id: "bingo", name: "Road bingo", icon: Grid3x3 },
  { id: "alphabet", name: "Alphabet game", icon: CaseSensitive },
  { id: "trivia", name: "State trivia", icon: HelpCircle },
  { id: "talk", name: "Would you rather", icon: MessageCircle },
];

// Car games. Everything here works with no signal once the page is open.
export default function GamesTab({ store, routeStates, game, setGame }) {
  const g = GAMES.some(x => x.id === game) ? game : "plates";
  return (
    <div className="rf-games">
      <nav className="rf-chips rf-game-nav" aria-label="Games">
        {GAMES.map(x => {
          const Icon = x.icon;
          return (
            <button key={x.id} type="button" className={g === x.id ? "is-on" : ""} aria-current={g === x.id ? "page" : undefined} onClick={() => setGame(x.id)}>
              <Icon size={15} aria-hidden="true" /> {x.name}
            </button>
          );
        })}
      </nav>
      {g === "plates" && <Plates store={store} routeStates={routeStates} />}
      {g === "bingo" && <Bingo store={store} />}
      {g === "alphabet" && <Alphabet store={store} />}
      {g === "trivia" && <Trivia store={store} routeStates={routeStates} />}
      {g === "talk" && <Talk />}
    </div>
  );
}

function Plates({ store, routeStates }) {
  const { data, patch } = store;
  const found = data.games.plates;
  const count = Object.keys(found).length;
  const onRoute = new Set(routeStates);
  const toggle = code => patch(d => {
    const plates = { ...d.games.plates };
    if (plates[code]) delete plates[code];
    else plates[code] = true;
    return { games: { ...d.games, plates } };
  });
  return (
    <section className="rf-panel">
      <header className="rf-panel-head">
        <h2>
          License plate game <small>{count} of {STATES.length}</small>
        </h2>
        {count > 0 && (
          <button type="button" className="rf-btn is-ghost is-small" onClick={() => patch(d => ({ games: { ...d.games, plates: {} } }))}>
            <RotateCcw size={14} aria-hidden="true" /> Start over
          </button>
        )}
      </header>
      <p className="rf-muted rf-small">Tap a state when someone spots its plate.{routeStates.length ? " States you'll drive through are marked with a dot: those are the easy ones." : ""}</p>
      <div className="rf-progress" aria-hidden="true">
        <span style={{ width: `${(count / STATES.length) * 100}%` }} />
      </div>
      <ul className="rf-plates">
        {STATES.map(s => (
          <li key={s.code}>
            <button type="button" className={found[s.code] ? "is-on" : ""} aria-pressed={Boolean(found[s.code])} onClick={() => toggle(s.code)}>
              <strong>{s.code}</strong>
              <span>{s.name}</span>
              {onRoute.has(s.code) && <i className="rf-onroute" title="On your route" />}
            </button>
          </li>
        ))}
      </ul>
      {count === STATES.length && <p className="rf-win">All 50 states and DC. Legendary.</p>}
    </section>
  );
}

function Bingo({ store }) {
  const { data, patch } = store;
  const bingo = data.games.bingo ?? { seed: 1, marks: [] };
  const card = useMemo(() => bingoCard(bingo.seed), [bingo.seed]);
  const lines = bingoLines(bingo.marks);
  const inLine = new Set(lines.flat());
  const set = b => patch(d => ({ games: { ...d.games, bingo: b } }));
  const toggle = i => {
    if (i === 12) return;
    set({ ...bingo, marks: bingo.marks.includes(i) ? bingo.marks.filter(x => x !== i) : [...bingo.marks, i] });
  };
  return (
    <section className="rf-panel">
      <header className="rf-panel-head">
        <h2>
          Road trip bingo {lines.length > 0 && <small>{lines.length === 1 ? "BINGO!" : `${lines.length} lines!`}</small>}
        </h2>
        <button type="button" className="rf-btn is-ghost is-small" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) + 1, marks: [] })}>
          <Shuffle size={14} aria-hidden="true" /> New card
        </button>
      </header>
      <p className="rf-muted rf-small">Spot it out the window, tap it. Five in a row in any direction wins. Everyone can open their own card on their own phone.</p>
      <div className="rf-bingo" role="grid" aria-label="Bingo card">
        {card.map((item, i) => {
          const on = i === 12 || bingo.marks.includes(i);
          return (
            <button key={i} type="button" role="gridcell" aria-pressed={on} className={`${on ? "is-on" : ""}${inLine.has(i) ? " is-line" : ""}${i === 12 ? " is-free" : ""}`} onClick={() => toggle(i)}>
              {item}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function Alphabet({ store }) {
  const { data, patch } = store;
  const players = data.games.alphabet?.players ?? [{ name: "Player 1", at: 0 }];
  const [name, setName] = useState("");
  const set = list => patch(d => ({ games: { ...d.games, alphabet: { players: list } } }));
  const step = (i, by) => set(players.map((p, j) => (j === i ? { ...p, at: Math.max(0, Math.min(26, p.at + by)) } : p)));
  const winner = players.find(p => p.at >= 26);
  return (
    <section className="rf-panel">
      <header className="rf-panel-head">
        <h2>Alphabet game</h2>
        <button type="button" className="rf-btn is-ghost is-small" onClick={() => set(players.map(p => ({ ...p, at: 0 })))}>
          <RotateCcw size={14} aria-hidden="true" /> Restart
        </button>
      </header>
      <p className="rf-muted rf-small">{ALPHABET_RULES}</p>
      {winner && <p className="rf-win">{winner.name} made it to Z!</p>}
      <ul className="rf-alpha">
        {players.map((p, i) => (
          <li key={i}>
            <div className="rf-alpha-name">
              <strong>{p.name}</strong>
              {players.length > 1 && (
                <button type="button" className="rf-icon-btn" onClick={() => set(players.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="rf-alpha-row">
              <button type="button" className="rf-icon-btn" onClick={() => step(i, -1)} disabled={p.at === 0} aria-label="Undo a letter">
                <Undo2 size={16} />
              </button>
              <button type="button" className="rf-letter" onClick={() => step(i, 1)} disabled={p.at >= 26} aria-label={p.at >= 26 ? "Done" : `Found ${LETTERS[p.at]}`}>
                {p.at >= 26 ? "★" : LETTERS[p.at]}
              </button>
              <span className="rf-alpha-track" aria-hidden="true">
                {[...LETTERS].map((l, k) => (
                  <i key={l} className={k < p.at ? "is-on" : ""}>
                    {l}
                  </i>
                ))}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {players.length < 6 && (
        <form
          className="rf-addplayer"
          onSubmit={e => {
            e.preventDefault();
            set([...players, { name: name.trim() || `Player ${players.length + 1}`, at: 0 }]);
            setName("");
          }}
        >
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Add a player" aria-label="Player name" maxLength={20} />
          <button type="submit" className="rf-btn is-small">
            <UserPlus size={14} aria-hidden="true" /> Add
          </button>
        </form>
      )}
    </section>
  );
}

function Trivia({ store, routeStates }) {
  const { data, patch } = store;
  const [onlyRoute, setOnlyRoute] = useState(routeStates.length > 0);
  const [q, setQ] = useState(() => triviaQuestion(Math.random, onlyRoute ? routeStates : []));
  const [picked, setPicked] = useState(null);
  const score = data.games.trivia;
  function answer(c) {
    if (picked) return;
    setPicked(c);
    patch(d => ({ games: { ...d.games, trivia: { right: d.games.trivia.right + (c === q.answer ? 1 : 0), asked: d.games.trivia.asked + 1 } } }));
  }
  function next(route = onlyRoute) {
    setPicked(null);
    setQ(triviaQuestion(Math.random, route ? routeStates : []));
  }
  return (
    <section className="rf-panel">
      <header className="rf-panel-head">
        <h2>
          State trivia <small>{score.right} / {score.asked} right</small>
        </h2>
        {score.asked > 0 && (
          <button type="button" className="rf-btn is-ghost is-small" onClick={() => patch(d => ({ games: { ...d.games, trivia: { right: 0, asked: 0 } } }))}>
            <RotateCcw size={14} aria-hidden="true" /> Reset score
          </button>
        )}
      </header>
      {routeStates.length > 0 && (
        <label className="rf-check">
          <input
            type="checkbox"
            checked={onlyRoute}
            onChange={e => {
              setOnlyRoute(e.target.checked);
              next(e.target.checked);
            }}
          />
          Only states on this trip
        </label>
      )}
      <p className="rf-question">{q.prompt}</p>
      <div className="rf-choices">
        {q.choices.map(c => (
          <button key={c} type="button" onClick={() => answer(c)} className={picked ? (c === q.answer ? "is-right" : c === picked ? "is-wrong" : "") : ""} disabled={Boolean(picked) && c !== picked && c !== q.answer}>
            {c}
          </button>
        ))}
      </div>
      {picked && (
        <div className="rf-after">
          <p>{picked === q.answer ? "Correct!" : `It's ${q.answer}.`}</p>
          <button type="button" className="rf-btn" onClick={() => next()}>
            Next question
          </button>
        </div>
      )}
    </section>
  );
}

function Talk() {
  const [deck, setDeck] = useState("wyr");
  const [order, setOrder] = useState(() => ({ wyr: shuffle(WOULD_YOU_RATHER), talk: shuffle(TALK_CARDS) }));
  const [i, setI] = useState(0);
  const cards = order[deck];
  const card = cards[i % cards.length];
  return (
    <section className="rf-panel">
      <header className="rf-panel-head">
        <h2>Talk it out</h2>
        <div className="rf-chips">
          <button type="button" className={deck === "wyr" ? "is-on" : ""} onClick={() => { setDeck("wyr"); setI(0); }}>
            Would you rather
          </button>
          <button type="button" className={deck === "talk" ? "is-on" : ""} onClick={() => { setDeck("talk"); setI(0); }}>
            Conversation cards
          </button>
        </div>
      </header>
      <button type="button" className="rf-bigcard" onClick={() => setI(i + 1)}>
        <span>{card}</span>
        <em>Tap for the next one</em>
      </button>
      <p className="rf-muted rf-small">
        {(i % cards.length) + 1} of {cards.length}{" "}
        <button type="button" className="rf-link" onClick={() => { setOrder({ wyr: shuffle(WOULD_YOU_RATHER), talk: shuffle(TALK_CARDS) }); setI(0); }}>
          Shuffle
        </button>
      </p>
    </section>
  );
}
