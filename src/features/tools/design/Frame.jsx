// GD&T symbols and the feature control frame, drawn in SVG so the same pieces
// work in a page header, a list and on the drawings.

import { frameCells } from "./frameLayout";

/** One characteristic symbol, drawn in a 20×20 box centred on (0, 0). */
export function SymbolPath({ id }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "straightness":
      return <line x1={-8} y1={0} x2={8} y2={0} {...s} />;
    case "flatness":
      return <path d="M-8 5 L-3 -5 L8 -5 L3 5 Z" {...s} />;
    case "circularity":
      return <circle r={7.5} {...s} />;
    case "cylindricity":
      return (
        <g {...s}>
          <circle r={5.5} />
          <line x1={-6.5} y1={8} x2={-1.5} y2={-8} />
          <line x1={1.5} y1={8} x2={6.5} y2={-8} />
        </g>
      );
    case "profile-line":
      return <path d="M-8 4 A8 8 0 0 1 8 4" {...s} />;
    case "profile-surface":
      return <path d="M-8 4 A8 8 0 0 1 8 4 Z" {...s} />;
    case "perpendicularity":
      return (
        <g {...s}>
          <line x1={-8} y1={7} x2={8} y2={7} />
          <line x1={0} y1={7} x2={0} y2={-8} />
        </g>
      );
    case "parallelism":
      return (
        <g {...s}>
          <line x1={-7} y1={7} x2={-1} y2={-7} />
          <line x1={1} y1={7} x2={7} y2={-7} />
        </g>
      );
    case "angularity":
      return <path d="M8 7 L-8 7 L6 -7" {...s} />;
    case "position":
      return (
        <g {...s}>
          <circle r={5} />
          <line x1={-8.5} y1={0} x2={8.5} y2={0} />
          <line x1={0} y1={-8.5} x2={0} y2={8.5} />
        </g>
      );
    case "concentricity":
      return (
        <g {...s}>
          <circle r={7.5} />
          <circle r={3.6} />
        </g>
      );
    case "symmetry":
      return (
        <g {...s}>
          <line x1={-8} y1={0} x2={8} y2={0} />
          <line x1={-5} y1={-4.5} x2={5} y2={-4.5} />
          <line x1={-5} y1={4.5} x2={5} y2={4.5} />
        </g>
      );
    case "circular-runout":
      return (
        <g {...s}>
          <line x1={-5} y1={8} x2={4} y2={-6} />
          <path d="M0.5 -6.8 L5.5 -8.5 L5.3 -3.2" />
        </g>
      );
    case "total-runout":
      return (
        <g {...s}>
          <line x1={-8} y1={8} x2={6} y2={8} />
          <line x1={-7} y1={8} x2={-1} y2={-6} />
          <line x1={0} y1={8} x2={6} y2={-6} />
          <path d="M-4.5 -6.5 L-0.5 -8.5 L0 -4" />
          <path d="M2.5 -6.5 L6.5 -8.5 L7 -4" />
        </g>
      );
    default:
      return <text textAnchor="middle" dominantBaseline="central" fontSize={12} fill="currentColor">?</text>;
  }
}

/** A symbol on its own, for lists and headers. */
export function Symbol({ id, size = 22, title }) {
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <SymbolPath id={id} />
    </svg>
  );
}

const MOD_LETTER = { MMC: "M", LMC: "L" };

/** A circled M or L. */
function CircledLetter({ x, y, letter, r = 7.5 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.45} fill="currentColor" fontWeight={600}>
        {letter}
      </text>
    </g>
  );
}

