import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "../nav";
import { Check, ClipboardList, Copy, Download, Link2, Printer, RotateCcw, Star, TriangleAlert } from "lucide-react";
import { calcById, categoryById } from "../registry";
import { defaultsOf, run, toParams, fromParams, applyPreset, matchingPreset, isVisible } from "../model/engine";
import { defaultUnit, fromSI, unitLabel, fmt } from "../model/units";
import { NumField, ChoiceField, PresetField, TextField, UnitSelect } from "./Fields";
import Visual from "./Visuals";
import { DIAGRAMS } from "../diagrams";
import { inputRows, reportCsv, reportText, resultRows } from "../model/report";
import { reportSnapshot } from "../model/projects";
import { captureFromPage } from "../model/capture";
import SaveToProject from "./SaveToProject";
import { TermCard } from "./TermInfo";
import { useTerm } from "./useTerm";
import { termFor, termsOnPage, usesFor } from "../glossary";

// Drawings and tables a saved calc takes along when the page doesn't mark its own
// (data-report-figure / data-report-table; see model/capture.js).
const CAPTURE_FALLBACK = {
  figures: [
    [".tf-diagram", "Diagram"],
    [".tf-visual", null],
  ],
  tables: [[".tf-visual table", null]],
};

const MODE_KEY = "toolfox-mode";
const readMode = () => {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved) return saved === "form" ? "form" : "diagram";
  } catch {
    // Fall through to the default below.
  }
  // Drawings scale to fit any screen (and zoom), so everyone starts on the drawing.
  return "diagram";
};

