// What each app contains, flattened into one shape for the catalog view:
//   { groups: [{ title, items: [{ id, title, meta, text, list, choices, href }] }] }
// Each loader imports the app's own data on demand, so the developer area
// stays light until a catalog is opened. Imports use `* as`, so an app that
// renames an export shows an empty catalog instead of breaking the build.

const groupBy = (items, keyOf, titleOf = k => k) => {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item) ?? "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map].map(([key, list]) => ({ title: titleOf(key), items: list }));
};

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export async function cookfox() {
  // recipes.js already includes the extra and world collections.
  const { recipes = [] } = await import("../../cook/data/recipes.js");
  const items = recipes.map(r => ({
    id: r.id,
    title: r.title,
    meta: [r.cuisine, r.difficulty && cap(r.difficulty), r.time?.total && `${r.time.total} min`, r.servings && `serves ${r.servings}`]
      .filter(Boolean)
      .join(" · "),
    text: r.description,
    tags: [...(r.meals ?? []), ...(r.tags ?? [])],
    group: (r.meals ?? ["other"])[0],
    href: `/cook?r=${encodeURIComponent(r.id)}`,
  }));
  return { groups: groupBy(items, i => i.group, k => cap(k)) };
}

export async function growfox() {
  const { PLANTS = [], TYPES = [] } = await import("../../grow/data/plants.js");
  const typeName = new Map(TYPES.map(t => [t.id, t.name]));
  const items = PLANTS.map(p => ({
    id: p.id,
    title: p.name,
    meta: [p.latin, p.size, p.spacing && `space ${p.spacing}`, p.days && `${p.days} days`].filter(Boolean).join(" · "),
    text: p.tip,
    list: (p.care ?? []).map(c => (typeof c === "string" ? c : `${cap(c.kind)} ${c.freq}${c.note ? `: ${c.note}` : ""}`)),
    tags: p.tags,
    group: p.type,
  }));
  return { groups: groupBy(items, i => i.group, k => typeName.get(k) ?? cap(k)) };
}

export async function medicfox() {
  const [q, s, k] = await Promise.all([
    import("../../medic/data/questions.js"),
    import("../../medic/data/skills.js"),
    import("../../medic/data/knowledge.js"),
  ]);
  const skills = (s.SKILLS ?? []).map(x => ({
    id: `skill-${x.id}`,
    title: x.name,
    meta: [x.min?.toUpperCase(), x.minutes && `${x.minutes} min`, x.steps && `${x.steps.length} steps`].filter(Boolean).join(" · "),
    text: x.intro,
    list: (x.steps ?? []).map(step => step.label).filter(Boolean),
  }));
  const topics = (k.TOPICS ?? []).map(t => ({
    id: `topic-${t.id}`,
    title: t.title,
    meta: t.min?.toUpperCase(),
    text: t.summary,
    // A point is plain text, or { min, t } when only some levels learn it.
    list: (t.points ?? []).map(pt => (typeof pt === "string" ? pt : `${pt.min ? `[${pt.min.toUpperCase()}+] ` : ""}${pt.t}`)),
  }));
  const questions = (q.QUESTIONS ?? []).map(x => ({
    id: `q-${x.id}`,
    title: x.text,
    meta: [x.min?.toUpperCase(), x.topic].filter(Boolean).join(" · "),
    choices: { options: x.choices, answer: x.answer, why: x.why },
  }));
  return {
    groups: [
      { title: "Skill sheets", items: skills },
      { title: "Study topics", items: topics },
      { title: "Practice questions", items: questions },
    ],
  };
}

export async function flyfox() {
  const [q, t] = await Promise.all([import("../../fly/data/questions.js"), import("../../fly/data/topics.js")]);
  const topics = (t.TOPICS ?? []).map(x => ({
    id: `topic-${x.id}`,
    title: x.title,
    meta: (x.exams ?? []).join(", ").toUpperCase(),
    list: (x.sections ?? []).map(sec => sec.h).filter(Boolean),
  }));
  const questions = (q.QUESTIONS ?? []).map(x => ({
    id: `q-${x.id}`,
    title: x.text,
    meta: [x.topic, x.ref].filter(Boolean).join(" · "),
    choices: { options: x.choices, answer: x.answer, why: x.why },
  }));
  return { groups: [{ title: "Study topics", items: topics }, ...groupBy(questions, i => i.meta.split(" · ")[0], k => `Questions: ${k}`)] };
}

export async function calmfox() {
  const { sessions = [], goals = [], KINDS = {} } = await import("../../calm/data/sessions.js");
  const goalName = new Map(goals.map(g => [g.id, g.name]));
  const items = sessions.map(x => ({
    id: x.id,
    title: x.title,
    meta: [KINDS[x.kind] ?? x.kind, x.minutes && `${x.minutes} min`].filter(Boolean).join(" · "),
    text: x.summary,
    list: [...(x.opening ?? []), ...(x.prompts ?? []).slice(0, 4)],
    group: x.goal,
  }));
  return { groups: groupBy(items, i => i.group, k => goalName.get(k) ?? cap(k)) };
}

