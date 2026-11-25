// Turns aviationweather.gov and adsb.lol answers into the small shapes
// FlyFox uses. Plain functions so the tests can run them in Node.

const num = v => (Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : null);
const str = v => (typeof v === "string" ? v.trim() : "");

/** "10+" -> 10, "1 1/2" -> 1.5, "P6SM"-style values as numbers of statute miles. */
export function visibilityMiles(v) {
  if (Number.isFinite(v)) return v;
  const s = str(v).replace(/SM$/i, "").replace(/^[PM]/, "").replace(/\+$/, "");
  if (!s) return null;
  const parts = s.split(" ");
  let total = 0;
  for (const p of parts) {
    if (p.includes("/")) {
      const [a, b] = p.split("/").map(Number);
      if (!b) return null;
      total += a / b;
    } else if (Number.isFinite(Number(p))) total += Number(p);
    else return null;
  }
  return total;
}

/** Ceiling in feet AGL: the lowest broken, overcast or vertical-visibility layer. */
export function ceilingFt(clouds, vertVis = null) {
  let low = Number.isFinite(vertVis) ? vertVis * (vertVis < 100 ? 100 : 1) : null;
  for (const c of Array.isArray(clouds) ? clouds : []) {
    if (!/^(BKN|OVC|OVX|VV)$/.test(str(c.cover))) continue;
    const base = num(c.base);
    if (base === null) continue;
    if (low === null || base < low) low = base;
  }
  return low;
}

/** VFR / MVFR / IFR / LIFR from ceiling (ft) and visibility (sm), the FAA's way. */
export function flightCategory(ceiling, vis) {
  const c = ceiling ?? Infinity;
  const v = vis ?? Infinity;
  if (c < 500 || v < 1) return "LIFR";
  if (c < 1000 || v < 3) return "IFR";
  if (c <= 3000 || v <= 5) return "MVFR";
  return "VFR";
}

export function parseMetars(list) {
  return (Array.isArray(list) ? list : [])
    .filter(m => str(m.icaoId) && Number.isFinite(m.lat) && Number.isFinite(m.lon))
    .map(m => {
      const vis = visibilityMiles(m.visib);
      const ceiling = ceilingFt(m.clouds, num(m.vertVis));
      return {
        id: str(m.icaoId),
        name: str(m.name).replace(/, [A-Z]{2}, [A-Z]{2}$/, "").replace(/, US$/, ""),
        lat: m.lat,
        lon: m.lon,
        elevFt: Number.isFinite(m.elev) ? Math.round(m.elev * 3.28084) : null,
        time: Number.isFinite(m.obsTime) ? m.obsTime * 1000 : null,
        raw: str(m.rawOb),
        tempC: num(m.temp),
        dewC: num(m.dewp),
        windDir: m.wdir === "VRB" ? "VRB" : num(m.wdir),
        windKt: num(m.wspd),
        gustKt: num(m.wgst),
        visSm: vis,
        altimInHg: Number.isFinite(m.altim) ? Math.round((m.altim / 33.8639) * 100) / 100 : null,
        ceilingFt: ceiling,
        clouds: (Array.isArray(m.clouds) ? m.clouds : []).map(c => ({ cover: str(c.cover), base: num(c.base) })),
        wx: str(m.wxString),
        category: /^(VFR|MVFR|IFR|LIFR)$/.test(str(m.fltCat)) ? m.fltCat : flightCategory(ceiling, vis),
      };
    });
}

export function parseTafs(list) {
  return (Array.isArray(list) ? list : [])
    .filter(t => str(t.icaoId))
    .map(t => ({
      id: str(t.icaoId),
      issued: str(t.issueTime) || null,
      from: Number.isFinite(t.validTimeFrom) ? t.validTimeFrom * 1000 : null,
      to: Number.isFinite(t.validTimeTo) ? t.validTimeTo * 1000 : null,
      raw: str(t.rawTAF),
      periods: (Array.isArray(t.fcsts) ? t.fcsts : []).map(f => {
        const vis = visibilityMiles(f.visib);
        const ceiling = ceilingFt(f.clouds, num(f.vertVis));
        return {
          from: Number.isFinite(f.timeFrom) ? f.timeFrom * 1000 : null,
          to: Number.isFinite(f.timeTo) ? f.timeTo * 1000 : null,
          change: str(f.fcstChange) || null,
          probability: num(f.probability),
          windDir: f.wdir === "VRB" ? "VRB" : num(f.wdir),
          windKt: num(f.wspd),
          gustKt: num(f.wgst),
          visSm: vis,
          ceilingFt: ceiling,
          wx: str(f.wxString),
          category: flightCategory(ceiling, vis),
        };
      }),
    }));
}

