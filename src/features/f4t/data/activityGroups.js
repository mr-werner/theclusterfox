import { activities } from './activities';

// The first matching rule wins. Keep equipment, load and terrain variants
// separate from ordinary speed-based activities. Never alter source METs.
const rules = [
  // Running: distinct equipment and conditions are separate cards.
  ['Running', 'Running with weighted backpack', /^Running, .*\bbackpack\b/i],
  ['Running', 'Running with jogging stroller', /^Running, jogging stroller/i],
  ['Running', 'Running barefoot', /^Running, barefoot/i],
  ['Running', 'Running on curved treadmill', /^Running(?:\/jogging)?,? curved treadmill/i],
  ['Running', 'Running uphill', /^Running uphill/i],
  ['Running', 'Running downhill', /^Running downhill/i],
  ['Running', 'Jogging', /^Jogging(?:,|\s)/i],
  ['Running', 'Running', /^Running,?\s*(?:\d+(?:\.\d+)?|[<>]\s*\d)/i],

  // Cycling: road speeds, power levels and cycling types are distinct.
  ['Bicycling', 'Mountain biking', /^Bicycling, mountain/i],
  ['Bicycling', 'Electric bicycling', /^E-bike/i],
  ['Bicycling', 'Stationary cycling', /^Bicycling, stationary, (?!RPM\/Spin bike class)/i],
  ['Bicycling', 'Concentric cycling', /^Bicycling, concentric only/i],
  ['Bicycling', 'Eccentric cycling', /^Bicycling, eccentric only/i],
  ['Bicycling', 'Road bicycling', /^Bicycling,\s*(?:[<>]\s*\d|\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*mph|leisure\s*\d|self-selected\s*(?:easy|moderate|vigorous))/i],

  // Water Activities: preserve different equipment and motion types.
  ['Water Activities', 'Aquatic cycling', /^Aquatic cycling/i],
  ['Water Activities', 'Water running', /^Water running/i],
  ['Water Activities', 'Stand-up paddleboarding', /^Stand up paddle ?board/i],
  ['Water Activities', 'Canoeing — rowing', /^Canoeing, rowing(?!, kayaking, competition)/i],
  ['Water Activities', 'Canoeing — competition', /^Canoeing or rowing, in competition/i],
  ['Water Activities', 'Rowing — on water', /^Rowing, (?!simulated|single scull, ergometer)/i],
  ['Water Activities', 'Rowing — simulated/ergometer', /^Rowing, (?:simulated|single scull, ergometer)/i],
  ['Water Activities', 'Kayaking', /^Kayaking,/i],
  ['Water Activities', 'Swimming — laps', /^Swimming, (?:laps|freestyle|crawl|breaststroke|backstroke|butterfly)/i],

  // Winter Activities: speeds and gradients are selectable source records.
  ['Winter Activities', 'Rollerskiing', /^Rollerskiing,/i],
  ['Winter Activities', 'Cross-country skiing', /^Skiing, cross[ -]country/i],
  ['Winter Activities', 'Skating treadmill', /^Skating Treadmill/i],
  ['Winter Activities', 'Snow shoveling', /^Snow shoveling/i],
  ['Winter Activities', 'Downhill skiing', /^Skiing, downhill/i],

  // Sports: keep equipment or technique distinct; combine documented effort/rate variants.
  ['Sports', 'Boxing — punching bag', /^Boxing, punching bag/i],
  ['Sports', 'Race walking', /^Race Walking/i],
  ['Sports', 'Rock climbing', /^Rock climbing, (?!rappelling)/i],
  ['Sports', 'Rope jumping', /^Rope jumping/i],
  ['Sports', 'Longboarding', /^Skateboard, longboard/i],
  ['Sports', 'Skateboarding', /^Skateboarding,/i],
  ['Sports', 'Rollerblading', /^Rollerblading,/i],
  ['Sports', 'Basketball', /^Basketball, (?:game|general|drills|shooting baskets|non-game)/i],
  ['Sports', 'Badminton', /^Badminton,/i],
  ['Sports', 'Tennis', /^Tennis,/i],
  ['Sports', 'Soccer', /^Soccer,/i],
  ['Sports', 'Volleyball', /^Volleyball,/i],

  // Occupation: do not merge unloaded walking with loaded walking.
  ['Occupation', 'Soldiers — walking with load/incline', /^Soldiers, walking/i],
  ['Occupation', 'Soldiers — military marching', /^Soldiers, military/i],
  ['Occupation', 'Walking on job — carrying', /^Walking(?: on job)?,.*carrying/i],
  ['Occupation', 'Walking on job', /^Walking on job,/i],
  ['Occupation', 'Walking — carrying load', /^Walking or walk downstairs or standing, carrying/i],
  ['Occupation', 'Shoveling', /^Shoveling,/i],
  ['Occupation', 'Forestry — axe chopping', /^Forestry, ax chopping/i],
  ['Occupation', 'Forestry — other work', /^Forestry, (?:moderate|vigorous)/i],
  ['Occupation', 'Carrying loads', /^Carrying (?:heavy|moderate) loads/i],
  ['Occupation', 'Active workstation — treadmill', /^Active workstation, treadmill desk/i],

  // Conditioning Exercise.
  ['Conditioning Exercise', 'Rowing — stationary ergometer', /^Rowing, stationary/i],
  ['Conditioning Exercise', 'Jumping rope machine', /^Jumping rope,/i],
  ['Conditioning Exercise', 'Stair climbing machine', /^(?:Stair treadmill|Stair climbing machine|Stair-step machine)/i],

  // Carrying, climbing and shoveling in their original categories.
  ['Lawn & Garden', 'Carrying or stacking wood', /^Carrying, loading or stacking wood/i],
  ['Lawn & Garden', 'Snow shoveling', /^Shoveling snow/i],
  ['Lawn & Garden', 'Digging and shoveling', /^(?:Digging|Shoveling dirt)/i],
  ['Home Activities', 'Carrying groceries', /^Carrying groceries/i],
  ['Home Activities', 'Walking while carrying child', /^Walking and carrying small child/i],
  ['Home Activities', 'Playing with children — walking/running', /^Walking\/running, playing with child/i],
  ['Home Repair', 'Shoveling dirt', /^Spreading dirt with a shovel/i],
  ['Transportation', 'Bicycling for transportation', /^Bicycling for transportation/i],
  ['Religious Activities', 'Walking', /^Walking,/i],
  ['Volunteer Activities', 'Walking — carrying/pushing', /^Walking,.*(?:carrying|pushing)/i],
  ['Volunteer Activities', 'Walking', /^Walking,/i],

  // Walking: level speeds vs treadmill, grades and special conditions.
  ['Walking', 'Treadmill walking', /^Walking,? treadmill/i],
  ['Walking', 'Level walking', /^Walking,\s*(?:less than|\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*mph)/i],

  ['Walking', 'Walking uphill', /^Walking,.*(?:uphill|\bgrade\b)/i],
  ['Walking', 'Walking downhill', /^Walking,.*downhill/i],
  ['Walking', 'Nordic walking', /^Walking,.*(?:ski poles|Nordic walking)/i],
  ['Walking', 'Walking with a load', /^Walking,.*(?:load|carrying)/i],

  ['Conditioning Exercise', 'Elliptical trainer', /^Elliptical trainer/i],
  ['Conditioning Exercise', 'Resistance training', /^Resistance \(weight\)/i],
  ['Conditioning Exercise', 'Calisthenics', /^Calisthenics/i],
  ['Conditioning Exercise', 'Circuit training', /^Circuit training/i],
];


