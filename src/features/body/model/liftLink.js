// The link between BodyFox and LiftFox. A muscle in the 3D body belongs to
// one of LiftFox's muscle groups; "Train it in LiftFox" opens LiftFox with
// that group picked. Going the other way, LiftFox (or any app) can open
// BodyFox at a group with /body?group=<id>.

const RULES = [
  ["chest", /pectoralis (major|minor)/],
  ["shoulders", /deltoid|supraspinatus|infraspinatus|teres minor|subscapularis/],
  ["traps", /trapezius|rhomboid|levator scapulae/],
  ["lats", /latissimus|teres major/],
  ["biceps", /biceps brachii|brachialis|coracobrachialis/],
  ["triceps", /triceps brachii|anconeus/],
  ["forearms", /carpi|digitorum superficialis|digitorum profundus|brachioradialis|pronator|supinator|palmaris|pollicis longus|extensor pollicis brevis|extensor digitorum(?! (longus|brevis))|extensor digiti minimi|extensor indicis/],
  ["abs", /rectus abdominis|transversus abdominis|pyramidalis/],
  ["obliques", /(external|internal) oblique/],
  ["lowerBack", /iliocostalis lumborum|iliocostalis thoracis|longissimus thoracis|spinalis thoracis|multifidus|quadratus lumborum|lumbar rotator/],
  ["glutes", /gluteus|piriformis|tensor fasciae latae/],
  ["quads", /rectus femoris|vastus/],
  ["hamstrings", /biceps femoris|semitendinosus|semimembranosus/],
  ["calves", /gastrocnemius|soleus|plantaris|calcaneal tendon/],
];

export const LIFT_GROUPS = RULES.map(([id]) => id);

/** The LiftFox muscle group for a part, or null. */
export function liftGroupFor(part) {
  if (!part || part.layer !== "muscles") return null;
  const n = part.name.toLowerCase();
  return RULES.find(([, re]) => re.test(n))?.[0] ?? null;
}

/** Every part that belongs to a LiftFox group. */
export const partsInGroup = (parts, group) => parts.filter(p => liftGroupFor(p) === group);

/** Opens LiftFox's workout builder with this group picked. */
export const liftHref = group => `/lift?muscles=${encodeURIComponent(group)}`;

/** Opens BodyFox showing this group's muscles. */
export const bodyHref = group => `/body?group=${encodeURIComponent(group)}`;
