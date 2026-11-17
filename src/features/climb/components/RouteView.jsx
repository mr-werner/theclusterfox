import { useEffect, useState } from "react";
import { CalendarPlus, Check, ExternalLink, Navigation, Star } from "lucide-react";

import { getClimb, openBetaClimb } from "../api";
import { equivalents, mainGrade } from "../model/grades";
import { addRouteToTrip, climbSnap, isSend, newId, TICK_STYLES } from "../state/climbStore";
import { directionsHref, fmtLen, localDay, SAFETY_TEXT } from "./format";
import { Breadcrumbs, ConditionsStrip, ErrorNote, GradeChip, Spinner, TypeTags } from "./ui";
import { useConditions } from "./useConditions";

// One route: grade in every system, what kind of climbing it is, length,
// bolts, pitches and first ascent, its neighbors on the wall in order, the
// week's conditions, and your to-do, ticks and plan for it.
export default function RouteView({ uuid, c, openArea, openRoute }) {
  const { data, patch } = c;
  const [state, setState] = useState({ uuid: null, climb: null, error: null });
  const [retry, setRetry] = useState(0);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    getClimb(uuid, { signal: ctrl.signal })
      .then(climb => setState({ uuid, climb, error: null }))
      .catch(e => e.name !== "AbortError" && setState({ uuid, climb: null, error: e.message }));
    return () => ctrl.abort();
  }, [uuid, retry]);

  const climb = state.uuid === uuid ? state.climb : null;
  const cond = useConditions(climb?.lat, climb?.lng, climb?.path);

  if (state.uuid !== uuid && !state.error) return <Spinner>Opening route…</Spinner>;
  if (!climb) return <ErrorNote error={state.error} onRetry={() => setRetry(r => r + 1)} />;

  const g = mainGrade(climb);
  const eq = equivalents(climb).filter(e => e.grade !== g.text);
  const onTodo = data.todo.some(t => t.uuid === uuid);
  const ticks = data.ticks.filter(t => t.uuid === uuid).sort((a, b) => b.date.localeCompare(a.date));
  const sent = ticks.some(t => isSend(t.style));
  const snap = climbSnap({ ...climb, areaUuid: climb.parent?.uuid, areaName: climb.parent?.name });
  const len = fmtLen(climb.length, data.units);
  const hasWriteup = climb.description || climb.location || climb.protection;
  const idx = climb.neighbors.findIndex(n => n.uuid === uuid);

  function addToPlan() {
    if (!climb.parent) return;
    const area = { uuid: climb.parent.uuid, name: climb.parent.name, path: climb.path.slice(0, -1), lat: climb.parent.lat, lng: climb.parent.lng };
    const best = (cond.days ?? []).slice(0, 7).reduce((b, d) => (!b || d.score > b.score ? d : b), null);
    const { trips, trip } = addRouteToTrip(data.trips, snap, area, localDay(), best?.day ?? localDay(new Date(Date.now() + 864e5)));
    patch({ trips });
    c.toast(`${climb.name} is on your plan for ${area.name}`, trip.id);
  }

  return (
    <article className="cb-routepage">
      <header className="cb-area-head">
        <Breadcrumbs path={climb.path} ancestors={climb.ancestors} onArea={openArea} />
        <div className="cb-route-title">
          <GradeChip climb={climb} big />
          <div>
            <h1>
              {climb.name}
              {sent && <Check size={22} className="cb-sent" aria-label="You've sent this" />}
            </h1>
            <p className="cb-route-sub">
              <TypeTags types={climb.types} />
              {eq.length > 0 && <span className="cb-muted">≈ {eq.map(e => `${e.grade} ${e.system}`).join(" · ")}</span>}
            </p>
          </div>
        </div>
        <div className="cb-actions">
          <button type="button" className={`cb-btn${onTodo ? " is-on" : ""}`} aria-pressed={onTodo} onClick={() => patch(d => ({ todo: onTodo ? d.todo.filter(t => t.uuid !== uuid) : [snap, ...d.todo] }))}>
            <Star size={16} fill={onTodo ? "currentColor" : "none"} aria-hidden="true" /> {onTodo ? "On your to-do list" : "To-do"}
          </button>
          <button type="button" className="cb-btn cb-btn--ghost" onClick={() => setLogging(v => !v)}>
            <Check size={16} aria-hidden="true" /> Log a climb
          </button>
          <button type="button" className="cb-btn cb-btn--ghost" onClick={addToPlan} disabled={!climb.parent}>
            <CalendarPlus size={16} aria-hidden="true" /> Add to a climbing day
          </button>
          {Number.isFinite(climb.lat) && (
            <a className="cb-btn cb-btn--ghost" href={directionsHref(climb.lat, climb.lng)} target="_blank" rel="noreferrer">
              <Navigation size={16} aria-hidden="true" /> Directions
            </a>
          )}
        </div>
        {logging && <TickForm onSave={t => { patch(d => ({ ticks: [{ ...snap, ...t, id: newId() }, ...d.ticks] })); setLogging(false); c.toast(`Logged ${climb.name}`); }} onCancel={() => setLogging(false)} />}
      </header>

      <div className="cb-area-grid">
        <section className="cb-section">
          <h2>The route</h2>
          <dl className="cb-facts">
            <div>
              <dt>Grade</dt>
              <dd>{[climb.grades.yds, climb.grades.vscale, climb.grades.french, climb.grades.font, climb.grades.uiaa, climb.grades.ewbank, climb.grades.wi].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "Not graded"}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{len ?? "Not listed"}</dd>
            </div>
            <div>
              <dt>Bolts</dt>
              <dd>{climb.bolts ?? (climb.types.includes("sport") ? "Not listed" : "—")}</dd>
            </div>
            <div>
              <dt>Pitches</dt>
              <dd>{climb.pitches.length > 1 ? climb.pitches.length : "1"}</dd>
            </div>
            <div>
              <dt>Protection rating</dt>
              <dd>{climb.safety ? SAFETY_TEXT[climb.safety] ?? climb.safety : "None given (G)"}</dd>
            </div>
            <div>
              <dt>First ascent</dt>
              <dd>{climb.fa || "Unknown"}</dd>
            </div>
          </dl>
          {hasWriteup ? (
            <div className="cb-prose">
              {climb.description && <p>{climb.description}</p>}
              {climb.location && (
                <>
                  <h3>Where</h3>
                  <p>{climb.location}</p>
                </>
              )}
              {climb.protection && (
                <>
                  <h3>Protection</h3>
                  <p>{climb.protection}</p>
                </>
              )}
            </div>
          ) : (
            <p className="cb-muted">
              No write-up yet.{" "}
              <a href={openBetaClimb(uuid)} target="_blank" rel="noreferrer">
                Add beta on OpenBeta <ExternalLink size={12} aria-hidden="true" />
              </a>{" "}
              and it appears here for everyone.
            </p>
          )}
          {climb.pitches.length > 1 && (
            <>
              <h3>Pitches</h3>
              <ol className="cb-pitches">
                {climb.pitches.map(p => (
                  <li key={p.n}>
                    <strong>P{p.n}</strong> {p.grade} {fmtLen(p.length, data.units) && `· ${fmtLen(p.length, data.units)}`} {p.bolts && `· ${p.bolts} bolts`}
                    {p.description && <p>{p.description}</p>}
                  </li>
                ))}
              </ol>
            </>
          )}
          {ticks.length > 0 && (
            <>
              <h3>Your log</h3>
              <ul className="cb-ticks">
                {ticks.map(t => (
                  <li key={t.id}>
                    <strong>{TICK_STYLES.find(s => s.id === t.style)?.name}</strong> {new Date(`${t.date}T12:00:00`).toLocaleDateString()} {t.notes && <span className="cb-muted">· {t.notes}</span>}
                    <button type="button" className="cb-link" onClick={() => patch(d => ({ ticks: d.ticks.filter(x => x.id !== t.id) }))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {climb.neighbors.length > 1 && (
          <section className="cb-section">
            <h2>On the wall, left to right</h2>
            <p className="cb-muted">
              {climb.parent && (
                <button type="button" className="cb-link" onClick={() => openArea(climb.parent.uuid)}>
                  {climb.parent.name}
                </button>
              )}{" "}
              · route {idx + 1} of {climb.neighbors.length}
            </p>
            <ol className="cb-lineup">
              {climb.neighbors.map(n => (
                <li key={n.uuid} className={n.uuid === uuid ? "is-here" : ""}>
                  <button type="button" onClick={() => n.uuid !== uuid && openRoute(n.uuid)} aria-current={n.uuid === uuid ? "true" : undefined}>
                    <GradeChip climb={n} />
                    <span>{n.name}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {Number.isFinite(climb.lat) && (
        <section className="cb-section">
          <h2>Climbing conditions here</h2>
          <ConditionsStrip cond={cond} units={data.units} />
        </section>
      )}
    </article>
  );
}

function TickForm({ onSave, onCancel }) {
  const [style, setStyle] = useState("redpoint");
  const [date, setDate] = useState(localDay());
  const [notes, setNotes] = useState("");
  return (
    <form
      className="cb-tickform"
      onSubmit={e => {
        e.preventDefault();
        onSave({ style, date, notes: notes.trim() });
      }}
    >
      <div className="cb-chips" role="radiogroup" aria-label="How did it go?">
        {TICK_STYLES.map(s => (
          <button type="button" key={s.id} role="radio" aria-checked={style === s.id} className={`cb-chip${style === s.id ? " is-on" : ""}`} onClick={() => setStyle(s.id)} title={s.hint}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="cb-tickform-row">
        <label>
          Date
          <input type="date" value={date} max={localDay()} onChange={e => setDate(e.target.value)} required />
        </label>
        <label className="cb-grow">
          Notes
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Beta, partner, conditions…" maxLength={500} />
        </label>
      </div>
      <div className="cb-actions">
        <button type="submit" className="cb-btn">
          Save
        </button>
        <button type="button" className="cb-btn cb-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
