import { useEffect } from "react";

// Units, colours and the page title for the Design & Manufacturing pages.

export const DESIGN_HUE = "#ffb86b";

/** Length formatting in the person's unit system. Everything is stored in mm. */
export function lengthUnits(system) {
  const us = system === "us";
  return {
    us,
    unit: us ? "in" : "mm",
    /** Value only, as written in a frame (0.05 or 0.0020). */
    num: (mm) => (us ? (mm / 25.4).toFixed(4) : trimMm(mm)),
    /** Value with unit. */
    L: (mm) => (us ? `${(mm / 25.4).toFixed(4)} in` : `${trimMm(mm)} mm`),
    toDisp: (mm) => (us ? mm / 25.4 : mm),
    fromDisp: (v) => (us ? v * 25.4 : v),
    step: (mmStep) => (us ? Math.max(0.0001, Number((mmStep / 25.4).toPrecision(1))) : mmStep),
  };
}
function trimMm(mm) {
  const a = Math.abs(mm);
  const d = a !== 0 && a < 0.01 ? 4 : 3;
  let t = mm.toFixed(d);
  if (t.includes(".")) t = t.replace(/0+$/, "");
  if (/\.\d$/.test(t)) t += "0";
  if (t.endsWith(".")) t += "00";
  return t;
}

/** Set the tab title while a page is open. */
export function useTitle(title) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [title]);
}
