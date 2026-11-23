// What BodyFox says about a part, at each level of explanation.
//
//   kid  Elementary: the basics, in words a young child knows.
//   bio  Biology: what it is, where it sits and what it does.
//
//   sport Sports Medicine: use, injury and getting back to play.
//   med   Medical: what goes wrong, and how it is (or can't be) treated.
//
// The two clinical levels live in clinical.js.

import { baseName, layerById } from "../model/parts.js";
import { systemInfo, systemOf } from "../model/systems.js";
import { clinicalText } from "./clinical.js";
import { kindInfo, KINDS } from "./kinds.js";
import { noteFor } from "./notes.js";

export const LEVELS = [
  { id: "kid", name: "Elementary", short: "Elementary", blurb: "Just the basics" },
  { id: "bio", name: "Biology", short: "Biology", blurb: "How it works" },
  { id: "sport", name: "Sports Medicine", short: "Sports med", blurb: "Use, injury and return to play" },
  { id: "med", name: "Medical", short: "Medical", blurb: "What goes wrong and how it's treated" },
];
export const levelById = new Map(LEVELS.map(l => [l.id, l]));

// Elementary write-ups for parts children have heard of. First match wins.
const KID_NOTES = [
  // Bones
  { match: /^(frontal|parietal|occipital|temporal) bone/, text: "One of the bones of your skull, the hard helmet that keeps your brain safe." },
  { match: /^mandible/, text: "Your lower jaw. It's the only bone in your head that moves, so you can chew and talk." },
  { match: /^maxilla/, text: "Your upper jaw. Your top teeth grow out of it." },
  { match: /^zygomatic bone/, text: "Your cheekbone. You can feel it under your eye." },
  { match: /^nasal bone/, text: "A tiny bone at the top of your nose. The rest of your nose is bendy cartilage." },
  { match: /^atlas|^axis/, text: "One of the top bones of your neck. It lets you nod and shake your head." },
  { match: /vertebra$/, text: "One of the bones stacked up to make your backbone. A soft cord of nerves runs through a hole in the middle." },
  { match: /^sacrum|^coccyx/, text: "Bones at the very bottom of your backbone. The tailbone is all that's left of a tail!" },
  { match: /^clavicle/, text: "Your collarbone. It holds your shoulder out to the side so your arm can swing." },
  { match: /^scapula/, text: "Your shoulder blade, a flat bone on your back that slides when you move your arm." },
  { match: /^humerus/, text: "The bone in your upper arm. When you bump your \"funny bone\", you're really hitting a nerve near it." },
  { match: /^radius|^ulna/, text: "One of the two bones in your forearm. They twist around each other when you turn your hand over." },
  { match: /^hip bone/, text: "Your hip bone. With the other hip bone, it makes a bowl that holds up your belly." },
  { match: /^femur/, text: "Your thigh bone, the longest and strongest bone in your body." },
  { match: /^patella/, text: "Your kneecap. It protects the front of your knee." },
  { match: /^tibia/, text: "Your shin bone. Bumping it really hurts because there's hardly any padding over it." },
  { match: /^fibula/, text: "The thin bone on the outside of your lower leg." },
  { match: /^calcaneus/, text: "Your heel bone. You land on it with every step." },
  { match: /\brib\b/, text: "One of your ribs. They curve around your chest like a cage to protect your heart and lungs." },
  { match: /sternum|manubrium|xiphoid/, text: "Part of your breastbone, the flat bone in the middle of your chest." },
  { match: /tooth/, text: "One of your teeth. Brush it twice a day to keep it strong!" },
  { match: /intervertebral disk/, text: "A squishy cushion between two back bones, like a jelly doughnut." },
  { match: /hyoid/, text: "A little U-shaped bone in your neck that helps you swallow." },
  // Muscles
  { match: /biceps brachii/, text: "Your biceps. Bend your elbow and squeeze, and you can feel it bulge!" },
  { match: /triceps brachii/, text: "Your triceps, on the back of your arm. It straightens your elbow." },
  { match: /deltoid/, text: "Your shoulder muscle. It lifts your arm up to wave." },
  { match: /pectoralis major/, text: "Your chest muscle. It helps you push, throw and hug." },
  { match: /rectus abdominis/, text: "Your \"six-pack\" muscle. It helps you sit up and bend forward." },
  { match: /oblique/, text: "A belly muscle on your side. It helps you twist." },
  { match: /latissimus dorsi/, text: "A big, wide back muscle. It pulls your arms down, like when you climb." },
  { match: /trapezius/, text: "A big muscle across your upper back and neck. It shrugs your shoulders." },
  { match: /gluteus maximus/, text: "Your biggest muscle, in your bottom. It helps you climb stairs, run and jump." },
  { match: /gluteus/, text: "One of your bottom muscles. It keeps your hips steady when you walk." },
  { match: /rectus femoris|vastus/, text: "One of the four big muscles on the front of your thigh. They straighten your knee for kicking." },
  { match: /biceps femoris|semitendinosus|semimembranosus/, text: "A hamstring, on the back of your thigh. It bends your knee." },
  { match: /gastrocnemius|soleus/, text: "Your calf muscle. It lifts your heel so you can stand on tiptoe and jump." },
  { match: /calcaneal tendon/, text: "Your Achilles tendon, the strongest tendon in your body. It ties your calf muscle to your heel." },
  { match: /tibialis anterior/, text: "The muscle on the front of your shin. It lifts your toes so you don't trip." },
  { match: /diaphragm/, text: "A dome-shaped muscle under your lungs. When it pulls down, air rushes into your lungs. Hiccups are this muscle twitching!" },
  { match: /intercostal/, text: "A muscle between your ribs that helps you breathe." },
  { match: /sternocleidomastoid/, text: "A strong neck muscle that turns your head." },
  { match: /masseter/, text: "Your chewing muscle. Clench your teeth and feel it get hard at the back of your cheek." },
  { match: /temporalis/, text: "A chewing muscle on the side of your head. Feel it move above your ear when you chew." },
  { match: /orbicularis oculi/, text: "The ring of muscle around your eye that makes you blink and squint." },
  { match: /orbicularis oris/, text: "The ring of muscle around your mouth. You use it to whistle and kiss." },
  { match: /zygomaticus/, text: "Your smiling muscle. It pulls the corners of your mouth up." },
  { match: /frontalis/, text: "The muscle on your forehead that raises your eyebrows when you're surprised." },
  { match: /(superior|inferior|medial|lateral) rectus$|oblique$/, text: "A tiny muscle that moves your eyeball so you can look around." },
  { match: /tongue|genioglossus|hyoglossus/, text: "Your tongue is made of muscles. It helps you taste, talk and swallow." },
  // Organs
  { match: /^liver|caudate lobe of liver/, text: "Your liver, the biggest organ inside you. It cleans your blood and helps break down food." },
  { match: /lobe of lung|^lung/, text: "Part of your lungs. They fill with air when you breathe in and get oxygen into your blood." },
  { match: /^trachea/, text: "Your windpipe. Air goes down this tube to your lungs." },
  { match: /bronch|segmental|lobar/, text: "One of the branching air tubes inside your lungs. They look like an upside-down tree." },
  { match: /^esophagus/, text: "The food pipe from your mouth to your stomach. Muscles squeeze food down, even if you're upside down!" },
  { match: /^stomach/, text: "Your stomach, a stretchy bag that mashes food with strong juices." },
  { match: /duodenum|jejunum|ileum|small intestine/, text: "Part of your small intestine, a long curly tube where the good stuff from food soaks into your blood. It's about as long as a school bus!" },
  { match: /colon|cecum|rectum|appendix/, text: "Part of your large intestine. It soaks up water from leftovers and makes poop." },
  { match: /^pancreas|pancrea/, text: "Your pancreas. It makes juices to digest food and insulin to control the sugar in your blood." },
  { match: /^spleen/, text: "Your spleen. It cleans your blood and helps fight germs." },
  { match: /gallbladder/, text: "A little bag that stores bile, a green juice that helps digest fatty food." },
  { match: /hepatic|biliary|bile|cystic duct/, text: "A tiny tube that carries bile out of your liver." },
  { match: /^kidney/, text: "One of your two kidneys, shaped like beans. They clean your blood and make pee." },
  { match: /^ureter/, text: "A tube that carries pee from a kidney down to your bladder." },
  { match: /bladder/, text: "Your bladder, a stretchy bag that holds pee until you go to the bathroom." },
  { match: /adrenal/, text: "A small gland on top of your kidney. It makes adrenaline, which gets you ready to run when you're scared." },
  { match: /thymus/, text: "A gland in your chest that trains your germ-fighting cells. It's biggest when you're a kid." },
  { match: /pituitary/, text: "A pea-sized gland under your brain. It sends messages that tell you when to grow." },
  { match: /thyroid gland/, text: "A butterfly-shaped gland in your neck. It controls how fast your body uses energy." },
  { match: /uter/, text: "The uterus, or womb. It's where a baby grows before it is born." },
  { match: /ovar/, text: "An ovary. It holds tiny egg cells and makes hormones." },
  { match: /mammary/, text: "The part of the breast that can make milk to feed a baby." },
  { match: /vagina|cervix/, text: "Part of the birth canal, the way a baby comes out when it's born." },
  { match: /testis|epididymis|deferent|seminal|prostate|penis/, text: "Part of the male reproductive system, which makes sperm cells." },
  { match: /^cornea|^lens/, text: "A clear part at the front of your eye that bends light so you can see sharply." },
  { match: /^iris/, text: "The colored part of your eye. It makes your pupil bigger in the dark and smaller in bright light." },
  { match: /retina/, text: "The back of your eye, which catches light like the screen in a camera and sends the picture to your brain." },
  { match: /sclera/, text: "The white of your eye, a tough coat that protects it." },
  { match: /lacrimal|tear/, text: "Part of your tear system, which keeps your eyes wet and clean." },
  { match: /external ear/, text: "Your outer ear. Its curly shape catches sound." },
  // Heart and vessels
  { match: /valve|cusp|leaflet|chordae/, text: "Part of a heart valve, a little door that lets blood go only one way. The \"lub-dub\" of your heartbeat is valves closing." },
  { match: /wall of|atrium|ventricle of heart|papillary/, text: "Part of your heart, a muscle that pumps blood all day and night without ever taking a break." },
  { match: /aorta/, text: "Your aorta, the biggest blood pipe in your body. Blood rushes into it from your heart." },
  { match: /vena cava/, text: "One of the two biggest veins, bringing blood back into your heart." },
  { match: /coronary/, text: "A small pipe that brings blood to the heart muscle itself." },
  { match: /carotid/, text: "A big pipe in your neck that takes blood to your brain. You can feel its pulse beside your windpipe." },
  { match: /radial artery/, text: "The pipe you feel when you check your pulse at your wrist." },
  { match: /pulmonary/, text: "A pipe between your heart and lungs. Blood goes to your lungs to pick up oxygen." },
  // Brain and nerves
  { match: /cerebell/, text: "Your cerebellum, the \"little brain\" at the back. It helps you balance and ride a bike." },
  { match: /midbrain|pons|medulla/, text: "Part of your brainstem. It keeps you breathing and your heart beating, even when you're asleep." },
  { match: /hippocamp/, text: "A part of your brain shaped like a seahorse. It helps you remember things." },
  { match: /amygdal/, text: "A tiny part of your brain that helps you feel scared or excited." },
  { match: /corpus callosum/, text: "A bridge that lets the left and right halves of your brain talk to each other." },
  { match: /gyrus|lobule|lobe$|insula/, text: "One of the folds on the outside of your brain. The folds fit a lot of brain into your head." },
  { match: /ventricle$|aqueduct|choroid plexus/, text: "A space in your brain filled with clear liquid that cushions it like a waterbed." },
  { match: /optic/, text: "Part of the eye nerve, which carries pictures from your eyes to your brain." },
  { match: /spinal cord/, text: "Your spinal cord, a thick bundle of nerves inside your backbone that carries messages to and from your brain." },
  { match: /nerve/, text: "A nerve, like a wire carrying messages between your brain and your body." },
  // Skin
  { match: /^skin/, text: "Your skin, the biggest organ you have. It keeps germs out, keeps water in, and lets you feel hot, cold and soft." },
  { match: /hair|eyebrow/, text: "Hair grows from tiny pockets in your skin. Eyebrows stop sweat from running into your eyes." },
];

