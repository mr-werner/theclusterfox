import { useMemo, useState } from "react";
import { ArrowRight, Check, CornerDownLeft, Flag, GripVertical, Plus } from "lucide-react";

import WeatherIcon from "../../clocast/components/WeatherIcon";
import { formatTemp } from "../../clocast/units";
import { addDays, formatTime, longDate, parseDay, relativeDay } from "../model/dates";
import { money } from "../model/entries";
import { canMove, CHECKABLE, dueToday, parseQuickAdd } from "../model/tasks";

const DRAG_TYPE = "application/x-planfox-item";
const NEXT_PRIORITY = { normal: "high", high: "low", low: "normal" };
const PRIORITY_LABEL = { high: "High priority", normal: "Normal priority", low: "Low priority" };

function QuickAdd({ today, onAdd }) {
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("normal");
  const parsed = parseQuickAdd(text, today);
  const shownPriority = parsed.priority !== "normal" ? parsed.priority : priority;

  function submit(event) {
    event.preventDefault();
    if (!parsed.title) return;
    onAdd({ title: parsed.title, day: parsed.day, priority: shownPriority });
    setText("");
    setPriority("normal");
  }

  return (
    <form className="pf-quick" onSubmit={submit}>
      <label className="pf-quick-row">
        <Plus size={18} aria-hidden="true" />
        <span className="pf-sr">Add a task</span>
        <input
          value={text}
          onChange={event => setText(event.target.value)}
          placeholder="Add a task, like “Pay rent friday !”"
          maxLength={140}
          autoComplete="off"
        />
        <button
          type="button"
          className={`pf-flag is-${shownPriority}`}
          onClick={() => setPriority(NEXT_PRIORITY[priority])}
          aria-label={`${PRIORITY_LABEL[shownPriority]}. Change priority`}
          title={PRIORITY_LABEL[shownPriority]}
        >
          <Flag size={16} aria-hidden="true" />
        </button>
        <button type="submit" className="pf-quick-go" disabled={!parsed.title} aria-label="Add task">
          <CornerDownLeft size={16} aria-hidden="true" />
        </button>
      </label>
      <p className="pf-quick-hint" aria-live="polite">
        {parsed.title ? (
          <>
            Adds <b>{parsed.title}</b> for <b>{relativeDay(parsed.day, today)}</b>
            {shownPriority !== "normal" && <>, {shownPriority} priority</>}
          </>
        ) : (
          <>Say when: today, tomorrow or a weekday. Add ! for high priority or ~ for low.</>
        )}
      </p>
    </form>
  );
}

