import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";

import { openInApp } from "../../../lib/launchApp";
import { dayKey } from "../model/dates";
import { gapLabel, preview, RATINGS } from "../model/srs";
import { checkTyped, shortBack } from "../model/exercises";
import { Lines } from "./ui";
import { appInfo } from "../model/stats";

/** "Open in GrowFox" for one piece of material. */
export function SourceLink({ app, href, label }) {
  const navigate = useNavigate();
  if (!href) return null;
  return (
    <button type="button" className="sy-source" onClick={() => openInApp(app, href, navigate)}>
      <ExternalLink size={13} aria-hidden="true" /> {label ?? `Open in ${appInfo(app).subtitle}`}
    </button>
  );
}

/** An index card that flips, then asks how well you knew it. */
export function FlashCard({ item, app, state, onRate }) {
  const [flipped, setFlipped] = useState(false);
  const gaps = preview(state, dayKey());

  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        onRate(RATINGS[Number(e.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, onRate]);

  return (
    <div className="sy-flash">
      <div
        role="button"
        tabIndex={0}
        className={`sy-card${flipped ? " sy-turned" : ""}`}
        onClick={() => setFlipped(f => !f)}
        aria-label={flipped ? "Card back. Tap to see the front." : "Card front. Tap to flip."}
      >
        <div className="sy-card-inner">
          <div className="sy-card-face is-front" aria-hidden={flipped}>
            <Lines text={item.front} className="sy-card-front" />
            <small className="sy-flip-hint">Tap or press space to flip</small>
          </div>
          <div className="sy-card-face is-back" aria-hidden={!flipped}>
            <small className="sy-card-term">{item.front.length > 90 ? shortBack(item.front, 90) : item.front}</small>
            <Lines text={item.back} className="sy-card-back" />
          </div>
        </div>
      </div>
      <div className="sy-rate" aria-hidden={!flipped}>
        {flipped ? (
          RATINGS.map((r, i) => (
            <button key={r.id} type="button" className={`sy-rate-btn is-${r.id}`} onClick={() => onRate(r.id)} title={`${r.hint} (key ${i + 1})`}>
              <strong>{r.name}</strong>
              <span>{gapLabel(gaps[r.id])}</span>
            </button>
          ))
        ) : (
          <button type="button" className="sy-btn is-wide" onClick={() => setFlipped(true)}>
            <RotateCcw size={16} aria-hidden="true" /> Show the answer
          </button>
        )}
      </div>
      {flipped && <SourceLink app={app} href={item.href} />}
    </div>
  );
}

/** One multiple choice question, answered once. */
export function ChoiceQuestion({ q, onAnswer, onNext, nextLabel = "Next" }) {
  const [picked, setPicked] = useState(null);
  const reveal = picked !== null;
  const pick = i => {
    if (reveal) return;
    setPicked(i);
    onAnswer(i === q.answer);
  };
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.("input, textarea, select")) return;
      const n = Number(e.key);
      if (!reveal && n >= 1 && n <= q.choices.length) pick(n - 1);
      else if (reveal && e.key === "Enter") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="sy-q">
      <p className="sy-q-text">
        <Lines text={q.text} />
      </p>
      <ol className="sy-choices">
        {q.choices.map((c, i) => {
          const cls = reveal ? (i === q.answer ? "is-right" : i === picked ? "is-wrong" : "is-dim") : "";
          return (
            <li key={i}>
              <button type="button" className={`sy-choice ${cls}`} onClick={() => pick(i)} disabled={reveal}>
                <span className="sy-letter">{"ABCDEF"[i]}</span>
                <span className="sy-choice-text">{c}</span>
                {reveal && i === q.answer && <Check size={17} aria-hidden="true" />}
                {reveal && i === picked && i !== q.answer && <X size={17} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      {reveal && (
        <div className={`sy-why ${picked === q.answer ? "is-right" : "is-wrong"}`}>
          <strong>{picked === q.answer ? "Right." : `It's ${"ABCDEF"[q.answer]}.`}</strong> <Lines text={q.why || q.choices[q.answer]} />
          <div className="sy-row">
            <button type="button" className="sy-btn" onClick={onNext} autoFocus>
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A sentence with a gap to type into. */
export function ClozeQuestion({ item, onAnswer, onNext, nextLabel = "Next" }) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const submit = e => {
    e.preventDefault();
    if (result !== null) return onNext();
    if (!typed.trim()) return undefined;
    const ok = checkTyped(typed, item.answer);
    setResult(ok);
    onAnswer(ok);
    return undefined;
  };
  const giveUp = () => {
    setResult(false);
    onAnswer(false);
  };
  return (
    <form className="sy-cloze" onSubmit={submit}>
      <p className="sy-cloze-text">
        <Lines text={item.before} />
        {result === null ? (
          <span className="sy-gap" style={{ "--w": `${Math.min(18, Math.max(4, item.answer.length))}ch` }}>
            <input value={typed} onChange={e => setTyped(e.target.value)} aria-label="Your answer" autoFocus autoComplete="off" autoCapitalize="off" spellCheck="false" />
          </span>
        ) : (
          <mark className={`sy-filled ${result ? "is-right" : "is-wrong"}`}>{item.answer}</mark>
        )}
        <Lines text={item.after} />
      </p>
      {result === null ? (
        <div className="sy-row">
          <button type="submit" className="sy-btn">
            Check
          </button>
          <button type="button" className="sy-btn is-ghost" onClick={giveUp}>
            Show me
          </button>
          <span className="sy-muted sy-small">{item.term ? "Name it" : "Type the missing words"}</span>
        </div>
      ) : (
        <div className={`sy-why ${result ? "is-right" : "is-wrong"}`}>
          <strong>{result ? "Right." : typed.trim() ? `Not quite: you wrote "${typed.trim()}".` : "Here it is."}</strong>
          <div className="sy-row">
            <button type="submit" className="sy-btn" autoFocus>
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
