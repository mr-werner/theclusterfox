// Indoor skydiving wind tunnels in the US. Locations are close to the
// building; check the tunnel's own site for hours, booking and prices.
// kind: "public" tunnels sell first-time flights; "sport" tunnels are
// mostly for licensed flyers, teams and coaching (they still take beginners).

const t = (id, name, city, state, lat, lon, website, extra = {}) => ({ id, name, city, state, lat, lon, website, kind: "public", ...extra });

export const TUNNELS = [
  t("ifly-orlando", "iFLY Orlando", "Orlando", "FL", 28.4433, -81.4700, "https://www.iflyworld.com/orlando/"),
  t("ifly-tampa", "iFLY Tampa", "Tampa", "FL", 28.0600, -82.4100, "https://www.iflyworld.com/tampa/"),
  t("ifly-ftl", "iFLY Fort Lauderdale", "Davie", "FL", 26.0800, -80.2500, "https://www.iflyworld.com/fort-lauderdale/"),
  t("ifly-atlanta", "iFLY Atlanta", "Kennesaw", "GA", 34.0200, -84.5600, "https://www.iflyworld.com/atlanta/"),
  t("paraclete-indoor", "Paraclete XP Indoor", "Raeford", "NC", 34.9900, -79.2100, "https://paracletexp.com", { kind: "sport", note: "Big, fast tunnel next to Paraclete XP Skydive. Popular with teams." }),
  t("ifly-philly", "iFLY Philadelphia", "King of Prussia", "PA", 40.0900, -75.3900, "https://www.iflyworld.com/philadelphia/"),
  t("ifly-westchester", "iFLY Westchester", "Yonkers", "NY", 40.9300, -73.8700, "https://www.iflyworld.com/westchester/"),
  t("ifly-boston", "iFLY Boston", "Natick", "MA", 42.3000, -71.3800, "https://www.iflyworld.com/boston/"),
  t("skyventure-nh", "SkyVenture New Hampshire", "Nashua", "NH", 42.7700, -71.4800, "https://www.skyventurenh.com"),
  t("ifly-cincinnati", "iFLY Cincinnati", "West Chester", "OH", 39.3300, -84.4200, "https://www.iflyworld.com/cincinnati/"),
  t("ifly-chicago-lp", "iFLY Chicago Lincoln Park", "Chicago", "IL", 41.9130, -87.6550, "https://www.iflyworld.com/chicago-lincoln-park/"),
  t("ifly-chicago-nap", "iFLY Chicago Naperville", "Naperville", "IL", 41.7900, -88.1500, "https://www.iflyworld.com/chicago-naperville/"),
  t("ifly-twincities", "iFLY Twin Cities", "Roseville", "MN", 45.0100, -93.1700, "https://www.iflyworld.com/twin-cities/"),
  t("ifly-kc", "iFLY Kansas City", "Overland Park", "KS", 38.9300, -94.6700, "https://www.iflyworld.com/kansas-city/"),
  t("ifly-dallas", "iFLY Dallas", "Frisco", "TX", 33.1000, -96.8100, "https://www.iflyworld.com/dallas/"),
  t("ifly-houston", "iFLY Houston", "Houston", "TX", 29.7800, -95.5400, "https://www.iflyworld.com/houston/"),
  t("ifly-austin", "iFLY Austin", "Round Rock", "TX", 30.4800, -97.6700, "https://www.iflyworld.com/austin/"),
  t("ifly-sanantonio", "iFLY San Antonio", "San Antonio", "TX", 29.6000, -98.6000, "https://www.iflyworld.com/san-antonio/"),
  t("ifly-denver", "iFLY Denver", "Lone Tree", "CO", 39.5400, -104.8800, "https://www.iflyworld.com/denver/"),
  t("ifly-utah", "iFLY Utah", "Ogden", "UT", 41.2200, -111.9700, "https://www.iflyworld.com/utah/"),
  t("skyventure-az", "SkyVenture Arizona", "Eloy", "AZ", 32.8075, -111.5880, "https://skyventureaz.com", { kind: "sport", note: "On the Skydive Arizona field. Mostly coaching and team training." }),
  t("vegas-indoor", "Vegas Indoor Skydiving", "Las Vegas", "NV", 36.1300, -115.1600, "https://www.vegasindoorskydiving.com", { note: "One of the first public tunnels in the US, on the Strip." }),
  t("ifly-hollywood", "iFLY Hollywood", "Universal City", "CA", 34.1370, -118.3530, "https://www.iflyworld.com/hollywood/"),
  t("ifly-ontario", "iFLY Ontario", "Ontario", "CA", 34.0700, -117.5500, "https://www.iflyworld.com/ontario/"),
  t("perris-indoor", "Perris Indoor Skydiving", "Perris", "CA", 33.7620, -117.2190, "https://skydiveperris.com", { kind: "sport", note: "On the Skydive Perris field." }),
  t("ifly-sandiego", "iFLY San Diego", "San Diego", "CA", 32.8300, -117.1500, "https://www.iflyworld.com/san-diego/"),
  t("ifly-sfbay", "iFLY SF Bay", "Union City", "CA", 37.5900, -122.0200, "https://www.iflyworld.com/sf-bay/"),
  t("ifly-seattle", "iFLY Seattle", "Tukwila", "WA", 47.4600, -122.2600, "https://www.iflyworld.com/seattle/"),
];

export const TUNNEL_PRICES = [
  { id: "first", label: "First-time flyer (2 flights, about 1 minute each)", value: "$70–$110", note: "Includes a short class, suit, helmet and an instructor in the tunnel with you." },
  { id: "more", label: "More flights on the same visit", value: "$35–$60 each" },
  { id: "pro", label: "Licensed flyer time", value: "$12–$25 a minute", note: "Usually sold in 30- or 60-minute blocks. Much cheaper per minute in big blocks and off-peak." },
  { id: "coach", label: "Coaching", value: "$5–$15 a minute on top", note: "Or a flat rate per block. Worth it: a coach can save you hours." },
];

export const TUNNEL_TIPS = [
  "Ten minutes in the tunnel is about the freefall time of 10 to 15 skydives.",
  "Doing 30 to 60 minutes before AFF makes the levels go faster and saves repeat jumps.",
  "Book off-peak (weekday mornings) for the best per-minute price.",
  "Two-minute rotations are the sweet spot while you learn. You tire fast at first.",
];
