// What BodyFox shares with StudyFox: the parts of the body that have a
// write-up, one deck per layer (bones, muscles, organs...), plus a deck for
// sorting parts into their body systems. Each card opens that part in the
// 3D body. StudyFox loads this on demand (see src/app/studyLinks.js).
import { KINDS } from "../data/kinds.js";
import { NOTES } from "../data/notes.js";
import { LAYERS, baseName, displayName } from "./parts.js";

let partsPromise = null;
/** The parts list BodyFox's viewer uses: [{ id, name, layer, kind }]. */
function defaultLoadParts() {
  partsPromise ??= fetch("/anatomy/index.json")
    .then(r => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load the body"))))
    .then(d => d.parts)
    .catch(e => {
      partsPromise = null;
      throw e;
    });
  return partsPromise;
}

/** Every part with a write-up, as a card, with its layer as the group. */
export function bodyCards(parts) {
  const cards = [];
  const seen = new Set();
  for (const note of NOTES) {
    const part = parts.find(p => note.match.test(baseName(p.name)));
    if (!part) continue;
    const name = displayName(baseName(part.name));
    if (seen.has(name)) continue;
    seen.add(name);
    cards.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), front: name, back: note.text, layer: part.layer, href: `/body?part=${encodeURIComponent(part.id)}` });
  }
  for (const [kind, info] of Object.entries(KINDS)) {
    const part = parts.find(p => p.kind === kind);
    if (!part || seen.has(info.label)) continue;
    seen.add(info.label);
    cards.push({ id: `kind-${kind.replace(/[^a-z0-9]+/g, "-")}`, front: info.label, back: info.text, layer: part.layer, href: `/body?part=${encodeURIComponent(part.id)}` });
  }
  return cards.map(c => ({ ...c, group: LAYERS.find(l => l.id === c.layer)?.name }));
}

export function decks() {
  return [
    ...LAYERS.filter(l => l.id !== "skin").map(l => ({ id: l.id, title: l.name, blurb: `${l.blurb}: names and what each does.`, group: "Anatomy" })),
    { id: "systems", title: "Sort parts by body system", blurb: "Bones, muscles, organs, vessels and nerves, mixed together to sort.", group: "Anatomy" },
  ];
}

export async function deck(id, { loadParts = defaultLoadParts } = {}) {
  const layer = LAYERS.find(l => l.id === id);
  if (!layer && id !== "systems") return null;
  const all = bodyCards(await loadParts());
  if (id === "systems") {
    return { id, title: "Sort parts by body system", href: "/body", cards: all };
  }
  const cards = all.filter(c => c.layer === id).map(c => ({ ...c, group: undefined }));
  return {
    id,
    title: layer.name,
    blurb: layer.blurb,
    href: "/body",
    cards,
    diagrams: cards.slice(0, 12).map(c => ({ title: c.front, href: c.href, blurb: "See it in the 3D body, take it apart and turn it around." })),
  };
}
