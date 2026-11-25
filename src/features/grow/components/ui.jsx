import { useEffect } from "react";
import { Sun, CloudSun, Cloud, X, Lamp, Scale } from "lucide-react";
import { RATINGS } from "../model/care";
import { INDOOR_LIGHT } from "../model/indoor";

const CONIFERS = new Set(["whitepine", "spruce", "juniper"]);

// A little seed-packet drawing for each kind of plant, tinted by the plant.
export function PlantArt({ plant, size = 64 }) {
  const c = plant.color;
  const leaf = "var(--gf-leaf)";
  const stem = "var(--gf-stem)";
  let body;
  switch (plant.art ?? plant.type) {
    case "mushroom":
    case "fungi":
      body = (
        <>
          <path d="M28 56 Q27 40 29 32 H35 Q37 40 36 56 Z" fill="#efe6d6" />
          <path d="M10 34 Q12 12 32 12 Q52 12 54 34 Q32 28 10 34 Z" fill={c} />
          <path d="M16 46 Q17 40 18 37 H21 Q22 41 22 46 Z" fill="#efe6d6" />
          <path d="M11 38 Q13 30 19 30 Q26 30 27 38 Q19 36 11 38 Z" fill={c} opacity="0.85" />
        </>
      );
      break;
    case "palmate":
      body = (
        <>
          <path d="M32 58 V34" stroke={stem} strokeWidth="2.5" />
          {[-75, -50, -25, 0, 25, 50, 75].map((a, i) => (
            <ellipse key={a} cx="32" cy={34 - (i === 3 ? 13 : 11 - Math.abs(3 - i) * 1.5)} rx="3.2" ry={i === 3 ? 14 : 12 - Math.abs(3 - i) * 2} transform={`rotate(${a} 32 34)`} fill={c} />
          ))}
        </>
      );
      break;
    case "flytrap":
      body = (
        <>
          {[-35, 0, 35].map(a => (
            <g key={a} transform={`rotate(${a} 32 56)`}>
              <path d="M32 56 V32" stroke={leaf} strokeWidth="3" />
              <path d="M24 30 Q32 14 40 30 Q32 26 24 30 Z" fill={c} />
              <path d="M24 30 L22 26 M28 24 L27 20 M36 24 L37 20 M40 30 L42 26" stroke={leaf} strokeWidth="1.2" />
            </g>
          ))}
        </>
      );
      break;
    case "vine":
      body = (
        <>
          <path d="M32 58 Q24 44 32 32 T32 6" stroke={stem} strokeWidth="2.5" fill="none" />
          {[[24, 46], [40, 36], [24, 24], [40, 14]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 6} Q${x + 6} ${y} ${x} ${y + 7} Q${x - 6} ${y} ${x} ${y - 6} Z`} fill={c} />
          ))}
        </>
      );
      break;
    case "foliage":
      body = (
        <>
          <path d="M18 56 H46 L43 44 H21 Z" fill="var(--gf-bark)" />
          <path d="M32 44 Q30 30 20 20 M32 44 Q34 26 44 16 M32 44 V14" stroke={stem} strokeWidth="2" fill="none" />
          <ellipse cx="18" cy="20" rx="9" ry="6" transform="rotate(-40 18 20)" fill={c} />
          <ellipse cx="45" cy="15" rx="9" ry="6" transform="rotate(35 45 15)" fill={c} />
          <ellipse cx="32" cy="12" rx="6" ry="9" fill={c} opacity="0.9" />
        </>
      );
      break;
    case "trailing":
      body = (
        <>
          <path d="M16 20 H48 L45 32 H19 Z" fill="var(--gf-bark)" />
          {[[20, 30], [32, 32], [44, 30]].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x} ${y} Q${x - 4} ${y + 12} ${x + 2} ${y + 24}`} stroke={stem} strokeWidth="1.8" fill="none" />
              {[6, 14, 22].map(dy => (
                <circle key={dy} cx={x + (dy % 2 ? -2 : 1)} cy={y + dy} r="3.6" fill={c} />
              ))}
            </g>
          ))}
          <ellipse cx="32" cy="16" rx="12" ry="5" fill={c} />
        </>
      );
      break;
    case "succulent":
      body = (
        <>
          <path d="M18 56 H46 L43 46 H21 Z" fill="var(--gf-bark)" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
            <ellipse key={a} cx="32" cy="26" rx="5" ry="12" transform={`rotate(${a} 32 36)`} fill={c} opacity="0.9" />
          ))}
          <circle cx="32" cy="36" r="5" fill={leaf} />
        </>
      );
      break;
    case "kitchen":
      body = (
        <>
          <path d="M18 56 H46 L43 42 H21 Z" fill="var(--gf-bark)" />
          {[22, 28, 34, 40].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 42 V${24 + (i % 2) * 6}`} stroke={stem} strokeWidth="1.8" />
              <ellipse cx={x - 3} cy={26 + (i % 2) * 6} rx="4" ry="2.5" transform={`rotate(-30 ${x - 3} ${26 + (i % 2) * 6})`} fill={c} />
              <ellipse cx={x + 3} cy={23 + (i % 2) * 6} rx="4" ry="2.5" transform={`rotate(30 ${x + 3} ${23 + (i % 2) * 6})`} fill={c} />
            </g>
          ))}
        </>
      );
      break;
    case "tree":
      body = CONIFERS.has(plant.id) ? (
        <>
          <rect x="29" y="44" width="6" height="12" rx="1" fill="var(--gf-bark)" />
          <path d="M32 6 L48 30 H40 L52 46 H12 L24 30 H16 Z" fill={c} />
        </>
      ) : (
        <>
          <rect x="29" y="36" width="6" height="20" rx="2" fill="var(--gf-bark)" />
          <circle cx="32" cy="24" r="16" fill={c} />
          <circle cx="20" cy="30" r="10" fill={c} opacity="0.85" />
          <circle cx="44" cy="30" r="10" fill={c} opacity="0.85" />
        </>
      );
      break;
    case "shrub":
      body = (
        <>
          <ellipse cx="32" cy="40" rx="22" ry="14" fill={leaf} />
          {[[20, 34], [32, 30], [44, 34], [26, 42], [38, 42]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" fill={c} />
          ))}
        </>
      );
      break;
    case "grass":
      body = (
        <>
          {[10, 16, 22, 28, 34, 40, 46, 52].map((x, i) => (
            <path key={i} d={`M${x} 56 Q${x + (i % 2 ? 4 : -3)} ${36 - (i % 3) * 6} ${x + (i % 2 ? 6 : -1)} ${20 + (i % 3) * 4}`} stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
          ))}
        </>
      );
      break;
    case "bulb":
      body = (
        <>
          <path d="M32 56 V30" stroke={stem} strokeWidth="3" />
          <path d="M32 50 Q20 40 22 28 Q30 38 32 46" fill={leaf} />
          <path d="M22 14 Q22 30 32 32 Q42 30 42 14 Q37 20 32 12 Q27 20 22 14 Z" fill={c} />
        </>
      );
      break;
    case "herb":
      body = (
        <>
          <path d="M32 58 V14" stroke={stem} strokeWidth="2.5" />
          {[18, 28, 38, 48].map((y, i) => (
            <g key={i}>
              <ellipse cx="24" cy={y} rx="8" ry="4" transform={`rotate(-30 24 ${y})`} fill={c} />
              <ellipse cx="40" cy={y - 4} rx="8" ry="4" transform={`rotate(30 40 ${y - 4})`} fill={c} />
            </g>
          ))}
        </>
      );
      break;
    case "vegetable":
    case "fruit":
      body = (
        <>
          <path d="M32 22 Q26 10 18 12 Q22 20 32 22 Q38 10 46 12 Q42 20 32 22" fill={leaf} />
          <circle cx="32" cy="38" r="16" fill={c} />
          <ellipse cx="26" cy="32" rx="4" ry="6" fill="#fff" opacity="0.25" />
        </>
      );
      break;
    case "cover":
      body = (
        <>
          <path d="M8 50 Q20 30 32 44 T56 30" stroke={stem} strokeWidth="2.5" fill="none" />
          {[[14, 42], [28, 38], [40, 42], [52, 32]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6" fill={i % 2 ? c : leaf} />
          ))}
        </>
      );
      break;
    default:
      // Flowers: annuals and perennials.
      body = (
        <>
          <path d="M32 58 V30" stroke={stem} strokeWidth="3" />
          <ellipse cx="24" cy="48" rx="8" ry="4" transform="rotate(-25 24 48)" fill={leaf} />
          {[0, 60, 120, 180, 240, 300].map(a => (
            <ellipse key={a} cx="32" cy="14" rx="5" ry="10" transform={`rotate(${a} 32 24)`} fill={c} />
          ))}
          <circle cx="32" cy="24" r="5" fill="var(--gf-sunny)" />
        </>
      );
  }
  return (
    <svg className="gf-art" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {body}
    </svg>
  );
}

export function RatingBadge({ result, compact = false }) {
  if (!result) return null;
  const r = RATINGS[result.score];
  return (
    <span className={`gf-rating gf-rating--${result.score}`} title={r.hint}>
      <span className="gf-rating-dots" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(i => (
          <i key={i} className={i <= Math.min(result.score, 5) ? "on" : ""} />
        ))}
      </span>
      {!compact && <span>{r.name}</span>}
      {compact && <span className="sr-only">{r.name}</span>}
    </span>
  );
}

const SUN_ICONS = { full: Sun, part: CloudSun, shade: Cloud };
const SUN_NAMES = { full: "Full sun", part: "Part sun", shade: "Shade" };
export function SunNeeds({ sun, withText = false }) {
  return (
    <span className="gf-sun" title={sun.map(s => SUN_NAMES[s]).join(", ")}>
      {sun.map(s => {
        const Icon = SUN_ICONS[s];
        return (
          <span key={s} className="gf-sun-item">
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            {withText && <span>{SUN_NAMES[s]}</span>}
          </span>
        );
      })}
      {!withText && <span className="sr-only">{sun.map(s => SUN_NAMES[s]).join(", ")}</span>}
    </span>
  );
}

const LIGHT_ICONS = { bright: Sun, medium: CloudSun, low: Lamp };
/** Indoor light needs: bright, medium, low. */
export function IndoorLight({ light, withText = false }) {
  const names = light.map(l => INDOOR_LIGHT[l].name).join(", ");
  return (
    <span className="gf-sun gf-sun--indoor" title={`${names} light`}>
      {light.map(l => {
        const Icon = LIGHT_ICONS[l];
        return (
          <span key={l} className="gf-sun-item">
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            {withText && <span>{INDOOR_LIGHT[l].name}</span>}
          </span>
        );
      })}
      {!withText && <span className="sr-only">{names} light</span>}
    </span>
  );
}

/** "Check your local law" chip for restricted specialty grows. */
export function LawChip() {
  return (
    <span className="gf-law-chip">
      <Scale size={13} aria-hidden="true" /> Check your local law
    </span>
  );
}

export function Sheet({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="gf-sheet-wrap" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`gf-sheet${wide ? " gf-sheet--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="gf-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="gf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="gf-sheet-body">{children}</div>
      </div>
    </div>
  );
}