// Elementary words for each kind of part, when the part itself has no note.
const KID_KINDS = {
  "phalanx of finger": "A finger bone. Each finger has three, and your thumb has two.",
  "phalanx of toe": "A toe bone. Each toe has three, and your big toe has two.",
  "carpal bone": "One of eight little wrist bones that let your hand bend and wiggle.",
  "tarsal bone": "One of the bones in your ankle and the back of your foot.",
  "metacarpal bone": "A bone in the palm of your hand.",
  "metatarsal bone": "A long bone in the middle of your foot.",
  "sesamoid bone": "A tiny bone inside a tendon, like a pulley.",
  "costal cartilage": "Bendy cartilage that joins a rib to your breastbone.",
  "cartilage organ": "Cartilage: smooth, bendy stuff like what's in your ears and nose.",
  ligament: "A ligament, a tough strap that ties bones together.",
  "systemic artery": "An artery, a pipe carrying fresh, oxygen-filled blood away from your heart.",
  artery: "An artery, a pipe carrying blood away from your heart.",
  "systemic vein": "A vein, a pipe bringing blood back to your heart.",
  vein: "A vein, a pipe bringing blood back to your heart.",
  "portal vein": "A vein carrying blood from your belly to your liver, so it can be cleaned.",
  "cardiac vein": "A small vein taking used blood away from your heart muscle.",
  "coronary artery": "A small pipe feeding the heart muscle itself.",
  "branch of right coronary artery": "A small pipe feeding the heart muscle itself.",
  "branch of left coronary artery": "A small pipe feeding the heart muscle itself.",
  "pulmonary artery": "A pipe taking blood to your lungs to pick up oxygen.",
  "pulmonary vein": "A pipe bringing fresh, oxygen-filled blood from your lungs to your heart.",
  "gyrus of neuraxis": "One of the folds on the outside of your brain.",
  nerve: "A nerve, like a wire carrying messages between your brain and your body.",
};

