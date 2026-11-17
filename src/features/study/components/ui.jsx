import { Link } from "react-router-dom";
import { X } from "lucide-react";

import { appInfo } from "../model/stats";


/** The source app's icon in its own color. */
export function AppMark({ app, size = 16 }) {
  const info = appInfo(app);
  const Icon = info.icon;
  return (
    <span className="sy-appmark" style={{ "--app": `var(--${info.accent ?? app}, #ffd84a)` }} title={info.subtitle} aria-hidden="true">
      {Icon && <Icon size={size} strokeWidth={2.1} />}
    </span>
  );
}

/** Top of a practice round: what you're studying, how far along, and a way out. */
export function SessionHead({ title, kicker, done, total, closeTo }) {
  const share = total ? Math.min(1, done / total) : 0;
  return (
    <header className="sy-session-head">
      <div className="sy-session-title">
        <p className="sy-kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {total > 0 && (
        <span className="sy-count" aria-label={`${done} of ${total} done`}>
          {Math.min(done, total)} / {total}
        </span>
      )}
      <Link to={closeTo} className="sy-icon-btn" aria-label="End this round" title="End this round">
        <X size={18} />
      </Link>
      <div className="sy-progress" aria-hidden="true">
        <i style={{ width: `${share * 100}%` }} />
      </div>
    </header>
  );
}

/** End-of-round summary. */
export function Finished({ right, total, onAgain, closeTo, note }) {
  const pct = total ? Math.round((right / total) * 100) : 0;
  return (
    <section className="sy-finished">
      <div className="sy-score" style={{ "--pct": pct }}>
        <strong>{pct}%</strong>
        <span>
          {right} of {total} right
        </span>
      </div>
      <h2>{pct >= 90 ? "Nailed it." : pct >= 70 ? "Solid round." : pct >= 40 ? "Getting there." : "That's what practice is for."}</h2>
      <p className="sy-muted">{note ?? "Anything you missed comes back sooner in your spaced review."}</p>
      <div className="sy-row">
        {onAgain && (
          <button type="button" className="sy-btn" onClick={onAgain}>
            Another round
          </button>
        )}
        <Link to={closeTo} className="sy-btn is-ghost">
          Back to the deck
        </Link>
      </div>
    </section>
  );
}

/** Text with line breaks kept. */
export const Lines = ({ text, className = "" }) => <span className={`sy-lines ${className}`.trim()}>{text}</span>;

export function Empty({ children }) {
  return <p className="sy-empty">{children}</p>;
}
