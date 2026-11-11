import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { DatumFlag, FrameSvg, Basic } from "./Frame";
import { BAR, HOLE, PIN, bump, runoutRadius, sag, wave } from "./gdtModel";

// Simplified drawings for each callout. Every drawing shows the part, the
// tolerance zone (green when the part passes, red when it fails) and the actual
// feature in orange. Form errors are hugely exaggerated so they can be seen;
// the numbers in the readouts are the real ones.

const W = 640;
const H = 380;
const pts = (list) => list.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
const samples = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
const zoneClass = (ok) => `gd-zone ${ok ? "" : "is-bad"}`;

function Sheet({ children, label, h = H, note = "Errors exaggerated so you can see them" }) {
  return (
    <svg className="gd-sheet" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label}>
      {children}
      {note && (
        <text x={W - 12} y={h - 10} textAnchor="end" className="gd-note">
          {note}
        </text>
      )}
    </svg>
  );
}

/** The frame with a leader to the feature. */
function Callout({ layout, x, y, to, scale = 1.25 }) {
  const fw = layout.w * scale;
  const fh = layout.h * scale;
  const from = [to[0] < x ? x : to[0] > x + fw ? x + fw : to[0], to[1] < y ? y : y + fh];
  return (
    <g>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} className="gd-leader" markerEnd="url(#gd-arrow)" />
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <FrameSvg layout={layout} />
      </g>
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="gd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="gd-arrowhead" />
      </marker>
      <pattern id="gd-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" className="gd-hatch-line" />
      </pattern>
    </defs>
  );
}

function Label({ x, y, children, anchor = "start", className = "" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={`gd-label ${className}`}>
      {children}
    </text>
  );
}

function DimV({ x, y1, y2, label, side = "left" }) {
  const mid = (y1 + y2) / 2;
  return (
    <g className="gd-dimline">
      <line x1={x} y1={y1} x2={x} y2={y2} markerStart="url(#gd-arrow)" markerEnd="url(#gd-arrow)" />
      <text x={side === "left" ? x - 8 : x + 8} y={mid} textAnchor={side === "left" ? "end" : "start"} dominantBaseline="central" className="gd-label">
        {label}
      </text>
    </g>
  );
}

// Form -------------------------------------------------------------------------

function Flatness({ s, r, layout }) {
  const K = 260, x0 = 110, x1 = 530, yT = 175, yB = 300;
  const X = (u) => x0 + u * (x1 - x0);
  const dev = (u) => s.tilt * (u - 0.5) + wave(u, s.wave, 2.25);
  const top = samples(160, (u) => [X(u), yT - K * dev(u)]);
  const mid = (u) => s.tilt * (u - 0.5);
  const ext = 0.04;
  const zTop = samples(2, (k) => { const u = -ext + k * (1 + 2 * ext); return [X(u), yT - K * (mid(u) + s.tol / 2)]; });
  const zBot = samples(2, (k) => { const u = 1 + ext - k * (1 + 2 * ext); return [X(u), yT - K * (mid(u) - s.tol / 2)]; });
  return (
    <Sheet label="Flatness: side view of a block with its top face inside a floating zone">
      <Defs />
      <line x1={x0 - 30} x2={x1 + 30} y1={yT - K * 0.1} y2={yT - K * 0.1} className="gd-limit" />
      <line x1={x0 - 30} x2={x1 + 30} y1={yT + K * 0.1} y2={yT + K * 0.1} className="gd-limit" />
      <Label x={x1 + 34} y={yT - K * 0.1 + 4} className="is-dim">max 20.1</Label>
      <Label x={x1 + 34} y={yT + K * 0.1 + 4} className="is-dim">min 19.9</Label>
      <path d={`${pts([[x0, yB], ...top, [x1, yB]])} Z`} className="gd-part" />
      <path d={`${pts([...zTop, ...zBot])} Z`} className={zoneClass(r.checks[0].ok)} />
      <path d={pts(top)} className="gd-actual" />
      <DimV x={70} y1={yT} y2={yB} label="20 ±0.1" />
      <Callout layout={layout} x={250} y={40} to={[X(0.62), yT - K * dev(0.62) - 4]} />
      <Label x={x0} y={yB + 30}>Zone tilts with the face: only the waviness has to fit</Label>
    </Sheet>
  );
}

function Straightness(props) {
  return props.s.mode === "line" ? <StraightnessLine {...props} /> : <StraightnessAxis {...props} />;
}

