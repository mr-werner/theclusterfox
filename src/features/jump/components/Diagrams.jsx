// Small drawings for the skills: a skydiver seen from above (how you look
// from the camera flyer), side views for loops and landings, and simple
// charts for the canopy pattern and emergencies. Colors come from the
// JumpFox --jf-* variables so they read in the app's theme.

const POSES = {
  // [shoulder, elbow, hand], [hip, knee, foot] for the LEFT side; the right mirrors.
  box: { arm: [[-11, -26], [-33, -25], [-31, -48]], leg: [[-7, 12], [-19, 34], [-15, 56]] },
  forward: { arm: [[-11, -26], [-30, -16], [-35, -34]], leg: [[-7, 12], [-15, 42], [-12, 68]] },
  track: { arm: [[-11, -26], [-17, -6], [-16, 14]], leg: [[-5, 12], [-6, 42], [-5, 70]] },
};

function Body({ pose = "box", x = 0, y = 0, rotate = 0, scale = 1, right, className = "" }) {
  const p = POSES[pose];
  const mirror = pts => pts.map(([a, b]) => [-a, b]);
  const line = pts => pts.map(([a, b], i) => `${i ? "L" : "M"}${a} ${b}`).join(" ");
  const rightArm = right ?? mirror(p.arm);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} className={`jf-body ${className}`}>
      <path d={line(p.leg)} className="jf-limb" />
      <path d={line(mirror(p.leg))} className="jf-limb" />
      <path d={line(p.arm)} className="jf-limb" />
      <path d={line(rightArm)} className="jf-limb" />
      <rect x="-12" y="-30" width="24" height="44" rx="10" className="jf-torso" />
      <rect x="-9" y="-24" width="18" height="30" rx="5" className="jf-rig" />
      <circle cx="0" cy="-39" r="9" className="jf-head" />
    </g>
  );
}

// A skydiver from the side, belly down, facing right.
function Side({ x, y, rotate = 0, scale = 1, tuck }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} className="jf-body">
      {tuck ? (
        <>
          <path d="M-6 2 L-2 14 L8 12" className="jf-limb" />
          <path d="M8 -4 L14 6 L8 12" className="jf-limb" />
          <ellipse cx="0" cy="0" rx="12" ry="7" className="jf-torso" />
        </>
      ) : (
        <>
          <path d="M-12 0 L-24 -4 L-32 -14" className="jf-limb" />
          <path d="M10 -2 L18 -10 L26 -16" className="jf-limb" />
          <path d="M-12 0 Q0 7 12 0" className="jf-limb jf-torso-line" />
        </>
      )}
      <circle cx={tuck ? 15 : 17} cy={tuck ? -6 : 2} r="5.5" className="jf-head" />
    </g>
  );
}

const Defs = () => (
  <defs>
    <marker id="jf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" className="jf-arrowhead" />
    </marker>
  </defs>
);

function Label({ x, y, children, anchor = "start", strong }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={`jf-dlabel${strong ? " is-strong" : ""}`}>
      {children}
    </text>
  );
}

function Wind({ x, y, length = 60, angle = 90, label = "Wind" }) {
  const r = (angle * Math.PI) / 180;
  const x2 = x + length * Math.sin(r);
  const y2 = y - length * Math.cos(r);
  return (
    <g>
      <line x1={x} y1={y} x2={x2} y2={y2} className="jf-wind" markerEnd="url(#jf-arrow)" />
      <Label x={x} y={y - 8}>{label}</Label>
    </g>
  );
}