export default function CalcView({ id, prefsApi }) {
  const calc = calcById[id];
  const { prefs, toggleFavorite, touch, setUnit } = prefsApi;
  const [params, setParams] = useSearchParams();
  const [values, setValues] = useState(() => (calc ? fromParams(calc, params) : {}));
  const [outUnits, setOutUnits] = useState({});
  const [copied, setCopied] = useState("");
  const pageRef = useRef(null);
  const [mode, setModeState] = useState(readMode);
  const setMode = (m) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Not saved; the choice still applies on this page.
    }
  };

  useEffect(() => {
    if (!calc) return;
    touch(`calc:${calc.id}`);
    document.title = `${calc.name} · Engineer ToolFox`;
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [calc, touch]);

  // Keep the URL in step, so any result can be shared or bookmarked.
  useEffect(() => {
    if (!calc) return;
    const next = new URLSearchParams(toParams(calc, values));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [calc, values, params, setParams]);

  const output = useMemo(() => (calc ? run(calc, values) : null), [calc, values]);

  if (!calc) {
    return (
      <div className="tf-card tf-empty">
        <h2>That tool isn't here.</h2>
        <Link to="/tools">Back to all tools</Link>
      </div>
    );
  }

  const cat = categoryById[calc.cat];
  const fav = prefs.favorites.includes(`calc:${calc.id}`);
  const unitFor = (dim) => prefs.units[dim] || defaultUnit(dim, prefs.system);
  const outUnitFor = (r) => outUnits[r.id] || (r.unit && !prefs.units[r.dim] ? r.unit : unitFor(r.dim));
  const set = (key, v) =>
    setValues((cur) => {
      const next = { ...cur, [key]: v };
      return calc.onSet ? calc.onSet(next, key, cur) : next;
    });
  const entry = DIAGRAMS[calc.id];
  const diagram = entry?.pick ? { ...entry, ...entry.pick(values) } : entry;
  const useDiagram = Boolean(diagram) && (mode === "diagram" || diagram.always);
  const onDiagram = (input) => useDiagram && diagram.fields.includes(input.id);
  const restInputs = calc.inputs.filter((i) => isVisible(i, values) && !onDiagram(i));
  const pick = (presetId, label) => setValues((cur) => applyPreset(calc, cur, presetId, label));
  const presetValue = (presetId) => matchingPreset(calc.inputs.find((i) => i.id === presetId), values);
  const wideVisual = ["beam", "pump"].includes(output.visual?.type);
  const showVisual = !wideVisual && (!useDiagram || ["moody", "line"].includes(output.visual?.type));
  const primary = output.results.find((r) => r.primary);
  const others = output.results.filter((r) => !r.primary);
  const inTerm = (input) => termFor(calc.id, "in", input.id);
  const outTerm = (r) => termFor(calc.id, "out", r.id);
  const pageTerms = termsOnPage(
    calc.id,
    calc.inputs.filter((i) => i.type !== "preset" && isVisible(i, values)),
    output.results
  );
  const uses = usesFor(calc.id);

  function copy(text, key) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(""), 1400);
      },
      () => {}
    );
  }

  function report() {
    const inputs = inputRows(calc, values, unitFor);
    const results = resultRows(output.results, outUnitFor);
    return { calc, inputs, results, warnings: output.warnings, url: window.location.href };
  }

  /** Everything a project report needs, captured as it is on screen now. */
  function snapshot() {
    const { inputs, results } = report();
    const p = primary ? resultRows([primary], outUnitFor)[0] : null;
    return reportSnapshot({
      calc,
      inputs,
      results,
      primary: p,
      warnings: output.warnings,
      units: prefs.system === "us" ? "US customary" : "Metric (SI)",
      ...captureFromPage(pageRef.current, CAPTURE_FALLBACK),
    });
  }

  function download() {
    const blob = new Blob([reportCsv(report())], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${calc.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const resultText = (r) => (r.text !== undefined ? r.text : `${fmt(fromSI(r.value, r.dim, outUnitFor(r)))} ${unitLabel(r.dim, outUnitFor(r))}`.trim());

  return (
    <article ref={pageRef} className="tf-calc" style={{ "--tf-cat": cat.hue }}>
      <header className="tf-page-head">
        <Link to={`/tools/c/${cat.id}`} className="tf-crumb">
          <cat.icon size={15} aria-hidden="true" /> {cat.name}
        </Link>
        <div className="tf-title-row">
          <h1>{calc.name}</h1>
          <div className="tf-actions">
            <button type="button" className={`tf-icon-btn ${fav ? "is-on" : ""}`} onClick={() => toggleFavorite(`calc:${calc.id}`)} aria-pressed={fav} title={fav ? "Remove from favorites" : "Add to favorites"}>
              <Star size={18} fill={fav ? "currentColor" : "none"} />
            </button>
            <button type="button" className="tf-icon-btn" onClick={() => copy(window.location.href, "link")} title="Copy a link to these exact inputs">
              {copied === "link" ? <Check size={18} /> : <Link2 size={18} />}
            </button>
            <button type="button" className="tf-icon-btn" onClick={() => setValues(defaultsOf(calc))} title="Reset to the example values">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
        <p className="tf-lede">{calc.blurb}</p>
      </header>

      {diagram?.always && <p className="tf-mode-row tf-muted tf-small">{diagram.hint}</p>}
      {diagram && !diagram.always && (
        <div className="tf-mode-row">
          <div className="tf-segmented is-small" role="radiogroup" aria-label="Input style">
            {[
              ["diagram", "Diagram"],
              ["form", "Form"],
            ].map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}>
                {label}
              </button>
            ))}
          </div>
          {useDiagram && <span className="tf-muted tf-small">{diagram.hint}</span>}
        </div>
      )}

      {useDiagram && (
        <section className="tf-card tf-diagram" aria-label="Diagram inputs">
          <diagram.component
            calc={calc}
            values={values}
            set={set}
            output={output}
            unit={unitFor}
            setUnit={setUnit}
            pick={pick}
            presetValue={presetValue}
          />
        </section>
      )}

      <div className={`tf-calc-grid ${restInputs.length === 0 ? "is-single" : ""}`}>
        {restInputs.length > 0 && (
        <section className="tf-card tf-inputs" aria-label={useDiagram ? "More settings" : "Inputs"}>
          {useDiagram && <h2 className="tf-inputs-title">More settings</h2>}
          {restInputs.map((input) => {
            const fid = `in-${calc.id}-${input.id}`;
            if (input.type === "num")
              return (
                <NumField
                  key={input.id}
                  id={fid}
                  label={input.label}
                  hint={input.hint}
                  dim={input.dim}
                  value={values[input.id]}
                  unit={unitFor(input.dim)}
                  onValue={(v) => set(input.id, v)}
                  onUnit={(u) => setUnit(input.dim, u)}
                  term={inTerm(input)}
                />
              );
            if (input.type === "choice") return <ChoiceField key={input.id} id={fid} label={input.label} options={input.options} value={values[input.id]} onChange={(v) => set(input.id, v)} term={inTerm(input)} />;
            if (input.type === "preset")
              return <PresetField key={input.id} id={fid} label={input.label} options={input.options} value={matchingPreset(input, values)} onPick={(label) => setValues((cur) => applyPreset(calc, cur, input.id, label))} />;
            return <TextField key={input.id} id={fid} label={input.label} value={values[input.id]} onChange={(v) => set(input.id, v)} term={inTerm(input)} />;
          })}
          <p className="tf-tip">Tip: type 4.7k, 1 1/4 or 3/8. Arrow keys nudge a value.</p>
        </section>
        )}

        <div className="tf-results-col">
          <section className="tf-card tf-results" aria-live="polite" aria-label="Results">
            {primary ? (
              <PrimaryResult
                r={primary}
                term={outTerm(primary)}
                unit={outUnitFor(primary)}
                onUnit={(u) => setOutUnits((o) => ({ ...o, [primary.id]: u }))}
                copied={copied === primary.id}
                onCopy={() => copy(resultText(primary), primary.id)}
              />
            ) : (
              <div className="tf-primary is-empty">
                <span className="tf-primary-label">Result</span>
                <div className="tf-primary-value">
                  <output>—</output>
                </div>
              </div>
            )}
            {others.length > 0 && (
              <dl className="tf-result-list">
                {others.map((r) => (
                  <ResultRow
                    key={r.id}
                    r={r}
                    term={outTerm(r)}
                    unit={outUnitFor(r)}
                    onUnit={(u) => setOutUnits((o) => ({ ...o, [r.id]: u }))}
                    copied={copied === r.id}
                    onCopy={() => copy(resultText(r), r.id)}
                  />
                ))}
              </dl>
            )}
            {output.warnings.map((w) => (
              <p key={w} className="tf-warning">
                <TriangleAlert size={16} aria-hidden="true" />
                {w}
              </p>
            ))}
          </section>
          <div className="tf-export" role="group" aria-label="Export this calculation">
            <button type="button" className="tf-export-btn" onClick={() => copy(reportText(report()), "report")}>
              {copied === "report" ? <Check size={15} aria-hidden="true" /> : <ClipboardList size={15} aria-hidden="true" />}
              {copied === "report" ? "Copied" : "Copy calc"}
            </button>
            <button type="button" className="tf-export-btn" onClick={download} disabled={!output.results.length}>
              <Download size={15} aria-hidden="true" /> CSV
            </button>
            <button type="button" className="tf-export-btn" onClick={() => window.print()}>
              <Printer size={15} aria-hidden="true" /> Print sheet
            </button>
            <SaveToProject tool={{ kind: "calc", id: calc.id, name: calc.name, discipline: cat.name }} getReport={snapshot} />
          </div>
          {showVisual && <Visual visual={output.visual} system={prefs.system} unit={unitFor} />}
        </div>
      </div>

      {wideVisual && <Visual visual={output.visual} system={prefs.system} unit={unitFor} />}

      <section className="tf-card tf-about">
        {uses && (
          <div className="tf-about-block tf-uses">
            <h2>Where this is used</h2>
            <div className="tf-use-fields" aria-label="Industries">
              {uses.fields.map((f) => (
                <span key={f} className="tf-use-field">
                  {f}
                </span>
              ))}
            </div>
            <ul className="tf-use-examples">
              {uses.examples.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        {pageTerms.length > 0 && (
          <div className="tf-about-block tf-terms">
            <h2>What the terms mean</h2>
            <p className="tf-muted tf-small">Tap the ? beside any input or result to see its meaning right there, or open one below.</p>
            <div className="tf-term-list">
              {pageTerms.map((t) => (
                <details key={t.key} className="tf-term-item">
                  <summary>
                    <span>{t.name}</span>
                    {t.symbol && <span className="tf-term-symbol">{t.symbol}</span>}
                  </summary>
                  <TermCard term={t} compact />
                </details>
              ))}
            </div>
          </div>
        )}
        <div className="tf-about-block">
          <h2>Equations</h2>
          <div className="tf-formulas">
            {calc.formula.map((f) => (
              <code key={f}>{f}</code>
            ))}
          </div>
        </div>
        <div className="tf-about-block">
          <h2>Assumptions and limits</h2>
          <p>{calc.about}</p>
        </div>
        {calc.sources && (
          <div className="tf-about-block">
            <h2>References</h2>
            <p className="tf-source">{calc.sources}</p>
          </div>
        )}
        {calc.related?.length > 0 && (
          <div className="tf-related">
            <span>Related</span>
            {calc.related.map((r) => (
              <Link key={r} to={`/tools/calc/${r}`} className="tf-chip">
                {calcById[r].name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="tf-titleblock" aria-label="Calculation sheet details">
        <div>
          <span>Calculation</span>
          <strong>{calc.name}</strong>
        </div>
        <div>
          <span>Discipline</span>
          <strong>{cat.name}</strong>
        </div>
        <div>
          <span>Units</span>
          <strong>{prefs.system === "us" ? "US customary" : "Metric (SI)"}</strong>
        </div>
        <div>
          <span>Date</span>
          <strong>{new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</strong>
        </div>
        <p>Engineer ToolFox. Check results before relying on them for design.</p>
      </footer>
    </article>
  );
}

/** The headline result, with its meaning a tap away. */
function PrimaryResult({ r, term, unit, onUnit, copied, onCopy }) {
  const info = useTerm(term);
  return (
    <div className="tf-primary">
      <span className="tf-primary-label">
        {r.label}
        {info.button}
      </span>
      <div className="tf-primary-value">
        <output>{r.text !== undefined ? r.text : fmt(fromSI(r.value, r.dim, unit))}</output>
        {r.text === undefined && <UnitSelect dim={r.dim} unit={unit} onChange={onUnit} label={r.label} />}
        <button type="button" className="tf-copy" onClick={onCopy} title="Copy">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      {info.panel}
    </div>
  );
}

/** One result line, with its meaning a tap away. */
function ResultRow({ r, term, unit, onUnit, copied, onCopy }) {
  const info = useTerm(term);
  return (
    <div className={`tf-result ${info.open ? "is-open" : ""}`}>
      <dt>
        {r.label}
        {info.button}
      </dt>
      <dd>
        <span className="tf-result-num">{r.text !== undefined ? r.text : fmt(fromSI(r.value, r.dim, unit))}</span>
        {r.text === undefined && <UnitSelect dim={r.dim} unit={unit} onChange={onUnit} label={r.label} compact />}
        <button type="button" className="tf-copy is-small" onClick={onCopy} title="Copy">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </dd>
      {info.panel && <dd className="tf-result-term">{info.panel}</dd>}
    </div>
  );
}