/** Surface line: a flat bar seen from the side. Its size is a thickness, so nothing here carries ⌀. */
function StraightnessLine({ s, r, layout }) {
  const K = 300, x0 = 100, x1 = 520, yB = 300, t0 = 120;
  const X = (u) => x0 + u * (x1 - x0);
  const th = t0 + K * (s.size - BAR.nominal);
  const yTopNom = yB - th;
  const bowAt = (u) => K * s.bow * sag(u);
  const top = samples(160, (u) => [X(u), yTopNom - bowAt(u) - K * wave(u, s.wave, 3)]);
  const bot = samples(160, (u) => [X(1 - u), yB - bowAt(1 - u)]);
  const devs = samples(160, (u) => s.bow * sag(u) + wave(u, s.wave, 3));
  const mid = (Math.min(...devs) + Math.max(...devs)) / 2;
  const zone = r.checks[0];
  const envTop = yB - (t0 + K * (BAR.mmc - BAR.nominal));
  const lowest = Math.max(...bot.map((p) => p[1]));
  return (
    <Sheet label="Straightness of a surface line: side view of a flat bar">
      <Defs />
      <line x1={x0 - 24} x2={x1 + 24} y1={envTop - (yB - lowest)} y2={envTop - (yB - lowest)} className="gd-envelope" />
      <line x1={x0 - 24} x2={x1 + 24} y1={lowest} y2={lowest} className="gd-envelope" />
      <Label x={x1 + 28} y={envTop - (yB - lowest) + 4} className="is-dim">plate</Label>
      <Label x={x1 + 28} y={lowest + 4} className="is-dim">plate</Label>
      <path d={`${pts([...top, ...bot])} Z`} className="gd-part" />
      <rect x={x0 - 16} width={x1 - x0 + 32} y={yTopNom - K * (mid + s.tol / 2)} height={K * s.tol} className={zoneClass(zone.ok)} />
      <path d={pts(top)} className="gd-actual" />
      <DimV x={62} y1={yTopNom} y2={yB} label={BAR.label} />
      <Callout layout={layout} x={280} y={26} to={[X(0.35), yTopNom - bowAt(0.35) - 4]} />
      <Label x={x0} y={lowest + 30} className="is-dim">Rule #1: perfect form at MMC, two flat plates 10.1 apart</Label>
      <Label x={x0} y={lowest + 52} className="is-dim">No ⌀ anywhere: the zone is a flat band along the top face</Label>
    </Sheet>
  );
}

function StraightnessAxis({ s, r, layout }) {
  const K = 300, x0 = 100, x1 = 520, cy = 205, r0 = 68;
  const X = (u) => x0 + u * (x1 - x0);
  const rA = r0 + (K * (s.size - PIN.nominal)) / 2;
  const axisY = (u) => cy - K * s.bow * sag(u);
  const top = samples(160, (u) => [X(u), axisY(u) - rA]);
  const bot = samples(160, (u) => [X(1 - u), axisY(1 - u) + rA]);
  const zone = r.checks[0];
  const allowed = r.main.allowed;
  const yMid = cy - (K * s.bow) / 2;
  const env = r.vc ? r0 + (K * (r.vc - PIN.nominal)) / 2 : null;
  return (
    <Sheet label="Straightness of an axis: side view of a pin">
      <Defs />
      {env && (
        <g>
          <rect x={x0 - 10} width={x1 - x0 + 20} y={cy - env} height={env * 2} className="gd-envelope" />
          <Label x={x0 - 6} y={cy + env + 24} className="is-dim">{`Virtual condition ⌀${r.vc.toFixed(2)} (gauge sleeve)`}</Label>
        </g>
      )}
      <path d={`${pts([...top, ...bot])} Z`} className="gd-part" />
      <line x1={x0 - 24} x2={x1 + 24} y1={cy} y2={cy} className="gd-center" />
      <g>
        <rect x={x0 - 16} width={x1 - x0 + 32} y={yMid - (K * allowed) / 2} height={K * allowed} className={zoneClass(zone.ok)} />
        {r.main.bonus > 0 && <rect x={x0 - 16} width={x1 - x0 + 32} y={yMid - (K * s.tol) / 2} height={K * s.tol} className="gd-zone-base" />}
      </g>
      <path d={pts(samples(80, (u) => [X(u), axisY(u)]))} className="gd-actual" />
      <Label x={x1 + 30} y={cy - 40} className="is-strong">{PIN.label}</Label>
      <Callout layout={layout} x={x1 - 170} y={cy + r0 + 60} to={[X(0.8), axisY(0.8) + rA + 4]} />
    </Sheet>
  );
}