export async function toolfox() {
  const reg = await import("../../tools/registry.js");
  const cats = new Map((reg.CATEGORIES ?? []).map(c => [c.id, c.name]));
  const calcs = (reg.CALCS ?? []).map(c => ({ id: c.id, title: c.name, text: c.blurb, group: c.cat, href: `/tools/calc/${c.id}` }));
  const builders = (reg.BUILDERS ?? []).map(b => ({ id: b.id, title: b.name, text: b.blurb, href: b.path }));
  const tables = (reg.TABLES ?? []).map(t => ({ id: t.id, title: t.name ?? t.title ?? t.id, text: t.blurb, href: `/tools/data/${t.id}` }));
  return {
    groups: [
      { title: "Builders", items: builders },
      ...groupBy(calcs, i => i.group, k => `Calculators: ${cats.get(k) ?? k}`),
      { title: "Reference tables", items: tables },
    ],
  };
}

export async function bodyfox() {
  const { NOTES = [] } = await import("../../body/data/notes.js");
  // Each note matches part names by a pattern like /^femur/; show it as a name.
  const nameOf = n =>
    cap(String(n.match?.source ?? n.name ?? "").replace(/^\^/, "").replace(/[\\()[\]|?*+$]/g, " ").replace(/\s+/g, " ").trim());
  const items = NOTES.map((n, i) => ({ id: String(i), title: nameOf(n) || `Part ${i + 1}`, text: n.text ?? "" }));
  return { groups: [{ title: "Body parts with notes", items }] };
}

export async function leapfox() {
  const { drills = [], KINDS = [] } = await import("../../leap/data/drills.js");
  const { GOALS = [] } = await import("../../leap/data/goals.js");
  const kindName = new Map(KINDS.map(k => [k.id, k.name]));
  const legs = { two: "two feet", one: "one foot", split: "alternating", either: "any" };
  const items = drills.map(d => ({
    id: d.id,
    title: d.name,
    meta: [legs[d.legs], `level ${d.level}`, `${d.reps} ${d.unit}${d.perSide ? " each side" : ""}`].filter(Boolean).join(" · "),
    text: d.tip,
    list: d.steps,
    group: d.kind,
    href: `/leap?tab=drills&drill=${encodeURIComponent(d.id)}`,
  }));
  const goals = GOALS.map(g => ({
    id: `goal-${g.id}`,
    title: g.name,
    meta: [`${g.takeoff === "both" ? "one & two feet" : g.takeoff === "one" ? "one-foot" : "two-foot"} takeoff`, g.approach ? "with sprints" : null].filter(Boolean).join(" · "),
    text: g.blurb,
    list: [`Sport drills: ${g.sport.join(", ")}`, `Tests: ${g.tests.join(", ")}`],
  }));
  return { groups: [{ title: "Sports & events", items: goals }, ...groupBy(items, i => i.group, k => kindName.get(k) ?? cap(k))] };
}

export async function readyfox() {
  const [{ JOBS = [], BRANCHES = [], EVENTS = {}, SOURCES = {} }, { AFT_TABLES = {} }, scoring] = await Promise.all([
    import("../../ready/data/jobs.js"),
    import("../../ready/data/aftTables.js"),
    import("../../ready/model/scoring.js"),
  ]);
  const branchName = new Map(BRANCHES.map(b => [b.id, b.name]));
  const items = JOBS.map(j => {
    const std = scoring.standardsFor?.(j, { sex: "m", age: 20 }, AFT_TABLES) ?? [];
    const fmt = (id, v) => (v == null ? "–" : typeof v === "object" ? Object.entries(v).map(([k, n]) => `${n} ${k}`).join(" or ") : scoring.fmtResult?.(id, v) ?? String(v));
    return {
      id: j.id,
      title: j.name,
      meta: [j.code, j.test.name, j.test.scoring === "aft" && `pass ${j.test.passTotal}+ (60 per event)`].filter(Boolean).join(" · "),
      text: [j.blurb, j.test.note].filter(Boolean).join(" "),
      list: [
        ...std.map(s => `${EVENTS[s.id]?.name}: min ${fmt(s.id, s.min)}${s.aim != null ? `, aim ${fmt(s.id, s.aim)}` : ""}${j.test.scoring === "aft" ? " (age 17-21)" : ""}`),
        ...j.test.sources.map(id => `Source: ${SOURCES[id]?.name} (${SOURCES[id]?.url})`),
      ],
      group: j.branch,
      href: "/ready",
    };
  });
  return { groups: groupBy(items, i => i.group, k => branchName.get(k) ?? cap(k)) };
}
