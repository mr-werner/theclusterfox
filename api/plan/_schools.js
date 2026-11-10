// Public schools in a ZIP code, from the federal NCES school directory
// (Common Core of Data), served by NCES's own public map service. Free, no
// key, and current: it's the 2024–25 directory as of this writing.
// https://data-nces.opendata.arcgis.com/datasets/nces::public-school-characteristics-current

const QUERY_URL = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/School_Characteristics_Current/FeatureServer/1/query";
const FIELDS = ["NCESSCH", "SCH_NAME", "LEA_NAME", "LCITY", "GSLO", "GSHI", "SCHOOL_LEVEL", "CHARTER_TEXT", "SY_STATUS_TEXT", "LATCOD", "LONCOD"];
const ORDER = ["elementary", "middle", "high", "other"];
const LEVEL = { elementary: "elementary", primary: "elementary", middle: "middle", high: "high", secondary: "high" };
// NCES grade codes: PK, KG, 01–13, UG (ungraded), AE (adult ed), N (none).
const grade = g => {
  const code = String(g ?? "").trim().toUpperCase();
  if (code === "PK") return "PK";
  if (code === "KG") return "K";
  if (/^\d{1,2}$/.test(code)) return String(Number(code));
  return null;
};

/** Directory rows (NCES attribute names) to the list the finder shows. */
export function parseSchools(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => row?.attributes ?? row)
    .filter(s => s?.SCH_NAME && !/closed|inactive|future/i.test(s.SY_STATUS_TEXT ?? ""))
    .map(s => ({
      id: String(s.NCESSCH ?? `${s.SCH_NAME}-${s.LCITY}`),
      name: s.SCH_NAME,
      district: s.LEA_NAME ?? "",
      level: LEVEL[String(s.SCHOOL_LEVEL ?? "").trim().toLowerCase()] ?? "other",
      grades: [grade(s.GSLO), grade(s.GSHI)].filter(Boolean).join("–"),
      city: s.LCITY ?? "",
      latitude: Number.isFinite(s.LATCOD) ? s.LATCOD : null,
      longitude: Number.isFinite(s.LONCOD) ? s.LONCOD : null,
      charter: /^yes$/i.test(s.CHARTER_TEXT ?? ""),
    }))
    .sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level) || a.name.localeCompare(b.name));
}

async function query(zip) {
  const url = new URL(QUERY_URL);
  url.searchParams.set("where", `LZIP='${zip}'`);
  url.searchParams.set("outFields", FIELDS.join(","));
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("resultRecordCount", "200");
  url.searchParams.set("f", "json");
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`NCES request failed with status ${response.status}`);
  const body = await response.json();
  // The map service reports its own errors inside a 200 answer.
  if (body.error) throw new Error(`NCES error ${body.error.code}: ${body.error.message}`);
  return body.features ?? [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const zip = String(req.query.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: "Enter a 5-digit US ZIP code." });
  }

  // The service now and then answers a good query with an error, so try a
  // couple more times before giving up.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const schools = parseSchools(await query(zip));
      res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=2592000");
      return res.status(200).json({ zip, schools });
    } catch (error) {
      lastError = error;
    }
  }
  console.error("School directory error:", lastError);
  return res.status(502).json({ error: "The school directory isn't responding. Try again in a moment." });
}
