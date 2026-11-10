// What to actually buy at the store for an amount an ingredient's recipes need.
import { packages } from "../data/packages.js";

// A package within this share of the need still counts (a 14-oz block of tofu
// covers a recipe that calls for 400 g).
const SLACK = 0.05;
const MAX_EACH = 12;

// The smallest set of standard packages that covers `amount`: least total
// bought first, then fewest packages. Mixes up to three sizes, so 1.25 lb of
// butter is a 1-lb box plus a stick rather than two boxes.
export function bestPackages(sizes, amount) {
  const need = amount * (1 - SLACK);
  let best = null;
  const visit = (i, picked, total, count) => {
    if (total >= need) {
      if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && count < best.count)) best = { picked: [...picked], total, count };
      return;
    }
    if (i >= sizes.length) return;
    const s = sizes[i];
    const most = Math.min(MAX_EACH, Math.ceil((need - total) / s.amount));
    for (let n = most; n >= 0; n--) {
      if (n) picked.push({ ...s, count: n });
      visit(i + 1, picked, total + n * s.amount, count + n);
      if (n) picked.pop();
    }
  };
  visit(0, [], 0, 0);
  return best;
}

const packText = p => `${p.count} × ${p.label}`;

// { text, total, packs, named } describing what to buy, or null when the amount is
// best shown as is (meat or produce sold by weight with no standard pack).
export function buyFor(item, amount) {
  if (!item || !(amount > 0)) return null;
  const sizes = packages[item.id];
  if (sizes?.length) {
    const best = bestPackages(sizes, amount);
    if (!best) return null;
    const packs = [...best.picked].sort((a, b) => b.amount - a.amount);
    return { text: packs.map(packText).join(" + "), total: best.total, packs };
  }
  if (item.unit === "each") {
    const n = Math.max(1, Math.ceil(amount - SLACK));
    return { text: `${n} ${n === 1 ? item.name : item.plural ?? item.name}`, total: n, packs: [], named: true };
  }
  return null;
}

// How much will be left over after the recipes, as a share of what's bought.
export const leftoverShare = (buy, amount) => (buy && buy.total > 0 ? Math.max(0, buy.total - amount) / buy.total : 0);