function Circularity({ s, r, layout }) {
  const K = 600, cx = 330, cy = 188, R = 118;
  const n = Number(s.lobes) || 3;
  const prof = samples(240, (u) => {
    const t = u * 2 * Math.PI;
    const rr = R + K * s.amp * Math.cos(n * t);
    return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)];
  });
  const ro = R + (K * s.tol) / 2;
  const ri = Math.max(2, R - (K * s.tol) / 2);
  const twoPoint = n % 2 ? 0 : 4 * s.amp;
  return (
    <Sheet label="Circularity: cross-section of a shaft between two concentric circles">
      <Defs />
      <circle cx={cx} cy={cy} r={R} className="gd-nominal" />
      <path d={`${pts(prof)} Z`} className="gd-part" />
      <path d={`M${cx + ro} ${cy} A${ro} ${ro} 0 1 0 ${cx - ro} ${cy} A${ro} ${ro} 0 1 0 ${cx + ro} ${cy} Z M${cx + ri} ${cy} A${ri} ${ri} 0 1 1 ${cx - ri} ${cy} A${ri} ${ri} 0 1 1 ${cx + ri} ${cy} Z`} className={zoneClass(r.ok)} fillRule="evenodd" />
      <path d={`${pts(prof)} Z`} className="gd-actual" />
      <line x1={cx - 10} x2={cx + 10} y1={cy} y2={cy} className="gd-center" />
      <line y1={cy - 10} y2={cy + 10} x1={cx} x2={cx} className="gd-center" />
      <Callout layout={layout} x={24} y={30} to={[cx - (R + K * s.amp) * Math.cos(Math.PI / 4), cy - (R + K * s.amp) * Math.sin(Math.PI / 4)]} />
      <Label x={cx} y={cy + R + 42} anchor="middle">Section A–A · each slice is checked on its own</Label>
      <Label x={W - 16} y={40} anchor="end" className="is-dim">Micrometer (2-point) width varies by</Label>
      <Label x={W - 16} y={62} anchor="end" className="is-strong">{twoPoint.toFixed(3)} mm</Label>
      {n % 2 === 1 && s.amp > 0 && (
        <Label x={W - 16} y={84} anchor="end" className="is-warn">Odd lobes fool a micrometer</Label>
      )}
    </Sheet>
  );
}

function Cylindricity({ s, r, layout }) {
  const K = 500, x0 = 60, x1 = 370, cy = 205, R = 78;
  const X = (u) => x0 + u * (x1 - x0);
  const axis = (u) => cy - K * s.bow * sag(u);
  const rad = (u) => R + K * (s.taper / 2) * (0.5 - u) + K * s.amp;
  const top = samples(120, (u) => [X(u), axis(u) - rad(u)]);
  const bot = samples(120, (u) => [X(1 - u), axis(1 - u) + rad(1 - u)]);
  const fitAxis = cy - (K * s.bow) / 2;
  const half = (K * s.tol) / 2;
  const cx = 520;
  const prof = samples(200, (u) => {
    const t = u * 2 * Math.PI;
    const rr = R + K * s.amp * Math.cos(3 * t);
    return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)];
  });
  const ro = R + half, ri = Math.max(2, R - half);
  return (
    <Sheet label="Cylindricity: side view and end view of a shaft">
      <Defs />
      <path d={`${pts([...top, ...bot])} Z`} className="gd-part" />
      <rect x={x0 - 12} width={x1 - x0 + 24} y={fitAxis - R - half} height={half * 2} className={zoneClass(r.ok)} />
      <rect x={x0 - 12} width={x1 - x0 + 24} y={fitAxis + R - half} height={half * 2} className={zoneClass(r.ok)} />
      <path d={pts(top)} className="gd-actual" />
      <path d={pts(bot)} className="gd-actual" />
      <line x1={x0 - 24} x2={x1 + 24} y1={fitAxis} y2={fitAxis} className="gd-center" />
      <path d={`${pts(prof)} Z`} className="gd-part" />
      <path d={`M${cx + ro} ${cy} A${ro} ${ro} 0 1 0 ${cx - ro} ${cy} A${ro} ${ro} 0 1 0 ${cx + ro} ${cy} Z M${cx + ri} ${cy} A${ri} ${ri} 0 1 1 ${cx - ri} ${cy} A${ri} ${ri} 0 1 1 ${cx + ri} ${cy} Z`} className={zoneClass(r.ok)} fillRule="evenodd" />
      <path d={`${pts(prof)} Z`} className="gd-actual" />
      <Label x={(x0 + x1) / 2} y={cy + R + 62} anchor="middle">Side: taper and bend</Label>
      <Label x={cx} y={cy + R + 62} anchor="middle">End: out-of-round</Label>
      <Callout layout={layout} x={110} y={24} to={[X(0.3), axis(0.3) - rad(0.3) - 4]} />
    </Sheet>
  );
}

// Profile ---------------------------------------------------------------------

