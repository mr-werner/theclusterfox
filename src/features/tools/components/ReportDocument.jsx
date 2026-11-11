import { headline } from "../model/projects";

// A project report laid out like an engineering calculation package: a cover
// sheet with the title block, an index of calculations and sign-off boxes,
// then one section per calculation starting on a new page.

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
// CSS string for the page footer (printed in the page margin).
const cssString = (s) => `"${String(s).replace(/[\\"]/g, "\\$&").replace(/[\n\r]/g, " ")}"`;

function RowsTable({ title, rows, primary }) {
  if (!rows.length) return null;
  return (
    <section className="rp-block">
      <h3>{title}</h3>
      <table className="rp-table rp-kv">
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.label}${i}`} className={primary && r.label === primary.label && r.value === primary.value ? "is-primary" : ""}>
              <th scope="row">{r.label}</th>
              <td className="rp-num">{r.value}</td>
              <td className="rp-unit">{r.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DataTable({ t }) {
  const cols = Math.max(t.head.length, ...t.rows.map((r) => r.length));
  return (
    <section className="rp-block rp-wide">
      <h3>{t.title}</h3>
      <table className="rp-table rp-grid">
        {t.head.length > 0 && (
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} scope="col">
                  {t.head[i] || ""}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i}>
              {Array.from({ length: cols }, (_, k) => (
                <td key={k}>{r[k] || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Figure({ f, n }) {
  // Shown as an image, so nothing in the saved markup can run.
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(f.svg)}`;
  const ratio = f.w && f.h ? f.h / f.w : 0.6;
  return (
    <figure className="rp-figure">
      <img src={src} alt={f.title} style={{ aspectRatio: f.w && f.h ? `${f.w} / ${f.h}` : undefined, maxHeight: ratio > 1 ? "150mm" : undefined }} />
      <figcaption>
        Figure {n}. {f.title}
      </figcaption>
    </figure>
  );
}

function SheetHead({ project, label, title, sub }) {
  return (
    <header className="rp-sheet-head">
      <div className="rp-sh-main">
        <span className="rp-sh-label">{label}</span>
        <strong>{title}</strong>
        {sub && <span>{sub}</span>}
      </div>
      <dl className="rp-sh-meta">
        <div>
          <dt>Project</dt>
          <dd>{project.name}</dd>
        </div>
        <div>
          <dt>No.</dt>
          <dd>{project.number || "—"}</dd>
        </div>
        <div>
          <dt>Rev</dt>
          <dd>{project.revision || "—"}</dd>
        </div>
        <div>
          <dt>By</dt>
          <dd>{project.preparedBy || "—"}</dd>
        </div>
        <div>
          <dt>Checked</dt>
          <dd>{project.checkedBy || "—"}</dd>
        </div>
      </dl>
    </header>
  );
}

function Cover({ project, items }) {
  const today = day(new Date().toISOString());
  const meta = [
    ["Project number", project.number],
    ["Client", project.client],
    ["Location", project.location],
    ["Revision", project.revision],
    ["Date", today],
  ].filter(([, v]) => v);
  return (
    <section className="rp-sheet rp-cover">
      <div className="rp-cover-top">
        <span className="rp-brand">
          Engineer Tool<strong>Fox</strong>
        </span>
        <span className="rp-doc-type">Calculation package</span>
      </div>
      <h1>{project.name}</h1>
      <dl className="rp-cover-meta">
        {meta.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {project.description && <p className="rp-description">{project.description}</p>}

      <h2>Index of calculations</h2>
      <table className="rp-table rp-grid rp-index">
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col">Calculation</th>
            <th scope="col">Tool</th>
            <th scope="col">Key result</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td>C-{String(i + 1).padStart(2, "0")}</td>
              <td>{it.title}</td>
              <td>{it.toolName}</td>
              <td>{headline(it)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="rp-table rp-grid rp-signoff">
        <thead>
          <tr>
            <th scope="col">Rev</th>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Prepared</th>
            <th scope="col">Checked</th>
            <th scope="col">Approved</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{project.revision || "0"}</td>
            <td>{today}</td>
            <td>Issued</td>
            <td>{project.preparedBy}</td>
            <td>{project.checkedBy}</td>
            <td />
          </tr>
          <tr>
            <td />
            <td />
            <td />
            <td />
            <td />
            <td />
          </tr>
        </tbody>
      </table>
      <p className="rp-disclaimer">
        Calculations were prepared with Engineer ToolFox for preliminary design. Results depend on the inputs and the stated assumptions and must be checked by a qualified engineer before they are relied on for design or construction.
      </p>
    </section>
  );
}

function CalcSection({ project, item, number, count, opts }) {
  const r = item.report;
  const tag = `C-${String(number).padStart(2, "0")}`;
  return (
    <section className="rp-sheet rp-calc">
      <SheetHead project={project} label={`Calculation ${tag} · ${number} of ${count}`} title={item.title} sub={[item.toolName, item.discipline, r.units].filter(Boolean).join(" · ")} />
      <p className="rp-saved">Saved {day(item.updatedAt)}</p>
      {item.note && (
        <section className="rp-block rp-wide">
          <h3>Purpose and basis</h3>
          <p className="rp-note">{item.note}</p>
        </section>
      )}
      {r.primary && (
        <div className="rp-answer">
          <span>{r.primary.label}</span>
          <strong>
            {r.primary.value} {r.primary.unit}
          </strong>
        </div>
      )}
      <div className="rp-two">
        <RowsTable title="Inputs" rows={r.inputs} />
        <RowsTable title="Results" rows={r.results} primary={r.primary} />
      </div>
      {r.warnings.length > 0 && (
        <section className="rp-block rp-wide rp-warnings">
          <h3>Notes and warnings</h3>
          <ul>
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      {opts.tables && r.tables.map((t, i) => <DataTable key={i} t={t} />)}
      {opts.figures && r.figures.length > 0 && (
        <section className="rp-block rp-wide rp-figures">
          {r.figures.map((f, i) => (
            <Figure key={i} f={f} n={`${number}.${i + 1}`} />
          ))}
        </section>
      )}
      {opts.equations && r.formula.length > 0 && (
        <section className="rp-block rp-wide">
          <h3>Equations</h3>
          <div className="rp-formulas">
            {r.formula.map((f) => (
              <code key={f}>{f}</code>
            ))}
          </div>
        </section>
      )}
      {opts.assumptions && r.about && (
        <section className="rp-block rp-wide">
          <h3>Assumptions and limits</h3>
          <p>{r.about}</p>
        </section>
      )}
      {opts.assumptions && r.sources && (
        <section className="rp-block rp-wide">
          <h3>References</h3>
          <p>{r.sources}</p>
        </section>
      )}
    </section>
  );
}

/** `items` are the calculations to print; `total` is the project's full list, for numbering. */
export default function ReportDocument({ project, items, total = items, opts }) {
  const footer = `${project.number ? `${project.number} · ` : ""}${project.name}${project.revision ? ` · Rev ${project.revision}` : ""}`;
  return (
    <div className="rp-doc">
      <style>{`@page { @bottom-left { content: ${cssString(footer)}; } }`}</style>
      {opts.cover && <Cover project={project} items={total} />}
      {items.map((it) => {
        const n = total.findIndex((x) => x.id === it.id) + 1;
        return <CalcSection key={it.id} project={project} item={it} number={n} count={total.length} opts={opts} />;
      })}
    </div>
  );
}
