import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, CircleCheck, CircleAlert, Trash2 } from "lucide-react";

import { EVENTS } from "../data/jobs";
import { AFT_TABLES } from "../data/aftTables";
import { aimLabel, checkScores, fmtResult, fmtStandard } from "../model/scoring";
import { fmtDay, fmtTime, parseHold, parseTime } from "../model/units";
import { latestScores } from "../state/readyStore";
import { Empty, EventIcon, StatusChip } from "./ui";

/** The text a stored value shows in its input. */
function toText(id, v) {
  if (v == null) return "";
  const kind = EVENTS[id].kind;
  return kind === "time" || kind === "hold" ? fmtTime(v) : String(v);
}

function fromText(id, text) {
  const kind = EVENTS[id].kind;
  if (kind === "time") return parseTime(text);
  if (kind === "hold") return parseHold(text);
  const n = Number(String(text).trim());
  return String(text).trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function Profile({ job, profile, onChange }) {
  const needsAge = job.test.scoring === "aft";
  const needsSex = job.test.bySex || (job.test.scoring === "aft" && job.test.standard === "general");
  if (!needsAge && !needsSex) return null;
  return (
    <div className="rf-profile">
      {needsSex && (
        <label className="rf-field">
          <span>Scored as</span>
          <select value={profile.sex ?? ""} onChange={e => onChange({ sex: e.target.value || null })}>
            <option value="">Choose…</option>
            <option value="m">Male</option>
            <option value="f">Female</option>
          </select>
        </label>
      )}
      {needsAge && (
        <label className="rf-field">
          <span>Age</span>
          <input type="number" inputMode="numeric" min="17" max="80" value={profile.age ?? ""} placeholder="e.g. 19" onChange={e => onChange({ age: e.target.value ? Number(e.target.value) : null })} />
        </label>
      )}
      <p className="rf-fine">
        {job.test.scoring === "aft"
          ? job.test.standard === "combat"
            ? "The combat standard is the same for everyone; only your age changes the table."
            : "The general standard is scored by sex and age."
          : "This test has separate minimums for men and women."}
      </p>
    </div>
  );
}

export default function TestTab({ store, job, today, onPickJob, onPlan }) {
  const { data } = store;
  const [params] = useSearchParams();
  const sessionId = params.get("session");
  const history = useMemo(() => (job ? data.attempts.filter(a => a.jobId === job.id) : []), [data.attempts, job]);
  const [texts, setTexts] = useState(() => {
    if (!job) return {};
    const last = latestScores(data.attempts, job.id);
    return Object.fromEntries(job.test.events.map(e => [e.id, EVENTS[e.id].kind === "pass" ? last[e.id] ?? null : toText(e.id, last[e.id])]).concat(
      job.test.events.filter(e => EVENTS[e.id].options).map(e => [`${e.id}:option`, last[`${e.id}:option`] ?? EVENTS[e.id].options[0].id]),
    ));
  });
  const [day, setDay] = useState(today);
  const [saved, setSaved] = useState(null);

  if (!job) {
    return (
      <Empty title="Pick a job first" action={<button type="button" className="rf-btn is-primary" onClick={onPickJob}>See the jobs</button>}>
        Your test, its minimums and your plan all follow from the job you pick.
      </Empty>
    );
  }

  const scores = {};
  for (const e of job.test.events) {
    const ev = EVENTS[e.id];
    if (ev.kind === "pass") {
      if (texts[e.id] != null) scores[e.id] = texts[e.id];
    } else {
      const v = fromText(e.id, texts[e.id]);
      if (v != null) scores[e.id] = v;
    }
    if (ev.options) scores[`${e.id}:option`] = texts[`${e.id}:option`];
  }
  const result = checkScores(job, scores, data.profile, AFT_TABLES);
  const aim = aimLabel(job);
  const isAft = job.test.scoring === "aft";
  const entered = result.rows.some(r => r.status !== "none");
  const needsProfile = (isAft && !data.profile.age) || ((job.test.bySex || (isAft && job.test.standard === "general")) && !data.profile.sex);

  const set = (k, v) => {
    setSaved(null);
    setTexts(t => ({ ...t, [k]: v }));
  };

  const save = () => {
    const a = store.addAttempt({ jobId: job.id, day, scores, sessionId });
    setSaved(a.id);
  };

  return (
    <section>
      <div className="rf-intro">
        <h2>{job.test.name}</h2>
        <p>Enter your latest numbers, from a practice test or your best guess. Leave out any you haven't tried.</p>
      </div>

      <div className="rf-card">
        <Profile job={job} profile={data.profile} onChange={store.setProfile} />
        <div className="rf-events">
          {result.rows.map(r => {
            const ev = r.event;
            const invalid = ev.kind !== "pass" && texts[r.id] && fromText(r.id, texts[r.id]) == null;
            const option = ev.options ? texts[`${r.id}:option`] : null;
            const minText = ev.options && r.min ? fmtStandard(r.id, r.min[option], option) : fmtStandard(r.id, r.min, option);
            return (
              <div key={r.id} className="rf-event">
                <div className="rf-event-name">
                  <EventIcon id={r.id} />
                  <div>
                    <strong>{ev.name}</strong>
                    <small>
                      {ev.kind === "pass" ? "Pass or fail" : minText ? `Minimum ${minText}` : ""}
                      {r.aim != null && ev.kind !== "pass" ? ` · ${aim} ${fmtStandard(r.id, r.aim)}` : ""}
                    </small>
                  </div>
                </div>
                <div className="rf-event-input">
                  {ev.options && (
                    <select aria-label={`${ev.name}: which one`} value={option} onChange={e => set(`${r.id}:option`, e.target.value)}>
                      {ev.options.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {ev.kind === "pass" ? (
                    <select aria-label={ev.name} value={texts[r.id] == null ? "" : texts[r.id] ? "yes" : "no"} onChange={e => set(r.id, e.target.value === "" ? null : e.target.value === "yes")}>
                      <option value="">Not tried</option>
                      <option value="yes">Passed</option>
                      <option value="no">Not yet</option>
                    </select>
                  ) : (
                    <input
                      aria-label={ev.name}
                      aria-invalid={invalid || undefined}
                      inputMode={ev.kind === "time" || ev.kind === "hold" ? "text" : "numeric"}
                      placeholder={ev.kind === "time" ? "m:ss" : ev.kind === "hold" ? "m:ss or seconds" : ev.kind === "lbs" ? "lb" : "reps"}
                      value={texts[r.id] ?? ""}
                      onChange={e => set(r.id, e.target.value)}
                    />
                  )}
                  <StatusChip status={r.status} label={r.points != null ? `${r.points} pts` : undefined} />
                </div>
              </div>
            );
          })}
        </div>

        {entered && (
          <div className={`rf-verdict${result.pass ? " is-pass" : ""}`}>
            {result.pass ? <CircleCheck size={22} aria-hidden="true" /> : <CircleAlert size={22} aria-hidden="true" />}
            <div>
              <strong>{result.pass ? "You'd pass" : result.complete ? "Not passing yet" : "Keep going"}</strong>
              <span>
                {isAft && `${result.total} of ${job.test.passTotal} points needed. `}
                {result.combined != null && `Swim + run ${fmtTime(result.combined)} (21:00 or less needed). `}
                {result.rows.some(x => x.status === "below") && `Below the minimum: ${result.rows.filter(x => x.status === "below").map(x => x.event.short.toLowerCase()).join(", ")}. `}
                {!result.complete && "Fill in every event to see the whole picture. "}
                {result.pass && (job.selective ? "Selection takes far more than the minimum, so keep building." : "Aim to show up well above the minimum.")}
              </span>
            </div>
          </div>
        )}
        {needsProfile && <p className="rf-fine rf-warn">Add your {isAft && !data.profile.age ? "age" : "details"} above so the scores are checked against the right table.</p>}

        <div className="rf-save">
          <label className="rf-field">
            <span>Test date</span>
            <input type="date" value={day} max={today} onChange={e => setDay(e.target.value || today)} />
          </label>
          <button type="button" className="rf-btn is-primary" disabled={!entered} onClick={save}>
            Log this test
          </button>
          {saved && (
            <span className="rf-saved" role="status">
              Saved.{" "}
              <button type="button" className="rf-link" onClick={onPlan}>
                <CalendarRange size={14} aria-hidden="true" /> {data.plan ? "See your plan" : "Build a plan"}
              </button>
            </span>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="rf-card">
          <h3>Your tests</h3>
          <ul className="rf-history">
            {history.map(a => {
              const r = checkScores(job, a.scores, data.profile, AFT_TABLES);
              return (
                <li key={a.id}>
                  <div>
                    <strong>{fmtDay(a.day, { month: "short", day: "numeric", year: "numeric" })}</strong>
                    <span className={r.pass ? "rf-ok" : "rf-no"}>{r.pass ? "Pass" : r.complete ? "Not yet" : "Partial"}{r.total != null ? ` · ${r.total} pts` : ""}</span>
                  </div>
                  <p>
                    {r.rows
                      .filter(x => x.value != null)
                      .map(x => `${x.event.short} ${fmtResult(x.id, x.value, x.option)}`)
                      .join(" · ")}
                  </p>
                  <button type="button" className="rf-icon-btn" aria-label="Delete this test" onClick={() => store.deleteAttempt(a.id)}>
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
