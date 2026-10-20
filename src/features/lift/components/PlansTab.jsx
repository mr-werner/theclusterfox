import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Check, ChevronDown, Lock, Play, Plus, Target, Trash2 } from "lucide-react";

import MuscleMap from "./MuscleMap";
import { withNext } from "../../../lib/redirect";
import { GearPicker, LevelPicker, Segment } from "./Pickers";
import HowTo from "./HowTo";
import { describeItem } from "../model/format";
import { exercisesById } from "../data/exercises";
import { muscleName } from "../data/muscles";
import {
  buildProgram, DAYS_PER_WEEK, nextSession, PLAN_GOALS, PLAN_LENGTHS, planTitle, progress, sessionDate, toIsoDay, WEEKDAYS,
} from "../model/program";

const SESSION_LENGTHS = [30, 45, 60, 75, 90];

function formatDay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function SignedOut() {
  return (
    <section className="lf-panel lf-empty">
      <Lock size={32} aria-hidden="true" />
      <h2>Long-term plans live in your account</h2>
      <p className="lf-muted">
        Sign up (it's free) to build a plan of 4 to 12 weeks around your goal. Your plan, progress and workout history
        follow you to any device.
      </p>
      <div className="lf-actions lf-actions--center">
        <Link className="lf-btn" to={withNext("/signup", "/lift?tab=plans")}>Sign up</Link>
        <Link className="lf-ghost" to={withNext("/login", "/lift?tab=plans")}>Log in</Link>
      </div>
    </section>
  );
}

function PlanBuilder({ prefs, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    goal: prefs.goal === "strength" || prefs.goal === "stamina" ? prefs.goal : "size",
    daysPerWeek: 3,
    minutes: SESSION_LENGTHS.includes(prefs.minutes) ? prefs.minutes : 45,
    weeks: 8,
    level: prefs.level,
    gear: prefs.gear,
    focus: [],
    startDate: toIsoDay(new Date()),
  }));
  const [showFocus, setShowFocus] = useState(false);
  const set = change => setForm(f => ({ ...f, ...change }));

  function save() {
    onSave(buildProgram({ ...form, seed: Math.floor(Math.random() * 1e6) + 1 }));
  }

  return (
    <div className="lf-builder">
      <section className="lf-panel">
        <h2>What's the overall goal?</h2>
        <div className="lf-goals lf-goals--four" role="radiogroup" aria-label="Plan goal">
          {Object.entries(PLAN_GOALS).map(([id, g]) => (
            <button key={id} type="button" role="radio" aria-checked={form.goal === id} className="lf-goal" onClick={() => set({ goal: id })}>
              <strong>{g.name}</strong>
              <span>{g.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="lf-panel lf-grid-2">
        <div>
          <h3>Days a week</h3>
          <Segment label="Days a week" options={DAYS_PER_WEEK.map(d => ({ id: d, name: String(d) }))} value={form.daysPerWeek} onChange={v => set({ daysPerWeek: v })} />
        </div>
        <div>
          <h3>Each session</h3>
          <Segment label="Session length" options={SESSION_LENGTHS.map(d => ({ id: d, name: `${d} min` }))} value={form.minutes} onChange={v => set({ minutes: v })} />
        </div>
        <div>
          <h3>Plan length</h3>
          <Segment label="Plan length" options={PLAN_LENGTHS.map(w => ({ id: w, name: `${w} weeks` }))} value={form.weeks} onChange={v => set({ weeks: v })} />
        </div>
        <div>
          <h3>Your experience</h3>
          <LevelPicker level={form.level} onChange={v => set({ level: v })} />
        </div>
        <div>
          <h3>Start on</h3>
          <input className="lf-input" type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value || toIsoDay(new Date()) })} />
          <p className="lf-note">Your first session is on this day.</p>
        </div>
      </section>

      <section className="lf-panel">
        <h2>Gear you can use</h2>
        <GearPicker gear={form.gear} onChange={gear => set({ gear })} />
      </section>

      <section className="lf-panel">
        <button type="button" className="lf-disclosure" aria-expanded={showFocus} onClick={() => setShowFocus(v => !v)}>
          <Target size={16} aria-hidden="true" />
          Focus on specific muscles <span className="lf-muted">(optional{form.focus.length ? `, ${form.focus.length} picked` : ""})</span>
          <ChevronDown size={16} className={showFocus ? "is-flipped" : ""} aria-hidden="true" />
        </button>
        {showFocus && (
          <MuscleMap
            selected={form.focus}
            onToggle={id => set({ focus: form.focus.includes(id) ? form.focus.filter(m => m !== id) : [...form.focus, id] })}
            onSet={focus => set({ focus })}
          />
        )}
      </section>

      <div className="lf-actions">
        <button type="button" className="lf-btn lf-btn--big" onClick={save}>
          <CalendarCheck size={18} aria-hidden="true" /> Build my plan
        </button>
        {onCancel && <button type="button" className="lf-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function SessionRow({ plan, week, session, onToggle, onStart }) {
  const [open, setOpen] = useState(false);
  const [howTo, setHowTo] = useState(null);
  const date = sessionDate(plan.program, week.index, session.weekday);
  const done = plan.completed[session.id];
  return (
    <li className={`lf-session ${done ? "is-complete" : ""}`}>
      <div className="lf-session-head">
        <button
          type="button"
          className="lf-check"
          aria-pressed={Boolean(done)}
          aria-label={`${session.name}, week ${week.index + 1}: ${done ? "done" : "not done"}`}
          onClick={() => onToggle(session.id)}
        >
          {done && <Check size={14} />}
        </button>
        <button type="button" className="lf-session-name" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <strong>{session.name}</strong>
          <span>{date ? formatDay(date) : WEEKDAYS[session.weekday]} · {session.items.length} exercises</span>
        </button>
        <button type="button" className="lf-ghost" onClick={() => onStart(week, session)}>
          <Play size={14} aria-hidden="true" /> Start
        </button>
      </div>
      {open && (
        <ul className="lf-session-items">
          {session.items.map(item => {
            const ex = exercisesById.get(item.exerciseId);
            if (!ex) return null;
            return (
              <li key={item.exerciseId}>
                <button type="button" className="lf-link" onClick={() => setHowTo(howTo === ex.id ? null : ex.id)}>{ex.name}</button>
                <span className="lf-muted"> {describeItem(item)}</span>
                {howTo === ex.id && <HowTo exercise={ex} />}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function PlanView({ plan, onStart, onToggle, onDelete }) {
  const { program } = plan;
  const next = nextSession(program, plan.completed);
  const { done, total } = progress(program, plan.completed);
  const [openWeek, setOpenWeek] = useState(() => next?.week.index ?? 0);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <section className="lf-panel lf-summary">
        <p className="lf-eyebrow">YOUR PLAN</p>
        <h2>{planTitle(program)}</h2>
        <p className="lf-muted lf-small">
          {program.minutes}-minute sessions
          {program.focus.length > 0 && <> · extra focus on {program.focus.map(muscleName).join(", ").toLowerCase()}</>}
          {program.startDate && <> · started {formatDay(program.startDate)}</>}
        </p>
        <div className="lf-progress" aria-label={`${done} of ${total} sessions done`}>
          <span style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
        </div>
        <p className="lf-muted lf-small">{done} of {total} sessions done</p>
        {next ? (
          <div className="lf-next">
            <div>
              <p className="lf-eyebrow">UP NEXT · WEEK {next.week.index + 1}</p>
              <strong>{next.session.name}</strong>
              <span className="lf-muted lf-small">
                {" "}· {formatDay(sessionDate(program, next.week.index, next.session.weekday)) || WEEKDAYS[next.session.weekday]}
              </span>
              <p className="lf-muted lf-small">{next.week.note}</p>
            </div>
            <button type="button" className="lf-btn" onClick={() => onStart(next.week, next.session)}>
              <Play size={16} aria-hidden="true" /> Start session
            </button>
          </div>
        ) : (
          <p className="lf-next">You finished the whole plan. Nice work! Build a new one to keep going.</p>
        )}
      </section>

      <ol className="lf-weeks">
        {program.schedule.map(week => {
          const weekDone = week.sessions.filter(s => plan.completed[s.id]).length;
          const isOpen = openWeek === week.index;
          return (
            <li key={week.index} className={`lf-week ${week.deload ? "is-deload" : ""}`}>
              <button type="button" className="lf-week-head" aria-expanded={isOpen} onClick={() => setOpenWeek(isOpen ? -1 : week.index)}>
                <strong>Week {week.index + 1}</strong>
                {week.deload && <span className="lf-tag">Easy week</span>}
                <span className="lf-muted">{weekDone}/{week.sessions.length} done</span>
                <ChevronDown size={16} className={isOpen ? "is-flipped" : ""} aria-hidden="true" />
              </button>
              {isOpen && (
                <div className="lf-week-body">
                  <p className="lf-muted lf-small">{week.note}</p>
                  <ul>
                    {week.sessions.map(session => (
                      <SessionRow key={session.id} plan={plan} week={week} session={session} onToggle={onToggle} onStart={onStart} />
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="lf-actions">
        {confirm ? (
          <span className="lf-confirm">
            Delete this plan and its progress?
            <button type="button" className="lf-ghost lf-danger" onClick={onDelete}>Delete</button>
            <button type="button" className="lf-ghost" onClick={() => setConfirm(false)}>Keep it</button>
          </span>
        ) : (
          <button type="button" className="lf-ghost lf-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={14} aria-hidden="true" /> Delete plan
          </button>
        )}
      </div>
    </>
  );
}

/** Long-term plans, for signed-in people. */
export default function PlansTab({ data, isSignedIn, authLoading, onSavePlan, onDeletePlan, onToggleSession, onSelectPlan, onStartSession }) {
  const [building, setBuilding] = useState(false);
  const plan = useMemo(() => data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0] ?? null, [data.plans, data.activePlanId]);

  if (authLoading) return null;
  if (!isSignedIn) return <SignedOut />;

  if (building || !plan) {
    return (
      <>
        {!plan && (
          <section className="lf-panel lf-intro">
            <h2>Build a long-term plan</h2>
            <p className="lf-muted">
              Tell us your goal and schedule. You'll get a weekly split that gets a little harder each week, with an
              easy week every fourth week so you keep improving without burning out.
            </p>
          </section>
        )}
        <PlanBuilder
          prefs={data.prefs}
          onSave={program => {
            onSavePlan(program);
            setBuilding(false);
          }}
          onCancel={plan ? () => setBuilding(false) : null}
        />
      </>
    );
  }

  return (
    <div className="lf-plans">
      <div className="lf-plan-bar">
        {data.plans.length > 1 && (
          <select className="lf-input" value={plan.id} onChange={e => onSelectPlan(e.target.value)} aria-label="Plan">
            {data.plans.map(p => <option key={p.id} value={p.id}>{planTitle(p.program)}</option>)}
          </select>
        )}
        <button type="button" className="lf-ghost" onClick={() => setBuilding(true)}>
          <Plus size={14} aria-hidden="true" /> New plan
        </button>
      </div>
      <PlanView
        key={plan.id}
        plan={plan}
        onStart={(week, session) => onStartSession(plan, week, session)}
        onToggle={sessionId => onToggleSession(plan.id, sessionId)}
        onDelete={() => onDeletePlan(plan.id)}
      />
    </div>
  );
}