const firstMatch = (list, base) => list.find(n => n.match.test(base))?.text ?? null;

/**
 * The write-up for a part at a level.
 * → { lead, more, context } where lead is the main paragraph, more an extra
 *   one (or null), and context names the system it belongs to.
 */
export function explain(part, level) {
  const base = baseName(part.name);
  const { group, sub } = systemInfo(part);
  const layer = layerById.get(part.layer);
  const context = [layer?.name, group?.name, sub?.name].filter(Boolean).join(" › ");
  if (level === "kid") {
    const lead = firstMatch(KID_NOTES, base) ?? KID_KINDS[part.kind] ?? kidFallback(part, sub, group);
    const more = sub?.kid ?? group?.kid ?? null;
    return { lead, more: more && more !== lead ? more : null, context };
  }
  if (level === "sport" || level === "med") {
    const s = systemOf(part);
    const t = clinicalText(base, part.layer, s.group, s.sub, level);
    const lead = t.lead ?? (level === "sport"
      ? `Part of the ${layer.name.toLowerCase()}. Train it gradually, warm up first, and let pain guide how fast you build back after an injury.`
      : `Part of the ${layer.name.toLowerCase()}. Problems here are diagnosed from the history, an examination and imaging, and treated by their cause.`);
    return { lead, more: t.more, context, clinical: true };
  }
  const note = noteFor(base);
  const kind = kindInfo(part.kind) ?? fallbackKind(part, base);
  const lead = note ?? kind?.text ?? sub?.bio ?? group?.bio ?? `Part of the ${layer.name.toLowerCase()}. ${layer.blurb}.`;
  const extra = note && kind && part.layer === "muscles" ? kind.text : sub?.bio ?? group?.bio ?? null;
  return { lead, more: extra && extra !== lead ? extra : null, context, kindLabel: kind?.label ?? null };
}

function kidFallback(part, sub, group) {
  if (part.layer === "muscles") return "A muscle. Muscles pull on your bones to move you, and they get stronger when you use them.";
  if (part.layer === "skeleton") return "A bone. Bones hold you up, protect your insides and make new blood inside them.";
  if (part.layer === "vessels") return "A blood vessel, one of the pipes that carry blood around your body.";
  if (part.layer === "nervous") return "Part of your brain and nerves, which send messages all around your body.";
  return sub?.kid ?? group?.kid ?? "One of the parts inside your body that keeps you going.";
}

// A general write-up for parts the data doesn't classify.
export function fallbackKind(part, base) {
  if (part.layer === "muscles") return /tendon/.test(base) ? null : KINDS["muscle organ"];
  if (part.layer === "vessels") return /vein|venous|sinus/.test(base) ? KINDS["systemic vein"] : /arter|aorta|trunk|arch/.test(base) ? KINDS["systemic artery"] : null;
  if (part.layer === "nervous" && /nerve/.test(base)) return KINDS.nerve;
  if (part.layer === "skeleton" && /ligament/.test(base)) return KINDS.ligament;
  return null;
}
