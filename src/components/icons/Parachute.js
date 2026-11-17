// A parachute in the lucide style (lucide has none), so it can sit next to
// the other app icons: same 24px grid, stroke and props. Plain
// createElement so apps.js still loads in Node tests.
import { createElement as h } from "react";

const PARTS = [
  ["path", { d: "M2 10a10 7 0 0 1 20 0" }],
  ["path", { d: "M2 10q2.5-2 5 0q2.5-2 5 0q2.5-2 5 0q2.5-2 5 0" }],
  ["path", { d: "M2 10l8.5 8" }],
  ["path", { d: "M22 10l-8.5 8" }],
  ["path", { d: "M12 10v8" }],
  ["circle", { cx: 12, cy: 19.5, r: 1.5 }],
];

export default function Parachute({ size = 24, strokeWidth = 2, color = "currentColor", className = "", ...rest }) {
  return h(
    "svg",
    { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className: `lucide lucide-parachute ${className}`, "aria-hidden": "true", ...rest },
    ...PARTS.map(([tag, props], i) => h(tag, { key: i, ...props }))
  );
}
