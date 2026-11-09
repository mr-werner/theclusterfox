import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { DIMS, CONVERTER_DIMS, defaultUnit, toSI, fromSI, fmt, fmtInput, parseNumber } from "../model/units";

const EXAMPLES = { temp: "72", pressure: "100", length: "1", flow: "10", power: "1", energy: "1" };

export default function ConverterView({ dim: dimParam, prefsApi }) {
  const navigate = useNavigate();
  const dim = CONVERTER_DIMS.includes(dimParam) ? dimParam : "length";
  const d = DIMS[dim];
  const { prefs, touch } = prefsApi;
  const [text, setText] = useState(EXAMPLES[dim] || "1");
  const [from, setFrom] = useState(() => prefs.units[dim] || defaultUnit(dim, prefs.system === "si" ? "us" : "si"));
  const [copied, setCopied] = useState("");

  useEffect(() => {
    touch("convert");
    document.title = `${d.label} converter · Engineering ToolFox`;
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [d, touch]);

  const n = parseNumber(text);
  const si = Number.isFinite(n) ? toSI(n, dim, from) : NaN;

  function copy(value, id) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(""), 1200);
    }, () => {});
  }

  return (
    <article className="tf-convert">
      <header className="tf-page-head">
        <Link to="/tools" className="tf-crumb">
          Engineering ToolFox
        </Link>
        <h1>Unit converter</h1>
        <p className="tf-lede">Type once, see every unit at the same time. Click a result to copy it.</p>
      </header>

      <nav className="tf-chip-row tf-dim-chips" aria-label="Quantity">
        {CONVERTER_DIMS.map((k) => (
          <button key={k} type="button" className={`tf-chip ${k === dim ? "is-on" : ""}`} onClick={() => navigate(`/tools/convert/${k}`)}>
            {DIMS[k].label}
          </button>
        ))}
      </nav>

      <section className="tf-card tf-convert-card">
        <div className="tf-convert-input">
          <label htmlFor="tf-conv-value">{d.label}</label>
          <div className="tf-input-row is-big">
            <input id="tf-conv-value" inputMode="decimal" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <select className="tf-unit" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From unit">
              {d.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ul className="tf-convert-list">
          {d.units
            .filter((u) => u.id !== from)
            .map((u) => {
              const val = fromSI(si, dim, u.id);
              return (
                <li key={u.id}>
                  <button type="button" onClick={() => copy(fmtInput(val, 8), u.id)} disabled={!Number.isFinite(val)} title="Copy">
                    <span className="tf-convert-val">{fmt(val, 6)}</span>
                    <span className="tf-convert-unit">{u.label}</span>
                    {copied === u.id ? <Check size={15} /> : <Copy size={15} className="tf-copy-hint" />}
                  </button>
                </li>
              );
            })}
        </ul>
      </section>
    </article>
  );
}
