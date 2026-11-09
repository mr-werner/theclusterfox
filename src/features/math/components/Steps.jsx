import { useState } from "react";
import { ChevronRight, Eye, ListOrdered } from "lucide-react";
import { RichText, Tex } from "./Tex";

// Worked steps, with an optional one-step-at-a-time mode for practice.
export default function Steps({ methods }) {
  const [active, setActive] = useState(0);
  const [stepMode, setStepMode] = useState(false);
  const [shown, setShown] = useState(1);

  const method = methods[Math.min(active, methods.length - 1)];
  if (!method) return null;
  const steps = method.steps;
  const visible = stepMode ? steps.slice(0, shown) : steps;
  // Number only the real steps; headings sit between them unnumbered.
  const numbers = visible.reduce((acc, s) => {
    const prev = acc.length ? acc[acc.length - 1].n : 0;
    const heading = !s.tex && !s.work;
    acc.push({ heading, n: heading ? prev : prev + 1 });
    return acc;
  }, []);

  return (
    <section className="mf-card mf-steps" aria-label="Step-by-step solution">
      <div className="mf-steps__head">
        <h2>
          <ListOrdered size={18} /> Steps
        </h2>
        <button
          type="button"
          className={`mf-chip ${stepMode ? "is-on" : ""}`}
          onClick={() => {
            setStepMode(m => !m);
            setShown(1);
          }}
          aria-pressed={stepMode}
        >
          <Eye size={14} /> One at a time
        </button>
      </div>
      {methods.length > 1 && (
        <div className="mf-tabs" role="tablist" aria-label="Method">
          {methods.map((m, i) => (
            <button
              key={m.name}
              role="tab"
              aria-selected={i === active}
              className={`mf-tab ${i === active ? "is-on" : ""}`}
              onClick={() => {
                setActive(i);
                setShown(1);
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
      <ol className="mf-steplist">
        {visible.map((s, i) => {
          const { heading, n } = numbers[i];
          return (
            <li key={`${active}-${i}`} className={`mf-step ${s.sub ? "is-sub" : ""} ${heading ? "is-heading" : ""}`}>
              {!heading && <span className="mf-step__n">{n}</span>}
              <div className="mf-step__body">
                <p className="mf-step__text">
                  <RichText text={s.text} />
                </p>
                {s.work && (
                  <div className="mf-step__work">
                    <Tex tex={s.work} display />
                  </div>
                )}
                {s.tex && (
                  <div className="mf-step__math">
                    <Tex tex={s.tex} display />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {stepMode && shown < steps.length && (
        <button type="button" className="mf-btn mf-btn--ghost" onClick={() => setShown(s => s + 1)}>
          Show next step <ChevronRight size={16} />
        </button>
      )}
    </section>
  );
}
