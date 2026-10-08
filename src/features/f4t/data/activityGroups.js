import { activities } from './activities';

// Group only records that are genuinely variations of the same activity.
// Each option keeps its original Compendium ID, description and MET.
const rules = [
  ['Running', 'Running', /^Running(?:,|\s)/i, /^(?!Running,? (?:cross country|self-selected|stairs|on a track|on track|training|marathon|hilly terrain|\(Taylor))/i],
  ['Running', 'Jogging', /^Jogging(?:,|\s)/i],
  ['Running', 'Jogging stroller', /^Running, jogging stroller/i],
  ['Running', 'Running uphill', /^Running uphill/i],
  ['Running', 'Running downhill', /^Running downhill/i],
  ['Running', 'Curved treadmill running', /^Running(?:\/jogging)? curved treadmill/i],
  ['Running', 'Barefoot running', /^Running, barefoot/i],
  ['Running', 'Running with backpack', /^Running, .*backpack/i],
  ['Walking', 'Walking on level ground', /^Walking, (?:\d|less than|for exercise,? \d)/i],
  ['Walking', 'Treadmill walking', /^Walking,? treadmill,? \d/i],
  ['Bicycling', 'Road bicycling', /^Bicycling, (?:\d|<|>|≥)/i],
  ['Bicycling', 'Stationary cycling', /^Bicycling, stationary/i],
  ['Bicycling', 'Mountain biking', /^Bicycling, mountain/i],
  ['Bicycling', 'E-bike', /^E-bike/i],
  ['Conditioning Exercise', 'Elliptical trainer', /^Elliptical trainer/i],
  ['Conditioning Exercise', 'Resistance training', /^Resistance \(weight\)/i],
  ['Conditioning Exercise', 'Calisthenics', /^Calisthenics/i],
  ['Conditioning Exercise', 'Circuit training', /^Circuit training/i],
];

function familyFor(a) {
  const d = a.description;
  // More specific running families must take priority over generic Running.
  const priority = rules.filter(r => r[0] === a.category && r[1] !== 'Running');
  const generic = rules.filter(r => r[0] === a.category && r[1] === 'Running');
  const rule = [...priority, ...generic].find(r => r[2].test(d) && (!r[3] || r[3].test(d)));
  return rule?.[1] ?? null;
}

export function buildActivityGroups(source = activities) {
  const groups = new Map();
  for (const a of source) {
    const family = familyFor(a);
    const key = family ? `${a.category}::${family}` : `entry::${a.id}`;
    if (!groups.has(key)) groups.set(key, {
      key, title: family ?? a.description, category: a.category, options: []
    });
    groups.get(key).options.push(a);
  }
  return [...groups.values()].map(g => ({
    ...g,
    options: [...g.options].sort((a,b) => a.met - b.met || a.id.localeCompare(b.id)),
  }));
}
