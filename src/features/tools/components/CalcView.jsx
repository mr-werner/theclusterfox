import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Copy, Link2, RotateCcw, Star, TriangleAlert } from "lucide-react";
import { calcById, categoryById } from "../registry";
import { defaultsOf, run, toParams, fromParams, applyPreset, matchingPreset, isVisible } from "../model/engine";
import { defaultUnit, fromSI, unitLabel, fmt } from "../model/units";
import { NumField, ChoiceField, PresetField, TextField, UnitSelect } from "./Fields";
import Visual from "./Visuals";
import { DIAGRAMS } from "../diagrams";

const MODE_KEY = "toolfox-mode";
const readMode = () => {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved) return saved === "form" ? "form" : "diagram";
  } catch {
    // Fall through to the default below.
  }
  // Drawings are wide, so phones start on the form; the switch is right there.
  return typeof window !== "undefined" && window.innerWidth < 640 ? "form" : "diagram";
};

export default function CalcView({ id, prefsApi }) {
  const calc = calcById[id];
  const { prefs, toggleFavorite, touch, setUnit } = prefsApi;
  const [params, setParams] = useSearchParams();
  const [values, setValues] = useState(() => (calc ? fromParams(calc, params) : {}));
  const [outUnits, setOutUnits] = useState({});
  const [copied, setCopied] = useState("");
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
    document.title = `${calc.name} · ToolFox`;
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
  const set = (key, v) => setValues((cur) => ({ ...cur, [key]: v }));
  const diagram = DIAGRAMS[calc.id];
  const useDiagram = Boolean(diagram) && (mode === "diagram" || diagram.always);
  const onDiagram = (input) => useDiagram && diagram.fields.includes(input.id);
  const restInputs = calc.inputs.filter((i) => isVisible(i, values) && !onDiagram(i));
  const pick = (presetId, label) => setValues((cur) => applyPreset(calc, cur, presetId, label));
  const presetValue = (presetId) => matchingPreset(calc.inputs.find((i) => i.id === presetId), values);
  const wideVisual = output.visual?.type === "beam";
  const showVisual = !wideVisual && (!useDiagram || ["moody", "line"].includes(output.visual?.type));
  const primary = output.results.find((r) => r.primary);
  const others = output.results.filter((r) => !r.primary);

  function copy(text, key) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(""), 1400);
      },
      () => {}
    );
  }

  const resultText = (r) => (r.text !== undefined ? r.text : `${fmt(fromSI(r.value, r.dim, outUnitFor(r)))} ${unitLabel(r.dim, outUnitFor(r))}`.trim());

  return (
    <article className="tf-calc" style={{ "--tf-cat": cat.hue }}>
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
                />
              );
            if (input.type === "choice") return <ChoiceField key={input.id} id={fid} label={input.label} options={input.options} value={values[input.id]} onChange={(v) => set(input.id, v)} />;
            if (input.type === "preset")
              return <PresetField key={input.id} id={fid} label={input.label} options={input.options} value={matchingPreset(input, values)} onPick={(label) => setValues((cur) => applyPreset(calc, cur, input.id, label))} />;
            return <TextField key={input.id} id={fid} label={input.label} value={values[input.id]} onChange={(v) => set(input.id, v)} />;
          })}
          <p className="tf-tip">Tip: type 4.7k, 1 1/4 or 3/8. Arrow keys nudge a value.</p>
        </section>
        )}

        <div className="tf-results-col">
          <section className="tf-card tf-results" aria-live="polite" aria-label="Results">
            {primary ? (
              <div className="tf-primary">
                <span className="tf-primary-label">{primary.label}</span>
                <div className="tf-primary-value">
                  <output>{primary.text !== undefined ? primary.text : fmt(fromSI(primary.value, primary.dim, outUnitFor(primary)))}</output>
                  {primary.text === undefined && <UnitSelect dim={primary.dim} unit={outUnitFor(primary)} onChange={(u) => setOutUnits((o) => ({ ...o, [primary.id]: u }))} label={primary.label} />}
                  <button type="button" className="tf-copy" onClick={() => copy(resultText(primary), primary.id)} title="Copy">
                    {copied === primary.id ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
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
                  <div key={r.id} className="tf-result">
                    <dt>{r.label}</dt>
                    <dd>
                      <span className="tf-result-num">{r.text !== undefined ? r.text : fmt(fromSI(r.value, r.dim, outUnitFor(r)))}</span>
                      {r.text === undefined && <UnitSelect dim={r.dim} unit={outUnitFor(r)} onChange={(u) => setOutUnits((o) => ({ ...o, [r.id]: u }))} label={r.label} compact />}
                      <button type="button" className="tf-copy is-small" onClick={() => copy(resultText(r), r.id)} title="Copy">
                        {copied === r.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </dd>
                  </div>
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
          {showVisual && <Visual visual={output.visual} system={prefs.system} unit={unitFor} />}
        </div>
      </div>

      {wideVisual && <Visual visual={output.visual} system={prefs.system} unit={unitFor} />}

      <section className="tf-card tf-about">
        <h2>How it works</h2>
        <div className="tf-formulas">
          {calc.formula.map((f) => (
            <code key={f}>{f}</code>
          ))}
        </div>
        <p>{calc.about}</p>
        {calc.sources && <p className="tf-source">Sources: {calc.sources}</p>}
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
    </article>
  );
}
