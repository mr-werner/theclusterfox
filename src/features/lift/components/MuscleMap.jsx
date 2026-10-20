import { useState } from "react";

import { BACK_SHAPES, BODY_HALF, FRONT_SHAPES, HEAD, muscleName, muscles, REGIONS } from "../data/muscles";

const MIRROR = "translate(200 0) scale(-1 1)";

function Body({ title, shapes, selected, hovered, onHover, onToggle }) {
  const drawn = side =>
    shapes.map(({ muscle, d }) => (
      <path
        key={`${side}-${muscle}`}
        d={d}
        className={`lm-muscle ${selected.includes(muscle) ? "is-on" : ""} ${hovered === muscle ? "is-hover" : ""}`}
        onClick={() => onToggle(muscle)}
        onMouseEnter={() => onHover(muscle)}
        onMouseLeave={() => onHover(null)}
      >
        <title>{muscleName(muscle)}</title>
      </path>
    ));

  return (
    <figure className="lm-body">
      <svg viewBox="0 -12 200 440" aria-hidden="true">
        <g className="lm-skin">
          <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
          {BODY_HALF.map((d, i) => <path key={i} d={d} />)}
          <g transform={MIRROR}>{BODY_HALF.map((d, i) => <path key={i} d={d} />)}</g>
        </g>
        {drawn("l")}
        <g transform={MIRROR}>{drawn("r")}</g>
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

/** A front and back body to tap muscles on, plus buttons for the same. */
export default function MuscleMap({ selected, onToggle, onSet }) {
  const [hovered, setHovered] = useState(null);
  const shared = { selected, hovered, onHover: setHovered, onToggle };

  return (
    <div className="lm-map">
      <div className="lm-figures">
        <Body title="Front" shapes={FRONT_SHAPES} {...shared} />
        <Body title="Back" shapes={BACK_SHAPES} {...shared} />
      </div>

      <div className="lm-picks">
        {REGIONS.map(region => {
          const ids = muscles.filter(m => m.region === region.id).map(m => m.id);
          const all = ids.every(id => selected.includes(id));
          return (
            <div key={region.id} className="lm-region">
              <button
                type="button"
                className="lm-region-name"
                onClick={() => onSet(all ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])])}
                title={all ? `Clear ${region.name.toLowerCase()}` : `Pick all ${region.name.toLowerCase()}`}
              >
                {region.name}
              </button>
              <div className="lm-chips">
                {ids.map(id => (
                  <button
                    key={id}
                    type="button"
                    className="lf-chip"
                    aria-pressed={selected.includes(id)}
                    onClick={() => onToggle(id)}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {muscleName(id)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
