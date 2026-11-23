// Climbing grades: reading them, ordering them and converting between
// systems. Conversions are the common published equivalences; charts
// disagree by about a grade, so the app calls them approximate.

// Roped grades, easiest to hardest. Each row: YDS, French, UIAA, Ewbank.
export const ROPE_TABLE = [
  ["5.4", "3", "III", "11"],
  ["5.5", "4a", "IV", "12"],
  ["5.6", "4b", "IV+", "13"],
  ["5.7", "4c", "V-", "15"],
  ["5.8", "5a", "V", "16"],
  ["5.9", "5b", "VI-", "17"],
  ["5.10a", "5c", "VI", "18"],
  ["5.10b", "6a", "VI+", "19"],
  ["5.10c", "6a+", "VII-", "20"],
  ["5.10d", "6b", "VII", "20"],
  ["5.11a", "6b+", "VII+", "21"],
  ["5.11b", "6c", "VIII-", "22"],
  ["5.11c", "6c+", "VIII-", "22"],
  ["5.11d", "7a", "VIII", "23"],
  ["5.12a", "7a+", "VIII+", "24"],
  ["5.12b", "7b", "IX-", "25"],
  ["5.12c", "7b+", "IX-", "26"],
  ["5.12d", "7c", "IX", "27"],
  ["5.13a", "7c+", "IX+", "28"],
  ["5.13b", "8a", "X-", "29"],
  ["5.13c", "8a+", "X-", "30"],
  ["5.13d", "8b", "X", "31"],
  ["5.14a", "8b+", "X+", "32"],
  ["5.14b", "8c", "XI-", "33"],
  ["5.14c", "8c+", "XI", "34"],
  ["5.14d", "9a", "XI+", "35"],
  ["5.15a", "9a+", "XI+", "35"],
  ["5.15b", "9b", "XII-", "36"],
  ["5.15c", "9b+", "XII", "37"],
  ["5.15d", "9c", "XII+", "38"],
];

// Boulder grades: V scale and Fontainebleau.
export const BOULDER_TABLE = [
  ["VB", "3"],
  ["V0", "4"],
  ["V1", "5"],
  ["V2", "5+"],
  ["V3", "6A"],
  ["V4", "6B"],
  ["V5", "6C"],
  ["V6", "7A"],
  ["V7", "7A+"],
  ["V8", "7B"],
  ["V9", "7C"],
  ["V10", "7C+"],
  ["V11", "8A"],
  ["V12", "8A+"],
  ["V13", "8B"],
  ["V14", "8B+"],
  ["V15", "8C"],
  ["V16", "8C+"],
  ["V17", "9A"],
];

/**
 * A YDS grade as a number that sorts: 5.9 -> 9, 5.10a -> 10, 5.10b -> 10.25,
 * 5.10c -> 10.5, 5.10d -> 10.75, 5.11- -> 11.1, 5.11+ -> 11.6, 5.10a/b -> 10.1.
 * null for anything that isn't YDS.
 */
export function ydsScore(grade) {
  const m = String(grade ?? "").trim().match(/^5\.(\d{1,2})\s*([abcd](?:\/[abcd])?)?\s*([+-])?/i);
  if (!m) return null;
  const base = Number(m[1]);
  if (base > 15) return null;
  const letters = m[2]?.toLowerCase();
  if (letters) {
    const v = letters.split("/").map(l => "abcd".indexOf(l) * 0.25);
    return base + v.reduce((a, b) => a + b, 0) / v.length + (v.length > 1 ? 0.01 : 0);
  }
  if (m[3] === "-") return base + (base >= 10 ? 0.1 : -0.2);
  if (m[3] === "+") return base + (base >= 10 ? 0.6 : 0.3);
  return base + (base >= 10 ? 0.375 : 0);
}