const SURFACE = { A: "Asphalt", C: "Concrete", G: "Grass", T: "Turf", W: "Water", D: "Dirt", S: "Sand", H: "Hard", P: "Paved", R: "Gravel", U: "Unknown" };

export function parseAirports(list) {
  return (Array.isArray(list) ? list : [])
    .filter(a => str(a.icaoId) || str(a.faaId))
    .map(a => ({
      id: str(a.icaoId) || str(a.faaId),
      faaId: str(a.faaId) || null,
      iataId: str(a.iataId) || null,
      name: titleCase(str(a.name)),
      state: str(a.state),
      country: str(a.country),
      lat: a.lat,
      lon: a.lon,
      elevFt: Number.isFinite(a.elev) ? Math.round(a.elev * 3.28084) : null,
      magVar: magVar(a.magdec),
      owner: str(a.owner) || null,
      towered: str(a.tower) === "T",
      fuel: str(a.services) === "S",
      runways: (Array.isArray(a.runways) ? a.runways : []).map(r => {
        const [len, wid] = str(r.dimension).split("x").map(Number);
        return { id: str(r.id), lengthFt: len || null, widthFt: wid || null, surface: SURFACE[str(r.surface)] ?? str(r.surface), heading: num(r.alignment) };
      }),
      freqs: str(a.freqs)
        .split(";")
        .map(f => f.split(","))
        .filter(([name, mhz]) => name && mhz)
        .map(([name, mhz]) => ({ name: name.replace(/\/P$/, "").replace(/^LCL$/, "TWR"), mhz })),
    }));
}

/** "08E" -> 8, "12W" -> -12 (east positive). */
export function magVar(v) {
  const m = /^(\d+(?:\.\d+)?)([EW])?$/.exec(str(v));
  if (!m) return null;
  return Number(m[1]) * (m[2] === "W" ? -1 : 1);
}

function titleCase(s) {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s/(-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\b(Intl|Rgnl|Muni|Co|Fld|Arpt|Afb|Sfb)\b/g, w => w);
}

export function parseStations(list) {
  return (Array.isArray(list) ? list : [])
    .filter(s => str(s.icaoId) && Number.isFinite(s.lat) && Number.isFinite(s.lon) && Array.isArray(s.siteType) && s.siteType.includes("METAR"))
    .map(s => ({ id: str(s.icaoId), faaId: str(s.faaId) || null, name: str(s.site), state: str(s.state), country: str(s.country), lat: s.lat, lon: s.lon, elevFt: Number.isFinite(s.elev) ? Math.round(s.elev * 3.28084) : null, taf: s.siteType.includes("TAF") }));
}

const HAZARD = {
  IFR: "IFR conditions",
  MT_OBSC: "Mountains obscured",
  "TURB-HI": "Turbulence (high)",
  "TURB-LO": "Turbulence (low)",
  ICE: "Icing",
  LLWS: "Low-level wind shear",
  SFC_WND: "Strong surface winds",
  CONVECTIVE: "Convective SIGMET",
  TS: "Thunderstorms",
  TURB: "Turbulence",
  ICING: "Icing",
  VA: "Volcanic ash",
  MTN_OBSCN: "Mountains obscured",
};

const fl = v => (v === null || v === undefined || v === "" ? null : /^\d{3}$/.test(String(v)) ? Number(v) * 100 : num(v));

