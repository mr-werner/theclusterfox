// Public schools in a ZIP code, from the Urban Institute's Education Data
// Portal (https://educationdata.urban.org), which republishes the federal
// NCES Common Core of Data school directory. Free, no key.

const BASE = "https://educationdata.urban.org/api/v1/schools/ccd/directory";
// Newest directory years first; the newest may not be published yet.
const YEARS = [2023, 2022, 2021];

const LEVELS = { 1: "elementary", 2: "middle", 3: "high" };
const grade = g => (g === -1 ? "PK" : g === 0 ? "K" : g > 0 ? String(g) : null);

export function parseSchools(results) {
  return (Array.isArray(results) ? results : [])
    .filter(s => s.school_name && s.school_status !== 2 && s.school_status !== 6)
    .map(s => ({
      id: String(s.ncessch ?? `${s.school_name}-${s.zip_location}`),
      name: s.school_name,
      district: s.lea_name ?? "",
      level: LEVELS[s.school_level] ?? "other",
      grades: [grade(s.lowest_grade_offered), grade(s.highest_grade_offered)].filter(Boolean).join("–"),
      city: s.city_location ?? "",
      latitude: Number.isFinite(s.latitude) ? s.latitude : null,
      longitude: Number.isFinite(s.longitude) ? s.longitude : null,
      charter: s.charter === 1,
    }))
    .sort((a, b) => ["elementary", "middle", "high", "other"].indexOf(a.level) - ["elementary", "middle", "high", "other"].indexOf(b.level) || a.name.localeCompare(b.name));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const zip = String(req.query.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: "Enter a 5-digit US ZIP code." });
  }

  try {
    for (const year of YEARS) {
      const response = await fetch(`${BASE}/${year}/?zip_location=${zip}`, { headers: { accept: "application/json" } });
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`Education Data request failed with status ${response.status}`);
      const body = await response.json();
      const schools = parseSchools(body.results);
      if (!schools.length && year !== YEARS[YEARS.length - 1]) continue;
      res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=2592000");
      return res.status(200).json({ zip, year, schools });
    }
    return res.status(200).json({ zip, year: null, schools: [] });
  } catch (error) {
    console.error("School directory error:", error);
    return res.status(502).json({ error: "The school directory isn't responding. Try again in a moment." });
  }
}
