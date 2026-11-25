import { useMemo } from "react";

import { useKeyed, useTripFares } from "../../plan/state/useLayerData";
import { departWindow, suggestTrips, tripDefaults, tripMonths } from "../../plan/model/trips";
import { weatherSource } from "../../road/model/packing";
import { fetchDrive, fetchEventThings, fetchGasAverage, fetchOsmThings, fetchStays, fetchStayWeather, fetchWikiThings } from "../api";
import { addDays, nightsOf, tripDays } from "../model/days";
import { mergeThings } from "../model/places";

const spot = p => (p ? `${p.lat.toFixed(3)},${p.lon.toFixed(3)}` : "");

/**
 * Everything TripFox looks up for one trip. Each source loads on its own:
 * { weather, drive, gas, fares, wiki, osm, events, stays, things }.
 */
export function useTripSources(trip, { home, homeAirport, today, wantThings, wantStays }) {
  const dest = trip?.dest ?? null;
  const days = useMemo(() => (trip ? tripDays(trip) : []), [trip]);

  const source = days.length ? weatherSource(days, today) : null;
  const weatherKey = dest && days.length ? `${spot(dest)}|${days[0]}|${days.length}|${source}` : null;
  const weather = useKeyed(weatherKey, signal => fetchStayWeather(dest, days, source, { signal }).then(byDay => ({ days: byDay, source })));

  const drives = trip?.travel === "drive";
  const drive = useKeyed(drives && home && dest ? `${spot(home)}>${spot(dest)}` : null, signal => fetchDrive(home, dest, { signal }));
  const gas = useKeyed(drives ? "gas" : null, signal => fetchGasAverage({ signal }));

  // Fares: the best leave-and-return pairs around the dates you picked.
  const flies = trip?.travel === "fly" && homeAirport && trip?.airport && homeAirport.code !== trip.airport.code;
  const nights = nightsOf(trip) || 3;
  const fareTrip = flies ? tripDefaults({ code: trip.airport.code, name: trip.airport.name, around: trip.start, flex: trip.start ? 3 : 30, minNights: nights, maxNights: nights, top: 3 }) : null;
  const window = fareTrip ? departWindow(fareTrip, { from: today, to: addDays(today, 30), today }) : null;
  const months = fareTrip ? tripMonths(fareTrip, window) : [];
  const fareData = useTripFares(flies ? homeAirport : null, fareTrip, months, "usd");
  const fares = useMemo(() => {
    if (!fareTrip || fareData.status !== "ok") return { status: fareData.status, error: fareData.error, pairs: [] };
    const out = fareData.value.out.filter(f => f.day >= today);
    const back = fareData.value.back.filter(f => f.day >= today);
    return { status: "ok", pairs: suggestTrips(out, back, fareTrip, window) };
    // fareTrip and window follow from the key fields below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fareData, today, trip?.start, nights]);

  const wiki = useKeyed(wantThings && dest ? `w${spot(dest)}` : null, signal => fetchWikiThings(dest, { signal }));
  const osm = useKeyed(wantThings && dest ? `o${spot(dest)}` : null, signal => fetchOsmThings(dest, { signal }));
  const eventEnd = days.length ? days[Math.min(days.length, 30) - 1] : null;
  const events = useKeyed(wantThings && dest && days.length && days[days.length - 1] >= today ? `e${spot(dest)}|${days[0]}|${eventEnd}` : null, signal =>
    fetchEventThings(dest, days[0] < today ? today : days[0], eventEnd, { signal })
  );
  const stays = useKeyed(wantStays && dest ? `s${spot(dest)}` : null, signal => fetchStays(dest, { signal }));

  const kids = trip?.kids ?? 0;
  const things = useMemo(() => mergeThings([wiki.value ?? [], osm.value ?? [], events.value ?? []], { kids }), [wiki.value, osm.value, events.value, kids]);

  return { days, weather, drive, gas, fares, wiki, osm, events, stays, things };
}