function Profile({ s, r, layout }) {
  const K = 300, x0 = 110, x1 = 530, yB = 305;
  const X = (u) => x0 + u * (x1 - x0);
  const Y = (u) => 215 - 85 * Math.sin(Math.PI * u);
  const normal = (u) => {
    const du = 0.001;
    const dx = X(u + du) - X(u - du), dy = Y(u + du) - Y(u - du);
    const l = Math.hypot(dx, dy);
    return [dy / l, -dx / l];
  };
  const at = (u, d) => { const n = normal(u); return [X(u) + n[0] * K * d, Y(u) + n[1] * K * d]; };
  const dev = (u) => s.shift + s.tilt * (u - 0.5) + s.bump * bump(u);
  const lockShift = r.lockShift, lockTilt = r.lockTilt;
  const rem = samples(120, (u) => dev(u) - (lockTilt ? 0 : s.tilt * (u - 0.5)));
  const mid = (Math.min(...rem) + Math.max(...rem)) / 2;
  const zc = (u) => (lockTilt ? 0 : s.tilt * (u - 0.5)) + (lockShift ? 0 : mid);
  const actual = samples(160, (u) => at(u, dev(u)));
  const zTop = samples(120, (u) => at(u, zc(u) + s.tol / 2));
  const zBot = samples(120, (u) => at(1 - u, zc(1 - u) - s.tol / 2));
  const nominal = samples(120, (u) => [X(u), Y(u)]);
  return (
    <Sheet label="Profile: a curved surface inside a band around its true shape">
      <Defs />
      <path d={`${pts([[x0, yB], ...actual, [x1, yB]])} Z`} className="gd-part" />
      <path d={`${pts([...zTop, ...zBot])} Z`} className={zoneClass(r.ok)} />
      <path d={pts(nominal)} className="gd-nominal" />
      <path d={pts(actual)} className="gd-actual" />
      <DatumFlag x={X(0.7)} y={yB} letter="A" dir="down" len={14} />
      <DatumFlag x={x0} y={yB - 30} letter="B" dir="left" len={22} />
      <Callout layout={layout} x={240} y={24} to={at(0.28, dev(0.28) + 0.01)} />
      <Label x={x1 + 8} y={Y(1) - 18} anchor="end" className="is-dim">dashed = true profile (basic)</Label>
      <Label x={x0 + 10} y={yB + 32}>{lockShift ? "Zone fixed to A: height, tilt and shape count" : lockTilt ? "Zone held square by B, slides up and down" : "No datums: zone floats to fit the part"}</Label>
    </Sheet>
  );
}

// Orientation ------------------------------------------------------------------

function Perpendicularity({ s, r, layout }) {
  const K = 300, x0 = 150, x1 = 420, yB = 305, yT = 95;
  const Y = (v) => yB - v * (yB - yT);
  if (s.mode === "axis") {
    const cxp = 285;
    const rH = 40 + (K * (s.size - HOLE.nominal)) / 2;
    const ax = (v) => cxp + K * s.lean * v;
    const allowed = r.main.allowed;
    const midX = cxp + (K * s.lean) / 2;
    return (
      <Sheet label="Perpendicularity of a hole: section through a block">
        <Defs />
        <rect x={x0} y={yT} width={x1 - x0} height={yB - yT} className="gd-part" />
        <rect x={x0} y={yT} width={x1 - x0} height={yB - yT} fill="url(#gd-hatch)" />
        <path d={`${pts([[ax(0) - rH, yB], [ax(1) - rH, yT], [ax(1) + rH, yT], [ax(0) + rH, yB]])} Z`} className="gd-cut" />
        <rect x={midX - (K * allowed) / 2} y={yT - 26} width={K * allowed} height={yB - yT + 52} className={zoneClass(r.checks[0].ok)} />
        {r.main.bonus > 0 && <rect x={midX - (K * s.tol) / 2} y={yT - 26} width={K * s.tol} height={yB - yT + 52} className="gd-zone-base" />}
        <line x1={ax(-0.1)} y1={Y(-0.1)} x2={ax(1.1)} y2={Y(1.1)} className="gd-actual" />
        <DatumFlag x={x0 + 50} y={yB} letter={s.datums[0] || "A"} dir="down" len={12} />
        <Label x={x1 + 14} y={yT + 14} className="is-strong">{HOLE.label}</Label>
        <Callout layout={layout} x={x1 + 14} y={yT + 30} to={[ax(0.85) + rH + 2, Y(0.85)]} />
        <Label x={x0} y={yB + 62} className="is-dim">Zone stands at 90° to A; it can sit anywhere left or right</Label>
      </Sheet>
    );
  }
  const dev = (v) => s.lean * v + wave(v, s.wave, 2);
  const face = samples(120, (v) => [x1 + K * dev(v), Y(v)]);
  const devs = samples(120, dev);
  const mid = (Math.min(...devs) + Math.max(...devs)) / 2;
  return (
    <Sheet label="Perpendicularity of a face: side view of a block">
      <Defs />
      <path d={`${pts([[x0, yB], [x0, yT], ...face.slice().reverse(), [x1 + K * dev(0), yB]])} Z`} className="gd-part" />
      <rect x={x1 + K * (mid - s.tol / 2)} y={yT - 26} width={K * s.tol} height={yB - yT + 26} className={zoneClass(r.ok)} />
      <path d={pts(face)} className="gd-actual" />
      <path d={`M${x1 - 18} ${yB} L${x1 - 18} ${yB - 18} L${x1} ${yB - 18}`} className="gd-square" />
      <DatumFlag x={x0 + 70} y={yB} letter={s.datums[0] || "A"} dir="down" len={12} />
      <Callout layout={layout} x={x1 + 40} y={yT + 40} to={[x1 + K * dev(0.7) + 3, Y(0.7)]} scale={1.15} />
      <Label x={x0} y={yB + 62} className="is-dim">Zone is square to A; it may slide sideways</Label>
    </Sheet>
  );
}

