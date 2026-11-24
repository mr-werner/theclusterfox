import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Check, ChevronDown, ClipboardCheck, Dumbbell, RefreshCw } from "lucide-react";

import { AFT_TABLES } from "../data/aftTables";
import { jobById } from "../data/jobs";
import { aimLabel, standardsFor, fmtStandard } from "../model/scoring";
import { allSessions, defaultTestDay, MAX_WEEKS, PHASE_NAMES } from "../model/plan";
import { addDays, daysBetween, fmtDay } from "../model/units";
import { latestScores } from "../state/readyStore";
import { Empty } from "./ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Setup({ store, job, today, existing }) {
  const { data } = store;
  const [testDay, setTestDay] = useState(existing?.testDay && existing.testDay > today ? existing.testDay : defaultTestDay(today));
  const [days, setDays] = useState(existing?.days ?? [1, 2, 4, 5, 6]);
  const aim = aimLabel(job);
  const [target, setTarget] = useState(existing?.target ?? (aim ? "aim" : "min"));
  const baseline = latestScores(data.attempts, job.id);
  const haveScores = Object.keys(baseline).length > 0;
  const minDay = addDays(today, 14);
  const maxDay = addDays(today, MAX_WEEKS * 7);
  const weeks = Math.ceil(daysBetween(today, testDay) / 7);
  const valid = testDay >= minDay && testDay <= maxDay && days.length >= 3;
  const std = standardsFor(job, data.profile, AFT_TABLES);

  const toggle = d => setDays(ds => (ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort()));

  const build = () =>
    store.savePlan({
      id: `p${Date.now().toString(36)}`,
      jobId: job.id,
      start: today,
      testDay,
      days,
      target,
      baseline,
      profile: data.profile,
      completed: {},
    });

  return (
    <div className="rf-card">
      <h3>Build your plan for {job.name}</h3>
      <div className="rf-setup">
        <label className="rf-field">
          <span>Test day</span>
          <input type="date" value={testDay} min={minDay} max={maxDay} onChange={e => setTestDay(e.target.value || defaultTestDay(today))} />
          <small>{valid || days.length < 3 ? `${weeks} weeks from today` : "Pick a day 2 to 26 weeks away"}</small>
        </label>
        <fieldset className="rf-field">
          <legend>Days you can train</legend>
          <div className="rf-days">
            {WEEKDAYS.map((w, i) => (
              <button key={w} type="button" aria-pressed={days.includes(i)} onClick={() => toggle(i)}>
                {w}
              </button>
            ))}
          </div>
          <small>{days.length < 3 ? "Pick at least 3 days" : `${days.length} days a week`}</small>
        </fieldset>
        <fieldset className="rf-field">
          <legend>Aim for</legend>
          <div className="rf-choice">
            <label>
              <input type="radio" name="target" checked={target === "min"} onChange={() => setTarget("min")} />
              <span>
                <strong>Pass comfortably</strong>
                <small>Train a margin past every minimum.</small>
              </span>
            </label>
            {aim && (
              <label>
                <input type="radio" name="target" checked={target === "aim"} onChange={() => setTarget("aim")} />
                <span>
                  <strong>{aim} scores</strong>
                  <small>{job.test.scoring === "aft" ? "80 points in every event: room to spare." : job.id === "navy-seal" ? "The Navy's Elevated PST, which can earn a shipping bonus." : "What graduates averaged on their first test."}</small>
                </span>
              </label>
            )}
          </div>
        </fieldset>
      </div>
      <p className="rf-fine">
        {haveScores
          ? "The plan starts from the scores you logged on the Test tab."
          : "You haven't logged a test, so the plan starts a little below each minimum. Log a practice test any time and update the plan."}
      </p>
      <ul className="rf-targets">
        {std.map(s => (
          <li key={s.id}>
            <span>{s.event.short}</span>
            <strong>{s.event.kind === "pass" ? "Pass" : fmtStandard(s.id, target === "aim" && s.aim != null ? s.aim : s.min) ?? "–"}</strong>
          </li>
        ))}
      </ul>
      <button type="button" className="rf-btn is-primary" disabled={!valid} onClick={build}>
        <CalendarCheck size={16} aria-hidden="true" /> Build my plan
      </button>
    </div>
  );
}

