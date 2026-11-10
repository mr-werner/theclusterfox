import { cToF } from "../model/climate";

export const tempText = (c, units) => (units === "metric" ? `${Math.round(c)}°C` : `${Math.round(cToF(c))}°F`);
export const rainText = (mm, units) => (units === "metric" ? `${Math.round(mm)} mm` : `${(mm / 25.4).toFixed(1)} in`);
