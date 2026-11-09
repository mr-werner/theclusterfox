import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, Download, Search, Star } from "lucide-react";
import { tableById, categoryById } from "../registry";
import { defaultUnit, fromSI, toSI, unitLabel, fmt, fmtInput, parseNumber } from "../model/units";
import { interp } from "../model/math";
import { UnitSelect } from "./Fields";
import Chart from "./Chart";

export default function TableView({ id, prefsApi }) {
  const table = tableById[id];
  const { prefs, toggleFavorite, touch, setUnit } = prefsApi;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState(null);
  const [colUnits, setColUnits] = useState({});
  const [lookup, setLookup] = useState("");
  const [chartY, setChartY] = useState(table?.chart?.y);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!table) return;
    touch(`table:${table.id}`);
    document.title = `${table.name} · Engineer ToolFox`;
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [table, touch]);

  const unitOfCol = (c) => colUnits[c.id] || (c.unit && !prefs.units[c.dim] ? c.unit : prefs.units[c.dim] || defaultUnit(c.dim, prefs.system));
  const filterCol = table?.columns.find((c) => c.filter);
  const groups = filterCol ? [...new Set(table.rows.map((r) => r[filterCol.id]))] : [];

  const rows = useMemo(() => {
    if (!table) return [];
    const q = query.trim().toLowerCase();
    let list = table.rows.filter((r) => (!group || r[filterCol.id] === group) && (!q || table.columns.some((c) => c.text && String(r[c.id] ?? "").toLowerCase().includes(q))));
    if (sort) {
      const c = table.columns.find((x) => x.id === sort.id);
      list = [...list].sort((a, b) => {
        const va = a[c.id], vb = b[c.id];
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = c.text ? String(va).localeCompare(String(vb), undefined, { numeric: true }) : va - vb;
        return sort.dir * cmp;
      });
    }
    return list;
  }, [table, query, group, sort, filterCol]);

  if (!table) {
    return (
      <div className="tf-card tf-empty">
        <h2>That table isn't here.</h2>
        <Link to="/tools">Back to all tools</Link>
      </div>
    );
  }

  const cat = categoryById[table.cat];
  const fav = prefs.favorites.includes(`table:${table.id}`);
  const numCols = table.columns.filter((c) => !c.text);
  const xCol = table.chart && table.columns.find((c) => c.id === table.chart.x);

  // Look up any x value between rows (for tables that run along temperature or altitude).
  let lookupRow = null;
  if (xCol && lookup.trim()) {
    const n = parseNumber(lookup);
    if (Number.isFinite(n)) {
      const xs = table.rows.map((r) => r[xCol.id]);
      const x = toSI(n, xCol.dim, unitOfCol(xCol));
      const inRange = x >= xs[0] && x <= xs[xs.length - 1];
      lookupRow = { inRange, row: Object.fromEntries(numCols.map((c) => [c.id, c.id === xCol.id ? x : interp(xs, table.rows.map((r) => r[c.id]), x)])) };
    }
  }

  const cell = (c, r) => {
    const v = r[c.id];
    if (c.text) return v ?? "—";
    if (v == null) return "—";
    return fmt(fromSI(v, c.dim, unitOfCol(c)));
  };

  function downloadCsv() {
    const head = table.columns.map((c) => (c.text ? c.label : `${c.label}${unitLabel(c.dim, unitOfCol(c)) ? ` (${unitLabel(c.dim, unitOfCol(c))})` : ""}`));
    const lines = [head, ...rows.map((r) => table.columns.map((c) => (c.text ? r[c.id] ?? "" : r[c.id] == null ? "" : fmtInput(fromSI(r[c.id], c.dim, unitOfCol(c))))))];
    const csv = lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const yCol = table.columns.find((c) => c.id === chartY);

  return (
    <article className="tf-table-page" style={{ "--tf-cat": cat.hue }}>
      <header className="tf-page-head">
        <Link to={`/tools/c/${cat.id}`} className="tf-crumb">
          <cat.icon size={15} aria-hidden="true" /> {cat.name} · Reference data
        </Link>
        <div className="tf-title-row">
          <h1>{table.name}</h1>
          <div className="tf-actions">
            <button type="button" className={`tf-icon-btn ${fav ? "is-on" : ""}`} onClick={() => toggleFavorite(`table:${table.id}`)} aria-pressed={fav} title={fav ? "Remove from favorites" : "Add to favorites"}>
              <Star size={18} fill={fav ? "currentColor" : "none"} />
            </button>
            <button type="button" className="tf-icon-btn" onClick={downloadCsv} title="Download as CSV (in the units shown)">
              {copied ? <Check size={18} /> : <Download size={18} />}
            </button>
          </div>
        </div>
        <p className="tf-lede">{table.blurb}</p>
      </header>

      {xCol && (
        <section className="tf-card tf-lookup">
          <div className="tf-lookup-head">
            <label htmlFor="tf-lookup">Look up any {xCol.label.toLowerCase()}</label>
            <div className="tf-input-row">
              <input id="tf-lookup" inputMode="decimal" placeholder={`e.g. ${fmtInput(fromSI(table.rows[Math.floor(table.rows.length / 2)][xCol.id], xCol.dim, unitOfCol(xCol)))}`} value={lookup} onChange={(e) => setLookup(e.target.value)} />
              <UnitSelect dim={xCol.dim} unit={unitOfCol(xCol)} onChange={(u) => setUnit(xCol.dim, u)} label={xCol.label} />
            </div>
          </div>
          {lookupRow && (
            <dl className="tf-lookup-result">
              {numCols
                .filter((c) => c.id !== xCol.id)
                .map((c) => (
                  <div key={c.id}>
                    <dt>{c.label}</dt>
                    <dd>
                      {cell(c, lookupRow.row)} <span className="tf-muted">{unitLabel(c.dim, unitOfCol(c))}</span>
                    </dd>
                  </div>
                ))}
            </dl>
          )}
          {lookupRow && !lookupRow.inRange && <p className="tf-warning">That's outside the table, so the nearest row is shown.</p>}
          {lookupRow && lookupRow.inRange && <p className="tf-muted tf-small">Linearly interpolated between the two nearest rows.</p>}
        </section>
      )}

      {table.chart && yCol && (
        <section className="tf-card tf-visual">
          <div className="tf-chart-head">
            <span className="tf-muted">Plot</span>
            <div className="tf-chip-row">
              {numCols
                .filter((c) => c.id !== xCol.id)
                .map((c) => (
                  <button key={c.id} type="button" className={`tf-chip ${c.id === chartY ? "is-on" : ""}`} onClick={() => setChartY(c.id)}>
                    {c.label}
                  </button>
                ))}
            </div>
          </div>
          <Chart
            series={[{ points: table.rows.filter((r) => r[yCol.id] != null).map((r) => ({ x: r[xCol.id], y: r[yCol.id] })) }]}
            x={{ label: xCol.label, dim: xCol.dim, unit: unitOfCol(xCol) }}
            y={{ label: yCol.label, dim: yCol.dim, unit: unitOfCol(yCol) }}
            marker={lookupRow?.inRange ? { x: lookupRow.row[xCol.id], y: lookupRow.row[yCol.id] } : undefined}
            legend={false}
          />
        </section>
      )}

      <section className="tf-card tf-table-card">
        <div className="tf-table-tools">
          <div className="tf-search-mini">
            <Search size={16} aria-hidden="true" />
            <input placeholder="Filter rows" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter rows" />
          </div>
          {groups.length > 1 && (
            <div className="tf-chip-row">
              <button type="button" className={`tf-chip ${!group ? "is-on" : ""}`} onClick={() => setGroup("")}>
                All
              </button>
              {groups.map((g) => (
                <button key={g} type="button" className={`tf-chip ${group === g ? "is-on" : ""}`} onClick={() => setGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
          )}
          <span className="tf-muted tf-small">{rows.length} rows</span>
        </div>
        <div className="tf-table-scroll">
          <table className="tf-table">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c.id} className={c.text ? "is-text" : ""} aria-sort={sort?.id === c.id ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                    <button type="button" className="tf-th-btn" onClick={() => setSort((s) => (s?.id === c.id ? (s.dir > 0 ? { id: c.id, dir: -1 } : null) : { id: c.id, dir: 1 }))}>
                      {c.label}
                      {sort?.id === c.id && (sort.dir > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                    </button>
                    {!c.text && <UnitSelect dim={c.dim} unit={unitOfCol(c)} onChange={(u) => setColUnits((o) => ({ ...o, [c.id]: u }))} label={c.label} compact />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {table.columns.map((c) => (
                    <td key={c.id} className={`${c.text ? "is-text" : ""} ${c.wide ? "is-wide" : ""}`}>
                      {cell(c, r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.note && <p className="tf-note">{table.note}</p>}
        {table.source && <p className="tf-source">Sources: {table.source}</p>}
      </section>
    </article>
  );
}