// A group has ONE adjustable measurement. Unit conversions (mph/kmh, kg/lb,
// W/watts) are display choices, not different measurement types.
const measurementPatterns = {
  power: /\b(?:watts?|W)\b/i,
  speed: /\b(?:mph|km\s*\/\s*h|kmh|kph|min\s*\/\s*mile)\b/i,
  incline: /(?:%\s*(?:grade|incline|slope)?|\b(?:grade|incline)\s*[-+]?\d|\b\d+(?:\.\d+)?\s*degrees?\b)/i,
  load: /\b(?:kg|kilograms?|lbs?|pounds?)\b/i,
  cadence: /\b(?:rpm|strokes?\s*\/\s*min|steps?\s*\/\s*min|jumps?\s*\/\s*min|punches?\s*\/\s*min|b\s*\/\s*min)\b/i,
  duration: /\b\d+(?:\.\d+)?\s*(?:minutes?|seconds?|min|sec)\b/i,
  distance: /\b\d+(?:\.\d+)?\s*(?:miles?|meters?|kilometers?|km)\b/i,
  intensity: /\b(?:very light|light|moderate|vigorous|very vigorous|easy|hard|low intensity|high intensity|general effort)\b/i,
  assistance: /\b(?:without electronic support|light electronic support|high electronic support)\b/i,
};
const unitLabels = {power:'Watts',speed:'Speed',incline:'Incline',load:'Load',cadence:'Cadence',duration:'Duration',distance:'Distance',intensity:'Intensity',assistance:'Assistance'};

function familyFor(activity) {
  return rules.find(([category, , pattern]) =>
    category === activity.category && pattern.test(activity.description)
  )?.[1] ?? null;
}