function Parallelism({ s, r, layout }) {
  const K = 260, x0 = 110, x1 = 530, yT = 175, yB = 300;
  const X = (u) => x0 + u * (x1 - x0);
  const dev = (u) => s.tilt * (u - 0.5) + wave(u, s.wave, 2.25);
  const top = samples(160, (u) => [X(u), yT - K * dev(u)]);
  const devs = samples(160, dev);
  const mid = (Math.min(...devs) + Math.max(...devs)) / 2;
  return (
    <Sheet label="Parallelism: side view of a block on datum A">
      <Defs />
      <path d={`${pts([[x0, yB], ...top, [x1, yB]])} Z`} className="gd-part" />
      <rect x={x0 - 20} width={x1 - x0 + 40} y={yT - K * (mid + s.tol / 2)} height={K * s.tol} className={zoneClass(r.ok)} />
      <path d={pts(top)} className="gd-actual" />
      <rect x={x0 - 40} y={yB} width={x1 - x0 + 80} height={14} className="gd-plate" />
      <Label x={x1 + 40} y={yB + 32} anchor="end" className="is-dim">surface plate</Label>
      <DatumFlag x={x0 + 60} y={yB + 14} letter={s.datums[0] || "A"} dir="down" len={10} />
      <Callout layout={layout} x={250} y={40} to={[X(0.62), yT - K * dev(0.62) - 4]} />
      <Label x={x0} y={yB + 72}>Zone stays parallel to A: tilt and waviness both count</Label>
    </Sheet>
  );
}

function Angularity({ s, r, layout }) {
  const K = 300, yB = 300, x0 = 130;
  const th = (s.angle * Math.PI) / 180;
  const P1 = [520, yB];
  const F = 230;
  const d = [-Math.cos(th), -Math.sin(th)];
  const n = [Math.sin(th), -Math.cos(th)];
  const P2 = [P1[0] + d[0] * F, P1[1] + d[1] * F];
  const errLen = 30 * Math.sin((s.err * Math.PI) / 180);
  const dev = (t) => errLen * (t - 0.5) + wave(t, s.wave, 2);
  const on = (t, dd) => [P1[0] + d[0] * F * t + n[0] * K * dd, P1[1] + d[1] * F * t + n[1] * K * dd];
  const face = samples(120, (t) => on(t, dev(t)));
  const devs = samples(120, dev);
  const mid = (Math.min(...devs) + Math.max(...devs)) / 2;
  const zone = [on(-0.06, mid + s.tol / 2), on(1.06, mid + s.tol / 2), on(1.06, mid - s.tol / 2), on(-0.06, mid - s.tol / 2)];
  const arcR = 70;
  const a1 = [P1[0] - arcR, P1[1]];
  const a2 = [P1[0] + d[0] * arcR, P1[1] + d[1] * arcR];
  const lab = [P1[0] - (arcR + 34) * Math.cos(th / 2), P1[1] - (arcR + 34) * Math.sin(th / 2)];
  return (
    <Sheet label="Angularity: an inclined face at a basic angle to datum A">
      <Defs />
      <path d={`${pts([[x0, yB], [face[0][0], yB], ...face, [x0, face[face.length - 1][1]]])} Z`} className="gd-part" />
      <path d={`${pts(zone)} Z`} className={zoneClass(r.ok)} />
      <path d={pts(face)} className="gd-actual" />
      <path d={`M${a1[0]} ${a1[1]} A${arcR} ${arcR} 0 0 1 ${a2[0]} ${a2[1]}`} className="gd-dimarc" />
      <Basic x={lab[0]} y={lab[1]}>{`${s.angle}°`}</Basic>
      <DatumFlag x={x0 + 60} y={yB} letter={s.datums[0] || "A"} dir="down" len={12} />
      <Callout layout={layout} x={Math.min(P2[0] + 40, W - layout.w * 1.25 - 10)} y={24} to={on(0.6, dev(0.6) + 0.01)} />
      <Label x={x0} y={yB + 62} className="is-dim">Zone sits at exactly {s.angle}° to A, the tolerance wide</Label>
    </Sheet>
  );
}

// Location ------------------------------------------------------------------------

