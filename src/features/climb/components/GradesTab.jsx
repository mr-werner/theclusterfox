import { BOULDER_TABLE, ROPE_TABLE } from "../model/grades";
import { SAFETY_TEXT } from "./format";

// Grade conversion charts and what the ratings mean.
export default function GradesTab() {
  return (
    <div className="cb-grades">
      <section className="cb-hero cb-hero--small">
        <p className="cb-kicker">Grades</p>
        <h1>Grade conversions</h1>
        <p className="cb-muted">Approximate: charts disagree by about a grade, and so do climbers.</p>
      </section>
      <div className="cb-area-grid">
        <section className="cb-section">
          <h2>Routes</h2>
          <table className="cb-table">
            <thead>
              <tr>
                <th>YDS (US)</th>
                <th>French</th>
                <th>UIAA</th>
                <th>Ewbank (AU)</th>
              </tr>
            </thead>
            <tbody>
              {ROPE_TABLE.map(r => (
                <tr key={r[0]}>
                  {r.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div>
          <section className="cb-section">
            <h2>Boulders</h2>
            <table className="cb-table">
              <thead>
                <tr>
                  <th>V scale</th>
                  <th>Font</th>
                </tr>
              </thead>
              <tbody>
                {BOULDER_TABLE.map(r => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td>{r[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="cb-section">
            <h2>Protection ratings</h2>
            <dl className="cb-facts cb-facts--wide">
              <div>
                <dt>G</dt>
                <dd>Good protection. The default when nothing is listed.</dd>
              </div>
              {["PG", "PG13", "R", "X"].map(k => (
                <div key={k}>
                  <dt>{k === "PG13" ? "PG-13" : k}</dt>
                  <dd>{SAFETY_TEXT[k].split(": ")[1]}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