/** G-AIRMETs and SIGMETs as polygons: [{ id, kind, hazard, label, severity, baseFt, topFt, from, to, coords: [[lat, lon]] }]. */
export function parseHazards(gairmets, sigmets) {
  const out = [];
  for (const g of Array.isArray(gairmets) ? gairmets : []) {
    if (g.geometryType !== "AREA" || !HAZARD[g.hazard] || !Array.isArray(g.coords)) continue;
    const valid = Date.parse(g.validTime);
    out.push({
      id: `g-${g.tag}-${g.hazard}-${g.forecastHour}`,
      kind: "G-AIRMET",
      hazard: g.hazard,
      label: HAZARD[g.hazard],
      severity: str(g.severity) || null,
      dueTo: str(g.due_to) || null,
      baseFt: g.base === "SFC" ? 0 : fl(g.base),
      topFt: fl(g.top),
      from: Number.isFinite(valid) ? valid : null,
      to: Number.isFinite(g.expireTime) ? g.expireTime * 1000 : null,
      forecastHour: num(g.forecastHour),
      coords: g.coords.map(c => [Number(c.lat), Number(c.lon)]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)),
    });
  }
  for (const s of Array.isArray(sigmets) ? sigmets : []) {
    if (!Array.isArray(s.coords) || s.coords.length < 3) continue;
    const kind = str(s.airSigmetType) || "SIGMET";
    out.push({
      id: `s-${s.airSigmetId ?? s.seriesId ?? out.length}-${s.hazard}`,
      kind: kind === "AIRMET" ? "AIRMET" : kind === "CONVECTIVE" || s.hazard === "CONVECTIVE" ? "Convective SIGMET" : "SIGMET",
      hazard: str(s.hazard),
      label: HAZARD[s.hazard] ?? str(s.hazard),
      severity: num(s.severity) ? `Severity ${s.severity}` : null,
      dueTo: null,
      baseFt: num(s.altitudeLow1) ?? num(s.base),
      topFt: num(s.altitudeHi1) ?? num(s.altitudeHi2) ?? num(s.top),
      from: Number.isFinite(s.validTimeFrom) ? s.validTimeFrom * 1000 : null,
      to: Number.isFinite(s.validTimeTo) ? s.validTimeTo * 1000 : null,
      raw: str(s.rawAirSigmet) || str(s.rawSigmet),
      coords: s.coords.map(c => [Number(c.lat), Number(c.lon)]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)),
    });
  }
  // Keep the soonest forecast of each G-AIRMET, so a route sees one copy.
  const best = new Map();
  for (const h of out) {
    const key = h.kind === "G-AIRMET" ? h.id.replace(/-\d+$/, "") : h.id;
    const cur = best.get(key);
    if (!cur || (h.forecastHour ?? 0) < (cur.forecastHour ?? 0)) best.set(key, h);
  }
  return [...best.values()].filter(h => h.coords.length >= 3);
}

const CATEGORY = { A1: "Light plane", A2: "Small plane", A3: "Airliner", A4: "Large jet", A5: "Heavy jet", A6: "Fast jet", A7: "Helicopter", B1: "Glider", B2: "Balloon", B4: "Ultralight", B6: "Drone", C1: "Ground vehicle", C2: "Ground vehicle" };

/** adsb.lol aircraft to [{ hex, callsign, reg, type, lat, lon, altFt, gsKt, track, vsFpm, squawk, ground, seen, category, emergency }]. */
export function parseTraffic(body) {
  return (Array.isArray(body?.ac) ? body.ac : [])
    .filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon) && str(a.hex))
    .map(a => ({
      hex: str(a.hex).replace(/^~/, ""),
      callsign: str(a.flight) || null,
      reg: str(a.r) || null,
      type: str(a.t) || null,
      desc: str(a.desc) || null,
      lat: a.lat,
      lon: a.lon,
      ground: a.alt_baro === "ground",
      altFt: a.alt_baro === "ground" ? 0 : num(a.alt_baro) ?? num(a.alt_geom),
      gsKt: num(a.gs),
      track: num(a.track) ?? num(a.true_heading),
      vsFpm: num(a.baro_rate) ?? num(a.geom_rate),
      squawk: str(a.squawk) || null,
      emergency: str(a.emergency) && a.emergency !== "none" ? a.emergency : null,
      category: CATEGORY[str(a.category)] ?? null,
      seen: num(a.seen_pos) ?? num(a.seen),
      distNm: num(a.dst),
    }))
    .sort((a, b) => (a.distNm ?? 0) - (b.distNm ?? 0));
}