function Position({ s, r, layout }) {
  const x0 = 50, y0 = 92, pw = 300, ph = 200, mm = pw / 60;
  const hx = x0 + 30 * mm, hy = y0 + ph - 20 * mm;
  const Kp = 110;
  const useX = s.datums.includes("B"), useY = s.datums.includes("C");
  const ax = hx + Kp * s.dx, ay = hy - Kp * s.dy;
  const hr = 5 * mm + ((s.size - HOLE.nominal) / 2) * Kp;
  const zx = 505, zy = 205, Kz = 420;
  const allowed = r.main.allowed, base = s.tol;
  const ok = r.checks[0].ok;
  const zr = (Kz * allowed) / 2, br = (Kz * base) / 2;
  const dot = [zx + Kz * s.dx, zy - Kz * s.dy];
  let zone;
  if (!useX && !useY) zone = null;
  else if (!useX) zone = <rect x={zx - 140} y={zy - zr} width={280} height={zr * 2} className={zoneClass(ok)} />;
  else if (!useY) zone = <rect x={zx - zr} y={zy - 140} width={zr * 2} height={280} className={zoneClass(ok)} />;
  else if (s.dia) zone = <circle cx={zx} cy={zy} r={zr} className={zoneClass(ok)} />;
  else zone = <rect x={zx - zr} y={zy - zr} width={zr * 2} height={zr * 2} className={zoneClass(ok)} />;
  const baseZone = r.main.bonus > 0 && useX && useY ? (s.dia ? <circle cx={zx} cy={zy} r={br} className="gd-zone-base" /> : <rect x={zx - br} y={zy - br} width={br * 2} height={br * 2} className="gd-zone-base" />) : null;
  return (
    <Sheet label="Position: a hole located from datums B and C, with a zoomed view of the tolerance zone" h={400}>
      <Defs />
      <rect x={x0} y={y0} width={pw} height={ph} className="gd-part" />
      <line x1={hx - 40} x2={hx + 40} y1={hy} y2={hy} className="gd-center" />
      <line y1={hy - 40} y2={hy + 40} x1={hx} x2={hx} className="gd-center" />
      <circle cx={ax} cy={ay} r={hr} className="gd-cut" />
      <circle cx={ax} cy={ay} r={hr} className="gd-actual" />
      <g className="gd-dimline">
        <line x1={x0} y1={y0 + ph + 34} x2={hx} y2={y0 + ph + 34} markerStart="url(#gd-arrow)" markerEnd="url(#gd-arrow)" />
        <line x1={hx} y1={hy + 44} x2={hx} y2={y0 + ph + 42} className="gd-ext" />
        <line x1={x0 - 30} y1={hy} x2={x0} y2={hy} markerStart="url(#gd-arrow)" markerEnd="url(#gd-arrow)" className="gd-hide" />
        <line x1={x0 - 34} y1={y0 + ph} x2={x0 - 34} y2={hy} markerStart="url(#gd-arrow)" markerEnd="url(#gd-arrow)" />
        <line x1={x0 - 42} y1={hy} x2={hx - 44} y2={hy} className="gd-ext" />
      </g>
      <Basic x={(x0 + hx) / 2} y={y0 + ph + 34}>30</Basic>
      <Basic x={x0 - 34} y={(y0 + ph + hy) / 2}>20</Basic>
      <DatumFlag x={x0} y={y0 + 40} letter="B" dir="left" len={8} />
      <DatumFlag x={x0 + pw - 50} y={y0 + ph} letter="C" dir="down" len={10} />
      <g className="gd-datum">
        <rect x={x0 + pw - 46} y={y0 + 10} width={36} height={22} className="gd-datum-box" />
        <text x={x0 + pw - 28} y={y0 + 21.5} textAnchor="middle" dominantBaseline="central" className="gd-datum-text">A</text>
      </g>
      <Label x={x0 + pw - 52} y={y0 + 26} anchor="end" className="is-dim">face =</Label>
      <Label x={x0} y={22} className="is-strong">{HOLE.label}</Label>
      <Callout layout={layout} x={x0} y={30} to={[ax + hr * 0.7, ay - hr * 0.7]} scale={1.15} />

      <rect x={zx - 140} y={zy - 140} width={280} height={280} className="gd-zoom" />
      <Label x={zx - 132} y={zy - 148} className="is-dim">Zoom at true position</Label>
      <clipPath id="gd-zoomclip">
        <rect x={zx - 140} y={zy - 140} width={280} height={280} />
      </clipPath>
      <g clipPath="url(#gd-zoomclip)">
        {zone}
        {baseZone}
      </g>
      <line x1={zx - 130} x2={zx + 130} y1={zy} y2={zy} className="gd-center" />
      <line y1={zy - 130} y2={zy + 130} x1={zx} x2={zx} className="gd-center" />
      <line x1={zx} y1={zy} x2={dot[0]} y2={dot[1]} className="gd-offset" />
      <circle cx={Math.max(zx - 136, Math.min(zx + 136, dot[0]))} cy={Math.max(zy - 136, Math.min(zy + 136, dot[1]))} r={6} className={`gd-dot ${ok ? "" : "is-bad"}`} />
      {!useX && !useY && <Label x={zx} y={zy + 60} anchor="middle" className="is-warn">No zone: nothing locates the hole</Label>}
      {r.main.bonus > 0 && useX && useY && <Label x={zx + 132} y={zy + 132} anchor="end" className="is-dim">dashed = without bonus</Label>}
      <Label x={zx} y={zy + 168} anchor="middle" className="is-dim">dot = actual hole centre</Label>
    </Sheet>
  );
}

