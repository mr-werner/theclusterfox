import { useMemo, useState } from "react";
import { Check, Search, Star } from "lucide-react";

import { band, BANDS, mainGrade } from "../model/grades";
import { climbSnap } from "../state/climbStore";
import { fmtLen, SAFETY_TEXT, TYPE_NAMES } from "./format";
import { GradeChip, TypeTags } from "./ui";

const SORTS = [
  { id: "wall", name: "Left to right" },
  { id: "easy", name: "Easiest first" },
  { id: "hard", name: "Hardest first" },
  { id: "name", name: "Name" },
];

/**
 * Routes with filters: type, difficulty band, text, and sort. Stars mark
 * your to-do list; checks mark what you've sent.
 */
export default function RouteList({ routes, c, openRoute, showWall = false, onAddToPlan }) {
  const { data, patch } = c;
  const [types, setTypes] = useState([]);
  const [bands, setBands] = useState([]);
  const [text, setText] = useState("");
  const [sort, setSort] = useState("wall");
  const [limit, setLimit] = useState(60);

  const todo = useMemo(() => new Set(data.todo.map(t => t.uuid)), [data.todo]);
  const sent = useMemo(() => new Set(data.ticks.filter(t => t.style !== "attempt").map(t => t.uuid)), [data.ticks]);

  const typeCounts = useMemo(() => {
    const m = {};
    for (const r of routes) for (const t of r.types) m[t] = (m[t] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [routes]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    let list = routes.filter(r => (!types.length || r.types.some(t => types.includes(t))) && (!bands.length || bands.includes(band(r))) && (!q || r.name.toLowerCase().includes(q) || (r.wall ?? "").toLowerCase().includes(q)));
    const score = r => mainGrade(r).score ?? 99;
    if (sort === "easy") list = [...list].sort((a, b) => score(a) - score(b));
    if (sort === "hard") list = [...list].sort((a, b) => score(b) - score(a));
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "wall") list = [...list].sort((a, b) => (a.wall ?? "").localeCompare(b.wall ?? "") || (a.lrIndex ?? 9999) - (b.lrIndex ?? 9999));
    return list;
  }, [routes, types, bands, text, sort]);

  const toggle = (list, set, id) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const shownRoutes = filtered.slice(0, limit);
  return (
    <div className="cb-routes">
      <div className="cb-filters">
        <label className="cb-filter-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder={showWall ? "Route or wall name" : "Route name"} aria-label="Filter routes by name" />
        </label>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort routes">
          {SORTS.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="cb-chips" role="group" aria-label="Route types">
        {typeCounts.map(([t, n]) => (
          <button type="button" key={t} className={`cb-chip${types.includes(t) ? " is-on" : ""}`} aria-pressed={types.includes(t)} onClick={() => toggle(types, setTypes, t)}>
            {TYPE_NAMES[t] ?? t} <small>{n}</small>
          </button>
        ))}
      </div>
      <div className="cb-chips" role="group" aria-label="Difficulty">
        {BANDS.map(b => (
          <button type="button" key={b.id} className={`cb-chip cb-band--${b.id}${bands.includes(b.id) ? " is-on" : ""}`} aria-pressed={bands.includes(b.id)} onClick={() => toggle(bands, setBands, b.id)} title={`${b.rope} · ${b.boulder}`}>
            {b.name}
          </button>
        ))}
      </div>
      <p className="cb-muted cb-count-line">
        {filtered.length === routes.length ? `${routes.length} routes` : `${filtered.length} of ${routes.length} routes`}
      </p>
      <ol className="cb-routelist">
        {shownRoutes.map((r, i) => {
          const header = showWall && sort === "wall" && (i === 0 || r.wall !== shownRoutes[i - 1].wall) ? r.wall : null;
          return (
            <li key={r.uuid}>
              {header !== null && header !== undefined && <h3 className="cb-wallhead">{header || "Main area"}</h3>}
              <div className="cb-route">
                <button type="button" className="cb-route-main" onClick={() => openRoute(r.uuid)}>
                  <GradeChip climb={r} />
                  <span className="cb-route-name">
                    <strong>
                      {r.name}
                      {sent.has(r.uuid) && <Check size={14} className="cb-sent" aria-label="Sent" />}
                    </strong>
                    <small>
                      <TypeTags types={r.types} />
                      {r.safety && <span className="cb-safety" title={SAFETY_TEXT[r.safety]}>{r.safety === "PG13" ? "PG-13" : r.safety}</span>}
                      {fmtLen(r.length, data.units) && <span>{fmtLen(r.length, data.units)}</span>}
                      {r.bolts && <span>{r.bolts} bolts</span>}
                      {!showWall || sort === "wall" ? null : r.wall && <span>{r.wall}</span>}
                    </small>
                  </span>
                </button>
                {onAddToPlan && (
                  <button type="button" className="cb-iconbtn" onClick={() => onAddToPlan(r)} title="Add to a climbing day">
                    +
                  </button>
                )}
                <button
                  type="button"
                  className={`cb-iconbtn${todo.has(r.uuid) ? " is-on" : ""}`}
                  aria-pressed={todo.has(r.uuid)}
                  aria-label={todo.has(r.uuid) ? `Remove ${r.name} from to-do` : `Add ${r.name} to to-do`}
                  title="To-do list"
                  onClick={() => patch(d => ({ todo: todo.has(r.uuid) ? d.todo.filter(t => t.uuid !== r.uuid) : [climbSnap(r), ...d.todo] }))}
                >
                  <Star size={16} fill={todo.has(r.uuid) ? "currentColor" : "none"} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {filtered.length > limit && (
        <button type="button" className="cb-btn cb-btn--ghost cb-more" onClick={() => setLimit(l => l + 120)}>
          Show more ({filtered.length - limit} left)
        </button>
      )}
    </div>
  );
}
