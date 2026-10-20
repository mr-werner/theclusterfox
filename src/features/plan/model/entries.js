// Turns every layer into one list of calendar entries per day.

import { itemLayer } from "../state/planStore.js";
import { dayRange, occurrences, shortDate } from "./dates.js";
import { airlineName, cheapestByDay } from "./trips.js";

export const money = (amount, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount);

export const cityName = place => place.name.replace(/\s*\([A-Z]{3}\)$/, "");

/**
 * Cheap days for each destination: fares within 15% of the cheapest one
 * found that month (and at most the five lowest) are called out.
 */
export function markCheapFares(fares) {
  const byTrip = new Map();
  for (const f of fares) {
    const key = `${f.from.code}>${f.to.code}|${f.day.slice(0, 7)}`;
    if (!byTrip.has(key)) byTrip.set(key, []);
    byTrip.get(key).push(f);
  }
  const out = [];
  for (const list of byTrip.values()) {
    const sorted = [...list].sort((a, b) => a.price - b.price);
    const low = sorted[0].price;
    const cheap = new Set(sorted.filter(f => f.price <= low * 1.15).slice(0, 5));
    for (const f of list) out.push({ ...f, cheap: cheap.has(f), cheapest: f.price === low });
  }
  return out;
}

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
export function buildEntries({ layers, from, to, alerts = [], sessions = [], instances = [], holidays = [], games = [], movies = [], releases = [], feedEvents = [], teams = [], nearbyEvents = [], trips = [] }) {
  const byDay = new Map();
  const add = entry => {
    if (!entry.day) return;
    if (!byDay.has(entry.day)) byDay.set(entry.day, []);
    byDay.get(entry.day).push(entry);
  };

  if (layers.holidays) {
    for (const h of holidays) add({ id: `h:${h.day}:${h.name}`, day: h.day, layer: "holidays", title: h.name, detail: h.note, closed: h.closed, minor: h.kind === "observance" });
  }
  if (layers.alerts && from && to) {
    for (const a of alerts) {
      const start = a.from < from ? from : a.from;
      const end = (a.to ?? a.from) > to ? to : a.to ?? a.from;
      if (start > end) continue;
      for (const day of dayRange(start, end)) add({ id: `a:${a.id}:${day}`, day, layer: "alerts", title: a.event, detail: a.headline, alert: a });
    }
  }
  if (layers.training) {
    for (const s of sessions) add({ id: `p:${s.id}`, day: s.day, layer: "training", title: s.title, session: s, done: s.done });
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
    for (const r of releases) add({ id: `r:${r.id}`, day: r.day, layer: "games", title: r.title, detail: r.platforms.join(", "), link: r.url, release: r, minor: true });
  }

  if (layers.nearby) {
    for (const e of nearbyEvents) {
      add({
        id: `n:${e.id}`,
        day: e.day,
        layer: "nearby",
        title: e.title,
        time: e.time,
        detail: [e.venue, e.distance != null && `${e.distance} mi`, e.price && `from ${money(e.price.min, e.price.currency)}`, e.status === "offsale" && "sold out"].filter(Boolean).join(" · "),
        link: e.url,
        nearby: e,
        minor: true,
      });
    }
  }
  if (layers.flights) {
    for (const { trip, out, back, suggestions } of trips) {
      // One-way fares: → there, ← back. Cheap days get a pill.
      for (const [arrow, list] of [["→", out], ["←", back]]) {
        for (const f of markCheapFares([...cheapestByDay(list, trip).values()])) {
          add({
            id: `f:${f.from.code}>${f.to.code}:${f.day}`,
            day: f.day,
            layer: "flights",
            title: `${arrow} ${cityName(f.to)} ${money(f.price, f.currency)}`,
            detail: [
              `${f.from.code} to ${f.to.code}`,
              airlineName(f.airline),
              f.transfers === 0 ? "nonstop" : f.transfers ? `${f.transfers} stop${f.transfers > 1 ? "s" : ""}` : null,
              f.cheapest ? "cheapest this month" : f.cheap ? "one of the cheapest days" : null,
            ]
              .filter(Boolean)
              .join(" · "),
            link: f.link,
            fare: f,
            minor: !f.cheap,
          });
        }
      }
      // The best trips: a pill on the day you'd leave and the day you'd come back.
      for (const s of suggestions) {
        add({
          id: `t:${trip.code}:${s.rank}`,
          day: s.depart,
          layer: "flights",
          title: `Trip ${s.rank}: ${cityName(trip)} ${money(s.total, s.out.currency)}`,
          detail: `Round trip, back ${shortDate(s.back)} · ${s.nights} night${s.nights === 1 ? "" : "s"} · ${money(s.out.price, s.out.currency)} there, ${money(s.ret.price, s.ret.currency)} back`,
          suggestion: { ...s, trip },
          minor: s.rank > 3,
        });
        add({
          id: `t:${trip.code}:${s.rank}:back`,
          day: s.back,
          layer: "flights",
          title: `Trip ${s.rank} home from ${cityName(trip)}`,
          detail: `Left ${shortDate(s.depart)} · ${money(s.total, s.out.currency)} round trip`,
          suggestion: { ...s, trip },
          minor: true,
        });
      }
    }
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time ?? "").localeCompare(b.time ?? "") || (a.minor ? 1 : 0) - (b.minor ? 1 : 0));
  }
  return byDay;
}