function Concentricity({ s, r, layout }) {
  const K = 300, cy = 205;
  const off = K * s.e;
  return (
    <Sheet label="Concentricity: a stepped shaft with the small diameter off-centre">
      <Defs />
      <rect x={80} y={cy - 95} width={220} height={190} className="gd-part" />
      <rect x={300} y={cy - 55 - off} width={250} height={110} className="gd-part" />
      <rect x={290} y={cy - (K * s.tol) / 2} width={276} height={K * s.tol} className={zoneClass(r.ok)} />
      <line x1={60} x2={590} y1={cy} y2={cy} className="gd-center" />
      <line x1={300} x2={566} y1={cy - off} y2={cy - off} className="gd-actual" />
      <DatumFlag x={190} y={cy + 95} letter={s.datums[0] || "A"} dir="down" len={12} />
      <Label x={80} y={cy + 160} className="is-dim">Datum axis A comes from the big diameter</Label>
      <Callout layout={layout} x={330} y={36} to={[470, cy - 55 - off - 3]} />
    </Sheet>
  );
}

function Symmetry({ s, r, layout }) {
  const K = 300, x0 = 140, x1 = 500, yT = 110, yB = 290, sw = 90, sd = 110;
  const c = 320 + K * s.e;
  return (
    <Sheet label="Symmetry: a slot that should be centred in a block">
      <Defs />
      <path d={`M${x0} ${yB} L${x0} ${yT} L${c - sw / 2} ${yT} L${c - sw / 2} ${yT + sd} L${c + sw / 2} ${yT + sd} L${c + sw / 2} ${yT} L${x1} ${yT} L${x1} ${yB} Z`} className="gd-part" />
      <rect x={320 - (K * s.tol) / 2} y={yT - 20} width={K * s.tol} height={sd + 30} className={zoneClass(r.ok)} />
      <line x1={320} x2={320} y1={yT - 40} y2={yB + 20} className="gd-center" />
      <line x1={c} x2={c} y1={yT - 14} y2={yT + sd + 8} className="gd-actual" />
      <g className="gd-dimline">
        <line x1={x0} y1={yB + 34} x2={x1} y2={yB + 34} markerStart="url(#gd-arrow)" markerEnd="url(#gd-arrow)" />
      </g>
      <Label x={(x0 + x1) / 2 + 60} y={yB + 28} className="is-dim">40</Label>
      <DatumFlag x={(x0 + x1) / 2} y={yB + 34} letter={s.datums[0] || "A"} dir="down" len={6} />
      <Callout layout={layout} x={360} y={26} to={[c + sw / 2 + 2, yT + 40]} />
      <Label x={x0} y={yB + 80} className="is-dim">Datum A = centre plane of the 40 width</Label>
    </Sheet>
  );
}

// Runout --------------------------------------------------------------------------