/** Draw a laid-out frame at (x, y). `active` highlights a cell; `onCell` makes cells clickable. */
export function FrameSvg({ layout, x = 0, y = 0, active, onCell, className = "" }) {
  const { cells, h, symbol, dia, mod } = layout;
  return (
    <g transform={`translate(${x} ${y})`} className={`gd-fcf ${className}`}>
      {cells.map((c) => (
        <g
          key={c.key}
          className={`gd-fcf-cell ${active === c.key ? "is-active" : ""} ${onCell ? "is-click" : ""}`}
          onClick={onCell ? () => onCell(c.key) : undefined}
          role={onCell ? "button" : undefined}
          tabIndex={onCell ? 0 : undefined}
          onKeyDown={onCell ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onCell(c.key)) : undefined}
          aria-label={onCell ? cellLabel(c) : undefined}
        >
          <rect x={c.x} y={0} width={c.w} height={h} className="gd-fcf-box" />
          {c.key === "symbol" && (
            <g transform={`translate(${c.x + h / 2} ${h / 2}) scale(1.05)`}>
              <SymbolPath id={symbol} />
            </g>
          )}
          {c.key === "tol" && (
            <g>
              {dia && (
                <g transform={`translate(${c.x + 15} ${h / 2})`} className="gd-fcf-dia">
                  <circle r={6} fill="none" stroke="currentColor" strokeWidth={1.3} />
                  <line x1={-6} y1={7.5} x2={6} y2={-7.5} stroke="currentColor" strokeWidth={1.3} />
                </g>
              )}
              <text x={c.x + 9 + (dia ? 16 : 0)} y={h / 2 + 0.5} dominantBaseline="central" className="gd-fcf-text">
                {c.tolText}
              </text>
              {mod && mod !== "RFS" && <CircledLetter x={c.x + c.w - 15} y={h / 2} letter={MOD_LETTER[mod]} />}
            </g>
          )}
          {c.letter !== undefined && (
            <text x={c.dmod ? c.x + 13 : c.x + c.w / 2} y={h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" className="gd-fcf-text is-datum">
              {c.letter}
            </text>
          )}
          {c.dmod && <CircledLetter x={c.x + c.w - 13} y={h / 2} letter={c.dmod === "MMB" ? "M" : "L"} r={6.5} />}
        </g>
      ))}
    </g>
  );
}

function cellLabel(c) {
  if (c.key === "symbol") return "Geometric characteristic";
  if (c.key === "tol") return "Tolerance";
  return `Datum ${c.letter}${c.dmod ? ` at ${c.dmod}` : ""}`;
}

/** A frame in its own SVG, sized to fit. */
export function FrameBox({ scale = 1.6, pad = 2, ...props }) {
  const layout = frameCells(props);
  return (
    <svg
      className="gd-fcf-svg"
      width={(layout.w + pad * 2) * scale}
      height={(layout.h + pad * 2) * scale}
      viewBox={`${-pad} ${-pad} ${layout.w + pad * 2} ${layout.h + pad * 2}`}
      role="img"
      aria-label="Feature control frame"
    >
      <FrameSvg layout={layout} active={props.active} onCell={props.onCell} />
    </svg>
  );
}

/** The datum feature symbol: a filled triangle on the surface with a boxed letter. */
export function DatumFlag({ x, y, letter, dir = "down", len = 26 }) {
  // dir is where the box sits relative to the triangle's foot on the surface.
  const v = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[dir];
  const tip = 9;
  const bx = x + v[0] * (len + tip);
  const by = y + v[1] * (len + tip);
  const perp = [v[1], v[0]];
  return (
    <g className="gd-datum">
      <path d={`M${x + perp[0] * tip} ${y + perp[1] * tip} L${x - perp[0] * tip} ${y - perp[1] * tip} L${x + v[0] * tip} ${y + v[1] * tip} Z`} className="gd-datum-tri" />
      <line x1={x + v[0] * tip} y1={y + v[1] * tip} x2={bx} y2={by} className="gd-datum-line" />
      <rect x={bx - 13} y={by - 13} width={26} height={26} className="gd-datum-box" />
      <text x={bx} y={by + 0.5} textAnchor="middle" dominantBaseline="central" className="gd-datum-text">
        {letter}
      </text>
    </g>
  );
}

/** A boxed basic dimension value. */
export function Basic({ x, y, children }) {
  const text = String(children);
  const w = text.length * 9 + 14;
  return (
    <g className="gd-basic">
      <rect x={x - w / 2} y={y - 12} width={w} height={24} />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </g>
  );
}
