// Ten years of hourly temperature and dew point from the Open-Meteo historical
// archive (ERA5 reanalysis), free and keyless, called straight from the browser.
// Engineer ToolFox turns it into heating and cooling design conditions
// (see features/tools/model/designWeather.js).

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

export async function fetchHourlyHistory({ latitude, longitude }, { years = 10, signal } = {}) {
  const lastYear = new Date().getFullYear() - 1;
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    start_date: `${lastYear - years + 1}-01-01`,
    end_date: `${lastYear}-12-31`,
    hourly: "temperature_2m,dew_point_2m",
    timezone: "auto",
    timeformat: "unixtime",
  });
  const response = await fetch(`${ARCHIVE_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("The weather history service isn't responding. Try again in a moment, or type the design temperatures under More settings.");
  const body = await response.json();
  const h = body.hourly ?? {};
  if (!h.time?.length) throw new Error("There's no weather history for that spot.");
  return {
    t: h.time,
    T: h.temperature_2m,
    Td: h.dew_point_2m,
    offset: body.utc_offset_seconds ?? 0,
    elevation: body.elevation ?? 0,
  };
}