const DIAGRAMS = {
  box: () => (
    <>
      <Body pose="box" x={110} y={100} scale={1.25} />
      <Label x={190} y={50} strong>From above</Label>
      <Label x={190} y={70}>Arms 90° at the elbow</Label>
      <Label x={190} y={88}>Hands about head height</Label>
      <Label x={190} y={106}>Knees shoulder-width</Label>
      <Label x={190} y={124}>Hips pushed down</Label>
      <Label x={190} y={142}>Head up, eyes on horizon</Label>
      <g transform="translate(222 172)">
        <path d="M-26 -6 Q0 12 26 -6" className="jf-limb jf-torso-line" />
        <circle cx="30" cy="-8" r="4" className="jf-head" />
        <Label x={-30} y={18}>Side view: a banana, belly down</Label>
      </g>
    </>
  ),
  turn: () => (
    <>
      <Body pose="box" x={120} y={104} rotate={-25} scale={1.15} />
      <path d="M60 60 A80 80 0 0 0 70 160" className="jf-path" markerEnd="url(#jf-arrow)" />
      <Label x={20} y={40}>Turning left</Label>
      <Label x={196} y={60} strong>Look, then tilt</Label>
      <Label x={196} y={80}>Look where you're going</Label>
      <Label x={196} y={98}>Dip the left shoulder a little</Label>
      <Label x={196} y={116}>Hips and legs stay in the box</Label>
      <Label x={196} y={134}>Stop with a small counter</Label>
      <Label x={196} y={152}>move before your heading</Label>
    </>
  ),
  forward: () => (
    <>
      <Body pose="forward" x={110} y={110} scale={1.15} />
      <line x1="110" y1="44" x2="110" y2="14" className="jf-path" markerEnd="url(#jf-arrow)" />
      <Label x={120} y={26}>You move this way</Label>
      <Label x={196} y={80} strong>Legs out, arms back</Label>
      <Label x={196} y={100}>Extend both legs</Label>
      <Label x={196} y={118}>Sweep arms slightly back</Label>
      <Label x={196} y={136}>Keep the arch</Label>
    </>
  ),
  track: () => (
    <>
      <Body pose="track" x={90} y={104} scale={1.15} />
      <line x1="90" y1="38" x2="90" y2="8" className="jf-path" markerEnd="url(#jf-arrow)" />
      <Label x={100} y={20}>Away from the group</Label>
      <Label x={170} y={70} strong>Long and flat</Label>
      <Label x={170} y={90}>Legs straight, toes pointed</Label>
      <Label x={170} y={108}>Arms by your sides, palms down</Label>
      <Label x={170} y={126}>Shoulders rolled slightly forward</Label>
      <Label x={170} y={144}>Turn 180° first, then go</Label>
    </>
  ),
  pull: () => (
    <>
      <Body pose="box" x={70} y={110} scale={0.95} right={[[11, -26], [30, -40], [24, -62]]} />
      <path d="M-11 -26 L-30 -40 L-24 -62" transform="translate(70 110) scale(0.95)" className="jf-limb" />
      <Label x={36} y={28}>1. Wave off</Label>
      <Body pose="box" x={210} y={110} scale={0.95} right={[[11, -26], [24, -4], [8, 18]]} />
      <path d="M-11 -26 L-22 -46 L-6 -64" transform="translate(210 110) scale(0.95)" className="jf-limb jf-accent" />
      <circle cx="217" cy="127" r="5" className="jf-pc" />
      <Label x={168} y={28}>2. Reach, grab, throw</Label>
      <Label x={168} y={186}>Left hand over your head for balance</Label>
      <Label x={20} y={186}>Both arms, clear and big</Label>
    </>
  ),
  backloop: () => <Loop backward />,
  frontloop: () => <Loop />,
  barrel: () => (
    <>
      <ellipse cx="120" cy="100" rx="70" ry="30" className="jf-path" />
      <path d="M190 100 A70 30 0 0 1 120 130" className="jf-path" markerEnd="url(#jf-arrow)" />
      <Body pose="box" x={120} y={70} scale={0.6} />
      <g transform="translate(120 132) scale(0.6)">
        <rect x="-12" y="-30" width="24" height="44" rx="10" className="jf-torso is-back" />
        <circle cx="0" cy="-39" r="9" className="jf-head" />
      </g>
      <Label x={60} y={176}>Roll onto your back and over</Label>
      <Label x={214} y={74} strong>Barrel roll</Label>
      <Label x={214} y={94}>Tuck one arm in</Label>
      <Label x={214} y={112}>Push the other out</Label>
      <Label x={214} y={130}>Arch hard to finish</Label>
    </>
  ),
  canopycheck: () => (
    <>
      <path d="M50 60 Q160 20 270 60 L262 78 Q160 44 58 78 Z" className="jf-canopy" />
      {[70, 100, 130, 160, 190, 220, 250].map(x => (
        <line key={x} x1={x} y1={x === 70 || x === 250 ? 74 : 64} x2={160 + (x - 160) * 0.08} y2="150" className="jf-line" />
      ))}
      <rect x="146" y="112" width="28" height="8" className="jf-slider" />
      <circle cx="160" cy="160" r="8" className="jf-head" />
      <Label x={160} y={16} anchor="middle" strong>Look up: is it there, square, and flying straight?</Label>
      <Label x={14} y={102}>End cells open</Label>
      <Label x={186} y={118}>Slider down</Label>
      <Label x={196} y={150}>Lines clear, no twists</Label>
      <Label x={14} y={186}>Then: brakes off, turn left, turn right, practice flare</Label>
    </>
  ),
  pattern: () => (
    <>
      <Wind x={250} y={26} length={70} angle={90} label="Wind blows this way" />
      <circle cx="62" cy="62" r="20" className="jf-path is-dash" />
      <Label x={36} y={34}>Holding area</Label>
      <rect x="44" y="134" width="36" height="36" rx="4" className="jf-target" />
      <Label x={62} y={190} anchor="middle">Target</Label>
      <path d="M84 62 L236 62" className="jf-path" markerEnd="url(#jf-arrow)" />
      <path d="M248 62 L248 140" className="jf-path" markerEnd="url(#jf-arrow)" />
      <path d="M240 152 L92 152" className="jf-path is-final" markerEnd="url(#jf-arrow)" />
      <Label x={96} y={54}>Downwind leg, about 1,000 ft</Label>
      <Label x={256} y={104}>Base, about 600 ft</Label>
      <Label x={100} y={144}>Final from at least 300 ft</Label>
      <Label x={100} y={170}>Land into the wind</Label>
    </>
  ),
  flare: () => (
    <>
      <line x1="10" y1="176" x2="310" y2="176" className="jf-ground" />
      {[
        { x: 40, y: 50, toggles: 0, label: "Full flight" },
        { x: 140, y: 110, toggles: 0.5, label: "Start the flare ~2× your height" },
        { x: 230, y: 160, toggles: 1, label: "Finish all the way" },
      ].map(s => (
        <g key={s.x} transform={`translate(${s.x} ${s.y})`}>
          <path d="M-30 -40 Q0 -54 30 -40" className="jf-canopy-line" />
          <line x1="-28" y1="-40" x2="-4" y2="-6" className="jf-line" />
          <line x1="28" y1="-40" x2="4" y2="-6" className="jf-line" />
          <circle cx="0" cy="-6" r="5" className="jf-head" />
          <line x1="0" y1="0" x2="0" y2="14" className="jf-limb" />
          <line x1="-2" y1="2" x2="-9" y2={-8 + s.toggles * 18} className="jf-limb jf-accent" />
          <line x1="2" y1="2" x2="9" y2={-8 + s.toggles * 18} className="jf-limb jf-accent" />
        </g>
      ))}
      <path d="M60 40 Q160 110 218 152" className="jf-path is-dash" />
      <Label x={80} y={46}>Full flight</Label>
      <Label x={176} y={92}>Start the flare at about</Label>
      <Label x={176} y={106}>twice your height</Label>
      <Label x={264} y={142}>Finish to</Label>
      <Label x={264} y={156}>your hips</Label>
      <Label x={14} y={196}>Eyes on the horizon, feet and knees together</Label>
    </>
  ),
  plf: () => (
    <>
      <line x1="10" y1="170" x2="310" y2="170" className="jf-ground" />
      {["Balls of the feet", "Side of the calf", "Side of the thigh", "Hip / buttock", "Back of the shoulder"].map((t, i) => (
        <g key={t}>
          <circle cx={56 + i * 62} cy={150} r="13" className="jf-step" />
          <text x={56 + i * 62} y={155} textAnchor="middle" className="jf-step-n">{i + 1}</text>
          <Label x={56 + i * 62} y={i % 2 ? 128 : 112} anchor="middle">{t}</Label>
        </g>
      ))}
      <path d="M40 92 Q160 40 280 92" className="jf-path" markerEnd="url(#jf-arrow)" />
      <Label x={160} y={34} anchor="middle" strong>Roll along the side, in this order</Label>
      <Label x={160} y={196} anchor="middle">Feet and knees together, chin tucked, elbows in</Label>
    </>
  ),
  altitudes: () => (
    <>
      <rect x="40" y="16" width="26" height="168" rx="6" className="jf-alt-bar" />
      {[
        { y: 22, label: "Exit (often 13,500 ft)", cls: "is-exit" },
        { y: 70, label: "Freefall: check every few seconds", cls: "" },
        { y: 104, label: "Breakoff: turn and track", cls: "is-warn" },
        { y: 128, label: "Wave off and pull", cls: "is-pull" },
        { y: 150, label: "Decision altitude: deal with a problem by here", cls: "is-no" },
        { y: 176, label: "Canopy pattern from about 1,000 ft", cls: "" },
      ].map(b => (
        <g key={b.y}>
          <line x1="34" y1={b.y} x2="74" y2={b.y} className={`jf-alt-tick ${b.cls}`} />
          <Label x={84} y={b.y + 4}>{b.label}</Label>
        </g>
      ))}
      <Label x={84} y={196}>Exact numbers: your instructor and the SIM</Label>
    </>
  ),
  malfunction: () => (
    <>
      {[
        { x: 10, y: 20, w: 92, t: "Check", s: "Square? Steerable?" },
        { x: 114, y: 20, w: 92, t: "Fix", s: "Only above decision alt" },
        { x: 218, y: 20, w: 92, t: "Act", s: "Your trained procedure" },
      ].map(b => (
        <g key={b.t}>
          <rect x={b.x} y={b.y} width={b.w} height="54" rx="10" className="jf-flow" />
          <text x={b.x + b.w / 2} y={b.y + 23} textAnchor="middle" className="jf-dlabel is-strong">{b.t}</text>
          <text x={b.x + b.w / 2} y={b.y + 41} textAnchor="middle" className="jf-dlabel is-small">{b.s}</text>
        </g>
      ))}
      <line x1="102" y1="47" x2="112" y2="47" className="jf-path" markerEnd="url(#jf-arrow)" />
      <line x1="206" y1="47" x2="216" y2="47" className="jf-path" markerEnd="url(#jf-arrow)" />
      <rect x="10" y="100" width="300" height="80" rx="10" className="jf-flow is-act" />
      <Label x={24} y={124} strong>Most rigs: Look · Grab · Peel · Pull · Pull</Label>
      <Label x={24} y={146}>Look at both handles, grab them, peel the cutaway,</Label>
      <Label x={24} y={164}>pull it, then pull the reserve and arch.</Label>
    </>
  ),
};

