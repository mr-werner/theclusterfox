// Open-Meteo: free, keyless weather and place search (https://open-meteo.com).
// Called straight from the browser; both APIs allow cross-origin requests.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "uv_index",
  "is_day",
  "shortwave_radiation",
  "direct_normal_irradiance",
  "diffuse_radiation",
];

export async function searchPlaces(query, { signal } = {}) {
  const params = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
  const response = await fetch(`${GEOCODE_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("Place search isn't responding. Try again in a moment.");
  const body = await response.json();
  return (body.results ?? []).map(result => ({
    id: String(result.id),
    name: result.name,
    region: [result.admin1, result.country_code === "US" ? null : result.country].filter(Boolean).join(", "),
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

/**
 * Hourly forecast for the next three days. Each hour has:
 * time (Date), localHour, localDay, temp °C, apparent °C, rh %, wind m/s,
 * gust m/s, precipProb %, precip mm, code (WMO), uv, isDay, global,
 * directNormal, diffuse (W/m²).
 */
export async function fetchForecast({ latitude, longitude }, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: HOURLY.join(","),
    wind_speed_unit: "ms",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "3",
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("The weather service isn't responding. Try again in a moment.");
  return parseForecast(await response.json());
}

export function parseForecast(body) {
  const h = body.hourly;
  const offset = body.utc_offset_seconds ?? 0;
  const hours = h.time.map((seconds, i) => {
    const local = new Date((seconds + offset) * 1000);
    return {
      time: new Date(seconds * 1000),
      localHour: local.getUTCHours(),
      localDay: local.toISOString().slice(0, 10),
      temp: h.temperature_2m[i],
      apparent: h.apparent_temperature?.[i] ?? h.temperature_2m[i],
      rh: h.relative_humidity_2m?.[i] ?? 50,
      wind: h.wind_speed_10m?.[i] ?? 0,
      gust: h.wind_gusts_10m?.[i] ?? 0,
      precipProb: h.precipitation_probability?.[i] ?? 0,
      precip: h.precipitation?.[i] ?? 0,
      code: h.weather_code?.[i] ?? 0,
      uv: h.uv_index?.[i] ?? 0,
      isDay: Boolean(h.is_day?.[i]),
      global: h.shortwave_radiation?.[i] ?? 0,
      directNormal: h.direct_normal_irradiance?.[i] ?? 0,
      diffuse: h.diffuse_radiation?.[i] ?? 0,
    };
  }).filter(hour => Number.isFinite(hour.temp));
  return { hours, timezone: body.timezone, utcOffset: offset };
}

// Short descriptions for WMO weather codes.
export function describeWeather(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
