// GPX in and out: open a route someone shared (or exported from another
// app) as a trail, and save your recorded hikes as GPX files. A small
// text parser so it works the same in the browser and in tests.

const attr = (tag, name) => {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return m ? Number(m[1]) : NaN;
};
const inner = (xml, name) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()) : null;
};
const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function points(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, "gi");
  let m;
  while ((m = re.exec(xml))) {
    const lat = attr(m[1], "lat");
    const lon = attr(m[1], "lon");
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const ele = m[2] ? Number(inner(m[2], "ele")) : NaN;
    const time = m[2] ? Date.parse(inner(m[2], "time") ?? "") : NaN;
    out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null, time: Number.isFinite(time) ? time : null, name: m[2] ? inner(m[2], "name") : null });
  }
  return out;
}

/** { name, line: [[lat, lon, ele|null]], waypoints: [{ name, lat, lon }] } or throws. */
export function parseGpx(xml) {
  if (typeof xml !== "string" || !/<gpx[\s>]/i.test(xml)) throw new Error("That file isn't a GPX file.");
  let pts = points(xml, "trkpt");
  if (pts.length < 2) pts = points(xml, "rtept");
  if (pts.length < 2) throw new Error("No track or route in that GPX file.");
  const metaName = inner(xml.replace(/<(trkpt|rtept|wpt)\b[\s\S]*?<\/\1>/gi, ""), "name");
  return {
    name: (metaName || "Imported trail").slice(0, 80),
    line: pts.map(p => [p.lat, p.lon, p.ele]),
    times: pts.map(p => p.time),
    waypoints: points(xml, "wpt")
      .filter(w => w.name)
      .slice(0, 50)
      .map(w => ({ name: w.name.slice(0, 60), lat: w.lat, lon: w.lon })),
  };
}

/** A GPX file for a recorded hike: points are [lat, lon, ele|null, unixSeconds]. */
export function toGpx({ name, points: pts, planned }) {
  const trkpts = pts
    .map(([lat, lon, ele, t]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${Number.isFinite(ele) ? `<ele>${ele.toFixed(1)}</ele>` : ""}${Number.isFinite(t) ? `<time>${new Date(t * 1000).toISOString()}</time>` : ""}</trkpt>`)
    .join("\n");
  const route = planned?.length
    ? `\n  <rte>\n    <name>${esc(name)} (planned)</name>\n${planned.map(([lat, lon]) => `    <rtept lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`).join("\n")}\n  </rte>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailFox (The ClusterFox)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name></metadata>${route}
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}
