// Active watches, warnings and advisories from the US National Weather
// Service (https://www.weather.gov/documentation/services-web-api). Free,
// keyless, and it allows browser requests. US locations only.

const pad = n => String(n).padStart(2, "0");
const localDay = iso => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TONES = { Extreme: "warn", Severe: "warn", Moderate: "caution", Minor: "info" };

/** [{ id, event, headline, severity, tone, from, to, area, text, instruction }] */
export function parseAlerts(body) {
  return (body?.features ?? [])
    .map(f => f.properties ?? {})
    .filter(p => p.event && p.status !== "Test" && p.messageType !== "Cancel")
    .map(p => {
      const start = p.onset || p.effective || p.sent;
      const end = p.ends || p.expires || start;
      return {
        id: p.id ?? `${p.event}-${start}`,
        event: p.event,
        headline: p.headline ?? p.event,
        severity: p.severity ?? "Unknown",
        tone: TONES[p.severity] ?? "info",
        from: start ? localDay(start) : null,
        to: end ? localDay(end) : null,
        starts: start ?? null,
        ends: end ?? null,
        area: p.areaDesc ?? "",
        text: (p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 600),
        instruction: (p.instruction ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
      };
    })
    .filter(a => a.from);
}

// Roughly the US, its territories excluded: the NWS only covers US points.
export const inUnitedStates = place =>
  Boolean(place) && place.latitude > 18 && place.latitude < 72 && place.longitude > -180 && place.longitude < -65;

export async function fetchAlerts(place, { signal } = {}) {
  const point = `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`;
  const response = await fetch(`https://api.weather.gov/alerts/active?point=${point}`, {
    signal,
    headers: { accept: "application/geo+json" },
  });
  if (!response.ok) throw new Error("Weather alerts aren't available right now.");
  return parseAlerts(await response.json());
}
