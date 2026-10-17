import {
  CloudRain,
  Droplets,
  Glasses,
  Hand,
  Info,
  Shirt,
  Snowflake,
  TriangleAlert,
  Wind,
} from "lucide-react";

import { garments } from "../data/garments";
import { formatHour } from "../units";

// Footwear still counts toward the insulation total but isn't suggested.
const REGION_LABELS = { top: "Top", outer: "Outer layer", legs: "Legs" };
const EXTRA_ICONS = {
  hat: Snowflake,
  gloves: Hand,
  rain: CloudRain,
  snow: Snowflake,
  wind: Wind,
  sun: Glasses,
  water: Droplets,
};

function groupItems(items) {
  const groups = [];
  for (const id of items) {
    const garment = garments[id];
    if (garment.hidden || !REGION_LABELS[garment.region]) continue;
    const group = groups.find(g => g.region === garment.region);
    if (group) group.items.push(garment);
    else groups.push({ region: garment.region, items: [garment] });
  }
  return groups;
}

export default function OutfitCard({ plan, summary }) {
  const { outfit, lighter, extras, warnings } = plan;
  // Only layers worn over something else can come off during the day.
  const baseTop = outfit.items.find(id => garments[id].region === "top");
  const removable = id => garments[id].region === "outer" || (garments[id].region === "top" && id !== baseTop);
  const removed = lighter ? outfit.items.filter(id => removable(id) && !lighter.outfit.items.includes(id)) : [];

  return (
    <div className="cc-outfit">
      <div className="cc-outfit-head">
        <div className="cc-outfit-icon" aria-hidden="true">
          <Shirt size={26} />
        </div>
        <div>
          <p className="cc-eyebrow">WEAR THIS</p>
          <h3 className="cc-outfit-name">{outfit.name}</h3>
          {summary && <p className="cc-muted">{summary}</p>}
        </div>
      </div>

      <dl className="cc-garments">
        {groupItems(outfit.items).map(group => (
          <div key={group.region}>
            <dt>{REGION_LABELS[group.region]}</dt>
            <dd>
              {group.items.map(item => (
                <span key={item.name}>{item.name}</span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      {lighter && removed.length > 0 && (
        <p className="cc-later">
          <strong>Dress in layers.</strong> Around {formatHour(lighter.localHour)} you can be down to “
          {lighter.outfit.name}”, so make the {removed.map(id => garments[id].name.toLowerCase()).join(" and ")} easy
          to take off.
        </p>
      )}

      {extras.length > 0 && (
        <>
          <h3 className="cc-subhead">Also bring</h3>
          <ul className="cc-extras">
            {extras.map(extra => {
              const Icon = EXTRA_ICONS[extra.kind] ?? Info;
              return (
                <li key={extra.kind}>
                  <Icon size={16} aria-hidden="true" />
                  {extra.text}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {warnings.length > 0 && (
        <ul className="cc-warnings">
          {warnings.map(warning => (
            <li key={warning.text} className={`is-${warning.tone}`}>
              {warning.tone === "info" ? <Info size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
              {warning.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
