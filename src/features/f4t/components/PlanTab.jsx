import { useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, ChevronLeft, ChevronRight, Eraser, Sparkles, UserRound, Wand2 } from "lucide-react";

import DayCard from "./DayCard";
import { addDays, dayLabel, fillWithinBudget, SLOTS } from "../model/planner.js";

const fmt = n => Math.round(n).toLocaleString();
const money = n => `$${Math.round(n).toLocaleString()}`;

export default function PlanTab({ data, linked, week, start, today, onWeek, actions, onAteElse, goTab }) {
  const { profile } = data;
  const { allowed, getRecipe, cook } = linked;
  const [note, setNote] = useState("");
  const { days, targets, training, ready, cooks, shop } = week;
  const budget = profile.budget;
  const emptySlots = days.reduce((n, d) => n + SLOTS.filter(s => !data.plan[d]?.slots?.[s.id]).length, 0);

  function fill(replace) {
    const seed = data.planSeed * 31 + Number(start.replaceAll("-", "")) % 997;
    const args = {
      days: replace ? days.filter(d => d >= today) : days,
      targets,
      training,
      recipes: allowed,
      plan: data.plan,
      profile,
      favorites: cook.favorites,
      seed,
      replace,
    };
    if (!args.days.length) return;
    const result = fillWithinBudget(args, { budget, people: profile.people, getRecipe, pantry: cook.pantry });
    actions.setPlanDays(result.week);
    actions.nextSeed();
    setNote(
      budget && !result.fits
        ? `Planned. The cheapest week we could find is about ${money(result.bill)}, over your ${money(budget)} budget. Try the batch-cooking style or fewer people.`
        : budget
          ? `Planned, about ${money(result.bill)} of groceries.`
          : "Planned."
    );
  }

  function clearWeek() {
    actions.setPlanDays(Object.fromEntries(days.filter(d => d >= today).map(d => [d, { slots: {} }])));
    setNote("Cleared the rest of the week.");
  }

  const over = budget && shop.total > budget;
  const cookDays = [...new Set(cooks.map(c => c.day))];

  return (
    <div className="fp-plan">
      <div className="fp-weekbar">
        <div className="fp-weeknav">
          <button type="button" className="fp-icon" onClick={() => onWeek(addDays(start, -7))} aria-label="Previous week">
            <ChevronLeft size={18} />
          </button>
          <h2>
            {dayLabel(days[0], { month: "short", day: "numeric" })} – {dayLabel(days[6], { month: "short", day: "numeric" })}
          </h2>
          <button type="button" className="fp-icon" onClick={() => onWeek(addDays(start, 7))} aria-label="Next week">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="fp-weekactions">
          {emptySlots > 0 && (
            <button type="button" className="ff-btn ff-btn-primary" onClick={() => fill(false)}>
              <Wand2 size={16} /> {emptySlots === 28 ? "Plan my week" : `Fill ${emptySlots} empty meal${emptySlots === 1 ? "" : "s"}`}
            </button>
          )}
          {emptySlots < 28 && (
            <button type="button" className="ff-btn" onClick={() => fill(true)} title="Plans every meal from today on again">
              <Sparkles size={16} /> Re-plan
            </button>
          )}
          {emptySlots < 28 && (
            <button type="button" className="ff-btn ff-btn-ghost" onClick={clearWeek}>
              <Eraser size={15} /> Clear
            </button>
          )}
        </div>
        {note && <p className="ff-note fp-weeknote" role="status">{note}</p>}
      </div>

      <div className="fp-stats">
        <div className="fp-stat">
          <span>Calories a day</span>
          <strong>{week.plannedDays ? fmt(week.avgKcal) : "–"}</strong>
          <small>{week.avgTarget ? `target ${fmt(week.avgTarget)} on average` : "set up your profile for a target"}</small>
        </div>
        <div className="fp-stat">
          <span>Protein a day</span>
          <strong>{week.plannedDays ? `${fmt(week.avgProteinPlanned)} g` : "–"}</strong>
          <small>{week.avgProtein ? `aim for about ${fmt(week.avgProtein)} g` : "planned average"}</small>
        </div>
        <button type="button" className={`fp-stat is-button${over ? " is-over" : ""}`} onClick={() => goTab("shop")}>
          <span>Groceries</span>
          <strong>{cooks.length ? money(shop.total) : "–"}</strong>
          <small>{budget ? (over ? `${money(shop.total - budget)} over your ${money(budget)} budget` : `within your ${money(budget)} budget`) : "estimate, see the list"}</small>
          {budget > 0 && (
            <span className="fp-meter" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (shop.total / budget) * 100)}%` }} />
            </span>
          )}
        </button>
        <div className="fp-stat">
          <span>Training days</span>
          <strong>{days.filter(d => training[d].length).length}</strong>
          <small>
            {linked.hasTrainingApp ? (
              <>from <Link to="/lift?tab=plans">LiftFox</Link>, <Link to="/pace">PaceFox</Link> and your own</>
            ) : (
              <>add workouts below, or plan in <Link to="/lift">LiftFox</Link> or <Link to="/pace">PaceFox</Link></>
            )}
          </small>
        </div>
      </div>

      {!ready && (
        <div className="fp-callout">
          <UserRound size={20} aria-hidden="true" />
          <p>
            <strong>Portions are sized for 2,000 calories a day for now.</strong> Add your height, age and weight so the plan fits your body and goal.
          </p>
          <button type="button" className="ff-btn ff-btn-small" onClick={() => goTab("me")}>Set up my profile</button>
        </div>
      )}
      {!linked.cookUsed && (
        <p className="fp-hint">
          Meals come from <Link to="/cook">CookFox</Link> recipes. Set allergies, diets and foods you don’t like in its <Link to="/cook?tab=profile">profile</Link> and the planner follows them.
        </p>
      )}

      <div className="fp-days">
        {days.map(day => (
          <DayCard
            key={day}
            day={day}
            isToday={day === today}
            dayPlan={data.plan[day]}
            target={targets[day]}
            workouts={training[day]}
            cooks={cooks}
            leftoverSource={week.leftoverSource}
            recipes={allowed}
            favorites={cook.favorites}
            getRecipe={getRecipe}
            weightLbs={data.weightLbs}
            onEntry={actions.setEntry}
            onAteElse={onAteElse}
            onAddWorkout={actions.addWorkout}
            onRemoveWorkout={actions.removeWorkout}
          />
        ))}
      </div>

      {cookDays.length > 0 && (
        <section className="ff-panel fp-cooking" aria-labelledby="fp-cooking-title">
          <div className="ff-panel-head">
            <h2 id="fp-cooking-title"><ChefHat size={20} aria-hidden="true" /> Cooking this week</h2>
            <span className="ff-tag">{profile.style === "prep" ? "Batch cooking" : "Cooking most days"}</span>
          </div>
          <ol className="fp-cooklist">
            {cookDays.map(day => (
              <li key={day}>
                <strong className="fp-cookday">{dayLabel(day, { weekday: "long" })}</strong>
                <ul>
                  {cooks.filter(c => c.day === day).map(c => {
                    const r = getRecipe(c.recipeId);
                    const later = c.eats.filter(e => e.day !== day || e.slot !== c.eats[0].slot).length;
                    return (
                      <li key={`${c.recipeId}-${day}`}>
                        <Link to={`/cook?r=${encodeURIComponent(c.recipeId)}&servings=${c.servings}`}>{r?.title ?? c.recipeId}</Link>
                        <span>
                          {c.servings} serving{c.servings === 1 ? "" : "s"}
                          {later > 0 ? `, covers ${later} more meal${later === 1 ? "" : "s"}` : ""}
                          {r?.time?.total ? ` · ${r.time.total} min` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
