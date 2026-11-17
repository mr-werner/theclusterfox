// Draws the view out of the windshield for the PilotFox simulator on a
// 2D canvas: sky, ground with farm fields, distant hills, runway 28 with
// its markings and PAPI lights. A small hand-rolled 3D projection keeps
// it light (no 3D library needed).

import { RUNWAY, fromRunway } from "./sim.js";

const D2R = Math.PI / 180;

/** Turn a world point into camera space: [right, forward, up]. */
function toCamera(p, cam) {
  const rx = p[0] - cam.x;
  const ry = p[1] - cam.y;
  const rz = p[2] - cam.z;
  // Yaw (heading, clockwise from north).
  const x1 = rx * cam.cy - ry * cam.sy;
  const y1 = rx * cam.sy + ry * cam.cy;
  // Pitch (nose up).
  const y2 = y1 * cam.cp + rz * cam.sp;
  const z2 = -y1 * cam.sp + rz * cam.cp;
  // Roll (right wing down).
  return [x1 * cam.cr - z2 * cam.sr, y2, x1 * cam.sr + z2 * cam.cr];
}

const NEAR = 0.5;

/** Clip a camera-space polygon to the near plane, then project it. */
function project(poly, cam) {
  const out = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ain = a[1] >= NEAR;
    const bin = b[1] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, NEAR, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out.map(p => [cam.cx + (cam.f * p[0]) / p[1], cam.cyScreen - (cam.f * p[2]) / p[1]]);
}

function fillPoly(ctx, world, cam, color) {
  const pts = project(world.map(p => toCamera(p, cam)), cam);
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const FIELD = 450; // m, size of a farm field
const FIELD_COLORS = ["#4f7a3a", "#5b8541", "#6d8c45", "#7a8a4a", "#58773c", "#8b8250", "#4a7036"];
const hash = (i, j) => {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

// Hills on the horizon in every direction, so heading changes are easy to see.
const HILLS = Array.from({ length: 22 }, (_, i) => {
  const bearing = (i / 22) * 2 * Math.PI + (hash(i, 7) % 100) / 400;
  const dist = 26000 + (hash(i, 3) % 9000);
  const width = 5000 + (hash(i, 5) % 6000);
  const height = 500 + (hash(i, 9) % 900) * (Math.abs(Math.sin(bearing + 1.2)) + 0.3);
  return { bearing, dist, width, height, color: i % 2 ? "#5d6f86" : "#6b7c92" };
});

function papiColors(s) {
  // PAPI on the left of runway 28, 300 m down from the threshold.
  const [px, py] = fromRunway(300, -RUNWAY.width / 2 - 15);
  const dist = Math.hypot(s.x - px, s.y - py);
  const angle = Math.atan2(s.h, dist) / D2R;
  // Lights from left to right switch to red below 3.5, 3.17, 2.83 and 2.5 degrees.
  return { pos: [px, py], colors: [3.5, 3.17, 2.83, 2.5].map(t => (angle >= t ? "#fff6e0" : "#ff3b30")) };
}

/** Draw one frame. s is the simulator state, w and h the canvas size in CSS pixels. */
export function drawView(ctx, s, w, h) {
  const pitch = s.gamma + s.alpha;
  const eye = 2.2;
  const cam = {
    x: s.x,
    y: s.y,
    z: s.h + eye,
    cy: Math.cos(s.psi),
    sy: Math.sin(s.psi),
    cp: Math.cos(pitch),
    sp: Math.sin(pitch),
    cr: Math.cos(s.phi),
    sr: Math.sin(s.phi),
    f: w / (2 * Math.tan(30 * D2R)),
    cx: w / 2,
    cyScreen: h * 0.42,
  };

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#2d6fc0");
  sky.addColorStop(0.55, "#8ec3ef");
  sky.addColorStop(1, "#cfe6f7");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Hills, then the ground in front of them.
  for (const hill of HILLS) {
    const cxw = s.x + Math.sin(hill.bearing) * hill.dist;
    const cyw = s.y + Math.cos(hill.bearing) * hill.dist;
    const px = Math.cos(hill.bearing) * hill.width;
    const py = -Math.sin(hill.bearing) * hill.width;
    fillPoly(ctx, [[cxw - px, cyw - py, -200], [cxw, cyw, hill.height], [cxw + px, cyw + py, -200]], cam, hill.color);
  }
  const far = 120000;
  fillPoly(ctx, [[s.x - far, s.y - far, 0], [s.x + far, s.y - far, 0], [s.x + far, s.y + far, 0], [s.x - far, s.y + far, 0]], cam, "#577a42");

  // Farm fields near the airplane (more of them the higher you are).
  const reach = Math.min(16, 6 + Math.floor(s.h / 250));
  const ci = Math.floor(s.x / FIELD);
  const cj = Math.floor(s.y / FIELD);
  for (let i = ci - reach; i <= ci + reach; i += 1) {
    for (let j = cj - reach; j <= cj + reach; j += 1) {
      const hsh = hash(i, j);
      const x0 = i * FIELD + 6;
      const y0 = j * FIELD + 6;
      const x1 = x0 + FIELD - 12;
      const y1 = y0 + FIELD - 12;
      fillPoly(ctx, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], cam, FIELD_COLORS[hsh % FIELD_COLORS.length]);
    }
  }

  // Runway 28 with a grass apron around it.
  const L = RUNWAY.length;
  const W = RUNWAY.width;
  const rw = (a, c) => [...fromRunway(a, c), 0.01];
  fillPoly(ctx, [rw(-60, -70), rw(L + 60, -70), rw(L + 60, 70), rw(-60, 70)], cam, "#6f9a4f");
  fillPoly(ctx, [rw(0, -W / 2), rw(L, -W / 2), rw(L, W / 2), rw(0, W / 2)], cam, "#3b3d42");
  // Threshold bars at both ends.
  for (const end of [0, L - 30]) {
    for (let k = -3; k <= 3; k += 1) {
      if (k === 0) continue;
      const c = k * 3.6;
      fillPoly(ctx, [rw(end + 6, c - 1.2), rw(end + 30, c - 1.2), rw(end + 30, c + 1.2), rw(end + 6, c + 1.2)], cam, "#f2f2f2");
    }
  }
  // Aiming point markers and centerline dashes.
  for (const end of [300, L - 350]) {
    for (const c of [-8, 8]) fillPoly(ctx, [rw(end, c - 2.5), rw(end + 50, c - 2.5), rw(end + 50, c + 2.5), rw(end, c + 2.5)], cam, "#f2f2f2");
  }
  for (let a = 50; a < L - 50; a += 60) fillPoly(ctx, [rw(a, -0.5), rw(a + 35, -0.5), rw(a + 35, 0.5), rw(a, 0.5)], cam, "#f2f2f2");

  // PAPI lights.
  const papi = papiColors(s);
  papi.colors.forEach((color, k) => {
    const [x, y] = fromRunway(300, -W / 2 - 15 - k * 9);
    const p = toCamera([x, y, 1], cam);
    if (p[1] < NEAR) return;
    const sx = cam.cx + (cam.f * p[0]) / p[1];
    const sy = cam.cyScreen - (cam.f * p[2]) / p[1];
    const r = Math.max(1.6, Math.min(6, 900 / p[1]));
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // The airplane's nose and glareshield.
  ctx.fillStyle = "#1a1d22";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.84);
  ctx.quadraticCurveTo(w * 0.5, h * 0.74, w, h * 0.84);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d9dde3";
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.8);
  ctx.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.64, h * 0.8);
  ctx.closePath();
  ctx.fill();
}

export { papiColors };