// Strip the varying measurement but preserve all other documented conditions.
// Do not collapse treadmill grade, equipment, carrying load, or technique.
function conditionSignature(description, dimension) {
  const s=description.toLowerCase();
  const fixed=[];
  // Do not mix records with differing values of another quantitative measure.
  for (const [type, pattern] of Object.entries(measurementPatterns)) {
    if (type===dimension || type==='intensity' || (dimension==='speed' && (type==='duration' || type==='distance'))) continue;
    const matches=s.match(new RegExp(pattern.source, 'gi'));
    if (matches?.length) {
      // Preserve the complete clause, not just the unit token.
      const clauses=s.split(/[,;]/).filter(c=>new RegExp(pattern.source,'i').test(c));
      fixed.push(type+':'+clauses.join('|').trim());
    }
  }
  // Preserve environmental/equipment conditions even when the measurement
  // being adjusted is the same. These are not adjustable dimensions.
  for (const marker of ['indoors','outdoors','seated','standing','uphill','downhill','treadmill',
    'curved','backward','barefoot','stroller','backpack','mountain','road','flat water',
    'competitive','drafting','not drafting','with poles','without poles']) {
    if (s.includes(marker)) fixed.push('context:'+marker);
  }
  return fixed.sort().join('::');
}

function measurementFor(description) {
  return Object.keys(measurementPatterns).filter(k=>measurementPatterns[k].test(description));
}
function firstNumber(description, dimension) {
  const re = {
    speed:/([<>]?\s*\d+(?:\.\d+)?)\s*(?:[-–]|to\s*\d+(?:\.\d+)?)?\s*(?:mph|km\s*\/\s*h|kmh|kph)/i,
    power:/([<>]?\s*\d+(?:\.\d+)?)\s*(?:[-–]|to\s*\d+(?:\.\d+)?)?\s*(?:watts?|w)\b/i,
    incline:/([-+]?\d+(?:\.\d+)?)\s*%/i,
    load:/([<>]?\s*\d+(?:\.\d+)?)\s*(?:[-–]|to\s*\d+(?:\.\d+)?)?\s*(?:kg|lbs?|pounds?)\b/i,
    cadence:/([<>]?\s*\d+(?:\.\d+)?)\s*(?:[-–]|to\s*\d+(?:\.\d+)?)?\s*(?:rpm|strokes?\s*\/\s*min|steps?\s*\/\s*min|b\s*\/\s*min)/i,
  }[dimension];
  const n = re?.exec(description)?.[1]?.replace(/[<>\s]/g,'');
  if (n != null) return Number(n);
  if (dimension==='intensity') {
    const v=description.toLowerCase();
    return /very light/.test(v)?0:/light|easy/.test(v)?1:/moderate/.test(v)?2:/very vigorous/.test(v)?4:/vigorous|hard/.test(v)?3:99;
  }
  return Number.POSITIVE_INFINITY;
}

// Only allow adjustable families where two or more source records share the
// same measurement AND fixed-condition signature. All others remain standalone.
export function buildActivityGroups(source = activities) {
  const candidates = new Map();
  for (const a of source) {
    const family=familyFor(a);
    const dimensions=measurementFor(a.description);
    if (!family || !dimensions.length) continue;
    for (const dimension of dimensions) {
      // Other measurement types are held fixed via their literal descriptions.
      const signature=conditionSignature(a.description,dimension);
      const key=JSON.stringify([a.category,family,dimension,signature]);
      if (!candidates.has(key)) candidates.set(key,[]);
      candidates.get(key).push(a);
    }
  }
  const chosen=new Map();
  const priority=['power','speed','incline','load','cadence','assistance','intensity','duration','distance'];
  for (const dimension of priority) {
    for (const [key,records] of candidates) {
      const [,family,d]=JSON.parse(key);
      if (d!==dimension || records.length<2) continue;
      const available=records.filter(a=>!chosen.has(a.id));
      if (available.length<2) continue;
      const groupKey=`unit::${key}`;
      for (const a of available) chosen.set(a.id,groupKey);
    }
  }
  const groups=new Map();
  for (const a of source) {
    const key=chosen.get(a.id) || `entry::${a.id}`;
    if (!groups.has(key)) {
      const parsed=key.startsWith('unit::')?JSON.parse(key.slice(6)):null;
      const dimension=parsed?.[2] || null;
      groups.set(key,{
        key, title:parsed?.[1] || a.description, category:a.category,
        adjustmentType:dimension, adjustmentLabel:dimension?unitLabels[dimension]:null,
        options:[],
      });
    }
    groups.get(key).options.push(a);
  }
  return [...groups.values()].map(g=>({
    ...g,
    options:g.options.sort((a,b)=>firstNumber(a.description,g.adjustmentType)-firstNumber(b.description,g.adjustmentType) || a.id.localeCompare(b.id)),
  }));
}
