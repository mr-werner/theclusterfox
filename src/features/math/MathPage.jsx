import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Clock, Delete, Keyboard, Lightbulb, Sigma, X } from "lucide-react";

import AppBar from "../../components/AppBar";
import { Tex, RichText } from "./components/Tex";
import Steps from "./components/Steps";
import Graph from "./components/Graph";
import { BoxPlot, FactTable, NumberLine } from "./components/Visuals";
import { previewTex, solve } from "./solve";
import { syntax, topics } from "./data/examples";
import { cleanHistory, loadHistory, pushHistory, saveHistory } from "./state/history";
import { useAccountSync } from "../../lib/useAccountSync";
import "./math.css";
import "./identity.css";

const KEYS = [
  ["x", "x"],
  ["y", "y"],
  ["x²", "^2"],
  ["xⁿ", "^"],
  ["√", "sqrt("],
  ["(", "("],
  [")", ")"],
  ["÷", "/"],
  ["×", "*"],
  ["=", " = "],
  ["<", " < "],
  [">", " > "],
  ["≤", " <= "],
  ["≥", " >= "],
  ["|x|", "|"],
  ["π", "pi"],
  ["e", "e"],
  ["sin", "sin("],
  ["cos", "cos("],
  ["tan", "tan("],
  ["ln", "ln("],
  ["log", "log("],
  ["d/dx", "derivative of "],
  ["∫", "integral of "],
  ["lim", "limit of  as x -> 0"],
  [",", ", "],
];

function runSolve(q) {
  if (!q.trim()) return null;
  try {
    return { result: solve(q) };
  } catch (err) {
    return { error: err?.message || "Something went wrong" };
  }
}

