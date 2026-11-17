import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ExternalLink } from "lucide-react";

import { openInApp } from "../../../lib/launchApp";
import { checkNumber, fillItems, flashItems, matchRound, newSeed, problemRound, quizRound, sortRound } from "../model/exercises";
import { ChoiceQuestion, ClozeQuestion, FlashCard, SourceLink } from "./Cards";
import { Empty, Finished, Lines, SessionHead } from "./ui";

const fullKey = (ref, key) => `${ref.app}:${ref.id}:${key}`;

// ── Flashcards ──────────────────────────────────────────────────────────
export function FlashcardsRound({ deck, refId, store, closeTo }) {
  const [seed, setSeed] = useState(newSeed);
  const [queue, setQueue] = useState(() => flashItems(deck));
  const [pos, setPos] = useState(0);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const total = queue.length;

  if (!total) return <Empty>This deck has no cards yet.</Empty>;
  if (pos >= total) {
    return (
      <Finished
        right={tally.right}
        total={tally.total}
        closeTo={closeTo}
        note="Each card is now on your review schedule. StudyFox brings it back just before you'd forget it."
        onAgain={() => {
          setSeed(newSeed());
          setQueue(flashItems(deck));
          setPos(0);
          setTally({ right: 0, total: 0 });
        }}
      />
    );
  }
  const item = queue[pos];
  return (
    <>
      <SessionHead kicker="Flashcards" title={deck.title} done={pos} total={total} closeTo={closeTo} />
      <FlashCard
        key={`${seed}:${pos}:${item.key}`}
        item={item}
        app={refId.app}
        state={store.data.items[fullKey(refId, item.key)]}
        onRate={rating => {
          store.review(fullKey(refId, item.key), rating);
          setTally(t => ({ right: t.right + (rating === "again" ? 0 : 1), total: t.total + 1 }));
          // Missed cards come round again before the round ends.
          if (rating === "again" && queue.filter(q => q.key === item.key).length < 3) setQueue(q => [...q, item]);
          setPos(p => p + 1);
        }}
      />
    </>
  );
}

// ── Multiple choice ─────────────────────────────────────────────────────
export function QuizRound({ deck, refId, store, closeTo }) {
  const [seed, setSeed] = useState(newSeed);
  const questions = useMemo(() => quizRound(deck, 10, seed), [deck, seed]);
  const [pos, setPos] = useState(0);
  const [right, setRight] = useState(0);
  if (!questions.length) return <Empty>This deck has no questions yet.</Empty>;
  if (pos >= questions.length) {
    return <Finished right={right} total={questions.length} closeTo={closeTo} onAgain={() => { setSeed(newSeed()); setPos(0); setRight(0); }} />;
  }
  const q = questions[pos];
  return (
    <>
      <SessionHead kicker="Multiple choice" title={deck.title} done={pos} total={questions.length} closeTo={closeTo} />
      <ChoiceQuestion
        key={`${seed}:${pos}`}
        q={q}
        onAnswer={ok => {
          store.practice(fullKey(refId, q.key), ok);
          if (ok) setRight(n => n + 1);
        }}
        onNext={() => setPos(p => p + 1)}
        nextLabel={pos + 1 === questions.length ? "See your score" : "Next"}
      />
      <SourceLink app={refId.app} href={q.href} />
    </>
  );
}

// ── Fill in the blank ───────────────────────────────────────────────────
export function FillRound({ deck, refId, store, closeTo }) {
  const [seed, setSeed] = useState(newSeed);
  const items = useMemo(() => fillItems(deck, seed).slice(0, 10), [deck, seed]);
  const [pos, setPos] = useState(0);
  const [right, setRight] = useState(0);
  if (!items.length) return <Empty>This deck has nothing to fill in yet.</Empty>;
  if (pos >= items.length) {
    return <Finished right={right} total={items.length} closeTo={closeTo} onAgain={() => { setSeed(newSeed()); setPos(0); setRight(0); }} />;
  }
  const item = items[pos];
  return (
    <>
      <SessionHead kicker="Fill in the blank" title={deck.title} done={pos} total={items.length} closeTo={closeTo} />
      <ClozeQuestion
        key={`${seed}:${pos}`}
        item={item}
        onAnswer={ok => {
          store.practice(fullKey(refId, item.key), ok);
          if (ok) setRight(n => n + 1);
        }}
        onNext={() => setPos(p => p + 1)}
        nextLabel={pos + 1 === items.length ? "See your score" : "Next"}
      />
    </>
  );
}