function TaskRow({ task, today, week, onToggle, onEdit, onMove }) {
  const movable = canMove(task);
  const meta = [
    task.overdue ? `Overdue, was ${relativeDay(task.day, today)}` : null,
    task.time ? formatTime(task.time) : null,
    task.kind === "bill" ? (task.amount ? `Bill · ${money(task.amount)}` : "Bill") : task.kind === "deadline" ? "Deadline" : null,
    task.repeat !== "none" ? "Repeats" : null,
  ].filter(Boolean);

  return (
    <li
      className={`pf-task is-${task.priority ?? "normal"}${task.done ? " is-done" : ""}${task.overdue ? " is-overdue" : ""}`}
      draggable={movable}
      onDragStart={event => {
        event.dataTransfer.setData(DRAG_TYPE, task.itemId);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      {movable && <GripVertical className="pf-task-grip" size={16} aria-hidden="true" />}
      <button
        type="button"
        className="pf-task-check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.done ? "Mark not done" : "Mark done"}: ${task.title}`}
        onClick={() => onToggle(task.itemId, task.day)}
      >
        {task.done && <Check size={14} aria-hidden="true" />}
      </button>
      <button type="button" className="pf-task-body" onClick={() => onEdit(task)}>
        <span className="pf-task-title">{task.title}</span>
        {meta.length > 0 && <span className="pf-task-meta">{meta.join(" · ")}</span>}
      </button>
      {movable && !task.done && (
        <label className="pf-task-move">
          <ArrowRight size={15} aria-hidden="true" />
          <span className="pf-sr">Move {task.title} to</span>
          <select value="" onChange={event => event.target.value && onMove(task.itemId, event.target.value)}>
            <option value="">Move to…</option>
            {week
              .filter(day => day !== task.day)
              .map(day => (
                <option key={day} value={day}>
                  {relativeDay(day, today)}
                </option>
              ))}
          </select>
        </label>
      )}
    </li>
  );
}

/** One day of the week strip; drop a task on it to move it there. */
function WeekDay({ day, today, selected, entries, forecast, units, onSelect, onMove }) {
  const [over, setOver] = useState(false);
  const mine = entries.filter(e => e.item);
  const others = entries.filter(e => !e.item && !e.minor);
  const date = parseDay(day);
  return (
    <li
      className={`pf-wk-day${day === today ? " is-today" : ""}${day === selected ? " is-selected" : ""}${over ? " is-over" : ""}`}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={event => {
        event.preventDefault();
        setOver(false);
        const id = event.dataTransfer.getData(DRAG_TYPE);
        if (id) onMove(id, day);
      }}
    >
      <button type="button" className="pf-wk-head" onClick={() => onSelect(day)} aria-pressed={day === selected}>
        <span className="pf-wk-name">{day === today ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}</span>
        <span className="pf-wk-date">{date.getDate()}</span>
        {forecast && (
          <span className="pf-wk-weather">
            <WeatherIcon code={forecast.code} size={14} />
            {formatTemp(forecast.high, units, { unit: false })}°
          </span>
        )}
      </button>
      <ul className="pf-wk-list">
        {mine.slice(0, 4).map(e => (
          <li key={e.id} className={`pf-l-${e.layer}${e.done ? " is-done" : ""}${e.item?.priority === "high" ? " is-high" : ""}`}>
            {e.title}
          </li>
        ))}
        {mine.length > 4 && <li className="pf-wk-more">+{mine.length - 4} more</li>}
        {others.length > 0 && <li className="pf-wk-more">{others.length} on the calendar</li>}
      </ul>
    </li>
  );
}

/** The day at a glance: what's due, quick add, and the week to drag things into. */
export default function TodayView({ today, selected, items, entriesByDay, forecastByDay, units, showWeather, onAdd, onToggleDone, onEdit, onMove, onSelect }) {
  const tasks = useMemo(() => dueToday(items, today), [items, today]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const schedule = (entriesByDay.get(today) ?? []).filter(e => !e.minor && !(e.item && CHECKABLE.includes(e.item.kind)));
  const weather = showWeather ? forecastByDay.get(today) : null;

  return (
    <div className="pf-today">
      <header className="pf-today-head">
        <p className="pf-today-kicker">Today</p>
        <h2>{longDate(today)}</h2>
        <p className="pf-muted">
          {open.length === 0 ? "Nothing left to do today." : `${open.length} thing${open.length === 1 ? "" : "s"} to do`}
          {weather && (
            <>
              {" · "}
              <WeatherIcon code={weather.code} size={15} /> {formatTemp(weather.high, units)} / {formatTemp(weather.low, units)}
            </>
          )}
        </p>
      </header>

      <QuickAdd today={today} onAdd={onAdd} />

      <section className="pf-todo" aria-label="To do">
        {open.length > 0 ? (
          <ul className="pf-tasks">
            {open.map(task => (
              <TaskRow key={task.id} task={task} today={today} week={week} onToggle={onToggleDone} onEdit={onEdit} onMove={onMove} />
            ))}
          </ul>
        ) : (
          <p className="pf-today-empty">{tasks.length ? "All done. Nice." : "No tasks for today. Add one above, or enjoy the space."}</p>
        )}
        {done.length > 0 && (
          <details className="pf-done-list">
            <summary>Done today ({done.length})</summary>
            <ul className="pf-tasks">
              {done.map(task => (
                <TaskRow key={task.id} task={task} today={today} week={week} onToggle={onToggleDone} onEdit={onEdit} onMove={onMove} />
              ))}
            </ul>
          </details>
        )}
      </section>

      {schedule.length > 0 && (
        <section className="pf-schedule" aria-label="On the calendar today">
          <h3>On the calendar</h3>
          <ol>
            {schedule.map(e => (
              <li key={e.id} className={`pf-l-${e.layer}`}>
                <span className="pf-schedule-time">{e.time ? formatTime(e.time) : "All day"}</span>
                <span>{e.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="pf-week-strip" aria-label="This week">
        <h3>
          This week <span className="pf-muted pf-hint-drag">Drag a task onto a day to move it</span>
          <span className="pf-muted pf-hint-touch">Tap the arrow on a task to move it</span>
        </h3>
        <ol className="pf-wk">
          {week.map(day => (
            <WeekDay
              key={day}
              day={day}
              today={today}
              selected={selected}
              entries={entriesByDay.get(day) ?? []}
              forecast={showWeather ? forecastByDay.get(day) : null}
              units={units}
              onSelect={onSelect}
              onMove={onMove}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}
