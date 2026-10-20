import { useEffect, useMemo, useState } from "react";

import { fetchFeed, fetchGameReleases, fetchMovies, fetchSchedule } from "../../../services/plan/planApi";
import { expandIcs } from "../../../services/plan/ics";
import { fetchAlerts, inUnitedStates } from "../../../services/plan/alerts";
import { fetchForecast } from "../../../services/weather/openMeteo";
import { addDays, dayKey, todayKey } from "../model/dates";
import { fetchHolidays } from "../model/holidays";

/**
 * Runs loader(signal) whenever key changes and keeps the latest answer.
 * A null key means "nothing to load". Returns { status, value, error }.
 */
function useKeyed(key, loader) {
  const [state, setState] = useState({ key: null, value: null, error: null });
  useEffect(() => {
    if (key === null) return undefined;
    const controller = new AbortController();
    loader(controller.signal).then(
      value => !controller.signal.aborted && setState({ key, value, error: null }),
      error => !controller.signal.aborted && setState({ key, value: null, error })
    );
    return () => controller.abort();
    // loader is rebuilt every render; the key says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (key === null) return { status: "off", value: null, error: null };
  if (state.key !== key) return { status: "loading", value: null, error: null };
  if (state.error) return { status: state.error.code === "no-key" ? "no-key" : "error", value: null, error: state.error.message };
  return { status: "ok", value: state.value, error: null };
}

const placeKey = place => (place ? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}` : null);

const matchesTeam = (team, teams) => teams.some(t => team.name.toLowerCase().includes(t.toLowerCase()));

/**
 * Everything the calendar layers need for days in [from, to].
 * Sports, movies and games are only fetched for spans of two months or
 * less (the month and agenda views), not for the year view.
 */
export function useLayerData(data, from, to) {
  const { layers, place, country, leagues, teams, feeds } = data;
  const today = todayKey();
  const short = to <= addDays(from, 62);

  const home = useKeyed(layers.weather || layers.wear || layers.car || layers.garden || layers.training ? placeKey(place) : null, signal =>
    fetchForecast(place, { signal })
  );

  const alerts = useKeyed(layers.alerts && inUnitedStates(place) ? placeKey(place) : null, signal => fetchAlerts(place, { signal }));

  // Forecasts for the places of upcoming items elsewhere (up to three).
  const away = useMemo(() => {
    const seen = new Map();
    const end = addDays(today, 14);
    for (const item of data.items) {
      if (!item.place || placeKey(item.place) === placeKey(place)) continue;
      if (item.day > end || (item.repeat === "none" && item.day < today)) continue;
      seen.set(placeKey(item.place), item.place);
    }
    return [...seen.values()].slice(0, 3);
  }, [data.items, place, today]);
  const awayForecasts = useKeyed(away.length ? away.map(placeKey).join("|") : null, signal =>
    Promise.all(away.map(p => fetchForecast(p, { signal }).then(f => [placeKey(p), f]).catch(() => null))).then(
      list => new Map(list.filter(Boolean))
    )
  );

  const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])];
  const holidays = useKeyed(layers.holidays ? `${country}|${years.join(",")}` : null, signal =>
    Promise.all(years.map(y => fetchHolidays(Number(y), country, { signal }))).then(lists => lists.flat())
  );

  const sportsKey = layers.sports && short && leagues.length ? `${from}|${to}|${leagues.join(",")}` : null;
  const sports = useKeyed(sportsKey, signal =>
    Promise.allSettled(leagues.map(id => fetchSchedule(id, from, to, { signal }))).then(results => {
      const games = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));
      if (!games.length && results.every(r => r.status === "rejected")) throw results[0].reason;
      return games;
    })
  );

  const movies = useKeyed(layers.movies && short ? `${from}|${to}|${country}` : null, signal =>
    fetchMovies(from, to, ["US", "CA", "GB", "IE", "AU", "NZ", "FR", "DE", "ES", "IT", "JP", "MX", "BR", "IN"].includes(country) ? country : "US", { signal })
  );

  const releases = useKeyed(layers.games && short ? `${from}|${to}` : null, signal => fetchGameReleases(from, to, { signal }));

  const feedKey = layers.feeds && feeds.length ? feeds.map(f => f.url).join("|") : null;
  const feedData = useKeyed(feedKey, signal =>
    Promise.all(
      feeds.map(feed =>
        fetchFeed(feed.url, { signal }).then(
          body => ({ feed, events: body.events ?? [], error: null }),
          error => ({ feed, events: [], error: error.message })
        )
      )
    )
  );

  const games = useMemo(
    () =>
      (sports.value ?? []).map(game => {
        const start = game.start ? new Date(game.start) : null;
        return {
          ...game,
          day: start ? dayKey(start) : null,
          favorite: matchesTeam(game.home, teams) || matchesTeam(game.away, teams),
        };
      }).filter(g => g.day),
    [sports.value, teams]
  );

  const feedEvents = useMemo(
    () =>
      (feedData.value ?? []).flatMap(({ feed, events }) =>
        expandIcs(events, from, to).map(e => ({ ...e, id: `${feed.id}:${e.id}`, feedId: feed.id, feedName: feed.name }))
      ),
    [feedData.value, from, to]
  );

  return {
    forecast: home.value,
    forecastStatus: home,
    awayForecasts: awayForecasts.value ?? new Map(),
    holidays: holidays.value ?? [],
    alerts: alerts.value ?? [],
    games,
    movies: movies.value ?? [],
    releases: releases.value ?? [],
    feedEvents,
    feedErrors: (feedData.value ?? []).filter(f => f.error).map(f => ({ id: f.feed.id, error: f.error })),
    status: {
      weather: home.status,
      alerts: layers.alerts && place && !inUnitedStates(place) ? "us-only" : alerts.status,
      holidays: holidays.status,
      sports: sportsKey === null && layers.sports && !short ? "range" : sports.status,
      movies: layers.movies && !short ? "range" : movies.status,
      games: layers.games && !short ? "range" : releases.status,
      feeds: feedData.status,
    },
    errors: { alerts: alerts.error, weather: home.error, holidays: holidays.error, sports: sports.error, movies: movies.error, games: releases.error },
  };
}
