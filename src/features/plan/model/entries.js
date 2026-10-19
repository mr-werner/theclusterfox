// Turns every layer into one list of calendar entries per day.

import { itemLayer } from "../state/planStore.js";
import { occurrences } from "./dates.js";

const timeOf = iso => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Personal items expanded into one instance per day they fall on. */
export function expandItems(items, from, to) {
  return items.flatMap(item =>
    occurrences(item, from, to).map(day => ({ ...item, itemId: item.id, id: `${item.id}@${day}`, day, done: item.done.includes(day) }))
  );
}

/**
 * Map of day → entries: { id, layer, title, time, detail, ... }, sorted
 * with all-day entries first, then by time.
 */
export function buildEntries({ layers, instances = [], holidays = [], games = [], movies = [], releases = [], feedEvents = [], teams = [] }) {
  const byDay = new Map();
  const add = entry => {
    if (!entry.day) return;
    if (!byDay.has(entry.day)) byDay.set(entry.day, []);
    byDay.get(entry.day).push(entry);
  };

  if (layers.holidays) {
    for (const h of holidays) add({ id: `h:${h.day}:${h.name}`, day: h.day, layer: "holidays", title: h.name, detail: h.note, closed: h.closed, minor: h.kind === "observance" });
  }
  for (const item of instances) {
    const layer = itemLayer(item.kind);
    if (!layers[layer]) continue;
    add({ id: item.id, day: item.day, layer, title: item.title, time: item.time, item, done: item.done });
  }
  if (layers.feeds) {
    for (const e of feedEvents) add({ id: e.id, day: e.day, layer: "feeds", title: e.title, time: e.time, detail: [e.feedName, e.location].filter(Boolean).join(" · ") });
  }
  if (layers.sports) {
    for (const g of games) {
      add({
        id: `g:${g.id}`,
        day: g.day,
        layer: "sports",
        title: `${g.away.short} at ${g.home.short}`,
        time: g.start ? timeOf(g.start) : null,
        detail: [g.venue, g.networks?.join(", ")].filter(Boolean).join(" · "),
        game: g,
        minor: teams.length ? !g.favorite : true,
      });
    }
  }
  if (layers.movies) {
    for (const m of movies) add({ id: `m:${m.id}`, day: m.day, layer: "movies", title: m.title, detail: m.release === "digital" ? "Digital release" : "In theaters", movie: m, minor: true });
  }
  if (layers.games) {
    for (const r of releases) add({ id: `r:${r.id}`, day: r.day, layer: "games", title: r.title, detail: r.platforms.join(", "), link: r.url, minor: true });
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time ?? "").localeCompare(b.time ?? "") || (a.minor ? 1 : 0) - (b.minor ? 1 : 0));
  }
  return byDay;
}
