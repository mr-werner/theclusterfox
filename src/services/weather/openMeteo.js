// Open-Meteo: free, keyless weather and place search (https://open-meteo.com).
// Called straight from the browser; both APIs allow cross-origin requests.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

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

const CURRENT = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "weather_code",
  "is_day",
  "pressure_msl",
  "dew_point_2m",
];

const DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "precipitation_sum",
  "uv_index_max",
  "wind_speed_10m_max",
  "sunrise",
  "sunset",
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
    postcode: result.postcodes?.[0] ?? null,
  }));
}

/**
 * Current conditions, fourteen days, and an hourly forecast. Each hour has:
 * time (Date), localHour, localDay, temp °C, apparent °C, rh %, wind m/s,
 * gust m/s, precipProb %, precip mm, code (WMO), uv, isDay, global,
 * directNormal, diffuse (W/m²).
 */
export async function fetchForecast({ latitude, longitude }, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: HOURLY.join(","),
    current: CURRENT.join(","),
    daily: DAILY.join(","),
    wind_speed_unit: "ms",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "14",
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

  const c = body.current;
  const current = c && Number.isFinite(c.temperature_2m)
    ? {
        temp: c.temperature_2m,
        apparent: c.apparent_temperature ?? c.temperature_2m,
        rh: c.relative_humidity_2m ?? null,
        wind: c.wind_speed_10m ?? 0,
        gust: c.wind_gusts_10m ?? 0,
        code: c.weather_code ?? 0,
        isDay: Boolean(c.is_day),
        pressure: c.pressure_msl ?? null,
        dewPoint: c.dew_point_2m ?? null,
      }
    : null;

  const d = body.daily;
  const localTime = seconds => {
    if (!Number.isFinite(seconds)) return null;
    const local = new Date((seconds + offset) * 1000);
    return { hour: local.getUTCHours(), minute: local.getUTCMinutes() };
  };
  const days = d
    ? d.time.map((seconds, i) => ({
        day: new Date((seconds + offset) * 1000).toISOString().slice(0, 10),
        code: d.weather_code?.[i] ?? 0,
        high: d.temperature_2m_max?.[i],
        low: d.temperature_2m_min?.[i],
        precipProb: d.precipitation_probability_max?.[i] ?? 0,
        precip: d.precipitation_sum?.[i] ?? 0,
        uv: d.uv_index_max?.[i] ?? 0,
        wind: d.wind_speed_10m_max?.[i] ?? 0,
        sunrise: localTime(d.sunrise?.[i]),
        sunset: localTime(d.sunset?.[i]),
      })).filter(day => Number.isFinite(day.high) && Number.isFinite(day.low))
    : [];

  return { hours, current, days, timezone: body.timezone, utcOffset: offset };
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

/**
 * Hourly US AQI (and its main pollutants) for about five days, keyed by
 * unix seconds so it can be joined onto forecast hours.
 */
export async function fetchAirQuality({ latitude, longitude }, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: "us_aqi,pm2_5,ozone",
    current: "us_aqi,pm2_5,ozone",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "5",
  });
  const response = await fetch(`${AIR_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("Air quality isn't available right now.");
  return parseAirQuality(await response.json());
}

export function parseAirQuality(body) {
  const h = body.hourly ?? {};
  const byTime = new Map();
  (h.time ?? []).forEach((seconds, i) => {
    const aqi = h.us_aqi?.[i];
    if (Number.isFinite(aqi)) byTime.set(seconds * 1000, { aqi, pm25: h.pm2_5?.[i] ?? null, ozone: h.ozone?.[i] ?? null });
  });
  const c = body.current;
  return {
    byTime,
    current: c && Number.isFinite(c.us_aqi) ? { aqi: c.us_aqi, pm25: c.pm2_5 ?? null, ozone: c.ozone ?? null } : null,
  };
}

// Adds air quality to forecast hours that have it.
export function withAirQuality(hours, air) {
  if (!air) return hours;
  return hours.map(hour => {
    const reading = air.byTime.get(hour.time.getTime());
    return reading ? { ...hour, aqi: reading.aqi, pm25: reading.pm25 } : hour;
  });
}

// US EPA AQI categories.
export function aqiCategory(aqi) {
  if (!Number.isFinite(aqi)) return null;
  if (aqi <= 50) return { label: "Good", tone: "good" };
  if (aqi <= 100) return { label: "Moderate", tone: "moderate" };
  if (aqi <= 150) return { label: "Unhealthy for sensitive groups", short: "Sensitive", tone: "usg" };
  if (aqi <= 200) return { label: "Unhealthy", tone: "unhealthy" };
  if (aqi <= 300) return { label: "Very unhealthy", tone: "very" };
  return { label: "Hazardous", tone: "hazardous" };
}
