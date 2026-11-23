import { useMemo } from "react";
import { Star, Trash2 } from "lucide-react";

import { mainGrade, pyramidBucket } from "../model/grades";
import { isSend, TICK_STYLES } from "../state/climbStore";
import { GradeChip, TypeTags } from "./ui";

// My climbs: the to-do list grouped by crag, the tick log, a grade pyramid
// and the numbers climbers like to see.
export default function LogTab({ c, openRoute, openArea, goExplore }) {
  const { data, patch } = c;
  const sends = data.ticks.filter(t => isSend(t.style));

  const stats = useMemo(() => {
    const days = new Set(data.ticks.map(t => t.date)).size;
    const hardest = kind => sends.filter(t => mainGrade(t).kind === kind).reduce((b, t) => (!b || (mainGrade(t).score ?? -9) > (mainGrade(b).score ?? -9) ? t : b), null);
    return { days, routes: new Set(sends.map(t => t.uuid)).size, rope: hardest("rope"), boulder: hardest("boulder") };
  }, [data.ticks, sends]);

  const pyramid = useMemo(() => {
    const m = new Map();
    for (const t of sends) {
      const b = pyramidBucket(t);
      if (!b) continue;
      const score = mainGrade(t).score;
      const key = `${mainGrade(t).kind}|${b}`;
      const row = m.get(key) ?? { label: b, kind: mainGrade(t).kind, n: 0, score: Math.floor(score) };
      row.n += 1;
      m.set(key, row);
    }
    return [...m.values()].sort((a, b) => (a.kind === b.kind ? b.score - a.score : a.kind === "rope" ? -1 : 1));
  }, [sends]);
  const maxN = Math.max(1, ...pyramid.map(p => p.n));

  const todoByArea = useMemo(() => {
    const m = new Map();
    for (const t of data.todo) {
      const k = t.areaUuid ?? "none";
      if (!m.has(k)) m.set(k, { uuid: t.areaUuid, name: t.areaName ?? "Other", list: [] });
      m.get(k).list.push(t);
    }
    return [...m.values()];
  }, [data.todo]);

  const ticks = [...data.ticks].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="cb-log">
      <section className="cb-hero cb-hero--small">
        <p className="cb-kicker">My climbs</p>
        <h1>Your climbing, in one place</h1>
        <div className="cb-statrow">
          <div>
            <strong>{stats.routes}</strong>
            <small>routes sent</small>
          </div>
          <div>
            <strong>{stats.days}</strong>
            <small>days out</small>
          </div>
          <div>
            <strong>{stats.rope ? mainGrade(stats.rope).text : "–"}</strong>
            <small>hardest route</small>
          </div>
          <div>
            <strong>{stats.boulder ? mainGrade(stats.boulder).text : "–"}</strong>
            <small>hardest boulder</small>
          </div>
          <div>
            <strong>{data.todo.length}</strong>
            <small>on to-do</small>
          </div>
        </div>
      </section>

      <div className="cb-area-grid">
        <section className="cb-section">
          <h2>To-do list</h2>
          {todoByArea.length === 0 && (
            <p className="cb-muted">
              Tap the <Star size={13} aria-label="star" /> on any route to save it here.{" "}
              <button type="button" className="cb-link" onClick={goExplore}>
                Find routes
              </button>
            </p>
          )}
          {todoByArea.map(g => (
            <div key={g.uuid ?? "none"} className="cb-todogroup">
              <h3>{g.uuid ? <button type="button" className="cb-link" onClick={() => openArea(g.uuid)}>{g.name}</button> : g.name}</h3>
              <ol className="cb-routelist">
                {g.list.map(r => (
                  <li key={r.uuid}>
                    <div className="cb-route">
                      <button type="button" className="cb-route-main" onClick={() => openRoute(r.uuid)}>
                        <GradeChip climb={r} />
                        <span className="cb-route-name">
                          <strong>{r.name}</strong>
                          <small>
                            <TypeTags types={r.types} />
                          </small>
                        </span>
                      </button>
                      <button type="button" className="cb-iconbtn is-on" aria-label={`Remove ${r.name} from to-do`} onClick={() => patch(d => ({ todo: d.todo.filter(t => t.uuid !== r.uuid) }))}>
                        <Star size={16} fill="currentColor" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>

        <section className="cb-section">
          <h2>Grade pyramid</h2>
          {pyramid.length === 0 ? (
            <p className="cb-muted">Log a send from any route page and your pyramid builds itself.</p>
          ) : (
            <div className="cb-pyramid">
              {pyramid.map(p => (
                <div key={`${p.kind}${p.label}`} className="cb-pyrow">
                  <span>{p.label}</span>
                  <span className="cb-pybar">
                    <i style={{ width: `${(p.n / maxN) * 100}%` }} className={`cb-pybar--${p.kind}`} />
                  </span>
                  <small>{p.n}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="cb-section">
        <h2>Log</h2>
        {ticks.length === 0 && <p className="cb-muted">Nothing logged yet. Open a route and tap Log a climb.</p>}
        <ul className="cb-ticklog">
          {ticks.slice(0, 300).map(t => (
            <li key={t.id}>
              <span className="cb-tickdate">{new Date(`${t.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              <button type="button" className="cb-route-main" onClick={() => openRoute(t.uuid)}>
                <GradeChip climb={t} />
                <span className="cb-route-name">
                  <strong>{t.name}</strong>
                  <small>
                    <span className={`cb-style cb-style--${t.style}`}>{TICK_STYLES.find(s => s.id === t.style)?.name}</span>
                    {t.areaName && <span>{t.areaName}</span>}
                    {t.notes && <span>{t.notes}</span>}
                  </small>
                </span>
              </button>
              <button type="button" className="cb-iconbtn" aria-label={`Delete log for ${t.name}`} onClick={() => patch(d => ({ ticks: d.ticks.filter(x => x.id !== t.id) }))}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        {ticks.length > 0 && (
          <button
            type="button"
            className="cb-btn cb-btn--ghost"
            onClick={() => {
              const rows = [["Date", "Route", "Grade", "Style", "Area", "Notes"], ...ticks.map(t => [t.date, t.name, mainGrade(t).text, t.style, t.areaName ?? "", t.notes])];
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = "climbfox-log.csv";
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            Download log (CSV)
          </button>
        )}
      </section>
    </div>
  );
}
