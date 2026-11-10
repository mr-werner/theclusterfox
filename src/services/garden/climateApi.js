// Ten years of daily weather from the Open-Meteo historical archive (ERA5),
// free and keyless, called straight from the browser. GrowFox turns it into
// a hardiness zone, frost dates and monthly rain (see model/climate.js).

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DAY = 86400000;

export async function fetchDailyHistory({ latitude, longitude }, { years = 10, signal } = {}) {
  const lastYear = new Date().getFullYear() - 1;
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    start_date: `${lastYear - years + 1}-01-01`,
    end_date: `${lastYear}-12-31`,
    daily: "temperature_2m_min,temperature_2m_max,precipitation_sum",
    timezone: "auto",
  });
  const response = await fetch(`${ARCHIVE_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("The climate service isn't responding. Try again in a moment, or pick your zone by hand.");
  const body = await response.json();
  const daily = body.daily ?? {};
  const time = (daily.time ?? []).map(t => Math.round(Date.parse(`${t}T00:00:00Z`) / DAY));
  if (!time.length) throw new Error("No weather history for that spot.");
  return { time, tmin: daily.temperature_2m_min, tmax: daily.temperature_2m_max, rain: daily.precipitation_sum };
}

/** Coldest night forecast for each of the next 7 days, in °C. */
export async function fetchLowForecast({ latitude, longitude }, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    daily: "temperature_2m_min,temperature_2m_max,precipitation_sum",
    forecast_days: "7",
    timezone: "auto",
  });
  const response = await fetch(`${FORECAST_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("Forecast unavailable.");
  const body = await response.json();
  const d = body.daily ?? {};
  return (d.time ?? []).map((day, i) => ({ day, low: d.temperature_2m_min?.[i], high: d.temperature_2m_max?.[i], rain: d.precipitation_sum?.[i] ?? 0 }));
}
