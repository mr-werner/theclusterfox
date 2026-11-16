// Formatting helpers shared by FlyFox screens.
import { pad3 } from "../model/nav";

export const CATEGORY_TEXT = {
  VFR: "VFR — good to go visually",
  MVFR: "Marginal VFR — low clouds or haze",
  IFR: "IFR — instrument conditions",
  LIFR: "Low IFR — very low clouds or fog",
};

export const fmtAlt = ft => (ft === null || ft === undefined ? "—" : `${Math.round(ft).toLocaleString("en-US")} ft`);
export const fmtWind = (dir, kt, gust) => {
  if (kt === null || kt === undefined) return "—";
  if (kt < 1) return "Calm";
  const d = dir === "VRB" || dir === null ? "Variable" : `${pad3(dir)}°`;
  return `${d} at ${Math.round(kt)} kt${gust ? `, gusts ${Math.round(gust)}` : ""}`;
};
export const fmtVis = v => (v === null || v === undefined ? "—" : v >= 10 ? "10+ sm" : `${Math.round(v * 100) / 100} sm`);
export const fmtTime = (ms, opts = {}) => (ms ? new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...opts }) : "—");
export const zulu = ms => (ms ? `${new Date(ms).toISOString().slice(11, 16).replace(":", "")}Z` : "");
export const ago = ms => {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
};

