import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, ExternalLink, Timer, Undo2 } from "lucide-react";

import { PHASES, allSessions, doseText, fmtDay, itemInfo, nextSession } from "../model/program";

const restText = sec => (sec >= 90 ? `${Math.round((sec / 60) * 2) / 2} min rest` : `${sec} s rest`);

function Item({ item, itemKey, checked, onToggle }) {
  const [open, setOpen] = useState(false);
  const info = itemInfo(item);
  const steps = info.drill?.steps ?? info.ex?.steps ?? [];
  const tip = info.drill?.tip ?? info.ex?.tip;
  const dose = doseText(item);
  return (
    <li className={`lp-item${checked ? " is-checked" : ""}`}>
      <button type="button" className="lp-check" role="checkbox" aria-checked={checked} aria-label={`Done: ${info.name}`} onClick={() => onToggle(itemKey)}>
        {checked && <Check size={16} />}
      </button>
      <div className="lp-item-body">
        <button type="button" className="lp-item-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="lp-item-name">
            {info.name}
            {info.lift && (
              <span className="lp-from" title="From LiftFox">
                <Dumbbell size={12} aria-hidden="true" /> LiftFox
              </span>
            )}
          </span>
          {dose && <span className="lp-dose">{dose}</span>}
          <ChevronDown size={16} className="lp-chev" aria-hidden="true" />
        </button>
        {(item.note || (item.rest > 0 && item.unit !== "round")) && (
          <p className="lp-item-note">
            {item.note}
            {item.note && item.rest > 0 && item.unit !== "round" ? " · " : ""}
            {item.rest > 0 && item.unit !== "round" && (
              <span className="lp-rest">
                <Timer size={12} aria-hidden="true" /> {restText(item.rest)}
              </span>
            )}
          </p>
        )}
        {open && (
          <div className="lp-how">
            <ol>
              {steps.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {tip && <p className="lp-tip">{tip}</p>}
            {info.lift && (
              <Link to={info.href} className="lp-link">
                See it move in LiftFox <ExternalLink size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function TrainTab({ store, plan, today, sessionId, onOpenSession, onGoPlan, onGoTests }) {
  const { data, markDone, toggleCheck } = store;
  if (!plan) {
    return (
      <div className="lp-empty">
        <h2>No plan yet</h2>
        <p>Pick your sport and how you take off, and LeapFox lays out every session for you.</p>
        <button type="button" className="lp-btn is-primary" onClick={onGoPlan}>
          Make a plan
        </button>
      </div>
    );
  }

  const list = allSessions(plan);
  const session = list.find(s => s.id === sessionId) ?? nextSession(plan, data.plan.done, today) ?? list[list.length - 1];
  const idx = list.indexOf(session);
  const prev = list[idx - 1];
  const next = list[idx + 1];
  const week = plan.weeks[session.week];
  const doneDay = data.plan.done[session.id];
  const checks = data.plan.checks[session.id] ?? [];
  const keys = session.blocks.flatMap(b => b.items.map((_, i) => `${b.id}-${i}`));
  const checkedCount = keys.filter(k => checks.includes(k)).length;

  return (
    <section className="lp-train">
      <div className="lp-train-nav">
        <button type="button" className="lp-icon-btn" disabled={!prev} onClick={() => onOpenSession(prev.id)} aria-label="Previous session">
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="lp-kicker">
            Week {week.index + 1} · {PHASES[week.phase].name} · {fmtDay(session.day)}
            {session.day === today && " · Today"}
          </p>
          <h2>{session.name}</h2>
        </div>
        <button type="button" className="lp-icon-btn" disabled={!next} onClick={() => onOpenSession(next.id)} aria-label="Next session">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="lp-stats">
        <div>
          <strong>{session.minutes}</strong>
          <span>minutes</span>
        </div>
        <div>
          <strong>{session.contacts}</strong>
          <span>foot contacts</span>
        </div>
        <div>
          <strong>
            {checkedCount}/{keys.length}
          </strong>
          <span>ticked off</span>
        </div>
      </div>

      {session.test && (
        <div className="lp-callout">
          {session.type === "test" ? "Last day of the block. " : "First day: get your starting numbers. "}
          Warm up, then test with full rest between tries and log your best in{" "}
          <button type="button" className="lp-inline-link" onClick={onGoTests}>
            Tests
          </button>
          .
        </div>
      )}

      {session.blocks.map(block => (
        <div key={block.id} className={`lp-block lp-block-${block.id}`}>
          <h3>{block.title}</h3>
          <ul>
            {block.items.map((item, i) => {
              const key = `${block.id}-${i}`;
              return <Item key={key} item={item} itemKey={key} checked={checks.includes(key)} onToggle={k => toggleCheck(session.id, k)} />;
            })}
          </ul>
        </div>
      ))}

      <p className="lp-rule">
        Every jump is a full effort with full rest. Stop a set when your jumps get lower or your landings get loud. Sharp pain in a knee, shin or heel means stop for today.
      </p>

      <div className="lp-done-row">
        {doneDay ? (
          <>
            <p>
              <Check size={18} aria-hidden="true" /> Done on {fmtDay(doneDay)}
            </p>
            <button type="button" className="lp-btn is-quiet" onClick={() => markDone(session.id, null)}>
              <Undo2 size={16} aria-hidden="true" /> Undo
            </button>
          </>
        ) : (
          <button
            type="button"
            className="lp-btn is-primary is-big"
            onClick={() => {
              markDone(session.id, today);
              if (session.test) onGoTests();
            }}
          >
            <Check size={18} aria-hidden="true" /> Session done
          </button>
        )}
      </div>
    </section>
  );
}
