// What JumpFox puts on the PlanFox calendar: planned jump days at a DZ
// (opening the jump check for it), saved events and boogies, the jumps you
// logged each day, and when your reserve is due for a repack. PlanFox loads
// this module on demand (see src/app/planLinks.js) with JumpFox's saved data.
import { dzById } from "../data/dropzones.js";
import { normalizeData } from "../state/jumpStore.js";

export const dzHref = id => `/jump?dz=${encodeURIComponent(id)}`;
export const LOG_HREF = "/jump?tab=log";

const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** [{ id, day, time, title, detail, href, action, done }] for days in [fromDay, toDay]. */
export function planItems(raw, fromDay, toDay) {
  if (!raw) return [];
  const data = normalizeData(raw);
  const inRange = day => day >= fromDay && day <= toDay;
  const out = [];

  for (const p of data.plans) {
    if (!inRange(p.day)) continue;
    const dz = dzById[p.dzId];
    out.push({
      id: `plan:${p.id}`,
      day: p.day,
      time: null,
      title: dz ? `Jump at ${dz.name}` : "Jump day",
      detail: [p.note, "Check the winds and clouds before you drive out."].filter(Boolean).join(" "),
      href: dz ? dzHref(dz.id) : "/jump",
      action: "Check winds",
    });
  }

  for (const e of data.events) {
    if (!inRange(e.day)) continue;
    out.push({ id: `event:${e.id}`, day: e.day, time: null, title: e.name, detail: e.where, href: "/jump?tab=events", action: "Open" });
  }

  const byDay = {};
  for (const j of data.jumps) {
    if (!inRange(j.date)) continue;
    (byDay[j.date] ??= []).push(j);
  }
  for (const [day, jumps] of Object.entries(byDay)) {
    const places = [...new Set(jumps.map(j => j.dzName).filter(Boolean))];
    const nums = jumps.map(j => j.number).sort((a, b) => a - b);
    out.push({
      id: `log:${day}`,
      day,
      time: null,
      title: jumps.length === 1 ? `Jump #${nums[0]}` : `${jumps.length} jumps (#${nums[0]}–${nums[nums.length - 1]})`,
      detail: places.length ? `At ${places.join(", ")}` : "",
      href: LOG_HREF,
      action: "Logbook",
      done: true,
    });
  }

  if (data.reserveRepackedOn) {
    const due = addDays(data.reserveRepackedOn, 180);
    if (inRange(due)) out.push({ id: `repack:${due}`, day: due, time: null, title: "Reserve repack due", detail: `Packed ${data.reserveRepackedOn}. You can't jump the rig after today until a rigger repacks it.`, href: "/jump?tab=gear", action: "Open" });
  }
  return out;
}

/** Things in JumpFox a planner item can open. */
export function launchTargets(raw) {
  const base = [
    { id: "today", title: "Can I jump today?", href: "/jump" },
    { id: "log", title: "Logbook", href: LOG_HREF },
    { id: "dz", title: "Find a drop zone", href: "/jump?tab=places" },
    { id: "license", title: "USPA license path", href: "/jump?tab=license" },
  ];
  if (!raw) return base;
  const data = normalizeData(raw);
  const home = data.homeDz && dzById[data.homeDz];
  return home ? [...base, { id: `dz:${home.id}`, title: `Winds at ${home.name}`, href: dzHref(home.id) }] : base;
}
