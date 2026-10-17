import { useState } from "react";
import { ChevronDown, User } from "lucide-react";

import { CM_PER_INCH, KG_PER_LB } from "../units";

const round1 = value => Math.round(value * 10) / 10;

// Text boxes keep what was typed; the saved profile is always metric.
function initialText(profile, units) {
  const { heightCm, weightKg, ageYears } = profile;
  const inches = heightCm ? heightCm / CM_PER_INCH : null;
  return {
    feet: inches ? String(Math.floor(Math.round(inches) / 12)) : "",
    inches: inches ? String(Math.round(inches) % 12) : "",
    cm: heightCm ? String(Math.round(heightCm)) : "",
    weight: weightKg ? String(round1(units === "metric" ? weightKg : weightKg / KG_PER_LB)) : "",
    age: ageYears ? String(ageYears) : "",
  };
}

export default function ProfilePanel({ profile, units, tolerance, onProfile, onTolerance }) {
  const [text, setText] = useState(() => initialText(profile, units));

  // Refill the boxes when details arrive from the account or units change.
  const [seen, setSeen] = useState({ profile, units });
  if (seen.profile !== profile || seen.units !== units) {
    const unitsChanged = seen.units !== units;
    setSeen({ profile, units });
    const empty = !text.feet && !text.cm && !text.weight && !text.age;
    if (unitsChanged || empty) setText(initialText(profile, units));
  }

  function change(field, value) {
    const next = { ...text, [field]: value };
    setText(next);
    if (field === "feet" || field === "inches") {
      const total = Number(next.feet || 0) * 12 + Number(next.inches || 0);
      onProfile({ heightCm: total > 0 ? total * CM_PER_INCH : null });
    } else if (field === "cm") {
      onProfile({ heightCm: Number(value) > 0 ? Number(value) : null });
    } else if (field === "weight") {
      const number = Number(value);
      onProfile({ weightKg: number > 0 ? (units === "metric" ? number : number * KG_PER_LB) : null });
    } else if (field === "age") {
      onProfile({ ageYears: Number(value) > 0 ? Math.round(Number(value)) : null });
    }
  }

  const filled = [profile.heightCm, profile.weightKg, profile.sex, profile.ageYears].filter(Boolean).length;

  return (
    <details className="cc-profile">
      <summary>
        <User size={17} aria-hidden="true" />
        <span>
          <strong>About you</strong>
          <span className="cc-muted">
            {filled ? ` · ${filled} of 4 details` : " · optional, sharpens the estimate"}
            {tolerance !== "normal" ? ` · runs ${tolerance}` : ""}
          </span>
        </span>
        <ChevronDown size={17} className="cc-chevron" aria-hidden="true" />
      </summary>

      <div className="cc-profile-body">
        <p className="cc-note">
          Your size changes how much heat you make for each square meter of skin. Everything is optional and stays on
          this device unless you're logged in.
        </p>

        <div className="cc-field-grid">
          <div className="cc-field">
            <span className="cc-label">Sex</span>
            <div className="cc-segment" role="group" aria-label="Sex">
              {[["female", "Female"], ["male", "Male"], [null, "Skip"]].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={profile.sex === value}
                  onClick={() => onProfile({ sex: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="cc-field">
            <span className="cc-label">Height</span>
            {units === "metric" ? (
              <span className="cc-input-unit">
                <input type="number" inputMode="numeric" min="100" max="250" value={text.cm} onChange={e => change("cm", e.target.value)} />
                <span>cm</span>
              </span>
            ) : (
              <span className="cc-input-pair">
                <span className="cc-input-unit">
                  <input type="number" inputMode="numeric" min="3" max="8" value={text.feet} aria-label="Feet" onChange={e => change("feet", e.target.value)} />
                  <span>ft</span>
                </span>
                <span className="cc-input-unit">
                  <input type="number" inputMode="numeric" min="0" max="11" value={text.inches} aria-label="Inches" onChange={e => change("inches", e.target.value)} />
                  <span>in</span>
                </span>
              </span>
            )}
          </label>

          <label className="cc-field">
            <span className="cc-label">Weight</span>
            <span className="cc-input-unit">
              <input type="number" inputMode="decimal" min="1" value={text.weight} onChange={e => change("weight", e.target.value)} />
              <span>{units === "metric" ? "kg" : "lb"}</span>
            </span>
          </label>

          <label className="cc-field">
            <span className="cc-label">Age</span>
            <span className="cc-input-unit">
              <input type="number" inputMode="numeric" min="10" max="110" value={text.age} onChange={e => change("age", e.target.value)} />
              <span>yrs</span>
            </span>
          </label>

          <div className="cc-field">
            <span className="cc-label">I usually</span>
            <div className="cc-segment" role="group" aria-label="How warm you run">
              {[["cold", "Run cold"], ["normal", "Normal"], ["warm", "Run warm"]].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={tolerance === value} onClick={() => onTolerance(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
