import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { covers, EXAM_AREAS, levelById, rank } from "../data/levels";
import { TOPICS } from "../data/knowledge";

const textOf = pt => (typeof pt === "string" ? pt : pt.t);
const minOf = pt => (typeof pt === "string" ? "emr" : pt.min);

export default function LearnTab({ level }) {
  const info = levelById.get(level);
  const [open, setOpen] = useState(() => new Set());
  const toggle = id =>
    setOpen(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="mx-learn">
      <article className="mx-card mx-level">
        <div className="mx-level-head">
          <span className="mx-badge">{info.short}</span>
          <div>
            <h2>{info.name}</h2>
            <p>{info.tagline}</p>
          </div>
        </div>
        <p className="mx-muted">{info.role}</p>
        <div className="mx-level-cols">
          <div>
            <h3>What you can do</h3>
            <ul>{info.scope.map(s => <li key={s}>{s}</li>)}</ul>
            <p className="mx-small">{info.hours}</p>
          </div>
          <div>
            <h3>The exams</h3>
            <ul>{info.exam.map(s => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
      </article>

      {EXAM_AREAS.map(area => {
        const topics = TOPICS.filter(t => t.area === area.id && covers(level, t.min));
        if (!topics.length) return null;
        return (
          <div key={area.id} className="mx-area">
            <h2 className="mx-area-title">{area.name}</h2>
            {topics.map(t => {
              const isOpen = open.has(t.id);
              const points = t.points.filter(pt => covers(level, minOf(pt)));
              const fresh = points.filter(pt => minOf(pt) === level && level !== "emr").length;
              return (
                <article key={t.id} className={`mx-card mx-topic${isOpen ? " is-open" : ""}`}>
                  <button type="button" className="mx-topic-head" aria-expanded={isOpen} onClick={() => toggle(t.id)}>
                    <span>
                      <strong>{t.title}</strong>
                      <span className="mx-muted">{t.summary}</span>
                    </span>
                    {rank(t.min) === rank(level) && level !== "emr" ? <em className="mx-new">New at {levelById.get(level).short}</em> : fresh ? <em className="mx-new">+{fresh} for {levelById.get(level).short}</em> : null}
                    <ChevronDown size={18} aria-hidden="true" className="mx-chev" />
                  </button>
                  {isOpen && (
                    <div className="mx-topic-body">
                      <ul className="mx-points">
                        {points.map(pt => (
                          <li key={textOf(pt)} className={minOf(pt) !== "emr" ? "is-level" : ""}>
                            {minOf(pt) !== "emr" && <span className="mx-tag">{levelById.get(minOf(pt)).short}</span>}
                            {textOf(pt)}
                          </li>
                        ))}
                      </ul>
                      {t.table && (
                        <div className="mx-table-wrap">
                          <table className="mx-table">
                            <caption>{t.table.caption}</caption>
                            <thead>
                              <tr>{t.table.head.map(h => <th key={h} scope="col">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                              {t.table.rows.map(r => (
                                <tr key={r.join("|")}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