export default function MathPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [draft, setDraft] = useState(q);
  const [keypad, setKeypad] = useState(false);
  const [topic, setTopic] = useState(topics[0].id);
  const [history, setHistory] = useState(loadHistory);
  const inputRef = useRef(null);
  const resultRef = useRef(null);

  // Keep the box in step with the address bar (back/forward, shared links).
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }

  const outcome = useMemo(() => runSolve(q), [q]);
  const preview = useMemo(() => previewTex(draft), [draft]);

  useEffect(() => saveHistory(history), [history]);
  const historyDoc = useMemo(() => ({ history }), [history]);
  useAccountSync("math_user_data", historyDoc, doc => setHistory(cleanHistory(doc?.history)), { history: [] });

  const submit = text => {
    const clean = (text ?? draft).trim();
    if (!clean) return;
    setDraft(clean);
    setParams({ q: clean });
    setHistory(h => pushHistory(h, clean));
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const insert = text => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    let next = draft.slice(0, start) + text + draft.slice(end);
    let caret = start + text.length;
    if (text === "limit of  as x -> 0") caret = start + "limit of ".length;
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const backspace = () => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    setDraft(draft.slice(0, from) + draft.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from, from);
    });
  };

  const current = topics.find(t => t.id === topic) ?? topics[0];
  const r = outcome?.result;

  return (
    <main className="math-page mf">
      <AppBar appId="mathfox" />
      <div className="mf-shell">
        <header className="mf-hero">
          <div className="mf-logo" aria-hidden="true">
            <Sigma size={26} />
          </div>
          <div>
            <p className="mf-eyebrow">MATHFOX</p>
            <h1>Every step, not just the answer.</h1>
            <p className="mf-lede">
              Type a problem, from fractions to integrals. MathFox solves it right in your browser, shows how, and graphs it. Free, with no account
              needed.
            </p>
          </div>
        </header>

        <form
          className="mf-card mf-ask"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="mf-input" className="sr-only">
            Math problem
          </label>
          <div className="mf-ask__row">
            <input
              id="mf-input"
              ref={inputRef}
              className="mf-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Try 2x + 3 = 11, x^2 - 5x + 6 = 0, or derivative of x^2 sin x"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode={keypad ? "none" : "text"}
            />
            {draft && (
              <button type="button" className="mf-icon-btn" onClick={() => setDraft("")} aria-label="Clear">
                <X size={18} />
              </button>
            )}
            <button type="submit" className="mf-btn" disabled={!draft.trim()}>
              Solve <ArrowRight size={17} />
            </button>
          </div>
          <div className="mf-ask__meta">
            <div className="mf-preview" aria-live="polite">
              {preview ? (
                <>
                  <span className="mf-muted">Reading this as</span> <Tex tex={preview} />
                </>
              ) : (
                <span className="mf-muted">Type math the way you'd write it. Spaces are fine.</span>
              )}
            </div>
            <button type="button" className={`mf-chip ${keypad ? "is-on" : ""}`} onClick={() => setKeypad(k => !k)} aria-pressed={keypad}>
              <Keyboard size={15} /> Keypad
            </button>
          </div>
          {keypad && (
            <div className="mf-keypad" role="group" aria-label="Math keypad">
              {KEYS.map(([label, text]) => (
                <button key={label} type="button" className="mf-key" onClick={() => insert(text)}>
                  {label}
                </button>
              ))}
              <button type="button" className="mf-key mf-key--wide" onClick={backspace} aria-label="Backspace">
                <Delete size={17} />
              </button>
            </div>
          )}
        </form>

        <section className="mf-examples" aria-label="Examples">
          <div className="mf-tabs mf-tabs--scroll" role="tablist" aria-label="Topics">
            {topics.map(t => (
              <button key={t.id} role="tab" aria-selected={t.id === topic} className={`mf-tab ${t.id === topic ? "is-on" : ""}`} onClick={() => setTopic(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="mf-chips">
            {current.examples.map(ex => (
              <button key={ex} type="button" className="mf-example" onClick={() => submit(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </section>

        <div ref={resultRef} className="mf-results">
          {outcome?.error && (
            <section className="mf-card mf-error" role="alert">
              <h2>I couldn't solve that one</h2>
              <p>{outcome.error}.</p>
              <p className="mf-muted">
                Check the brackets, write multiplication like <code>3x</code> or <code>3*x</code>, and use <code>^</code> for powers. The examples above show
                every kind of problem MathFox handles.
              </p>
            </section>
          )}

          {r && (
            <>
              <section className="mf-card mf-answer">
                <p className="mf-tag">{r.topic}</p>
                <div className="mf-problem">
                  <Tex tex={r.problem} display />
                </div>
                {r.answers.length > 0 && (
                  <div className="mf-answer__box">
                    <p className="mf-answer__label">Answer</p>
                    {r.answers.map((a, i) => (
                      <div key={i} className="mf-answer__line">
                        <Tex tex={a} display />
                      </div>
                    ))}
                    {r.approx.length > 0 && (
                      <div className="mf-answer__approx">
                        {r.approx.map((a, i) => (
                          <Tex key={i} tex={a} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {r.table && r.table.length > 0 && <FactTable facts={r.table} />}
                {r.notes.length > 0 && (
                  <ul className="mf-notes">
                    {r.notes.map((n, i) => (
                      <li key={i}>
                        <Lightbulb size={15} />
                        <span>
                          <RichText text={n} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {r.methods.length > 0 && <Steps key={q} methods={r.methods} />}

              {(r.graph || r.numberLine || r.stats) && (
                <section className="mf-card mf-visual">
                  <h2>{r.stats ? "Picture of the data" : r.graph ? "Graph" : "On the number line"}</h2>
                  {r.numberLine && <NumberLine data={r.numberLine} />}
                  {r.graph && <Graph key={q} graph={r.graph} />}
                  {r.stats && <BoxPlot stats={r.stats} />}
                </section>
              )}
            </>
          )}
        </div>

        <div className="mf-lower">
          {history.length > 0 && (
            <section className="mf-card mf-history">
              <div className="mf-row">
                <h2>
                  <Clock size={17} /> Recent
                </h2>
                <button type="button" className="mf-link" onClick={() => setHistory([])}>
                  Clear
                </button>
              </div>
              <div className="mf-chips">
                {history.map(h => (
                  <button key={h} type="button" className="mf-example" onClick={() => submit(h)}>
                    {h}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="mf-card mf-help">
            <h2>How to type math</h2>
            <table className="mf-syntax">
              <tbody>
                {syntax.map(([what, typed, shows]) => (
                  <tr key={what}>
                    <th scope="row">{what}</th>
                    <td>
                      <code>{typed}</code>
                    </td>
                    <td>
                      <Tex tex={shows} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mf-muted mf-small">
              Start with words when it helps: <code>solve</code>, <code>factor</code>, <code>expand</code>, <code>simplify</code>, <code>graph</code>,{" "}
              <code>derivative of</code>, <code>integral of … from 0 to 1</code>, <code>limit of … as x -&gt; 0</code>, <code>mean</code>, <code>median</code>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
