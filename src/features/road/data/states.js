// The 50 states and DC: names, capitals and nicknames for the car games, and
// which EIA weekly gas-price series covers each one. EIA publishes its own
// average for nine states; the rest use their region (PADD).

const S = (code, name, capital, nickname, gasArea) => ({ code, name, capital, nickname, gasArea });

export const STATES = [
  S("AL", "Alabama", "Montgomery", "The Yellowhammer State", "R30"),
  S("AK", "Alaska", "Juneau", "The Last Frontier", "R5XCA"),
  S("AZ", "Arizona", "Phoenix", "The Grand Canyon State", "R5XCA"),
  S("AR", "Arkansas", "Little Rock", "The Natural State", "R30"),
  S("CA", "California", "Sacramento", "The Golden State", "SCA"),
  S("CO", "Colorado", "Denver", "The Centennial State", "SCO"),
  S("CT", "Connecticut", "Hartford", "The Constitution State", "R1X"),
  S("DE", "Delaware", "Dover", "The First State", "R1Y"),
  S("DC", "District of Columbia", "Washington", "The Nation's Capital", "R1Y"),
  S("FL", "Florida", "Tallahassee", "The Sunshine State", "SFL"),
  S("GA", "Georgia", "Atlanta", "The Peach State", "R1Z"),
  S("HI", "Hawaii", "Honolulu", "The Aloha State", "R5XCA"),
  S("ID", "Idaho", "Boise", "The Gem State", "R40"),
  S("IL", "Illinois", "Springfield", "The Prairie State", "R20"),
  S("IN", "Indiana", "Indianapolis", "The Hoosier State", "R20"),
  S("IA", "Iowa", "Des Moines", "The Hawkeye State", "R20"),
  S("KS", "Kansas", "Topeka", "The Sunflower State", "R20"),
  S("KY", "Kentucky", "Frankfort", "The Bluegrass State", "R20"),
  S("LA", "Louisiana", "Baton Rouge", "The Pelican State", "R30"),
  S("ME", "Maine", "Augusta", "The Pine Tree State", "R1X"),
  S("MD", "Maryland", "Annapolis", "The Old Line State", "R1Y"),
  S("MA", "Massachusetts", "Boston", "The Bay State", "SMA"),
  S("MI", "Michigan", "Lansing", "The Great Lakes State", "R20"),
  S("MN", "Minnesota", "Saint Paul", "The North Star State", "SMN"),
  S("MS", "Mississippi", "Jackson", "The Magnolia State", "R30"),
  S("MO", "Missouri", "Jefferson City", "The Show-Me State", "R20"),
  S("MT", "Montana", "Helena", "The Treasure State", "R40"),
  S("NE", "Nebraska", "Lincoln", "The Cornhusker State", "R20"),
  S("NV", "Nevada", "Carson City", "The Silver State", "R5XCA"),
  S("NH", "New Hampshire", "Concord", "The Granite State", "R1X"),
  S("NJ", "New Jersey", "Trenton", "The Garden State", "R1Y"),
  S("NM", "New Mexico", "Santa Fe", "The Land of Enchantment", "R30"),
  S("NY", "New York", "Albany", "The Empire State", "SNY"),
  S("NC", "North Carolina", "Raleigh", "The Tar Heel State", "R1Z"),
  S("ND", "North Dakota", "Bismarck", "The Peace Garden State", "R20"),
  S("OH", "Ohio", "Columbus", "The Buckeye State", "SOH"),
  S("OK", "Oklahoma", "Oklahoma City", "The Sooner State", "R20"),
  S("OR", "Oregon", "Salem", "The Beaver State", "R5XCA"),
  S("PA", "Pennsylvania", "Harrisburg", "The Keystone State", "R1Y"),
  S("RI", "Rhode Island", "Providence", "The Ocean State", "R1X"),
  S("SC", "South Carolina", "Columbia", "The Palmetto State", "R1Z"),
  S("SD", "South Dakota", "Pierre", "The Mount Rushmore State", "R20"),
  S("TN", "Tennessee", "Nashville", "The Volunteer State", "R20"),
  S("TX", "Texas", "Austin", "The Lone Star State", "STX"),
  S("UT", "Utah", "Salt Lake City", "The Beehive State", "R40"),
  S("VT", "Vermont", "Montpelier", "The Green Mountain State", "R1X"),
  S("VA", "Virginia", "Richmond", "The Old Dominion", "R1Z"),
  S("WA", "Washington", "Olympia", "The Evergreen State", "SWA"),
  S("WV", "West Virginia", "Charleston", "The Mountain State", "R1Z"),
  S("WI", "Wisconsin", "Madison", "The Badger State", "R20"),
  S("WY", "Wyoming", "Cheyenne", "The Equality State", "R40"),
];

export const STATE_BY_CODE = Object.fromEntries(STATES.map(s => [s.code, s]));

// Where an area's price falls back to when EIA skips a week for it.
export const GAS_AREA_PARENT = { SCA: "R50", SCO: "R40", SFL: "R1Z", SMA: "R1X", SMN: "R20", SNY: "R1Y", SOH: "R20", STX: "R30", SWA: "R5XCA", R1X: "R10", R1Y: "R10", R1Z: "R10", R5XCA: "R50" };

/** The EIA area codes to try for a state, most specific first, ending with the U.S. average. */
export function gasAreasFor(code) {
  const out = [];
  let a = STATE_BY_CODE[code]?.gasArea;
  while (a) {
    out.push(a);
    a = GAS_AREA_PARENT[a];
  }
  out.push("NUS");
  return out;
}

/** The price per gallon for a state from an { area: price } map, or null. */
export function priceForState(code, prices) {
  if (!prices) return null;
  for (const a of gasAreasFor(code)) if (Number.isFinite(prices[a])) return prices[a];
  return null;
}
