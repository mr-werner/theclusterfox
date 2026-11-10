import { Apple, Banana, Bean, Beef, CakeSlice, Carrot, Citrus, Coffee, Cookie, CookingPot, Croissant, Drumstick, Egg, EggFried, Fish, Flame, Ham, IceCreamBowl, Leaf, Minus, Plus, Salad, Sandwich, Shrimp, Soup, UtensilsCrossed, Wheat } from "lucide-react";

const COVER_ICONS = { Apple, Banana, Bean, Beef, CakeSlice, Carrot, Citrus, Coffee, Cookie, CookingPot, Croissant, Drumstick, Egg, EggFried, Fish, Flame, Ham, IceCreamBowl, Leaf, Salad, Sandwich, Shrimp, Soup, UtensilsCrossed, Wheat };

// Illustrated cover in place of photography (no licensed photos yet).
export function Cover({ recipe, size = "card", children }) {
  const Icon = COVER_ICONS[recipe.cover.icon] ?? CookingPot;
  return (
    <div className={`ck-cover ck-cover--${size} ck-tone--${recipe.cover.tone}`} aria-hidden={children ? undefined : "true"}>
      <Icon className="ck-cover-icon" size={size === "hero" ? 72 : 44} strokeWidth={1.5} aria-hidden="true" />
      {children}
    </div>
  );
}

// A row of mutually exclusive buttons.
export function Segmented({ label, value, options, onChange, small }) {
  return (
    <div className={`ck-seg${small ? " ck-seg--small" : ""}`} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ label, value, min = 1, max = 48, onChange, suffix }) {
  return (
    <div className="ck-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
        <Minus size={16} />
      </button>
      <output aria-live="polite">
        <strong>{value}</strong> {suffix}
      </output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
        <Plus size={16} />
      </button>
    </div>
  );
}

// Toggle chips for multi-select lists.
export function Chips({ label, options, selected, onToggle }) {
  return (
    <div className="ck-chips" role="group" aria-label={label}>
      {Object.entries(options).map(([value, name]) => (
        <button key={value} type="button" className="ck-chip" aria-pressed={selected.includes(value)} onClick={() => onToggle(value)}>
          {name}
        </button>
      ))}
    </div>
  );
}

export function UnitToggles({ prefs, setPrefs }) {
  return (
    <div className="ck-unit-toggles">
      <Segmented
        small
        label="Measurements"
        value={prefs.measure}
        onChange={measure => setPrefs({ measure })}
        options={[
          { value: "volume", label: "Volume" },
          { value: "weight", label: "Weight" },
        ]}
      />
      <Segmented
        small
        label="Temperature"
        value={prefs.temp}
        onChange={temp => setPrefs({ temp })}
        options={[
          { value: "F", label: "°F" },
          { value: "C", label: "°C" },
        ]}
      />
    </div>
  );
}
