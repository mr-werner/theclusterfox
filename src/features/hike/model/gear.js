// What to bring. The Ten Essentials always, then whatever this hike's
// length, climb, daylight and weather call for, each with the reason.
// Plain function so tests can check the rules.

/**
 * trip: { minutes, distanceM, gain, maxEle, startMin, sun: { sunrise, sunset } }
 * wx (optional): the `worst` of the chosen start from scoreStart, plus
 *   { minTemp, maxApparent } in °C.
 * Returns [{ id, group, name, why, must }] in display order.
 */
export function gearList(trip, wx = null, { fmtTemp = c => `${Math.round(c)}°C`, fmtVol = l => `${l} L` } = {}) {
  const hours = Math.max(0.5, trip.minutes / 60);
  const items = [];
  const add = (group, id, name, why, must = false) => items.push({ id, group, name, why, must });

  // Water and food, sized to the hike.
  const hot = wx?.maxApparent ?? 18;
  let perHour = 0.5;
  if (hot > 24) perHour += 0.2;
  if (hot > 30) perHour += 0.25;
  if (trip.gain > 600) perHour += 0.1;
  const litres = Math.max(0.5, Math.ceil(hours * perHour * 2) / 2);
  add("Water & food", "water", `Water: ${fmtVol(litres)}`, `About ${fmtVol(Math.round(perHour * 10) / 10)} an hour for ${Math.round(hours * 10) / 10} hours${hot > 24 ? " in the heat" : ""}. Know where you can refill.`, true);
  if (hours >= 1.5) add("Water & food", "food", `Snacks: about ${Math.round((hours * 220) / 50) * 50} calories`, "Eat a little every hour; plus one extra snack in case you're out longer.", true);
  if (hours >= 5) add("Water & food", "filter", "Water filter or tablets", "Long day: refilling from streams beats carrying it all.");
  if (hot > 28) add("Water & food", "salt", "Electrolytes or salty snacks", "You'll sweat out salt as well as water.");

  // The Ten Essentials.
  add("Essentials", "nav", "Map and navigation", "Save this trail for offline use so the map and GPS work without signal.", true);
  add("Essentials", "light", "Headlamp", lightReason(trip), true);
  add("Essentials", "sun", "Sun protection", wx?.uv >= 6 ? `UV index ${Math.round(wx.uv)}: sunglasses, sunscreen, a hat.` : "Sunglasses and sunscreen, even when it's cool.", true);
  add("Essentials", "first-aid", "First aid kit", "Blister care, bandages, any meds you take.", true);
  add("Essentials", "knife", "Knife or multitool", "For gear repair and first aid.", true);
  add("Essentials", "fire", "Fire starter", "Lighter or waterproof matches, for an emergency.", true);
  add("Essentials", "shelter", "Emergency shelter", "A space blanket or bivy weighs almost nothing.", true);
  add("Essentials", "layers", "Extra layer", extraLayerReason(wx, fmtTemp), true);

  // Conditions.
  if ((wx?.rain ?? 0) >= 30 || wx?.storm) add("For these conditions", "shell", "Rain jacket", wx?.storm ? "Storms are possible. Plan to be off summits and ridges before they build." : `${Math.round(wx.rain)}% chance of rain or snow.`);
  if ((wx?.cold?.apparent ?? 10) < 5) add("For these conditions", "warm", "Warm hat and gloves", `It may feel like ${fmtTemp(wx.cold.apparent)} up high.`);
  if ((wx?.cold?.apparent ?? 10) < -10) add("For these conditions", "puffy", "Insulated jacket", "Bitter cold when you stop moving.");
  if ((wx?.gust ?? 0) > 40) add("For these conditions", "wind", "Windproof layer", "Strong gusts up high will chill you fast.");
  if ((wx?.snowDepth ?? 0) > 0.03 || (wx?.snow ?? 0) > 0.5) {
    add("For these conditions", "traction", "Microspikes or snowshoes", (wx.snowDepth ?? 0) > 0.3 ? "Deep snow on the trail: snowshoes, and check avalanche conditions." : "Snow or ice likely on the trail.");
    add("For these conditions", "gaiters", "Gaiters and waterproof boots", "Keeps snow out of your boots.");
  } else if (wx?.freezing !== null && wx?.freezing !== undefined && wx.freezing < trip.maxEle) {
    add("For these conditions", "traction", "Microspikes", "Freezing level is below the high point: watch for ice.");
  }
  if (hot > 20 && (wx?.rain ?? 0) >= 20) add("For these conditions", "bugs", "Bug spray", "Warm and damp: expect mosquitoes.");
  if (trip.gain > 500) add("For these conditions", "poles", "Trekking poles", `${Math.round(trip.gain)} m of climb: poles save your knees on the way down.`);
  if (trip.maxEle > 2500) add("For these conditions", "altitude", "Go slower up high", "Above 2,500 m the air is thin. Turn back if you get a bad headache or feel sick.");

  // Safety for long or remote days.
  add("Safety", "trip-plan", "Leave a trip plan", "Tell someone where you're going and when to call for help. Use the Share trip plan button.", true);
  add("Safety", "battery", "Charged phone, and a battery pack", hours >= 4 ? "A long day of GPS use: bring a small power bank." : "Start full. Airplane mode saves battery and GPS still works.", hours >= 4);
  if (hours >= 6 || trip.distanceM > 20000) add("Safety", "beacon", "Satellite messenger or PLB", "Long and likely out of cell range.");
  if (hours >= 5) add("Safety", "toilet", "Trowel and bags", "Pack out or bury waste 200 ft from water.");
  return items;
}

function lightReason(trip) {
  if (!trip.sun || !Number.isFinite(trip.startMin)) return "Hikes run long. A headlamp weighs nothing.";
  const end = trip.startMin + trip.minutes;
  if (trip.startMin < trip.sun.sunrise) return "You start before sunrise.";
  if (end > trip.sun.sunset - 45) return "You'll be finishing near or after sunset.";
  return "Hikes run long. A headlamp weighs nothing.";
}

function extraLayerReason(wx, fmtTemp) {
  if (!wx?.cold) return "It's colder up high, and colder still if you have to stop.";
  return `Lowest it'll feel up high is ${fmtTemp(wx.cold.apparent)}.`;
}
