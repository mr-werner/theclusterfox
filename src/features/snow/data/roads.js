// Each state's or province's official road-conditions site (closures, chain
// laws, plow cameras). Live traffic is in Google Maps' directions.

export const ROAD_SITES = {
  AK: { name: "Alaska 511", url: "https://511.alaska.gov/" },
  AZ: { name: "AZ 511", url: "https://www.az511.gov/" },
  CA: { name: "Caltrans QuickMap", url: "https://quickmap.dot.ca.gov/" },
  CO: { name: "COtrip", url: "https://maps.cotrip.org/" },
  ID: { name: "Idaho 511", url: "https://511.idaho.gov/" },
  MA: { name: "Mass 511", url: "https://mass511.com/" },
  ME: { name: "New England 511", url: "https://newengland511.org/" },
  MI: { name: "Mi Drive", url: "https://mdotjboss.state.mi.us/MiDrive/map" },
  MN: { name: "MN 511", url: "https://511mn.org/" },
  MT: { name: "MDT Travel Info", url: "https://www.mdt.mt.gov/travinfo/" },
  NC: { name: "DriveNC", url: "https://drivenc.gov/" },
  NH: { name: "New England 511", url: "https://newengland511.org/" },
  NM: { name: "NMRoads", url: "https://nmroads.com/" },
  NV: { name: "NVroads", url: "https://www.nvroads.com/" },
  NY: { name: "511NY", url: "https://511ny.org/" },
  OR: { name: "TripCheck", url: "https://tripcheck.com/" },
  PA: { name: "511PA", url: "https://www.511pa.com/" },
  UT: { name: "UDOT Traffic", url: "https://udottraffic.utah.gov/" },
  VT: { name: "New England 511", url: "https://newengland511.org/" },
  WA: { name: "WSDOT mountain passes", url: "https://wsdot.com/travel/real-time/mountainpasses" },
  WI: { name: "511 Wisconsin", url: "https://511wi.gov/" },
  WV: { name: "WV 511", url: "https://wv511.org/" },
  WY: { name: "WYDOT road conditions", url: "https://www.wyoroad.info/" },
  AB: { name: "511 Alberta", url: "https://511.alberta.ca/" },
  BC: { name: "DriveBC", url: "https://www.drivebc.ca/" },
  ON: { name: "Ontario 511", url: "https://511on.ca/" },
  QC: { name: "Québec 511", url: "https://www.quebec511.info/en/" },
};

// Ski areas where parking reservations or paid parking have applied on busy
// days in recent seasons. Rules change every year, so SnowFox only says to check.
export const PARKING_CHECK = new Set(["abasin", "alta", "snowbird", "brighton", "solitude", "parkcity", "copper", "keystone", "vail", "breck", "palisades", "alpine", "big-sky"]);

export const CANADA = new Set(["AB", "BC", "ON", "QC"]);
