import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from "lucide-react";
import { Chips, Segmented, Stepper } from "./ui";
import { toggleIn } from "./format";
import { ALLERGENS } from "../data/ingredients";
import { recipes, DIFFICULTY, EQUIPMENT, TASTES } from "../data/recipes";
import { DIETS } from "../model/recipe";
import { PRIORITIES } from "../model/discover";

const CUISINES = [...new Set(recipes.map(r => r.cuisine.replace(/-inspired$/, "")))].sort();

export default function ProfileTab({ data, setPrefs, setProfile, resetProfile }) {
  const { prefs, profile } = data;
  const unused = Object.keys(PRIORITIES).filter(p => !profile.priorities.includes(p));
  const move = (i, d) => {
    const next = [...profile.priorities];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setProfile({ priorities: next });
  };

  return (
    <section className="ck-profile" aria-label="Your kitchen">
      <p className="ck-muted">
        Everything here is optional and saved only in this browser. Allergies, diets and ingredients you never want are strict: those recipes are
        hidden, not just ranked lower.
      </p>

      <div className="ck-panel">
        <h3>Kitchen settings</h3>
        <div className="ck-setting">
          <span>Measurements</span>
          <Segmented
            label="Measurements"
            value={prefs.measure}
            onChange={measure => setPrefs({ measure })}
            options={[
              { value: "volume", label: "Volume (cups, spoons)" },
              { value: "weight", label: "Weight (grams, ml)" },
            ]}
          />
        </div>
        <div className="ck-setting">
          <span>Oven and food temperatures</span>
          <Segmented
            label="Temperature"
            value={prefs.temp}
            onChange={temp => setPrefs({ temp })}
            options={[
              { value: "F", label: "Fahrenheit" },
              { value: "C", label: "Celsius" },
            ]}
          />
        </div>
        <div className="ck-setting">
          <span>Look</span>
          <Segmented
            label="Theme"
            value={prefs.theme}
            onChange={theme => setPrefs({ theme })}
            options={[
              { value: "light", label: "Daylight" },
              { value: "dark", label: "Evening" },
            ]}
          />
        </div>
        <div className="ck-setting">
          <span>People I usually cook for</span>
          <Stepper label="People" value={profile.household} max={20} onChange={household => setProfile({ household })} suffix={profile.household === 1 ? "person" : "people"} />
        </div>
      </div>

      <div className="ck-panel">
        <h3>Allergies</h3>
        <p className="ck-muted ck-small">Recipes containing these are always hidden. Still check labels on packaged foods.</p>
        <Chips label="Allergies" options={ALLERGENS} selected={profile.allergies} onToggle={a => setProfile({ allergies: toggleIn(profile.allergies, a) })} />
        <h3 className="ck-subhead">Diet</h3>
        <Chips label="Diet" options={DIETS} selected={profile.diets} onToggle={d => setProfile({ diets: toggleIn(profile.diets, d) })} />
        <label className="ck-field ck-subhead">
          <span>Ingredients I never want</span>
          <input type="text" placeholder="e.g. mushrooms, cilantro" value={profile.dislikes} onChange={e => setProfile({ dislikes: e.target.value })} />
        </label>
      </div>

      <div className="ck-panel">
        <h3>What matters most</h3>
        <p className="ck-muted ck-small">Recommendations follow this order. The top one counts the most.</p>
        <ol className="ck-priorities">
          {profile.priorities.map((p, i) => (
            <li key={p}>
              <span className="ck-priority-n">{i + 1}</span>
              <span className="ck-priority-name">{PRIORITIES[p]}</span>
              <button type="button" className="ck-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${PRIORITIES[p]} up`}>
                <ArrowUp size={16} />
              </button>
              <button type="button" className="ck-icon-btn" onClick={() => move(i, 1)} disabled={i === profile.priorities.length - 1} aria-label={`Move ${PRIORITIES[p]} down`}>
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="ck-icon-btn"
                onClick={() => setProfile({ priorities: profile.priorities.filter(x => x !== p) })}
                disabled={profile.priorities.length === 1}
                aria-label={`Remove ${PRIORITIES[p]}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ol>
        {unused.length > 0 && (
          <div className="ck-chips" role="group" aria-label="Add a priority">
            {unused.map(p => (
              <button key={p} type="button" className="ck-chip" onClick={() => setProfile({ priorities: [...profile.priorities, p] })}>
                <Plus size={14} aria-hidden="true" /> {PRIORITIES[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ck-panel">
        <h3>Flavors I love</h3>
        <Chips label="Flavors" options={TASTES} selected={profile.flavors} onToggle={t => setProfile({ flavors: toggleIn(profile.flavors, t) })} />
        <h3 className="ck-subhead">Cuisines I love</h3>
        <Chips
          label="Cuisines"
          options={Object.fromEntries(CUISINES.map(c => [c, c]))}
          selected={profile.cuisines}
          onToggle={c => setProfile({ cuisines: toggleIn(profile.cuisines, c) })}
        />
        <div className="ck-field-grid ck-subhead">
          <label className="ck-field">
            <span>Protein goal (g per serving)</span>
            <input type="number" inputMode="numeric" min="0" max="150" placeholder="None" value={profile.minProtein || ""} onChange={e => setProfile({ minProtein: Math.min(150, Math.max(0, Number(e.target.value) || 0)) })} />
          </label>
          <label className="ck-field">
            <span>Calorie goal (per serving)</span>
            <input type="number" inputMode="numeric" min="0" max="3000" step="50" placeholder="None" value={profile.maxCalories || ""} onChange={e => setProfile({ maxCalories: Math.min(3000, Math.max(0, Number(e.target.value) || 0)) })} />
          </label>
        </div>
      </div>

      <div className="ck-panel">
        <h3>Cooking skill</h3>
        <Segmented
          label="Cooking skill"
          value={profile.skill}
          onChange={skill => setProfile({ skill })}
          options={Object.entries(DIFFICULTY).map(([value, label]) => ({ value, label }))}
        />
        <h3 className="ck-subhead">Equipment I have</h3>
        <label className="ck-check-line">
          <input type="checkbox" checked={profile.equipment === null} onChange={e => setProfile({ equipment: e.target.checked ? null : ["oven", "stovetop", "microwave"] })} />
          Show recipes for any equipment
        </label>
        {profile.equipment !== null && (
          <Chips label="Equipment" options={EQUIPMENT} selected={profile.equipment} onToggle={e => setProfile({ equipment: toggleIn(profile.equipment, e) })} />
        )}
      </div>

      <button
        type="button"
        className="ck-btn ck-btn--quiet"
        onClick={() => {
          if (window.confirm("Reset all your preferences? Saved recipes and history stay.")) resetProfile();
        }}
      >
        <RotateCcw size={16} aria-hidden="true" /> Reset preferences
      </button>
    </section>
  );
}
