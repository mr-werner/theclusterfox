import { CloudRain, Droplets, Flame, Info, Moon, Snowflake, Sun, Wind } from "lucide-react";

const ICONS = { sun: Sun, air: Wind, water: Droplets, heat: Flame, rain: CloudRain, dark: Moon, cold: Snowflake, wind: Wind };

// Advice lines with an icon each. tips: [{ kind, tone, title?, text }].
export default function TipList({ tips, compact = false }) {
  if (!tips.length) return null;
  return (
    <ul className={`cc-tips ${compact ? "is-compact" : ""}`}>
      {tips.map(tip => {
        const Icon = ICONS[tip.kind] ?? Info;
        return (
          <li key={`${tip.kind}-${tip.title ?? tip.text}`} className={`is-${tip.tone ?? "info"}`}>
            <span className="cc-tip-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span>
              {tip.title && <strong>{tip.title}</strong>}
              <span>{tip.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
