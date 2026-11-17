// US drop zones JumpFox knows about. Locations are the airfield, close
// enough for weather and distance. Programs and aircraft change: each DZ's
// own site is the final word, and USPA's locator lists every member DZ.
//
// programs: tandem, aff (Accelerated Freefall), sl (static line / IAD),
//           tunnel (wind tunnel on or next to the field)
// aircraft: what the DZ is known for flying; "turbine" when we aren't sure
// of the type. size: "big" for year-round, multi-plane destination DZs.

export const PROGRAMS = {
  tandem: { name: "Tandem", text: "Your first jump, strapped to an instructor. About a day, no experience needed." },
  aff: { name: "AFF", text: "Accelerated Freefall: ground school, then your own parachute with instructors holding on for the first levels." },
  sl: { name: "Static line / IAD", text: "Your parachute opens as you leave the plane. A slower, cheaper first few jumps before freefall." },
  tunnel: { name: "Wind tunnel", text: "A vertical wind tunnel at or next to the drop zone." },
};

const dz = (id, name, city, state, lat, lon, elevFt, programs, aircraft, website, extra = {}) => ({ id, name, city, state, lat, lon, elevFt, programs, aircraft, website, ...extra });

export const DROPZONES = [
  dz("perris", "Skydive Perris", "Perris", "CA", 33.7609, -117.2185, 1420, ["tandem", "aff", "tunnel"], ["Twin Otter", "Skyvan"], "https://skydiveperris.com", { size: "big", note: "Year-round, big-way and freefly coaching most weekends, tunnel on the field." }),
  dz("elsinore", "Skydive Elsinore", "Lake Elsinore", "CA", 33.6316, -117.2990, 1290, ["tandem", "aff"], ["Twin Otter"], "https://skydiveelsinore.com", { size: "big" }),
  dz("sandiego", "Skydive San Diego", "Jamul", "CA", 32.6950, -116.8686, 1050, ["tandem", "aff"], ["turbine"], "https://skydivesandiego.com"),
  dz("monterey", "Skydive Monterey Bay", "Marina", "CA", 36.6828, -121.7624, 140, ["tandem"], ["turbine"], "https://skydivemontereybay.com", { note: "Tandems over the bay." }),
  dz("santabarbara", "Skydive Santa Barbara", "Lompoc", "CA", 34.6656, -120.4675, 90, ["tandem"], ["turbine"], "https://skydivesantabarbara.com"),
  dz("byron", "Bay Area Skydiving", "Byron", "CA", 37.8284, -121.6258, 80, ["tandem", "aff"], ["turbine"], "https://baskydiving.com"),
  dz("lodi", "Lodi Parachute Center", "Acampo", "CA", 38.1735, -121.2703, 60, ["tandem", "aff", "sl"], ["Twin Otter"], "https://parachutecenter.com"),
  dz("taft", "Skydive Taft", "Taft", "CA", 35.1394, -119.4389, 880, ["tandem", "aff"], ["turbine"], "https://skydivetaft.com"),
  dz("eloy", "Skydive Arizona", "Eloy", "AZ", 32.8067, -111.5868, 1510, ["tandem", "aff", "tunnel"], ["Twin Otter", "Skyvan"], "https://skydiveaz.com", { size: "big", note: "One of the biggest DZs in the world. SkyVenture Arizona tunnel on the field." }),
  dz("vegas", "Skydive Las Vegas", "Boulder City", "NV", 35.9476, -114.8610, 2200, ["tandem"], ["turbine"], "https://skydivelasvegas.com"),
  dz("utah", "Skydive Utah", "Erda", "UT", 40.6097, -112.3497, 4320, ["tandem", "aff"], ["turbine"], "https://skydiveutah.com", { note: "High field: canopies fly faster here." }),
  dz("moab", "Skydive Moab", "Moab", "UT", 38.7550, -109.7549, 4560, ["tandem"], ["turbine"], "https://skydivemoab.com"),
  dz("milehi", "Skydive Mile-Hi", "Longmont", "CO", 40.1644, -105.1631, 5050, ["tandem", "aff"], ["turbine"], "https://skydivemilehi.com", { note: "Mile-high field: expect thinner air and faster landings." }),
  dz("snohomish", "Skydive Snohomish", "Snohomish", "WA", 47.9082, -122.1036, 20, ["tandem", "aff"], ["turbine"], "https://skydivesnohomish.com"),
  dz("kapowsin", "Skydive Kapowsin", "Shelton", "WA", 47.2380, -123.1475, 270, ["tandem", "aff"], ["turbine"], "https://skydivekapowsin.com"),
  dz("oregon", "Skydive Oregon", "Molalla", "OR", 45.1725, -122.5864, 300, ["tandem", "aff"], ["turbine"], "https://skydiveoregon.com"),
  dz("hawaii", "Skydive Hawaii", "Waialua", "HI", 21.5795, -158.1972, 15, ["tandem"], ["turbine"], "https://skydivehawaii.com", { note: "North Shore of Oahu." }),
  dz("spaceland-houston", "Skydive Spaceland Houston", "Rosharon", "TX", 29.3638, -95.4580, 50, ["tandem", "aff"], ["Twin Otter"], "https://skydivespaceland.com", { size: "big" }),
  dz("spaceland-dallas", "Skydive Spaceland Dallas", "Whitewright", "TX", 33.5520, -96.4216, 750, ["tandem", "aff"], ["Twin Otter"], "https://skydivespaceland.com", { size: "big" }),
  dz("houston", "Skydive Houston", "Waller", "TX", 30.0710, -95.9300, 250, ["tandem", "aff"], ["turbine"], "https://skydivehouston.com"),
  dz("chicago", "Skydive Chicago", "Ottawa", "IL", 41.3684, -88.8645, 620, ["tandem", "aff"], ["Twin Otter", "King Air"], "https://skydivechicago.com", { size: "big", note: "Home of Summerfest. Big fleet, swoop pond, camping." }),
  dz("rochelle", "Chicagoland Skydiving Center", "Rochelle", "IL", 41.8930, -89.0784, 780, ["tandem", "aff"], ["turbine"], "https://skydivecsc.com"),
  dz("midwest", "Skydive Midwest", "Sturtevant", "WI", 42.7020, -87.9590, 790, ["tandem", "aff"], ["turbine"], "https://skydivemidwest.com"),
  dz("twincities", "Skydive Twin Cities", "Baldwin", "WI", 44.9649, -92.3694, 1120, ["tandem", "aff"], ["turbine"], "https://skydivetwincities.com"),
  dz("wissota", "Skydive Wissota", "Chippewa Falls", "WI", 44.9300, -91.3200, 900, ["tandem", "aff"], ["turbine"], "https://skydivewissota.com"),
  dz("tecumseh", "Skydive Tecumseh", "Tecumseh", "MI", 42.0050, -83.9500, 800, ["tandem", "aff", "sl"], ["turbine"], "https://skydivetecumseh.com"),
  dz("ohio", "Skydive Ohio", "Xenia", "OH", 39.6909, -83.9910, 950, ["tandem", "aff"], ["turbine"], "https://skydiveohio.com"),
  dz("tennessee", "Skydive Tennessee", "Tullahoma", "TN", 35.3801, -86.2464, 1070, ["tandem", "aff"], ["turbine"], "https://skydivetennessee.com"),
  dz("atlanta", "Skydive Atlanta", "Thomaston", "GA", 32.9550, -84.2636, 800, ["tandem", "aff"], ["turbine"], "https://skydiveatlanta.com"),
  dz("carolina", "Skydive Carolina", "Chester", "SC", 34.7894, -81.1958, 650, ["tandem", "aff"], ["Twin Otter"], "https://skydivecarolina.com"),
  dz("paraclete", "Paraclete XP Skydive", "Raeford", "NC", 34.9800, -79.2000, 330, ["tandem", "aff", "tunnel"], ["Twin Otter"], "https://paracletexp.com", { size: "big", note: "Paraclete XP Indoor tunnel is a few minutes away." }),
  dz("orange-va", "Skydive Orange", "Orange", "VA", 38.2471, -78.0456, 470, ["tandem", "aff"], ["Twin Otter"], "https://skydiveorange.com"),
  dz("suffolk", "Skydive Suffolk", "Suffolk", "VA", 36.6826, -76.6019, 70, ["tandem", "aff"], ["turbine"], "https://skydivesuffolk.com"),
  dz("crosskeys", "Skydive Cross Keys", "Williamstown", "NJ", 39.7055, -75.0330, 150, ["tandem", "aff"], ["turbine"], "https://skydivecrosskeys.com"),
  dz("ranch", "Skydive the Ranch", "Gardiner", "NY", 41.6667, -74.1500, 300, ["tandem", "aff"], ["Twin Otter"], "https://skydivetheranch.com", { note: "Under the Shawangunk Ridge, an hour and a half from NYC." }),
  dz("longisland", "Skydive Long Island", "Calverton", "NY", 40.9150, -72.7920, 70, ["tandem", "aff"], ["turbine"], "https://skydivelongisland.com"),
  dz("jumptown", "Jumptown", "Orange", "MA", 42.5701, -72.2886, 560, ["tandem", "aff"], ["turbine"], "https://jumptown.com", { note: "One of the oldest commercial DZs in the US." }),
  dz("pepperell", "Skydive Pepperell", "Pepperell", "MA", 42.6967, -71.5528, 230, ["tandem", "aff"], ["turbine"], "https://skydivepepperell.com"),
  dz("newengland", "Skydive New England", "Lebanon", "ME", 43.3700, -70.9300, 340, ["tandem", "aff"], ["turbine"], "https://skydivenewengland.com"),
  dz("deland", "Skydive DeLand", "DeLand", "FL", 29.0670, -81.2837, 80, ["tandem", "aff"], ["Twin Otter"], "https://skydivedeland.com", { size: "big", note: "Birthplace of a lot of modern gear: several manufacturers sit on the field." }),
  dz("zhills", "Skydive City Z-Hills", "Zephyrhills", "FL", 28.2283, -82.1558, 90, ["tandem", "aff"], ["Twin Otter"], "https://skydivecity.com", { size: "big", note: "Famous Thanksgiving boogie." }),
  dz("sebastian", "Skydive Sebastian", "Sebastian", "FL", 27.8128, -80.4956, 20, ["tandem", "aff"], ["Twin Otter"], "https://skydiveseb.com", { size: "big" }),
  dz("keywest", "Skydive Key West", "Sugarloaf Key", "FL", 24.6460, -81.5786, 5, ["tandem"], ["turbine"], "https://skydivekeywest.com"),
];