function Loop({ backward }) {
  const figs = [0, 90, 180, 270];
  return (
    <>
      <circle cx="110" cy="100" r="58" className="jf-path is-dash" />
      <path d={backward ? "M168 100 A58 58 0 0 0 110 42" : "M52 100 A58 58 0 0 1 110 42"} className="jf-path" markerEnd="url(#jf-arrow)" />
      {figs.map(a => {
        const r = (a * Math.PI) / 180;
        return <Side key={a} x={110 + 58 * Math.sin(r)} y={100 - 58 * Math.cos(r)} rotate={backward ? -a : a} scale={0.8} tuck={a === 90 || a === 180} />;
      })}
      <Label x={196} y={66} strong>{backward ? "Backloop" : "Front loop"}</Label>
      <Label x={196} y={86}>{backward ? "Knees to chest" : "Arms back to hips"}</Label>
      <Label x={196} y={104}>{backward ? "Hands up by your head" : "Tuck and duck the head"}</Label>
      <Label x={196} y={122}>Arch when you see</Label>
      <Label x={196} y={140}>the ground again</Label>
      <Label x={20} y={188}>Seen from the side</Label>
    </>
  );
}

export default function Diagram({ id, title }) {
  const Draw = DIAGRAMS[id];
  if (!Draw) return null;
  return (
    <svg className="jf-diagram" viewBox="0 0 360 200" role="img" aria-label={title}>
      <Defs />
      <Draw />
    </svg>
  );
}
