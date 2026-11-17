import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, PartyPopper } from "lucide-react";

import { dayKey } from "../model/dates";
import { makeCloze, materialFor, newSeed, reviewQueue, rng, shuffleQuestion } from "../model/exercises";
import { formatTime } from "../model/stats";
import { useShelfDecks } from "../state/useStudyData";
import { ChoiceQuestion, ClozeQuestion, FlashCard, SourceLink } from "./Cards";
import { AppMark, SessionHead } from "./ui";
import { appInfo } from "../model/stats";

// Today's spaced review across everything on your shelf: what's due first,
// then a few new things. Cards flip, questions are multiple choice, facts
// are fill in the blank, all mixed together.
export default function Review({ store }) {
  const loaded = useShelfDecks(store.data.decks);
  const ready = loaded.length > 0 && loaded.every(l => l.status !== "loading");
  if (!store.data.decks.length) {
    return (
      <section className="sy-finished">
        <h2>Nothing on your shelf yet</h2>
        <p className="sy-muted">Add something to study first, from the library or with "Add to Study" in any learning app.</p>
        <Link to="/study?tab=library" className="sy-btn">
          Browse the library
        </Link>
      </section>
    );
  }
  if (!ready) return <p className="sy-loading">Gathering today's review…</p>;
  return <ReviewRun store={store} loaded={loaded.filter(l => l.deck)} />;
}

function ReviewRun({ store, loaded }) {
  const [seed] = useState(newSeed);
  const today = dayKey();
  // The queue is fixed when the review starts; misses are added to the end.
  const [queue, setQueue] = useState(() => reviewQueue(store.data, loaded, today, seed));
  const [pos, setPos] = useState(0);
  const [tally, setTally] = useState({ right: 0, total: 0 });
  const [lastRight, setLastRight] = useState(false);
  const decks = useMemo(() => new Map(loaded.map(l => [`${l.ref.app}:${l.ref.id}`, l.deck])), [loaded]);

  if (!queue.length || pos >= queue.length) {
    return (
      <section className="sy-finished">
        <span className="sy-finished-icon" aria-hidden="true">
          {tally.total ? <PartyPopper size={34} /> : <CalendarCheck size={34} />}
        </span>
        <h2>{tally.total ? "Today's review is done" : "You're all caught up"}</h2>
        <p className="sy-muted">
          {tally.total
            ? `${tally.right} of ${tally.total} right. What you missed comes back sooner; what you knew waits longer.`
            : "Nothing is due and you've met today's new cards. Practice any deck as much as you like, or come back tomorrow."}
        </p>
        <p className="sy-muted sy-small">PlanFox shows tomorrow's review on your calendar at {formatTime(store.data.settings.time)}.</p>
        <div className="sy-row">
          <Link to="/study" className="sy-btn">
            Back to my shelf
          </Link>
        </div>
      </section>
    );
  }

  const entry = queue[pos];
  const deck = decks.get(`${entry.app}:${entry.deckId}`);
  const material = deck && materialFor(deck, entry.kind, entry.id);
  const next = right => {
    setTally(t => ({ right: t.right + (right ? 1 : 0), total: t.total + 1 }));
    if (!right && queue.slice(pos + 1).filter(q => q.key === entry.key).length === 0 && queue.filter(q => q.key === entry.key).length < 3) setQueue(q => [...q, entry]);
    setPos(p => p + 1);
  };
  if (!material) {
    // The app changed and this piece is gone: skip it.
    setTimeout(() => setPos(p => p + 1));
    return null;
  }

  const head = (
    <>
      <SessionHead kicker="Today's review" title={deck.title} done={pos} total={queue.length} closeTo="/study" />
      <p className="sy-from">
        <AppMark app={entry.app} size={14} /> {appInfo(entry.app).subtitle} · {entry.kind === "c" ? "Card" : entry.kind === "q" ? "Question" : "Fill in the blank"}
      </p>
    </>
  );

  if (entry.kind === "c") {
    return (
      <>
        {head}
        <FlashCard
          key={`${pos}:${entry.key}`}
          item={{ ...material, key: entry.key }}
          app={entry.app}
          state={store.data.items[entry.key]}
          onRate={rating => {
            store.review(entry.key, rating);
            next(rating !== "again");
          }}
        />
      </>
    );
  }
  if (entry.kind === "q") {
    const q = shuffleQuestion(material, rng(seed + pos), entry.key);
    return (
      <>
        {head}
        <ChoiceQuestion
          key={`${pos}:${entry.key}`}
          q={q}
          onAnswer={right => {
            setLastRight(right);
            store.review(entry.key, right ? "good" : "again");
          }}
          onNext={() => next(lastRight)}
        />
        <SourceLink app={entry.app} href={deck.href} />
      </>
    );
  }
  const cloze = makeCloze(material);
  return (
    <>
      {head}
      <ClozeQuestion
        key={`${pos}:${entry.key}`}
        item={cloze}
        onAnswer={right => {
          setLastRight(right);
          store.review(entry.key, right ? "good" : "again");
        }}
        onNext={() => next(lastRight)}
      />
    </>
  );
}
