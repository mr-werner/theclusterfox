import { CircleHelp } from "lucide-react";

/** The small "?" beside a label that opens what the label means. */
export function TermButton({ term, open, onToggle, controls }) {
  return (
    <button
      type="button"
      className={`tf-term-btn ${open ? "is-open" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title={open ? "Hide the meaning" : `What is ${term.name.toLowerCase()}?`}
    >
      <CircleHelp size={15} aria-hidden="true" />
      <span className="tf-sr">What is {term.name}?</span>
    </button>
  );
}

/** What a term is, why it matters and, for the big ideas, where it's used. */
export function TermCard({ term, id, compact }) {
  return (
    <div className={`tf-term-card ${compact ? "is-compact" : ""}`} id={id} role="note">
      {!compact && (
        <p className="tf-term-name">
          {term.name}
          {term.symbol && <span className="tf-term-symbol">{term.symbol}</span>}
        </p>
      )}
      <p>{term.what}</p>
      <p>
        <strong>Why it matters:</strong> {term.why}
      </p>
      {term.seen && (
        <p>
          <strong>Where you'll meet it:</strong> {term.seen}
        </p>
      )}
    </div>
  );
}
