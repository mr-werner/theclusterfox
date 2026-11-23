import { Link, useSearchParams } from "react-router-dom";
import { Library, Repeat, Layers } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useDeck, useStudyData } from "./state/useStudyData";
import { MODES } from "./model/exercises";
import Shelf from "./components/Shelf";
import LibraryView from "./components/LibraryView";
import DeckView from "./components/DeckView";
import Review from "./components/Review";
import { DiagramsList, FillRound, FlashcardsRound, MatchRound, ProblemsRound, QuizRound, SortRound } from "./components/Practice";
import "./study.css";
import "./identity.css";

// StudyFox: one place to study what the other ClusterFox apps teach.
//   /study                  your shelf and today's review
//   /study?tab=library      everything you can add
//   /study?review=1         today's spaced review
//   /study?deck=app:id      one deck and the ways to study it
//   /study?deck=app:id&mode=flash|quiz|fill|match|sort|problems|diagrams

const ROUNDS = { flash: FlashcardsRound, quiz: QuizRound, fill: FillRound, match: MatchRound, sort: SortRound, problems: ProblemsRound, diagrams: DiagramsList };

function parseDeck(value) {
  if (!value) return null;
  const at = value.indexOf(":");
  if (at < 1) return null;
  return { app: value.slice(0, at), id: value.slice(at + 1) };
}

export default function StudyPage() {
  const store = useStudyData();
  const [params] = useSearchParams();
  const refId = parseDeck(params.get("deck"));
  const mode = MODES.some(m => m.id === params.get("mode")) ? params.get("mode") : null;
  const review = params.get("review") === "1";
  const tab = params.get("tab") === "library" ? "library" : "shelf";

  const planTitle = review ? "Study: today's review" : refId ? `Study: ${store.data.decks.find(d => d.app === refId.app && d.id === refId.id)?.title ?? "a deck"}` : "Study";
  const inSession = review || (refId && mode);

  return (
    <div className={`sy${inSession ? " is-session" : ""}`}>
      <AppBar appId="studyfox" planTitle={planTitle} planHref={review ? "/study?review=1" : undefined} backTo={() => (refId && mode ? `/study?deck=${encodeURIComponent(`${refId.app}:${refId.id}`)}` : "/study")} />
      <main className="sy-wrap">
        {!inSession && !refId && (
          <nav className="sy-tabs" aria-label="StudyFox">
            <Link to="/study" className={tab === "shelf" ? "is-on" : ""} aria-current={tab === "shelf" ? "page" : undefined}>
              <Layers size={16} aria-hidden="true" /> My shelf
            </Link>
            <Link to="/study?tab=library" className={tab === "library" ? "is-on" : ""} aria-current={tab === "library" ? "page" : undefined}>
              <Library size={16} aria-hidden="true" /> Library
            </Link>
            <Link to="/study?review=1" className="sy-tab-review">
              <Repeat size={16} aria-hidden="true" /> Review
            </Link>
          </nav>
        )}
        {review ? <Review store={store} /> : refId ? <DeckRoute refId={refId} mode={mode} store={store} /> : tab === "library" ? <LibraryView store={store} /> : <Shelf store={store} />}
      </main>
    </div>
  );
}

function DeckRoute({ refId, mode, store }) {
  const { status, deck } = useDeck(refId.app, refId.id);
  if (status === "loading") return <p className="sy-loading">Opening the deck…</p>;
  if (!deck) {
    return (
      <section className="sy-finished">
        <h2>{status === "error" ? "Couldn't load this deck" : "This deck isn't there anymore"}</h2>
        <p className="sy-muted">{status === "error" ? "Check your connection and try again." : "The app it came from no longer has it. You can take it off your shelf."}</p>
        <div className="sy-row">
          {store.data.decks.some(d => d.app === refId.app && d.id === refId.id) && (
            <button type="button" className="sy-btn is-ghost" onClick={() => store.remove(refId.app, refId.id)}>
              Take it off my shelf
            </button>
          )}
          <Link to="/study" className="sy-btn">
            Back to my shelf
          </Link>
        </div>
      </section>
    );
  }
  const closeTo = `/study?deck=${encodeURIComponent(`${refId.app}:${refId.id}`)}`;
  if (mode) {
    const Round = ROUNDS[mode];
    return <Round key={mode} deck={deck} refId={refId} store={store} closeTo={closeTo} />;
  }
  return <DeckView refId={refId} deck={deck} store={store} />;
}