function Session({ s, done, open, onOpen, onDone, onTest, today }) {
  const past = s.day < today;
  return (
    <li id={`s-${s.id}`} className={`rf-session k-${s.kind}${done ? " is-done" : ""}${s.day === today ? " is-today" : ""}`}>
      <button type="button" className="rf-session-head" aria-expanded={open} onClick={onOpen}>
        <span className="rf-session-day">
          <strong>{fmtDay(s.day, { weekday: "short" })}</strong>
          <small>{fmtDay(s.day, { month: "short", day: "numeric" })}</small>
        </span>
        <span className="rf-session-title">
          <strong>{s.title}</strong>
          <small>{done ? "Done" : s.day === today ? "Today" : past ? "Missed? No problem, keep going" : `about ${s.minutes} min`}</small>
        </span>
        <ChevronDown size={18} className="rf-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="rf-session-body">
          {s.blocks.map((b, i) => (
            <div key={i} className="rf-block">
              <h4>{b.title}</h4>
              <ul>
                {b.lines.map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ul>
              {b.link && (
                <Link className="rf-link" to={b.link}>
                  <Dumbbell size={14} aria-hidden="true" /> How to do it in LiftFox
                </Link>
              )}
            </div>
          ))}
          <div className="rf-session-actions">
            {(s.kind === "practice" || s.kind === "test") && (
              <button type="button" className="rf-btn" onClick={() => onTest(s.id)}>
                <ClipboardCheck size={16} aria-hidden="true" /> Log scores
              </button>
            )}
            <button type="button" className={done ? "rf-btn" : "rf-btn is-primary"} onClick={onDone}>
              <Check size={16} aria-hidden="true" /> {done ? "Done (undo)" : "Mark done"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function PlanTab({ store, job, weeks, today, focusId, onFocus, onPickJob, onTest }) {
  const { data } = store;
  const plan = data.plan;
  const planJob = plan ? jobById.get(plan.jobId) : null;
  const [editing, setEditing] = useState(false);
  const sessions = useMemo(() => allSessions(weeks), [weeks]);
  const todayWeek = weeks.findIndex(w => w.sessions.some(s => s.day >= today));
  const [openWeeks, setOpenWeeks] = useState(() => new Set([Math.max(0, todayWeek)]));
  const [closed, setClosed] = useState(false);
  const firstOpen = sessions.find(s => s.day >= today && !plan?.completed[s.id])?.id;
  const openId = closed ? null : focusId ?? firstOpen;
  const focusWeek = sessions.find(x => x.id === focusId)?.week ?? null;

  // A session opened from PlanFox scrolls into view.
  useEffect(() => {
    if (!focusId) return undefined;
    const t = setTimeout(() => document.getElementById(`s-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => clearTimeout(t);
  }, [focusId]);

  if (!job && !planJob) {
    return (
      <Empty title="Pick a job first" action={<button type="button" className="rf-btn is-primary" onClick={onPickJob}>See the jobs</button>}>
        Your plan is built around that job's fitness test.
      </Empty>
    );
  }

  if (!plan || editing || (job && plan.jobId !== job.id)) {
    const forJob = job ?? planJob;
    return (
      <section>
        {plan && plan.jobId !== forJob.id && (
          <p className="rf-fine rf-warn">You have a plan for {planJob?.name}. Building a new one replaces it.</p>
        )}
        <Setup store={store} job={forJob} today={today} existing={plan?.jobId === forJob.id ? plan : null} />
        {editing && (
          <button type="button" className="rf-link" onClick={() => setEditing(false)}>
            Keep my current plan
          </button>
        )}
      </section>
    );
  }

  const done = sessions.filter(s => plan.completed[s.id]).length;
  const daysLeft = daysBetween(today, plan.testDay);
  const latest = latestScores(data.attempts, plan.jobId);
  const newer = Object.keys(latest).some(k => latest[k] !== plan.baseline[k]);

  return (
    <section>
      <div className="rf-card rf-plan-head">
        <div>
          <p className="rf-eyebrow">{planJob.name}</p>
          <h2>{daysLeft > 0 ? `${daysLeft} days to go` : daysLeft === 0 ? "Test day" : "Test day has passed"}</h2>
          <p className="rf-fine">
            Test on {fmtDay(plan.testDay, { weekday: "long", month: "long", day: "numeric" })} · {done} of {sessions.length} sessions done · Shows on your PlanFox calendar
          </p>
          <div className="rf-progress" aria-hidden="true">
            <span style={{ width: `${sessions.length ? (done / sessions.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="rf-plan-actions">
          {newer && (
            <button type="button" className="rf-btn" onClick={() => store.savePlan({ ...plan, baseline: latest, profile: data.profile })}>
              <RefreshCw size={16} aria-hidden="true" /> Use my latest scores
            </button>
          )}
          <button type="button" className="rf-btn" onClick={() => setEditing(true)}>
            Change plan
          </button>
        </div>
      </div>

      {weeks.map(w => {
        const isOpen = openWeeks.has(w.index) || w.index === focusWeek;
        const wDone = w.sessions.filter(s => plan.completed[s.id]).length;
        return (
          <div key={w.index} className={`rf-week${w.index === todayWeek ? " is-now" : ""}`}>
            <button
              type="button"
              className="rf-week-head"
              aria-expanded={isOpen}
              onClick={() => {
                if (isOpen && w.index === focusWeek) onFocus(null);
                setOpenWeeks(ws => {
                  const n = new Set(ws);
                  if (isOpen) n.delete(w.index);
                  else n.add(w.index);
                  return n;
                });
              }}
            >
              <span>
                <strong>Week {w.index + 1}</strong>
                <small>
                  {PHASE_NAMES[w.phase]} · {fmtDay(w.start, { month: "short", day: "numeric" })}
                </small>
              </span>
              <span className="rf-week-count">
                {wDone}/{w.sessions.length}
              </span>
              <ChevronDown size={18} className="rf-chev" aria-hidden="true" />
            </button>
            {isOpen && (
              <ol className="rf-sessions">
                {w.sessions.map(s => (
                  <Session
                    key={s.id}
                    s={s}
                    today={today}
                    done={Boolean(plan.completed[s.id])}
                    open={openId === s.id}
                    onOpen={() => {
                      const closing = openId === s.id;
                      setClosed(closing);
                      onFocus(closing ? null : s.id);
                    }}
                    onDone={() => store.toggleDone(s.id)}
                    onTest={onTest}
                  />
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </section>
  );
}
