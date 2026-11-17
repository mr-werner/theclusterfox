import { useState } from "react";
import { Scale, Target, Trash2, TrendingDown, TrendingUp, Minus as Flat } from "lucide-react";

import WeightChart from "./WeightChart";
import { ACTIVITY, CM_PER_IN, daysToGoal, dayTargets, GOALS, LBS_PER_KG, profileReady, RATES, restingCalories, weeklyChange, weightFeedback } from "../model/body.js";
import { dayLabel } from "../model/planner.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const fmt = n => Math.round(n).toLocaleString();
const r1 = n => Math.round(n * 10) / 10;

function Choice({ value, options, onChange, label }) {
  return (
    <div className="fp-choice" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={String(key)} type="button" aria-pressed={value === key} className={value === key ? "is-active" : ""} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// Typed numbers stay as typed until they make sense, then save.
function NumberField({ id, value, onCommit, placeholder, min, max, step = "any", suffix }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text) !== value) setText(value == null ? "" : String(value));
  }
  return (
    <span className="fp-num">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={text}
        onChange={e => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value === "") onCommit(null);
          else if (Number.isFinite(n) && n >= min && n <= max) onCommit(n);
        }}
      />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

export default function MeTab({ data, today, actions }) {
  const { profile, weights, weightUnit } = data;
  const set = actions.setProfile;
  const kg = weightUnit === "kg";
  const show = lbs => (lbs == null ? null : r1(kg ? lbs / LBS_PER_KG : lbs));
  const toLbs = v => (kg ? v * LBS_PER_KG : v);

  const [weighDay, setWeighDay] = useState(today);
  const [weighText, setWeighText] = useState("");
  const latest = weights.at(-1);

  const ready = profileReady(profile, data.weightLbs);
  const rest = restingCalories(profile, data.weightLbs);
  const restDay = ready ? dayTargets(profile, data.weightLbs, []) : null;
  const trainDay = ready ? dayTargets(profile, data.weightLbs, [{ minutes: 45, met: 5 }]) : null;
  const feedback = weightFeedback(profile, weights, today);
  const change = weeklyChange(weights, today);
  const toGoal = daysToGoal(profile, weights, today);

  const feet = profile.heightCm ? Math.floor(profile.heightCm / CM_PER_IN / 12) : null;
  const inches = profile.heightCm ? Math.round(profile.heightCm / CM_PER_IN - (feet ?? 0) * 12) : null;
  const setFeetInches = (ft, inch) => {
    const total = (ft ?? 0) * 12 + (inch ?? 0);
    set({ heightCm: total > 0 ? r1(total * CM_PER_IN) : null });
  };

  function weighIn(e) {
    e.preventDefault();
    const v = Number(weighText);
    if (!(v > 0)) return;
    actions.logWeight(weighDay, r1(toLbs(v)));
    setWeighText("");
  }

  const TrendIcon = change == null ? Flat : change < -0.1 ? TrendingDown : change > 0.1 ? TrendingUp : Flat;

  return (
    <div className="fp-me">
      <section className="ff-panel fp-weigh" aria-labelledby="fp-weigh-title">
        <div className="ff-panel-head">
          <h2 id="fp-weigh-title"><Scale size={20} aria-hidden="true" /> Weight</h2>
          <div className="ff-unit" role="group" aria-label="Weight unit">
            {["lbs", "kg"].map(u => (
              <button key={u} type="button" aria-pressed={weightUnit === u} className={weightUnit === u ? "is-active" : ""} onClick={() => actions.setWeight(data.weightLbs, u)}>
                {u}
              </button>
            ))}
          </div>
        </div>

        <form className="fp-weigh-form" onSubmit={weighIn}>
          <label htmlFor="fp-weigh-value">Weigh in</label>
          <input id="fp-weigh-value" type="number" inputMode="decimal" min="1" step="0.1" placeholder={latest ? String(show(latest.lbs)) : kg ? "80" : "175"} value={weighText} onChange={e => setWeighText(e.target.value)} />
          <span>{weightUnit}</span>
          <input type="date" value={weighDay} max={today} onChange={e => setWeighDay(e.target.value || today)} aria-label="Day" />
          <button type="submit" className="ff-btn ff-btn-primary" disabled={!(Number(weighText) > 0)}>Save</button>
        </form>

        <div className="fp-weigh-stats">
          <div>
            <span>Latest</span>
            <strong>{latest ? `${show(latest.lbs)} ${weightUnit}` : data.weightLbs ? `${show(data.weightLbs)} ${weightUnit}` : "–"}</strong>
            {latest && <small>{dayLabel(latest.day)}</small>}
          </div>
          <div>
            <span>Trend</span>
            <strong>
              <TrendIcon size={18} aria-hidden="true" /> {change == null ? "–" : `${change > 0 ? "+" : ""}${r1(kg ? change / LBS_PER_KG : change)} ${weightUnit}/wk`}
            </strong>
            <small>over the last 4 weeks</small>
          </div>
          <div>
            <span>Goal</span>
            <strong>{profile.goalLbs ? `${show(profile.goalLbs)} ${weightUnit}` : "–"}</strong>
            <small>{toGoal ? `about ${Math.max(1, Math.round(toGoal / 7))} weeks at this pace` : GOALS[profile.goal].name}</small>
          </div>
        </div>

        <WeightChart weights={weights} goalLbs={profile.goalLbs} unit={weightUnit} />

        <div className={`fp-feedback is-${feedback.tone}`} role="status">
          <strong>{feedback.title}</strong>
          <p>{feedback.text}</p>
        </div>

        {weights.length > 0 && (
          <details className="fp-weigh-list">
            <summary>All weigh-ins ({weights.length})</summary>
            <ul>
              {[...weights].reverse().slice(0, 60).map(w => (
                <li key={w.day}>
                  <span>{dayLabel(w.day)}</span>
                  <b>{show(w.lbs)} {weightUnit}</b>
                  <button type="button" className="fp-icon" onClick={() => actions.deleteWeight(w.day)} aria-label={`Delete the weigh-in on ${dayLabel(w.day)}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="ff-panel fp-profile" aria-labelledby="fp-profile-title">
        <div className="ff-panel-head">
          <h2 id="fp-profile-title"><Target size={20} aria-hidden="true" /> About you</h2>
        </div>

        <div className="fp-form">
          <div className="fp-field">
            <span className="fp-label">Body</span>
            <Choice label="Sex" value={profile.sex} onChange={v => set({ sex: v })} options={[["male", "Male"], ["female", "Female"], [null, "Rather not say"]]} />
            <small>Used only for the resting-energy formula.</small>
          </div>
          <div className="fp-field-row">
            <label className="fp-field" htmlFor="fp-born">
              <span className="fp-label">Year born</span>
              <NumberField id="fp-born" value={profile.birthYear} min={1900} max={new Date().getFullYear() - 10} step="1" placeholder="1990" onCommit={v => set({ birthYear: v })} />
            </label>
            <div className="fp-field">
              <span className="fp-label">
                Height
                <button type="button" className="ff-link" onClick={() => set({ heightUnit: profile.heightUnit === "in" ? "cm" : "in" })}>
                  use {profile.heightUnit === "in" ? "cm" : "ft/in"}
                </button>
              </span>
              {profile.heightUnit === "cm" ? (
                <NumberField id="fp-height" value={profile.heightCm ? Math.round(profile.heightCm) : null} min={90} max={250} placeholder="175" suffix="cm" onCommit={v => set({ heightCm: v })} />
              ) : (
                <span className="fp-feet">
                  <NumberField id="fp-ft" value={feet} min={3} max={8} step="1" placeholder="5" suffix="ft" onCommit={v => setFeetInches(v, inches)} />
                  <NumberField id="fp-in" value={inches} min={0} max={11} step="1" placeholder="9" suffix="in" onCommit={v => setFeetInches(feet, v)} />
                </span>
              )}
            </div>
            {!data.weightLbs && (
              <div className="fp-field">
                <span className="fp-label">Weight</span>
                <small>Add a weigh-in above.</small>
              </div>
            )}
          </div>

          <div className="fp-field">
            <span className="fp-label">Everyday activity <small>(not counting workouts)</small></span>
            <div className="fp-cards">
              {Object.entries(ACTIVITY).map(([key, a]) => (
                <button key={key} type="button" aria-pressed={profile.activity === key} className={profile.activity === key ? "is-active" : ""} onClick={() => set({ activity: key })}>
                  <strong>{a.name}</strong>
                  <small>{a.blurb}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="fp-field">
            <span className="fp-label">Goal</span>
            <Choice label="Goal" value={profile.goal} onChange={v => set({ goal: v, rate: RATES[v][Math.min(1, RATES[v].length - 1)] })} options={Object.entries(GOALS).map(([k, g]) => [k, g.name])} />
            {profile.goal !== "maintain" && (
              <Choice label="Pace" value={profile.rate} onChange={v => set({ rate: v })} options={RATES[profile.goal].map(r => [r, `${kg ? r1(r / LBS_PER_KG) : r} ${weightUnit}/wk`])} />
            )}
          </div>
          {profile.goal !== "maintain" && (
            <label className="fp-field" htmlFor="fp-goal-weight">
              <span className="fp-label">Goal weight</span>
              <NumberField id="fp-goal-weight" value={show(profile.goalLbs)} min={kg ? 25 : 50} max={kg ? 320 : 700} placeholder={kg ? "75" : "165"} suffix={weightUnit} onCommit={v => set({ goalLbs: v == null ? null : r1(toLbs(v)) })} />
            </label>
          )}

          <div className="fp-field-row">
            <label className="fp-field" htmlFor="fp-budget">
              <span className="fp-label">Grocery budget</span>
              <NumberField id="fp-budget" value={profile.budget} min={1} max={5000} placeholder="100" suffix="$ / week" onCommit={v => set({ budget: v })} />
            </label>
            <label className="fp-field" htmlFor="fp-people">
              <span className="fp-label">People eating</span>
              <NumberField id="fp-people" value={profile.people} min={1} max={12} step="1" placeholder="1" onCommit={v => set({ people: v ?? 1 })} />
              <small>Calories are sized for you; groceries for everyone.</small>
            </label>
          </div>

          <div className="fp-field">
            <span className="fp-label">How you like to cook</span>
            <div className="fp-cards fp-cards-2">
              <button type="button" aria-pressed={profile.style === "daily"} className={profile.style === "daily" ? "is-active" : ""} onClick={() => set({ style: "daily" })}>
                <strong>Cook most days</strong>
                <small>Fresh dinners, with leftovers for the next day’s lunch.</small>
              </button>
              <button type="button" aria-pressed={profile.style === "prep"} className={profile.style === "prep" ? "is-active" : ""} onClick={() => set({ style: "prep" })}>
                <strong>Meal prep</strong>
                <small>Cook in two big batches a week and eat from the fridge.</small>
              </button>
            </div>
            {profile.style === "prep" && (
              <label className="fp-inline" htmlFor="fp-prepday">
                Prep day
                <select id="fp-prepday" value={profile.prepDay} onChange={e => set({ prepDay: Number(e.target.value) })}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
                <small>The second batch is three days later.</small>
              </label>
            )}
          </div>
        </div>

        <div className="fp-targets" aria-live="polite">
          {ready ? (
            <>
              <div>
                <span>Rest day</span>
                <strong>{fmt(restDay.kcal)} cal</strong>
                <small>{restDay.protein} g protein · {restDay.carbs} g carbs · {restDay.fat} g fat</small>
              </div>
              <div>
                <span>45-min lifting day</span>
                <strong>{fmt(trainDay.kcal)} cal</strong>
                <small>{trainDay.protein} g protein · {trainDay.carbs} g carbs · {trainDay.fat} g fat</small>
              </div>
              <p className="fp-fine">
                Resting energy about {fmt(rest)} cal (Mifflin-St Jeor), times your everyday activity, {profile.goal === "maintain" ? "with" : profile.goal === "lose" ? "minus" : "plus"}{" "}
                {profile.goal === "maintain" ? "no change for your goal" : `${fmt((profile.rate * 3500) / 7)} cal a day for ${profile.rate} lb a week`}. Workouts from LiftFox, PaceFox and the plan add their own calories.
                {restDay.floored && ` We won't plan below ${fmt(restDay.kcal)} calories a day; talk with a doctor or dietitian about anything lower.`}
              </p>
            </>
          ) : (
            <p className="fp-fine">Add your year born, height and a weigh-in to see your daily targets.</p>
          )}
        </div>
      </section>
    </div>
  );
}
