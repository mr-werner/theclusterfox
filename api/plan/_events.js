/* global process */
// Concerts, games, shows and family events near a point, from the
// Ticketmaster Discovery API (free key: developer.ticketmaster.com).

const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";
const MAX_DAYS = 62;
const SEGMENTS = { music: "Music", sports: "Sports", arts: "Arts & Theatre", family: "Family", other: "Miscellaneous" };
const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value);

// Ticketmaster takes a geohash for the search point.
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function geohash(latitude, longitude, precision = 9) {
  let lat = [-90, 90];
  let lon = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    const range = even ? lon : lat;
    const value = even ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;
    if (value >= mid) {
      ch = (ch << 1) | 1;
      range[0] = mid;
    } else {
      ch <<= 1;
      range[1] = mid;
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

const kindOf = segment => Object.keys(SEGMENTS).find(k => SEGMENTS[k] === segment) ?? "other";

export function parseEvents(body) {
  const seen = new Set();
  return (body?._embedded?.events ?? [])
    .filter(e => e.dates?.start?.localDate && e.dates?.status?.code !== "cancelled")
    .map(e => {
      const venue = e._embedded?.venues?.[0] ?? {};
      const c = e.classifications?.[0] ?? {};
      const price = (e.priceRanges ?? []).find(p => Number.isFinite(p.min));
      const image = (e.images ?? []).filter(i => i.ratio === "16_9" && i.width <= 640).sort((a, b) => b.width - a.width)[0];
      return {
        id: e.id,
        title: e.name,
        day: e.dates.start.localDate,
        time: e.dates.start.timeTBA || e.dates.start.noSpecificTime ? null : (e.dates.start.localTime ?? "").slice(0, 5) || null,
        kind: kindOf(c.segment?.name),
        genre: [c.genre?.name, c.subGenre?.name].find(g => g && g !== "Undefined" && g !== "Other") ?? "",
        venue: venue.name ?? "",
        city: venue.city?.name ?? "",
        distance: Number.isFinite(e.distance) ? Math.round(e.distance * 10) / 10 : null,
        price: price ? { min: price.min, max: price.max ?? price.min, currency: price.currency ?? "USD" } : null,
        status: e.dates?.status?.code ?? "onsale",
        url: e.url ?? null,
        image: image?.url ?? null,
        info: [e.info, e.pleaseNote].filter(Boolean).join("\n\n").slice(0, 1200),
        promoter: e.promoter?.name ?? "",
        seatmap: e.seatmap?.staticUrl ?? null,
        // A performer's own video channel, when Ticketmaster lists one.
        youtube: e._embedded?.attractions?.map(a => a.externalLinks?.youtube?.[0]?.url).find(Boolean) ?? null,
        onsale: e.sales?.public?.startDateTime ?? null,
      };
    })
    // The same show is often listed once per ticket type.
    .filter(e => {
      const key = `${e.title}|${e.day}|${e.time}|${e.venue}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.TICKETMASTER_API_KEY?.trim();
  if (!key) {
    return res.status(503).json({ error: "Nearby events aren't set up yet: the Ticketmaster key is missing.", code: "no-key" });
  }

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const radius = Math.min(100, Math.max(5, Math.round(Number(req.query.radius) || 25)));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: "A location is required." });
  }
  if (!isDay(from) || !isDay(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) {
    return res.status(400).json({ error: "Dates like from=2026-10-01&to=2026-10-31 are required." });
  }

  const params = new URLSearchParams({
    apikey: key,
    geoPoint: geohash(lat, lon),
    radius: String(radius),
    unit: "miles",
    // A day either side so local dates near midnight UTC aren't lost.
    startDateTime: `${new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10)}T00:00:00Z`,
    endDateTime: `${new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10)}T23:59:59Z`,
    size: "200",
    sort: "date,asc",
  });

  try {
    const page = async n => {
      const response = await fetch(`${BASE}?${params}&page=${n}`, { headers: { accept: "application/json" } });
      if (response.status === 401) throw Object.assign(new Error("bad key"), { status: 401 });
      if (!response.ok) throw new Error(`Ticketmaster request failed with status ${response.status}`);
      return response.json();
    };
    const first = await page(0);
    // Busy cities can have more than one page; a failed second page is skipped.
    const pages = [first, first?.page?.totalPages > 1 ? await page(1).catch(() => null) : null];
    const events = parseEvents({ _embedded: { events: pages.flatMap(p => p?._embedded?.events ?? []) } }).filter(e => e.day >= from && e.day <= to);
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ from, to, radius, events });
  } catch (error) {
    if (error.status === 401) {
      return res.status(503).json({ error: "Ticketmaster didn't accept the key. Check TICKETMASTER_API_KEY in Vercel.", code: "no-key" });
    }
    console.error("Nearby events error:", error);
    return res.status(502).json({ error: "Ticketmaster isn't responding. Try again in a moment." });
  }
}