export const dzById = Object.fromEntries(DROPZONES.map(d => [d.id, d]));

/** What jumping usually costs in the US, for when a DZ's own prices aren't in front of you. */
export const TYPICAL_PRICES = [
  { id: "tandem", label: "Tandem jump", value: "$230–$350", note: "Weekday and group deals are cheaper. Weight limit is usually 220–250 lb." },
  { id: "video", label: "Tandem video and photos", value: "$100–$160", note: "Handcam is cheaper than an outside camera flyer." },
  { id: "aff1", label: "AFF first jump with ground school", value: "$350–$500" },
  { id: "aff", label: "Whole program to an A license", value: "$2,500–$4,000", note: "AFF levels, coach jumps, solos, gear rental and the license fee." },
  { id: "ticket", label: "Fun jump ticket to 13,500 ft", value: "$30–$40", note: "Cheaper in blocks of 10 or more, more on bigger planes." },
  { id: "hop", label: "Hop and pop (4,000–5,000 ft)", value: "$15–$25" },
  { id: "rental", label: "Gear rental per jump", value: "$30–$45" },
  { id: "pack", label: "Having someone pack your main", value: "$10–$15" },
  { id: "repack", label: "Reserve repack (every 180 days)", value: "$80–$130" },
  { id: "uspa", label: "USPA membership", value: "about $80 a year", note: "Required at USPA Group Member DZs. Includes third-party liability coverage." },
];
