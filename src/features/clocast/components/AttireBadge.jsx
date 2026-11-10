import { ArrowLeftRight } from "lucide-react";

import { attireIcons, attireModes } from "../data/attire";
import { garments } from "../data/garments";
import GarmentIcon from "./GarmentIcon";

/**
 * What to wear, at a glance, beside the temperature: a few clothing
 * drawings under "Casual Attire", with a button to switch to sports.
 */
export default function AttireBadge({ plan, mode, when, onSwitch }) {
  const icons = attireIcons(plan, garments);
  const other = attireModes.find(m => m.id !== mode.id);
  const worn = plan.outfit.items.filter(id => !garments[id].hidden && garments[id].region !== "feet").map(id => garments[id].name);

  return (
    <div className="cc-attire">
      <div className="cc-attire-head">
        <p className="cc-attire-title">{mode.title}</p>
        <button type="button" className="cc-attire-switch" onClick={() => onSwitch(other.id)} title={other.hint}>
          <ArrowLeftRight size={13} aria-hidden="true" />
          {other.short}
        </button>
      </div>
      <ul className="cc-attire-icons" aria-label={`${plan.outfit.name}: ${[...worn, ...plan.extras.map(e => e.text)].join(", ")}`}>
        {icons.map((icon, index) => (
          <li key={`${icon.kind}-${index}`} title={icon.label}>
            <GarmentIcon kind={icon.kind} size={44} />
          </li>
        ))}
      </ul>
      <p className="cc-attire-name">
        {plan.outfit.name}
        {when && <span> · {when}</span>}
      </p>
    </div>
  );
}
