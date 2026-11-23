import { useState } from "react";
import { Check, ChevronRight, Play, RotateCcw, Trash2 } from "lucide-react";

import { goalById, TAKEOFFS, LEVELS, GEAR } from "../data/goals";
import { PHASES, allSessions, fmtDay, nextSession } from "../model/program";
import PlanBuilder from "./PlanBuilder";

const takeoffName = (opts) => {
  const t = TAKEOFFS.find(x => x.id === opts.takeoff)?.name ?? "";
  return opts.leg && opts.takeoff !== "two" ? `${t}, ${opts.leg} foot` : t;
};

export default function PlanTab({ store, plan, today, onOpenSession }) {
  const { data, startPlan, deletePlan } = store;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!plan || editing) {
    return (
      <PlanBuilder
        today={today}
        initial={editing ? { ...data.plan.options, start: today } : null}
        onCancel={editing ? () => setEditing(false) : null}
        onBuild={opts => {
          startPlan(opts, today);
          setEditing(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  const { opts } = plan;
  const goal = goalById.get(opts.goal);
  const done = data.plan.done;
  const sessions = allSessions(plan);
  const doneCount = sessions.filter(s => done[s.id]).length;
  const next = nextSession(plan, done, today);
  const nowWeek = plan.weeks.findLast(w => w.start <= today) ?? plan.weeks[0];
  const phase = PHASES[nowWeek.phase];

  return (
    <section className="lp-plan">
      <div className="lp-summary">
        <div>
          <p className="lp-kicker">{goal.name} plan</p>
          <h2>
            Week {Math.min(nowWeek.index + 1, plan.weeks.length)} of {plan.weeks.length}: {phase.name}
          </h2>
          <p className="lp-muted">{phase.blurb}</p>
          <ul className="lp-tags">
            <li>{takeoffName(opts)}</li>
            <li>{LEVELS.find(l => l.id === opts.level)?.name}</li>
            <li>{GEAR.find(g => g.id === opts.gear)?.name}</li>
            <li>{opts.inSeason ? "In season" : "Off-season"}</li>
          </ul>
        </div>
        <div className="lp-meter" aria-label={`${doneCount} of ${sessions.length} sessions done`}>
          <strong>{doneCount}</strong>
          <span>of {sessions.length} done</span>
          <div className="lp-meter-bar">
            <i style={{ width: `${(doneCount / sessions.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {next && (
        <button type="button" className="lp-next" onClick={() => onOpenSession(next.id)}>
          <span className="lp-next-icon" aria-hidden="true">
            <Play size={20} />
          </span>
          <span>
            <small>{next.day < today ? "Catch up" : next.day === today ? "Today" : `Next · ${fmtDay(next.day)}`}</small>
            <strong>{next.name}</strong>
            <em>
              about {next.minutes} min · {next.contacts} jumps
            </em>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
      {!next && (
        <div className="lp-callout">
          <strong>Plan finished.</strong> Log your final tests, then start a new block. Most people run 2 or 3 blocks a year with a few easy weeks between.
        </div>
      )}

      <ol className="lp-phases" aria-label="Phases">
        {plan.weeks.map(w => (
          <li key={w.index} className={`lp-ph lp-ph-${w.phase}${w.index === nowWeek.index ? " is-now" : ""}`} title={`Week ${w.index + 1}: ${PHASES[w.phase].name}`}>
            <span>{w.index + 1}</span>
          </li>
        ))}
      </ol>
      <ul className="lp-legend">
        {[...new Set(plan.weeks.map(w => w.phase))].map(id => (
          <li key={id} className={`lp-ph-${id}`}>
            {PHASES[id].name}
          </li>
        ))}
      </ul>

      <div className="lp-weeks">
        {plan.weeks.map(w => (
          <div key={w.index} className={`lp-week${w.index === nowWeek.index ? " is-now" : ""}`}>
            <h3>
              Week {w.index + 1} <span>{PHASES[w.phase].name}</span>
            </h3>
            <ul>
              {w.sessions.map(s => {
                const isDone = Boolean(done[s.id]);
                const state = isDone ? "done" : s.day < today ? "missed" : s.day === today ? "today" : "later";
                return (
                  <li key={s.id}>
                    <button type="button" className={`lp-sess is-${state}`} onClick={() => onOpenSession(s.id)}>
                      <span className="lp-sess-check" aria-hidden="true">
                        {isDone && <Check size={14} />}
                      </span>
                      <span className="lp-sess-day">{fmtDay(s.day)}</span>
                      <span className="lp-sess-name">
                        {s.name}
                        {s.test && <b className="lp-badge">Test</b>}
                      </span>
                      <span className="lp-sess-meta">{s.minutes} min</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="lp-plan-actions">
        <button type="button" className="lp-btn" onClick={() => setEditing(true)}>
          <RotateCcw size={16} aria-hidden="true" /> New plan
        </button>
        {confirmDelete ? (
          <span className="lp-confirm">
            Delete this plan and its check marks?
            <button type="button" className="lp-btn is-danger" onClick={() => { deletePlan(); setConfirmDelete(false); }}>
              Delete
            </button>
            <button type="button" className="lp-btn" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="lp-btn is-quiet" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden="true" /> Delete plan
          </button>
        )}
      </div>
    </section>
  );
}
