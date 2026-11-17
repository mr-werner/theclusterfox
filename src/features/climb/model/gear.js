// What to pack for a climbing day, built from the routes you picked.
// OpenBeta often has no length or bolt count, so the list falls back to
// what covers most single-pitch crags and says so.

const M_TO_FT = 3.28084;

export function gearList(routes, { conditions } = {}) {
  const types = new Set(routes.flatMap(r => r.types));
  const roped = routes.some(r => !r.types.includes("bouldering") || r.types.length > 1);
  const boulder = types.has("bouldering");
  const lengths = routes.map(r => r.length).filter(Boolean);
  const bolts = routes.map(r => r.bolts).filter(Boolean);
  const longest = lengths.length ? Math.max(...lengths) : null;
  const multi = routes.some(r => (r.pitches ?? 1) > 1);
  const groups = [];

  const base = ["Climbing shoes", "Chalk bag and chalk", "Water and food", "Headlamp", "First-aid kit", "Guidebook notes or this plan offline"];
  groups.push({ title: "Everyone", items: base });

  if (roped) {
    const items = ["Harness", "Helmet", "Belay device and locking carabiner"];
    if (longest) {
      const need = longest * 2;
      const rope = need <= 60 ? 60 : need <= 70 ? 70 : need <= 80 ? 80 : null;
      items.push(rope ? `${rope} m rope (longest route ${Math.round(longest)} m / ${Math.round(longest * M_TO_FT)} ft, lowering needs twice that)` : `Two ropes or a long rope: the longest route is ${Math.round(longest)} m, too long to lower on one 80 m rope`);
    } else {
      items.push("70 m rope (covers most single-pitch crags; check route lengths)");
    }
    items.push("Tie a stopper knot in the rope's end, every time");
    groups.push({ title: "Roped climbing", items });
  }
  if (types.has("sport")) {
    const draws = bolts.length ? Math.max(...bolts) + 2 : 14;
    groups.push({ title: "Sport", items: [`${draws} quickdraws${bolts.length ? "" : " (most routes here have no bolt count listed)"}`, "Two locking carabiners and a sling for the anchor", "Personal anchor or extra sling for cleaning"] });
  }
  if (types.has("trad") || multi) {
    groups.push({ title: "Trad", items: ["Single rack of cams (about 0.3–3) plus a set of nuts", "Doubles in the sizes the route calls for", "6–10 alpine draws / slings", "Nut tool", "Cordelette or quad for anchors"] });
  }
  if (types.has("tr")) groups.push({ title: "Top rope", items: ["Static line or long slings to build the anchor", "Edge protector", "Two locking carabiners"] });
  if (multi) groups.push({ title: "Multi-pitch", items: ["Approach shoes clipped to your harness", "Rappel backup (prusik)", "Small pack with layers and water", "Know the descent before you start"] });
  if (boulder) groups.push({ title: "Bouldering", items: ["Crash pad (two or more for high problems)", "Brush for holds", "A spotter", "Small towel or mat for your feet"] });
  if (types.has("ice") || types.has("mixed")) groups.push({ title: "Ice and mixed", items: ["Ice tools and crampons", "Ice screws", "Warm belay parka", "Spare gloves"] });
  if (types.has("alpine")) groups.push({ title: "Alpine", items: ["Map, compass or offline GPS", "Rain shell and warm layer", "Turnaround time agreed before you go"] });

  if (conditions) {
    const extra = [];
    if (conditions.high >= 24) extra.push("Extra water and electrolytes", "Sun hat and sunscreen");
    if (conditions.low <= 8) extra.push("Puffy jacket for belaying", "Hand warmers");
    if (conditions.rainMm > 1) extra.push("Rain shell");
    if (extra.length) groups.push({ title: "For this forecast", items: extra });
  }
  return groups;
}