/** V0 -> 0, V4-5 -> 4.5, V3+ -> 3.3, VB -> -1. null when not a V grade. */
export function vScore(grade) {
  const g = String(grade ?? "").trim().toUpperCase();
  if (/^VB/.test(g)) return -1;
  const m = g.match(/^V(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*([+-])?/);
  if (!m) return null;
  let v = Number(m[1]);
  if (m[2]) v = (v + Number(m[2])) / 2;
  if (m[3] === "+") v += 0.3;
  if (m[3] === "-") v -= 0.3;
  return v;
}

/** The grade to show for a route, and which kind it is. */
export function mainGrade(climb) {
  const g = climb?.grades ?? {};
  const boulder = climb?.types?.includes("bouldering");
  if (boulder && g.vscale) return { text: g.vscale, kind: "boulder", score: vScore(g.vscale) };
  if (g.yds && ydsScore(g.yds) !== null) return { text: g.yds, kind: "rope", score: ydsScore(g.yds) };
  if (g.vscale) return { text: g.vscale, kind: "boulder", score: vScore(g.vscale) };
  if (g.french) return { text: g.french, kind: "rope", score: frenchToYdsScore(g.french) };
  if (g.font) return { text: g.font, kind: "boulder", score: fontToV(g.font) };
  if (g.wi) return { text: g.wi, kind: "ice", score: null };
  if (g.ewbank) return { text: g.ewbank, kind: "rope", score: null };
  if (g.uiaa) return { text: g.uiaa, kind: "rope", score: null };
  if (g.yds) return { text: g.yds, kind: "rope", score: null };
  return { text: "?", kind: "rope", score: null };
}

function frenchToYdsScore(fr) {
  const row = ROPE_TABLE.find(r => r[1].toLowerCase() === String(fr).trim().toLowerCase());
  return row ? ydsScore(row[0]) : null;
}

function fontToV(font) {
  const row = BOULDER_TABLE.find(r => r[1].toUpperCase() === String(font).trim().toUpperCase());
  return row ? vScore(row[0]) : null;
}

/** The nearest row of a table for a score. */
function nearestRow(table, score, scoreOf) {
  let best = null;
  let gap = Infinity;
  for (const row of table) {
    const d = Math.abs(scoreOf(row[0]) - score);
    if (d < gap) {
      gap = d;
      best = row;
    }
  }
  return best;
}

/** Every equivalent for a grade: [{ system, grade }]. */
export function equivalents(climb) {
  const m = mainGrade(climb);
  if (m.score === null) return [];
  if (m.kind === "boulder") {
    const row = nearestRow(BOULDER_TABLE, m.score, vScore);
    return [{ system: "V scale", grade: row[0] }, { system: "Font", grade: row[1] }];
  }
  const row = nearestRow(ROPE_TABLE, m.score, ydsScore);
  return [
    { system: "YDS", grade: row[0] },
    { system: "French", grade: row[1] },
    { system: "UIAA", grade: row[2] },
    { system: "Ewbank", grade: row[3] },
  ];
}

/** Grade band, the same four buckets OpenBeta counts. */
export function band(climb) {
  const m = mainGrade(climb);
  if (m.score === null) return "unknown";
  if (m.kind === "boulder") return m.score < 3 ? "beginner" : m.score < 6 ? "intermediate" : m.score < 10 ? "advanced" : "expert";
  return m.score < 10 ? "beginner" : m.score < 12 ? "intermediate" : m.score < 14 ? "advanced" : "expert";
}

export const BANDS = [
  { id: "beginner", name: "Beginner", rope: "up to 5.9", boulder: "V0–V2" },
  { id: "intermediate", name: "Intermediate", rope: "5.10–5.11", boulder: "V3–V5" },
  { id: "advanced", name: "Advanced", rope: "5.12–5.13", boulder: "V6–V9" },
  { id: "expert", name: "Expert", rope: "5.14 and up", boulder: "V10 and up" },
];

/** Rough letter-free bucket for a pyramid: "5.10", "5.11", "V4"... */
export function pyramidBucket(climb) {
  const m = mainGrade(climb);
  if (m.score === null) return null;
  if (m.kind === "boulder") return m.score < 0 ? "VB" : `V${Math.floor(m.score)}`;
  return `5.${Math.floor(m.score)}`;
}

/** Choices for grade filters. */
export const ROPE_STEPS = ROPE_TABLE.map(r => r[0]);
export const BOULDER_STEPS = BOULDER_TABLE.map(r => r[0]);
