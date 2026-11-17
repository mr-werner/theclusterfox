import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpenCheck, Calculator, ChevronDown, Columns3, ExternalLink, GalleryVerticalEnd, ListChecks, MousePointerClick, Plus, Shapes, TextCursorInput, Trash2 } from "lucide-react";

import { openInApp } from "../../../lib/launchApp";
import { dayKey } from "../model/dates";
import { MODES, modeCounts, shortBack } from "../model/exercises";
import { hasDeck } from "../state/studyStore";
import { deckStats } from "../model/stats";
import { AppMark, Lines } from "./ui";
import { appInfo } from "../model/stats";

const ICONS = { flash: GalleryVerticalEnd, quiz: ListChecks, fill: TextCursorInput, match: Columns3, sort: Shapes, problems: Calculator, diagrams: MousePointerClick };

export default function DeckView({ refId, deck, store }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const counts = modeCounts(deck);
  const on = hasDeck(store.data, refId.app, refId.id);
  const stats = deckStats(store.data, refId, deck, dayKey());
  const info = appInfo(refId.app);
  const base = `/study?deck=${encodeURIComponent(`${refId.app}:${refId.id}`)}`;
  const cards = deck.cards ?? [];

  return (
    <div className="sy-deck-page" style={{ "--app": `var(--${info.accent ?? refId.app}, #ffd84a)` }}>
      <header className="sy-page-head">
        <p className="sy-from">
          <AppMark app={refId.app} size={14} /> From {info.fullName ?? info.subtitle}
        </p>
        <h1>{deck.title}</h1>
        {deck.blurb && <p className="sy-lede">{deck.blurb}</p>}
        <div className="sy-row">
          {on ? (
            <button type="button" className="sy-btn is-ghost is-small" onClick={() => store.remove(refId.app, refId.id)}>
              <Trash2 size={15} aria-hidden="true" /> Take off my shelf
            </button>
          ) : (
            <button type="button" className="sy-btn is-small" onClick={() => store.add({ app: refId.app, id: refId.id, title: deck.title })}>
              <Plus size={15} aria-hidden="true" /> Add to my shelf
            </button>
          )}
          {deck.href && (
            <button type="button" className="sy-btn is-ghost is-small" onClick={() => openInApp(refId.app, deck.href, navigate)}>
              <ExternalLink size={15} aria-hidden="true" /> Open in {info.subtitle}
            </button>
          )}
        </div>
        {on && stats && (
          <div className="sy-deck-stats">
            <div>
              <strong>{stats.total}</strong>
              <span>to learn</span>
            </div>
            <div>
              <strong>{stats.seen}</strong>
              <span>started</span>
            </div>
            <div>
              <strong>{stats.known}</strong>
              <span>known well</span>
            </div>
            <div>
              <strong>{stats.due}</strong>
              <span>due now</span>
            </div>
          </div>
        )}
      </header>

      <h2 className="sy-section-title">Ways to study it</h2>
      <div className="sy-modes">
        {MODES.map(m => {
          const n = counts[m.id] ?? 0;
          const Icon = ICONS[m.id];
          const label = n === Infinity ? "Fresh numbers" : n ? `${n} ${m.id === "diagrams" ? (n === 1 ? "page" : "pages") : "items"}` : "Not for this deck";
          return n ? (
            <Link key={m.id} to={`${base}&mode=${m.id}`} className={`sy-mode is-${m.id}`}>
              <Icon size={22} aria-hidden="true" />
              <strong>{m.name}</strong>
              <span>{m.blurb}</span>
              <small>{label}</small>
            </Link>
          ) : (
            <div key={m.id} className={`sy-mode is-${m.id} is-off`} aria-disabled="true">
              <Icon size={22} aria-hidden="true" />
              <strong>{m.name}</strong>
              <span>{m.blurb}</span>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
      {on && (
        <p className="sy-muted sy-small sy-review-note">
          <BookOpenCheck size={14} aria-hidden="true" /> This deck is part of your <Link to="/study?review=1">daily spaced review</Link>.
        </p>
      )}

      {cards.length > 0 && (
        <section className="sy-preview">
          <h2 className="sy-section-title">What's in it</h2>
          <ul>
            {(showAll ? cards : cards.slice(0, 8)).map(c => (
              <li key={c.id}>
                <strong>{c.front}</strong>
                <Lines text={shortBack(c.back, 200)} />
                {c.group && <em>{c.group}</em>}
              </li>
            ))}
          </ul>
          {cards.length > 8 && (
            <button type="button" className="sy-btn is-ghost is-small" onClick={() => setShowAll(s => !s)}>
              <ChevronDown size={15} aria-hidden="true" style={{ transform: showAll ? "rotate(180deg)" : undefined }} /> {showAll ? "Show fewer" : `Show all ${cards.length}`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