function Runout({ s, r, layout, total }) {
  const K = 600, x0 = 70, x1 = 360, cy = 215, R = 68;
  const X = (u) => x0 + u * (x1 - x0);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(!reduced);
  const [angle, setAngle] = useState(0);
  const [station, setStation] = useState(0.5);
  const raf = useRef(0);
  const t0 = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      t0.current += dt;
      setAngle((a) => (a + dt * 2.2) % (2 * Math.PI));
      if (total) setStation(0.5 - 0.5 * Math.cos(t0.current * 0.35));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, total]);

  const reading = runoutRadius(s, station, -angle - Math.PI / 2);
  // The needle's full swing over one turn at this section (or, for total runout, the whole surface).
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 180; i++) {
    const v = runoutRadius(s, station, (i / 180) * 2 * Math.PI);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }

  const axis = (u) => cy - K * s.bow * sag(u) * Math.cos(angle) * 0.5;
  const rad = (u) => R + K * (s.taper / 2) * (u - 0.5);
  const top = samples(80, (u) => [X(u), axis(u) - rad(u) - K * s.e * Math.cos(angle) * 0.5]);
  const bot = samples(80, (u) => [X(1 - u), axis(1 - u) + rad(1 - u) - K * s.e * Math.cos(angle) * 0.5]);
  const ix = X(station);
  const iy = top[Math.round(station * 80)][1];

  const cx = 520, ecy = 225;
  const sect = samples(200, (u) => {
    const t = u * 2 * Math.PI;
    const rr = R + K * runoutRadius(s, station, t - angle);
    return [cx + rr * Math.cos(t), ecy + rr * Math.sin(t)];
  });
  const markR = R + K * runoutRadius(s, station, 0) - 12;
  const mark = [cx + markR * Math.cos(angle), ecy + markR * Math.sin(angle)];
  const topR = R + K * reading;
  const gx = cx, gy = 52, gr = 34;
  const needle = Math.max(-1, Math.min(1, reading / Math.max(s.tol, 0.01))) * 2.4;
  const zo = R + (K * s.tol) / 2;
  const fim = total ? r.main.measured : hi - lo;

  return (
    <div className="gd-runout">
      <Sheet label={`${total ? "Total" : "Circular"} runout: a shaft spinning on its datum axis with a dial indicator`}>
        <Defs />
        <path d={`M${x0 - 34} ${cy - 14} L${x0} ${cy} L${x0 - 34} ${cy + 14} Z`} className="gd-centerpoint" />
        <path d={`M${x1 + 34} ${cy - 14} L${x1} ${cy} L${x1 + 34} ${cy + 14} Z`} className="gd-centerpoint" />
        <path d={`${pts([...top, ...bot])} Z`} className="gd-part" />
        <line x1={x0 - 40} x2={x1 + 40} y1={cy} y2={cy} className="gd-center" />
        <Label x={x0 - 40} y={cy + R + 46} className="is-dim">Datum axis {s.datums[0] || "A"} (centres)</Label>
        <line x1={ix} y1={iy - 40} x2={ix} y2={iy} className="gd-stem" />
        <rect x={ix - 14} y={iy - 70} width={28} height={30} className="gd-indicator" />
        {total && <line x1={x0} x2={x1} y1={iy - 84} y2={iy - 84} className="gd-sweep" markerStart="url(#gd-arrow)" markerEnd="url(#gd-arrow)" />}
        <Callout layout={layout} x={x0} y={18} to={[X(0.2), top[16][1] - 4]} scale={1.1} />

        <circle cx={cx} cy={ecy} r={zo} className="gd-zone-ring" />
        <circle cx={cx} cy={ecy} r={Math.max(2, R - (K * s.tol) / 2)} className="gd-zone-ring" />
        <path d={`${pts(sect)} Z`} className="gd-part" />
        <path d={`${pts(sect)} Z`} className="gd-actual" />
        <circle cx={mark[0]} cy={mark[1]} r={5} className="gd-mark" />
        <circle cx={cx} cy={ecy} r={3} className="gd-axisdot" />
        <line x1={gx} y1={gy + gr} x2={cx} y2={ecy - topR} className="gd-stem" />
        <circle cx={gx} cy={gy} r={gr} className="gd-gauge" />
        {[-2.4, -1.2, 0, 1.2, 2.4].map((a) => (
          <line key={a} x1={gx + Math.sin(a) * (gr - 4)} y1={gy - Math.cos(a) * (gr - 4)} x2={gx + Math.sin(a) * (gr - 10)} y2={gy - Math.cos(a) * (gr - 10)} className="gd-tick" />
        ))}
        <line x1={gx} y1={gy} x2={gx + Math.sin(needle) * (gr - 6)} y2={gy - Math.cos(needle) * (gr - 6)} className="gd-needle" />
        <Label x={gx - gr - 10} y={gy - 6} anchor="end" className="is-dim">{total ? "total swing" : "swing, this section"}</Label>
        <Label x={gx - gr - 10} y={gy + 16} anchor="end" className={fim <= s.tol + 1e-9 ? "is-ok" : "is-warn"}>{fim.toFixed(3)} mm</Label>
        <Label x={cx} y={ecy + R + 50} anchor="middle" className="is-dim">Section under the dial, turning</Label>
      </Sheet>
      <div className="gd-runout-tools">
        <button type="button" className="tf-chip" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {playing ? "Pause" : "Spin"}
        </button>
        {!playing && (
          <label className="gd-inline-range">
            Turn
            <input type="range" min={0} max={359} value={Math.round((angle * 180) / Math.PI)} onChange={(e) => setAngle((Number(e.target.value) * Math.PI) / 180)} />
          </label>
        )}
        {!total && (
          <label className="gd-inline-range">
            Dial along shaft
            <input type="range" min={0} max={100} value={Math.round(station * 100)} onChange={(e) => setStation(Number(e.target.value) / 100)} />
          </label>
        )}
      </div>
    </div>
  );
}

const DRAW = {
  flatness: Flatness,
  straightness: Straightness,
  circularity: Circularity,
  cylindricity: Cylindricity,
  "profile-line": Profile,
  "profile-surface": Profile,
  perpendicularity: Perpendicularity,
  parallelism: Parallelism,
  angularity: Angularity,
  position: Position,
  concentricity: Concentricity,
  symmetry: Symmetry,
  "circular-runout": (p) => <Runout {...p} total={false} />,
  "total-runout": (p) => <Runout {...p} total />,
};

export default function CalloutDiagram({ id, ...props }) {
  const Draw = DRAW[id];
  return Draw ? <Draw {...props} /> : null;
}
