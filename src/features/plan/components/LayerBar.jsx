import { CalendarPlus, Sparkles, X } from "lucide-react";

import { LAYERS, PRESETS } from "../state/planStore";

// Every layer as a one-tap toggle, always on screen above the calendar.
export function LayerBar({ layers, onToggle, onLinkCalendar }) {
  return (
    <ul className="pf-layer-bar" aria-label="Show on calendar">
      {LAYERS.map(layer => (
        <li key={layer.id}>
          <button type="button" className={`pf-layer-chip pf-l-${layer.id}`} aria-pressed={layers[layer.id]} onClick={() => onToggle(layer.id)} title={layer.source}>
            <span className="pf-swatch" aria-hidden="true" />
            {layer.short ?? layer.name}
          </button>
        </li>
      ))}
      <li>
        <button type="button" className="pf-layer-chip pf-link-chip" onClick={onLinkCalendar}>
          <CalendarPlus size={13} aria-hidden="true" /> Link a calendar
        </button>
      </li>
    </ul>
  );
}

// First visit: pick what the calendar is for. Each choice switches on a
// set of layers; anything can still be toggled afterwards.
export function SetupCard({ layers, onPick, onDismiss, hasPlan, onOpenPlanner, onLinkCalendar }) {
  return (
    <section className="pf-panel pf-setup" aria-label="What do you want to plan around?">
      <header className="pf-day-head">
        <div>
          <p className="pf-eyebrow">
            <Sparkles size={12} aria-hidden="true" /> QUICK SETUP
          </p>
          <h2>What do you want to plan around?</h2>
          <p className="pf-muted">Pick one or more. You can switch any layer on or off later from the colored bar above the calendar.</p>
        </div>
        <button type="button" className="pf-icon-btn" onClick={onDismiss} aria-label="Close quick setup">
          <X size={18} />
        </button>
      </header>
      <ul className="pf-presets">
        {PRESETS.map(preset => (
          <li key={preset.id}>
            <button type="button" className="pf-preset" aria-pressed={preset.layers.every(id => layers[id])} onClick={() => onPick(preset)}>
              <strong>{preset.name}</strong>
              <span className="pf-muted">{preset.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="pf-setup-actions">
        <button type="button" className="pf-btn" onClick={onLinkCalendar}>
          <CalendarPlus size={15} aria-hidden="true" /> Link Google, Apple, Outlook or school calendars
        </button>
        {layers.training && !hasPlan && (
          <button type="button" className="pf-btn" onClick={onOpenPlanner}>
            Build a training plan
          </button>
        )}
        <button type="button" className="pf-btn pf-btn-primary" onClick={onDismiss}>
          Done
        </button>
      </div>
    </section>
  );
}
