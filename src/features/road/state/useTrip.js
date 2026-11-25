import { useCallback, useEffect, useRef, useState } from "react";

import { fetchActivities, fetchRoutes } from "../api";
import { THEME_BY_ID } from "../data/themes";
import { pickStops, placeAlong, STOP_THEMES } from "../model/route";

// Builds every route for a trip: the fastest one and OSRM's alternative
// first, then a route for each theme through the best places along the way.
// Each route: { id, theme, name, route, stops, edited }. Stops carry
// .baseMile (where they fall on the fastest route, for ordering) and .mile
// (where they fall on their own route).

/** Stops with .mile on a route that runs through them in order. */
function onRoute(stops, route) {
  let m = 0;
  return stops.map((s, i) => {
    m += route.legs[i]?.miles ?? 0;
    return { ...s, mile: Math.round(m * 10) / 10 };
  });
}

export function useTrip(from, to, saved) {
  const [state, setState] = useState({ status: "idle", routes: [], places: [], error: null });
  const ctl = useRef(null);
  const key = from && to ? `${from.lat.toFixed(4)},${from.lon.toFixed(4)}|${to.lat.toFixed(4)},${to.lon.toFixed(4)}` : "";

  const run = useCallback(async () => {
    if (!from || !to) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const signal = c.signal;
    setState({ status: "routing", routes: [], places: [], error: null });
    try {
      const base = await fetchRoutes([from, to], { alternatives: true, signal });
      const fastest = base[0];
      const routes = [{ id: "fastest", theme: "fastest", name: "Fastest", route: fastest, stops: [] }];
      const alt = base[1];
      if (alt && Math.abs(alt.miles - fastest.miles) / fastest.miles > 0.02) routes.push({ id: "alt", theme: "fastest", name: "Another way", route: alt, stops: [] });
      setState({ status: "stops", routes: [...routes], places: [], error: null });

      const total = fastest.miles;
      const place = list => placeAlong(list, fastest, 20).map(p => ({ ...p, baseMile: p.mile }));
      let places = [];
      try {
        // Places show up a stretch at a time while the rest are still coming.
        places = place(
          await fetchActivities(fastest.points, {
            signal,
            onPart: (list, progress) => setState(s => ({ ...s, places: place(list), progress })),
          })
        );
      } catch (error) {
        if (error.name === "AbortError") throw error;
        setState(s => ({ ...s, status: "done", progress: null, error: `${error.message} The fastest route is ready; themed routes need places along the way.` }));
        return;
      }
      setState(s => ({ ...s, places, progress: null }));
      for (const theme of STOP_THEMES) {
        const stops = pickStops(places, theme, total);
        if (!stops.length) continue;
        try {
          const [r] = await fetchRoutes([from, ...stops, to], { signal });
          routes.push({ id: theme, theme, name: THEME_BY_ID[theme].name, route: r, stops: onRoute(stops, r) });
          setState(s => ({ ...s, routes: [...routes] }));
        } catch (error) {
          if (error.name === "AbortError") throw error;
        }
      }
      setState(s => ({ ...s, status: "done" }));
    } catch (error) {
      if (error.name === "AbortError") return;
      setState(s => ({ ...s, status: "error", error: error.message }));
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // A saved trip opens as it was saved, with no network needed.
  useEffect(() => {
    if (!saved) return;
    ctl.current?.abort();
    const points = saved.line.map(([lat, lon]) => ({ lat, lon }));
    const route = { points, miles: saved.miles, minutes: saved.minutes, legs: [] };
    setState({ status: "saved", routes: [{ id: "saved", theme: saved.theme, name: saved.title, route, stops: saved.stops, edited: false }], places: [], error: null });
  }, [saved?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => ctl.current?.abort(), []);

  /** Re-route one route through a new list of stops. */
  const restop = useCallback(
    async (routeId, stops) => {
      const sorted = [...stops].sort((a, b) => (a.baseMile ?? a.mile) - (b.baseMile ?? b.mile));
      setState(s => ({ ...s, busy: routeId }));
      try {
        const [r] = await fetchRoutes([from, ...sorted, to]);
        setState(s => ({ ...s, busy: null, routes: s.routes.map(x => (x.id === routeId ? { ...x, route: r, stops: onRoute(sorted, r), edited: true } : x)) }));
      } catch (error) {
        setState(s => ({ ...s, busy: null, error: error.message }));
      }
    },
    [from, to]
  );

  return { ...state, key, run, restop };
}