// ── Matching ────────────────────────────────────────────────────────────
export function MatchRound({ deck, refId, store, closeTo }) {
  const [seed, setSeed] = useState(newSeed);
  const round = useMemo(() => matchRound(deck, 5, seed), [deck, seed]);
  const [term, setTerm] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [missed, setMissed] = useState(() => new Set());
  const [shake, setShake] = useState(null);
  const [rounds, setRounds] = useState({ right: 0, total: 0 });

  const byKey = new Map(round.pairs.map(p => [p.key, p]));
  const allDone = matched.size === round.pairs.length && round.pairs.length > 0;

  const choose = meaningKey => {
    if (!term || matched.has(meaningKey)) return;
    if (term === meaningKey) {
      const next = new Set(matched).add(term);
      setMatched(next);
      setTerm(null);
      if (next.size === round.pairs.length) {
        for (const p of round.pairs) store.practice(fullKey(refId, p.key), !missed.has(p.key));
        setRounds(r => ({ right: r.right + round.pairs.filter(p => !missed.has(p.key)).length, total: r.total + round.pairs.length }));
      }
    } else {
      setMissed(m => new Set(m).add(term));
      setShake(meaningKey);
      setTimeout(() => setShake(null), 450);
    }
  };

  if (round.pairs.length < 3) return <Empty>This deck needs at least four cards to match.</Empty>;
  return (
    <>
      <SessionHead kicker="Matching" title={deck.title} done={matched.size} total={round.pairs.length} closeTo={closeTo} />
      <p className="sy-muted sy-instruct">Pick a term, then the meaning that goes with it.</p>
      <div className="sy-match">
        <ul className="sy-match-col" aria-label="Terms">
          {round.pairs.map(p => (
            <li key={p.key}>
              <button type="button" className={`sy-tile is-term${term === p.key ? " is-on" : ""}${matched.has(p.key) ? " is-done" : ""}`} onClick={() => setTerm(term === p.key ? null : p.key)} disabled={matched.has(p.key)} aria-pressed={term === p.key}>
                {matched.has(p.key) && <Check size={15} aria-hidden="true" />} {p.term}
              </button>
            </li>
          ))}
        </ul>
        <ul className="sy-match-col" aria-label="Meanings">
          {round.meanings.map(k => (
            <li key={k}>
              <button type="button" className={`sy-tile is-meaning${matched.has(k) ? " is-done" : ""}${shake === k ? " is-shake" : ""}`} onClick={() => choose(k)} disabled={matched.has(k) || !term}>
                {byKey.get(k).meaning}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {allDone && (
        <div className="sy-why is-right sy-match-done">
          <strong>All matched{missed.size ? `, ${missed.size} after a miss` : " on the first try"}.</strong> {rounds.total > round.pairs.length && `${rounds.right} of ${rounds.total} first-try matches this visit.`}
          <div className="sy-row">
            <button type="button" className="sy-btn" onClick={() => { setSeed(newSeed()); setMatched(new Set()); setMissed(new Set()); setTerm(null); }}>
              Next set <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sorting ─────────────────────────────────────────────────────────────
export function SortRound({ deck, refId, store, closeTo }) {
  const [seed, setSeed] = useState(newSeed);
  const round = useMemo(() => sortRound(deck, 10, seed), [deck, seed]);
  const [placed, setPlaced] = useState({}); // key -> group
  const [held, setHeld] = useState(null);
  const [checked, setChecked] = useState(false);

  if (round.groups.length < 2) return <Empty>This deck has no categories to sort.</Empty>;
  const loose = round.items.filter(i => !placed[i.key]);
  const put = (key, group) => {
    if (checked || !key) return;
    setPlaced(p => ({ ...p, [key]: group }));
    setHeld(null);
  };
  const check = () => {
    setChecked(true);
    for (const it of round.items) store.practice(fullKey(refId, it.key), placed[it.key] === it.group);
  };
  const right = round.items.filter(it => placed[it.key] === it.group).length;

  const chip = it => {
    const state = checked ? (placed[it.key] === it.group ? "is-right" : "is-wrong") : held === it.key ? "is-on" : "";
    return (
      <button
        key={it.key}
        type="button"
        draggable={!checked}
        onDragStart={e => {
          e.dataTransfer.setData("text/plain", it.key);
          setHeld(it.key);
        }}
        className={`sy-chip ${state}`}
        onClick={() => !checked && setHeld(held === it.key ? null : it.key)}
        aria-pressed={held === it.key}
        title={checked && placed[it.key] !== it.group ? `Goes in ${it.group}` : undefined}
      >
        {it.label}
        {checked && placed[it.key] !== it.group && <small> → {it.group}</small>}
      </button>
    );
  };

  return (
    <>
      <SessionHead kicker="Sorting" title={deck.title} done={round.items.length - loose.length} total={round.items.length} closeTo={closeTo} />
      <p className="sy-muted sy-instruct">Tap one, then tap the group it belongs in. On a computer you can drag too.</p>
      <div className="sy-tray" aria-label="Still to sort">
        {loose.length ? loose.map(chip) : !checked && <span className="sy-muted sy-small">All sorted. Check your answers.</span>}
      </div>
      <div className="sy-bins" style={{ "--n": round.groups.length }}>
        {round.groups.map(g => (
          <section
            key={g}
            className={`sy-bin${held ? " is-ready" : ""}`}
            onClick={() => put(held, g)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              put(e.dataTransfer.getData("text/plain"), g);
            }}
          >
            <h3>{g}</h3>
            <div className="sy-bin-items">{round.items.filter(i => placed[i.key] === g).map(chip)}</div>
          </section>
        ))}
      </div>
      <div className="sy-row">
        {!checked ? (
          <button type="button" className="sy-btn" disabled={loose.length > 0} onClick={check}>
            Check
          </button>
        ) : (
          <>
            <strong className="sy-sort-score">
              {right} of {round.items.length} in the right place
            </strong>
            <button type="button" className="sy-btn" onClick={() => { setSeed(newSeed()); setPlaced({}); setChecked(false); }}>
              New set <ArrowRight size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ── Practical problems ──────────────────────────────────────────────────
export function ProblemsRound({ deck, refId, closeTo }) {
  const [seed, setSeed] = useState(newSeed);
  const problems = useMemo(() => problemRound(deck, 5, seed), [deck, seed]);
  const [pos, setPos] = useState(0);
  const [right, setRight] = useState(0);
  if (!problems.length) return <Empty>This deck has no worked problems.</Empty>;
  if (pos >= problems.length) {
    return <Finished right={right} total={problems.length} closeTo={closeTo} note="Every round has new numbers, so practice as often as you like." onAgain={() => { setSeed(newSeed()); setPos(0); setRight(0); }} />;
  }
  const p = problems[pos];
  const next = () => setPos(n => n + 1);
  return (
    <>
      <SessionHead kicker="Practical problems" title={deck.title} done={pos} total={problems.length} closeTo={closeTo} />
      {p.kind === "choice" ? (
        <ChoiceQuestion key={`${seed}:${pos}`} q={p} onAnswer={ok => ok && setRight(n => n + 1)} onNext={next} />
      ) : (
        <NumberProblem key={`${seed}:${pos}`} p={p} onAnswer={ok => ok && setRight(n => n + 1)} onNext={next} />
      )}
      <SourceLink app={refId.app} href={p.href} label="Work it in the calculator" />
    </>
  );
}

function NumberProblem({ p, onAnswer, onNext }) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const submit = e => {
    e.preventDefault();
    if (result !== null) return onNext();
    if (!typed.trim()) return undefined;
    const ok = checkNumber(typed, p.answer, p.tolerance);
    setResult(ok);
    onAnswer(ok);
    return undefined;
  };
  const shown = Number(p.answer.toPrecision(4)).toLocaleString("en-US", { maximumFractionDigits: 6 });
  return (
    <form className="sy-problem" onSubmit={submit}>
      <p className="sy-q-text">
        <Lines text={p.text} />
      </p>
      <label className="sy-answer">
        <span className="sr-only">Your answer</span>
        <input inputMode="decimal" value={typed} onChange={e => setTyped(e.target.value)} disabled={result !== null} autoFocus autoComplete="off" placeholder="Your answer" />
        {p.unit && <span className="sy-unit">{p.unit}</span>}
      </label>
      {result === null ? (
        <div className="sy-row">
          <button type="submit" className="sy-btn">
            Check
          </button>
          <button type="button" className="sy-btn is-ghost" onClick={() => { setResult(false); onAnswer(false); }}>
            Show the working
          </button>
          <span className="sy-muted sy-small">Within {Math.round((p.tolerance ?? 0.02) * 100)}% counts</span>
        </div>
      ) : (
        <div className={`sy-why ${result ? "is-right" : "is-wrong"}`}>
          <strong>{result ? "Right." : `The answer is ${shown} ${p.unit ?? ""}.`}</strong>
          <pre className="sy-working">{p.why}</pre>
          <div className="sy-row">
            <button type="submit" className="sy-btn" autoFocus>
              Next
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Interactive diagrams ────────────────────────────────────────────────
export function DiagramsList({ deck, refId, closeTo }) {
  const navigate = useNavigate();
  const list = deck.diagrams ?? [];
  return (
    <>
      <SessionHead kicker="Interactive diagrams" title={deck.title} done={0} total={0} closeTo={closeTo} />
      <p className="sy-muted sy-instruct">These live in the app they came from, so you always get the full, current version. Each opens right where you need to be.</p>
      <ul className="sy-diagrams">
        {list.map(d => (
          <li key={d.href + d.title}>
            <button type="button" onClick={() => openInApp(refId.app, d.href, navigate)}>
              <span>
                <strong>{d.title}</strong>
                {d.blurb && <small>{d.blurb}</small>}
              </span>
              <ExternalLink size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <Empty>No diagrams for this deck.</Empty>}
    </>
  );
}

