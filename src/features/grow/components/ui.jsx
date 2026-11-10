import { useEffect } from "react";
import { Sun, CloudSun, Cloud, X } from "lucide-react";
import { RATINGS } from "../model/care";

const CONIFERS = new Set(["whitepine", "spruce", "juniper"]);

// A little seed-packet drawing for each kind of plant, tinted by the plant.
export function PlantArt({ plant, size = 64 }) {
  const c = plant.color;
  const leaf = "var(--gf-leaf)";
  const stem = "var(--gf-stem)";
  let body;
  switch (plant.type) {
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
