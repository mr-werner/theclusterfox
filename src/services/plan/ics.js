// Calendar links (.ics / webcal): parsing and expanding repeats. Shared by
// /api/plan/feed (parsing) and the planner page (expanding into local days).

const MAX_EVENTS = 3000;

// Lines starting with a space or tab continue the previous line.
const unfold = text => text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");

const unescape = value =>
  value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();

function parseLine(line) {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params = Object.fromEntries(rawParams.map(p => p.split("=")).map(([k, v]) => [k.toUpperCase(), v ?? ""]));
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/**
 * A DTSTART/DTEND value. Dates with a trailing Z are UTC and come back as
 * an ISO string (utc) for the browser to place in its own time zone; the
 * rest are kept as written (day + time), which is right when the calendar
 * and the viewer share a time zone.
 */
export function parseIcsDate(value, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  const day = `${y}-${mo}-${d}`;
  if (params.VALUE === "DATE" || h === undefined) return { day, time: null, utc: null, allDay: true };
  if (z) return { day, time: `${h}:${mi}`, utc: `${day}T${h}:${mi}:00Z`, allDay: false };
  return { day, time: `${h}:${mi}`, utc: null, allDay: false };
}

function parseRule(value) {
  const parts = Object.fromEntries(value.split(";").map(p => p.split("=")));
  const freq = parts.FREQ?.toLowerCase();
  if (!["daily", "weekly", "monthly", "yearly"].includes(freq)) return null;
  const until = parts.UNTIL ? parseIcsDate(parts.UNTIL)?.day ?? null : null;
  return {
    freq,
    interval: Math.max(1, Number.parseInt(parts.INTERVAL, 10) || 1),
    count: parts.COUNT ? Math.max(1, Number.parseInt(parts.COUNT, 10) || 1) : null,
    until,
    byDay: parts.BYDAY ? parts.BYDAY.split(",").map(d => d.slice(-2)) : null,
  };
}

/** Parses VEVENTs: [{ uid, title, location, start, end, rule, exdates }]. */
export function parseIcs(text) {
  const events = [];
  let current = null;
  for (const line of unfold(String(text ?? ""))) {
    if (line === "BEGIN:VEVENT") {
      current = { exdates: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.start && current.status !== "CANCELLED") {
        events.push({
          uid: current.uid ?? `${current.start.day}-${events.length}`,
          title: current.title || "Untitled event",
          location: current.location ?? "",
          start: current.start,
          end: current.end ?? null,
          rule: current.rule ?? null,
          exdates: current.exdates,
        });
      }
      current = null;
      if (events.length >= MAX_EVENTS) break;
      continue;
    }
    if (!current) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "SUMMARY") current.title = unescape(prop.value).slice(0, 200);
    else if (prop.name === "LOCATION") current.location = unescape(prop.value).slice(0, 200);
    else if (prop.name === "UID") current.uid = prop.value.slice(0, 200);
    else if (prop.name === "STATUS") current.status = prop.value.toUpperCase();
    else if (prop.name === "DTSTART") current.start = parseIcsDate(prop.value, prop.params);
    else if (prop.name === "DTEND") current.end = parseIcsDate(prop.value, prop.params);
    else if (prop.name === "RRULE") current.rule = parseRule(prop.value);
    else if (prop.name === "EXDATE") {
      for (const v of prop.value.split(",")) {
        const date = parseIcsDate(v, prop.params);
        if (date) current.exdates.push(date.day);
      }
    }
  }
  return events;
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const pad = n => String(n).padStart(2, "0");
const keyOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateOf = key => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Where an event starts for this viewer: UTC times move into local time.
function localStart(start) {
  if (!start.utc) return { day: start.day, time: start.time };
  const date = new Date(start.utc);
  return { day: keyOf(date), time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}

/**
 * Event instances on days in [from, to]:
 * [{ id, uid, day, time, endTime, allDay, title, location }].
 */
export function expandIcs(events, from, to, limit = 2000) {
  const out = [];
  for (const event of events) {
    const first = localStart(event.start);
    const end = event.end ? localStart(event.end) : null;
    const base = {
      uid: event.uid,
      title: event.title,
      location: event.location,
      allDay: event.start.allDay,
      time: event.start.allDay ? null : first.time,
      endTime: !event.start.allDay && end && end.day === first.day ? end.time : null,
    };
    const push = day => {
      if (day >= from && day <= to && !event.exdates.includes(day)) out.push({ ...base, id: `${event.uid}@${day}`, day });
    };
    const rule = event.rule;
    if (!rule) {
      push(first.day);
      continue;
    }
    const startDate = dateOf(first.day);
    const stop = rule.until && rule.until < to ? rule.until : to;
    let made = 0;
    const take = date => {
      const key = keyOf(date);
      if (key < first.day) return true;
      if (key > stop || (rule.count && made >= rule.count)) return false;
      made += 1;
      push(key);
      return true;
    };
    for (let step = 0; step < 5000; step++) {
      let keepGoing = true;
      if (rule.freq === "daily") {
        keepGoing = take(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + step * rule.interval));
      } else if (rule.freq === "weekly") {
        const weekStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - startDate.getDay() + step * 7 * rule.interval);
        const days = rule.byDay?.length ? rule.byDay.map(d => WEEKDAYS.indexOf(d)).filter(d => d >= 0).sort() : [startDate.getDay()];
        for (const d of days) {
          keepGoing = take(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + d));
          if (!keepGoing) break;
        }
      } else if (rule.freq === "monthly") {
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + step * rule.interval, startDate.getDate());
        // Skip months without that date (the 31st in a 30-day month).
        keepGoing = date.getDate() === startDate.getDate() ? take(date) : keyOf(date) <= stop;
      } else {
        keepGoing = take(new Date(startDate.getFullYear() + step * rule.interval, startDate.getMonth(), startDate.getDate()));
      }
      if (!keepGoing || out.length >= limit) break;
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? ""));
}
