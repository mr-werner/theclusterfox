// Each layer broken into the body systems and smaller groups that make it
// up, like Skeleton → Arms → Hand. Parts are sorted by name first and by
// where they sit in the body second. No three.js here, so tests run in Node.

import { baseName, boxCenter } from "./parts.js";

// Heights in metres in this model, from the bones themselves.
const Y = { head: 1.46, neck: 1.36, shoulder: 1.3, elbow: 1.03, wrist: 0.81, hip: 0.82, knee: 0.37, ankle: 0.05 };
// Further out to the side than this, a part belongs to an arm.
const ARM_X = 0.175;

const where = part => {
  const [x, y, z] = boxCenter(part.box);
  return { x, ax: Math.abs(x), y, z };
};
const isArm = ({ ax, y }) => ax > ARM_X && y > 0.55;

// ---------- Rules for each layer ----------
// Each returns [group id, subgroup id] for a part (subgroup may be null).

function skinGroup(n) {
  return /hair|eyebrow/.test(n) ? ["hair", null] : ["skin", null];
}

function muscleGroup(n, part) {
  const w = where(part);
  if (/tendon|aponeurosis|fascia|retinaculum|iliotibial|linea alba|raphe|sheath/.test(n)) return ["connective", null];
  if (/levator ani|coccygeus|iliococcygeus|pubococcygeus|puborectalis|perine|sphincter|bulbospongiosus|ischiocavernosus|urogenital|cremaster/.test(n)) return ["pelvic-floor", null];
  if (part.kind === "extra-ocular muscle" || /rectus (superior|inferior|medialis|lateralis)|superior oblique|inferior oblique|levator palpebrae|(superior|inferior|medial|lateral) rectus/.test(n) && w.y > Y.head) return ["head", "eye"];
  if (/temporalis|masseter|pterygoid/.test(n)) return ["head", "chewing"];
  if (part.kind === "muscle of face" || (w.y > Y.head && /orbicularis|zygomatic|nasalis|procerus|mentalis|risorius|buccinator|depressor|levator labii|levator anguli|corrugator|frontalis|occipitalis|epicranius|auricular|platysma/.test(n))) return ["head", "face"];
  if (w.y > Y.head) return ["head", "mouth"];
  if (part.kind === "muscle of neck" || (w.y > Y.neck && w.ax < 0.09)) return ["neck", null];
  if (part.kind === "muscle of upper limb" || part.kind === "muscle of pectoral girdle" || isArm(w)) {
    if (/pectoralis|serratus anterior|subclavius|trapezius|rhomboid|levator scapulae|latissimus/.test(n)) return ["trunk", /pectoralis|serratus|subclavius/.test(n) ? "chest" : "back"];
    if (/deltoid|supraspinatus|infraspinatus|teres|subscapularis/.test(n)) return ["arms", "shoulder"];
    if (w.y > Y.elbow) return ["arms", "upper-arm"];
    if (w.y > Y.wrist) return ["arms", "forearm"];
    return ["arms", "hand"];
  }
  if (part.kind === "muscle of lower limb" || w.y < Y.hip) {
    if (/glute|piriformis|gemellus|obturator|quadratus femoris|tensor fasciae|iliacus|psoas/.test(n)) return ["legs", "hip"];
    if (w.y > Y.knee) return ["legs", "thigh"];
    if (w.y > Y.ankle) return ["legs", "lower-leg"];
    return ["legs", "foot"];
  }
  if (/diaphragm/.test(n)) return ["trunk", "breathing"];
  if (/intercostal|subcostal|transversus thoracis|levatores costarum|serratus posterior/.test(n)) return ["trunk", "breathing"];
  if (/abdominis|oblique|pyramidalis|quadratus lumborum/.test(n)) return ["trunk", "belly"];
  if (/pectoralis|serratus anterior|subclavius/.test(n)) return ["trunk", "chest"];
  return ["trunk", "back"];
}

function boneGroup(n, part) {
  const w = where(part);
  if (/ligament|membrane|meniscus|labrum|cartilage of|cartilage$/.test(n) && !/costal cartilage/.test(n)) {
    return ["joints", /ligament|membrane/.test(n) ? "ligaments" : "cartilage"];
  }
  if (part.kind === "tooth" || /tooth/.test(n)) return ["skull", "teeth"];
  if (/malleus|incus|stapes/.test(n)) return ["skull", "ear"];
  if (/^(frontal|parietal|occipital|temporal|sphenoid|nasal|lacrimal|palatine|zygomatic) bone|ethmoid|maxilla|mandible|vomer|nasal concha|hyoid/.test(n)) return ["skull", "cranium"];
  if (/intervertebral disk/.test(n)) return ["spine", "disks"];
  if (/cervical vertebra|^atlas|^axis/.test(n)) return ["spine", "neck"];
  if (/thoracic vertebra/.test(n)) return ["spine", "mid-back"];
  if (/lumbar vertebra/.test(n)) return ["spine", "low-back"];
  if (/sacrum|coccy/.test(n)) return ["spine", "tailbone"];
  if (/costal cartilage/.test(n)) return ["ribcage", "cartilage"];
  if (/\brib\b/.test(n)) return ["ribcage", "ribs"];
  if (/sternum|manubrium|xiphoid/.test(n)) return ["ribcage", "breastbone"];
  if (/clavicle|scapula/.test(n)) return ["arms", "shoulder"];
  if (/humerus|radius|ulna/.test(n)) return ["arms", "arm"];
  if (/carpal|metacarpal|phalanx of (thumb|.*finger)|scaphoid|lunate|trapezium|trapezoid|capitate|triquetral|pisiform|hamate/.test(n) || (isArm(w) && w.y < Y.wrist)) return ["arms", "hand"];
  if (/hip bone|ilium|ischium|pubis/.test(n)) return ["legs", "pelvis"];
  if (/femur|patella|tibia|fibula/.test(n)) return ["legs", "leg"];
  if (w.y < 0.1) return ["legs", "foot"];
  if (part.kind === "cartilage organ") return ["joints", "cartilage"];
  if (w.y > Y.head) return ["skull", "cranium"];
  return ["joints", "cartilage"];
}

function organGroup(n, part) {
  if (/mammary|breast/.test(n)) return ["reproductive", "breast"];
  if (/uter|ovar|vagina|cervix|broad ligament|prostate|testis|epididymis|deferent|seminal|penis/.test(n)) return ["reproductive", part.sex === "f" || /uter|ovar|vagina|cervix|broad ligament/.test(n) ? "female" : "male"];
  if (/kidney|ureter|bladder|urethra/.test(n)) return ["urinary", null];
  if (/eye|sclera|choroid|retina|vitreous|corona ciliaris|cornea|anterior chamber|iris|lens|lacrimal|tarsal plate|trochlea|common tendinous ring|nasolacrimal/.test(n)) return ["senses", "eye"];
  if (/external ear|auricle/.test(n)) return ["senses", "ear"];
  if (/pituitary|thyroid|adrenal|thymus|pancreatic islet/.test(n)) return ["glands", null];
  if (/spleen/.test(n)) return ["glands", null];
  if (/lung/.test(n)) return ["breathing", "lungs"];
  if (/trachea|bronch|epiglottis|larynx|thyrohyoid|conus elasticus|vocal|cricoid|arytenoid|lobar|segmental/.test(n) || part.kind === "segment of bronchial tree" || part.kind === "segment of tracheobronchial tree") return ["breathing", "airways"];
  if (/liver|hepatic|biliary|bile|gallbladder|cystic duct|caudate lobe/.test(n) || part.kind === "segment of biliary tree") return ["digestive", "liver"];
  if (/pancrea/.test(n)) return ["digestive", "pancreas"];
  if (/tongue|lip|gingiva|salivary|submandibular|sublingual|parotid|pharyn|esophagus|pterygomandibular|palate/.test(n)) return ["digestive", "mouth"];
  if (/stomach/.test(n)) return ["digestive", "stomach"];
  if (/duodenum|jejunum|ileum|small intestine|mesentery/.test(n) || part.kind === "zone of small intestine") return ["digestive", "small-intestine"];
  if (/colon|cecum|rectum|appendix|ileocecal|anal|mesocolon|mesoappendix/.test(n)) return ["digestive", "large-intestine"];
  return ["other", null];
}

function vesselGroup(n, part) {
  const w = where(part);
  if (part.kind === "coronary artery" || /branch of (right|left) coronary|coronary artery/.test(n) || part.kind?.startsWith("branch of")) return ["heart", "coronary"];
  if (part.kind === "cardiac vein" || /cardiac vein|coronary sinus/.test(n)) return ["heart", "cardiac-veins"];
  if (/valve|cusp|leaflet|chordae/.test(n)) return ["heart", "valves"];
  if (/wall of|atrium|ventricle|papillary|heart|septum/.test(n)) return ["heart", "chambers"];
  if (part.kind === "pulmonary artery" || part.kind === "pulmonary vein" || /pulmonary/.test(n)) return ["lungs", null];
  const vein = part.kind === "systemic vein" || part.kind === "portal vein" || part.kind === "vein" || /vein|venous|vena cava|sinus\b/.test(n);
  const top = vein ? "veins" : "arteries";
  if (part.kind === "portal vein" || /portal|mesenteric vein|splenic vein/.test(n)) return ["veins", "gut"];
  if (/aorta|vena cava|brachiocephalic|arch\b/.test(n)) return [top, "main"];
  if (w.y > Y.neck - 0.02 && w.ax < 0.12) return [top, "head"];
  if (isArm(w) || /subclavian|axillary|brachial|radial|ulnar|palmar|digital.*hand|cephalic|basilic/.test(n)) return [top, "arms"];
  if (w.y < Y.hip - 0.04 || /femoral|popliteal|tibial|fibular|plantar|saphenous|dorsalis pedis/.test(n)) return [top, "legs"];
  return [top, "trunk"];
}

function nerveGroup(n) {
  if (/olfactory|optic|oculomotor|trochlear|trigeminal|ophthalmic|maxillary nerve|mandibular nerve|abducens|facial nerve|vestibulocochlear|glossopharyngeal|vagus|accessory nerve|hypoglossal|chiasm|optic tract/.test(n)) return ["nerves", "cranial"];
  if (/spinal cord|cauda equina/.test(n)) return ["nerves", "spinal"];
  if (/nerve|ganglion|plexus$/.test(n) && !/choroid/.test(n)) return ["nerves", "other"];
  if (/ventricle|aqueduct|central canal|choroid plexus|foramen/.test(n)) return ["brain", "fluid"];
  if (/midbrain|pons|medulla|peduncle|colliculus|tegment|interpeduncular/.test(n)) return ["brain", "brainstem"];
  if (/cerebell|vermis|flocculus/.test(n)) return ["brain", "cerebellum"];
  if (/thalam|caudate|putamen|pallidus|hippocamp|amygdal|nucleus|fornix|mammillary|internal capsule|claustrum|septum pellucidum|pineal/.test(n)) return ["brain", "deep"];
  return ["brain", "cerebrum"];
}

const RULES = { skin: skinGroup, muscles: muscleGroup, skeleton: boneGroup, organs: organGroup, vessels: vesselGroup, nervous: nerveGroup };

// ---------- Names and short write-ups ----------
// kid: for the Elementary level. bio: for the Biology level.

export const SYSTEMS = {
  skin: [
    { id: "skin", name: "Skin", kid: "Your skin is a stretchy, waterproof coat that keeps germs out and lets you feel things.", bio: "The integumentary system: epidermis and dermis, which protect, keep water in, sense touch and help control temperature." },
    { id: "hair", name: "Hair", kid: "Hair grows out of tiny pockets in your skin and helps keep you warm and protected.", bio: "Hair grows from follicles in the dermis. It insulates, shields the eyes and scalp from sun and sweat, and senses light touch." },
  ],
  muscles: [
    {
      id: "head", name: "Head & face", kid: "Little muscles in your face make smiles and frowns, and strong ones help you chew.", bio: "Muscles of facial expression, chewing (mastication), eye movement and the mouth and throat.",
      groups: [
        { id: "face", name: "Face", kid: "These muscles pull on your skin to make faces: smiling, frowning, blinking.", bio: "Muscles of facial expression attach to skin rather than bone; all are run by the facial nerve (cranial nerve VII)." },
        { id: "chewing", name: "Chewing", kid: "Some of the strongest muscles for their size. They close your jaw to bite and chew.", bio: "Muscles of mastication (temporalis, masseter, pterygoids) move the mandible; all are run by the trigeminal nerve (V)." },
        { id: "eye", name: "Eye", kid: "Six tiny muscles around each eye point it wherever you want to look.", bio: "Extra-ocular muscles: four recti and two obliques turn the eyeball; levator palpebrae lifts the upper lid." },
        { id: "mouth", name: "Mouth & throat", kid: "Muscles in your mouth and throat help you talk and swallow.", bio: "Muscles of the tongue, palate and pharynx shape speech and move food safely into the oesophagus." },
      ],
    },
    { id: "neck", name: "Neck", kid: "Neck muscles hold up your heavy head and turn it to look around.", bio: "Neck muscles balance and turn the head, steady the throat and help lift the ribs for deep breaths." },
    {
      id: "trunk", name: "Chest, belly & back", kid: "These muscles hold you up straight, help you breathe and protect your insides.", bio: "Trunk muscles stabilise the spine, move the shoulder blades, drive breathing and wall in the abdomen.",
      groups: [
        { id: "chest", name: "Chest", kid: "Your chest muscles push things away and hug things close.", bio: "Pectoralis major and minor, serratus anterior and subclavius move the arm and shoulder blade from the front of the chest." },
        { id: "breathing", name: "Breathing", kid: "The diaphragm and the muscles between your ribs make you breathe in and out.", bio: "The diaphragm and intercostal muscles change the size of the chest so air flows in and out of the lungs." },
        { id: "belly", name: "Belly (core)", kid: "Your belly muscles are like a strong belt that holds your insides in and helps you bend.", bio: "The abdominal wall (rectus abdominis, obliques, transversus) bends and twists the trunk and braces the spine." },
        { id: "back", name: "Back", kid: "Back muscles keep you standing tall and help you lift and pull.", bio: "Superficial back muscles move the shoulder blades and arms; deep muscles (erector spinae, multifidus) hold and extend the spine." },
      ],
    },
    {
      id: "arms", name: "Shoulders & arms", kid: "Arm muscles let you throw, lift, wave and write.", bio: "Muscles of the upper limb, from the rotator cuff around the shoulder to the small muscles of the hand.",
      groups: [
        { id: "shoulder", name: "Shoulder", kid: "Shoulder muscles lift your arm and keep it safely in its socket.", bio: "The deltoid lifts the arm; the rotator cuff (supraspinatus, infraspinatus, teres minor, subscapularis) holds the ball in its shallow socket." },
        { id: "upper-arm", name: "Upper arm", kid: "The biceps bends your elbow and the triceps straightens it.", bio: "Front compartment (biceps, brachialis) flexes the elbow; back compartment (triceps) extends it." },
        { id: "forearm", name: "Forearm", kid: "Forearm muscles pull on long strings (tendons) to move your wrist and fingers.", bio: "Flexors on the palm side and extensors on the back move the wrist and fingers through long tendons; others turn the palm." },
        { id: "hand", name: "Hand", kid: "Tiny hand muscles make careful moves, like holding a pencil.", bio: "Intrinsic hand muscles (thenar, hypothenar, lumbricals, interossei) give fine control and pinch strength." },
      ],
    },
    {
      id: "legs", name: "Hips & legs", kid: "Your leg muscles are the biggest and strongest. They make you stand, walk, run and jump.", bio: "Muscles of the lower limb carry body weight and power walking, running and jumping.",
      groups: [
        { id: "hip", name: "Hip & buttock", kid: "Your bottom muscles are among the strongest in your body. They help you climb and run.", bio: "Gluteal muscles extend and stabilise the hip; deep rotators and iliopsoas turn and lift the thigh." },
        { id: "thigh", name: "Thigh", kid: "The front of your thigh straightens your knee; the back bends it.", bio: "Quadriceps (front) extend the knee, hamstrings (back) flex it and extend the hip, adductors (inner) pull the legs together." },
        { id: "lower-leg", name: "Lower leg", kid: "Calf muscles push you up on your toes when you walk and jump.", bio: "Calf muscles (gastrocnemius, soleus) point the foot; front and side muscles lift and tilt it." },
        { id: "foot", name: "Foot", kid: "Small foot muscles help you balance and hold up the arch of your foot.", bio: "Intrinsic foot muscles support the arches and fine-tune balance and toe movement." },
      ],
    },
    { id: "pelvic-floor", name: "Pelvic floor", kid: "A hammock of muscles at the bottom of your belly that holds things in until you're ready to go to the bathroom.", bio: "The pelvic floor (levator ani, coccygeus) supports the pelvic organs and controls the openings of the bladder and bowel." },
    { id: "connective", name: "Tendons & sheets", kid: "Tough strings and sheets that tie muscles to bones.", bio: "Tendons, aponeuroses and fascia pass muscle force to bone and hold muscles in place." },
  ],
  skeleton: [
    {
      id: "skull", name: "Skull & teeth", kid: "Your skull is a hard helmet for your brain, and your teeth bite and chew.", bio: "The cranium protects the brain and sense organs; the facial bones and jaws hold the teeth.",
      groups: [
        { id: "cranium", name: "Skull bones", kid: "Many bones joined together like puzzle pieces make your skull.", bio: "About 22 bones joined by fixed seams (sutures); only the mandible moves." },
        { id: "teeth", name: "Teeth", kid: "Grown-ups have 32 teeth for cutting, tearing and grinding food.", bio: "Incisors cut, canines tear, premolars and molars grind; enamel is the hardest tissue in the body." },
        { id: "ear", name: "Ear bones", kid: "The three tiniest bones in your body help you hear.", bio: "The ossicles (malleus, incus, stapes) carry sound from the eardrum to the inner ear." },
      ],
    },
    {
      id: "spine", name: "Spine", kid: "Your backbone is a stack of bones that holds you up and protects the cord of nerves inside.", bio: "The vertebral column: 7 cervical, 12 thoracic, 5 lumbar vertebrae, the sacrum and coccyx, with disks between.",
      groups: [
        { id: "neck", name: "Neck (cervical)", kid: "Seven small bones in your neck let you nod and turn your head.", bio: "Seven cervical vertebrae; the atlas and axis allow nodding and turning." },
        { id: "mid-back", name: "Mid back (thoracic)", kid: "Twelve back bones that your ribs hook on to.", bio: "Twelve thoracic vertebrae, each joined to a pair of ribs." },
        { id: "low-back", name: "Low back (lumbar)", kid: "Five big, strong bones in your lower back carry most of your weight.", bio: "Five lumbar vertebrae, the largest, carry the upper body's weight." },
        { id: "tailbone", name: "Sacrum & tailbone", kid: "Fused bones at the bottom of your spine that join it to your hips.", bio: "The sacrum (5 fused vertebrae) joins the pelvis; the coccyx is the tailbone." },
        { id: "disks", name: "Disks", kid: "Squishy cushions between the back bones.", bio: "Intervertebral disks: a tough outer ring around a gel core that absorbs shock and lets the spine bend." },
      ],
    },
    {
      id: "ribcage", name: "Rib cage", kid: "Your ribs make a cage that protects your heart and lungs.", bio: "Twelve pairs of ribs, the sternum and the costal cartilages protect the chest organs and move with breathing.",
      groups: [
        { id: "ribs", name: "Ribs", kid: "Curved bones that go around your chest.", bio: "Ribs 1 to 7 join the sternum directly, 8 to 10 through cartilage, and 11 and 12 float." },
        { id: "breastbone", name: "Breastbone", kid: "The flat bone in the middle of your chest.", bio: "The sternum: manubrium, body and xiphoid process." },
        { id: "cartilage", name: "Rib cartilage", kid: "Bendy pieces that let your chest grow bigger when you breathe in.", bio: "Costal cartilages join ribs to the sternum and let the cage expand." },
      ],
    },
    {
      id: "arms", name: "Shoulders & arms", kid: "Arm bones are long levers that let you reach, lift and throw.", bio: "The upper limb skeleton: shoulder girdle, arm, forearm and 27 bones of the hand.",
      groups: [
        { id: "shoulder", name: "Shoulder", kid: "Your collarbone and shoulder blade hold your arm onto your body.", bio: "The shoulder girdle (clavicle and scapula) gives the arm a mobile base." },
        { id: "arm", name: "Arm & forearm", kid: "One bone in your upper arm and two in your forearm.", bio: "Humerus, radius and ulna; the radius turns around the ulna to rotate the palm." },
        { id: "hand", name: "Hand & wrist", kid: "Your hand has 27 bones, so it can do lots of different things.", bio: "8 carpal bones, 5 metacarpals and 14 phalanges." },
      ],
    },
    {
      id: "legs", name: "Pelvis & legs", kid: "Strong leg bones hold you up and let you walk and run.", bio: "The lower limb skeleton carries the whole body's weight to the ground.",
      groups: [
        { id: "pelvis", name: "Pelvis", kid: "Your hip bones make a bowl that holds up your belly.", bio: "The two hip bones and the sacrum form a ring that carries weight to the legs and protects the pelvic organs." },
        { id: "leg", name: "Leg", kid: "Your thigh bone is the longest bone in your body.", bio: "Femur, patella, tibia and fibula." },
        { id: "foot", name: "Foot & ankle", kid: "26 bones in each foot make a springy arch.", bio: "7 tarsal bones, 5 metatarsals and 14 phalanges form arches that spread load and spring." },
      ],
    },
    {
      id: "joints", name: "Cartilage & ligaments", kid: "Smooth, bendy cartilage and strong straps hold your joints together.", bio: "Cartilage cushions and lines joints; ligaments tie bone to bone.",
      groups: [
        { id: "cartilage", name: "Cartilage", kid: "Smooth, rubbery stuff that cushions bones where they meet.", bio: "Hyaline and fibrocartilage shape the nose, ears and airways and cushion joints." },
        { id: "ligaments", name: "Ligaments", kid: "Tough straps that tie bones together.", bio: "Dense bands of collagen that limit how far a joint can move." },
      ],
    },
  ],
  organs: [
    {
      id: "digestive", name: "Digestive system", kid: "A long tube that breaks food into tiny pieces your body can use.", bio: "The gut and its glands digest food and absorb nutrients from mouth to rectum.",
      groups: [
        { id: "mouth", name: "Mouth & throat", kid: "You chew and taste here, then swallow.", bio: "Teeth, tongue and salivary glands start digestion; the pharynx and oesophagus move food to the stomach." },
        { id: "stomach", name: "Stomach", kid: "A stretchy bag that mashes food with strong juices.", bio: "Mixes food with acid and enzymes to start digesting protein." },
        { id: "liver", name: "Liver & gallbladder", kid: "Your liver cleans your blood and makes bile, which helps break down fat.", bio: "The liver processes nutrients and toxins and makes bile, which the gallbladder stores." },
        { id: "pancreas", name: "Pancreas", kid: "Makes juices that digest food, and insulin that controls sugar in your blood.", bio: "Exocrine pancreas makes digestive enzymes; islets make insulin and glucagon." },
        { id: "small-intestine", name: "Small intestine", kid: "A long, curly tube where food soaks into your blood.", bio: "Duodenum, jejunum and ileum finish digestion and absorb most nutrients." },
        { id: "large-intestine", name: "Large intestine", kid: "Takes water back out of what's left and makes poop.", bio: "Caecum, colon and rectum absorb water and salts and store waste." },
      ],
    },
    {
      id: "breathing", name: "Respiratory system", kid: "Your lungs breathe in air and get oxygen into your blood.", bio: "Airways carry air to the lungs, where oxygen and carbon dioxide are exchanged.",
      groups: [
        { id: "airways", name: "Airways", kid: "Tubes that carry air from your mouth and nose down into your lungs.", bio: "Larynx, trachea and the branching bronchial tree." },
        { id: "lungs", name: "Lungs", kid: "Two spongy bags full of tiny air pockets.", bio: "Three lobes on the right, two on the left, with about 300 million alveoli." },
      ],
    },
    { id: "urinary", name: "Urinary system", kid: "Your kidneys clean your blood and make pee, which waits in your bladder.", bio: "Kidneys filter the blood and balance water and salts; urine flows through the ureters to the bladder and out the urethra." },
    {
      id: "reproductive", name: "Reproductive system", kid: "The parts that let grown-ups have babies.", bio: "Organs that make sex cells and hormones and, in females, carry a pregnancy and feed a baby.",
      groups: [
        { id: "female", name: "Female", kid: "The womb (uterus) is where a baby grows. The ovaries hold egg cells.", bio: "Ovaries, uterine tubes, uterus, cervix and vagina, held in place by ligaments." },
        { id: "breast", name: "Breasts", kid: "Breasts can make milk to feed a baby.", bio: "Mammary glands: lobes of milk glands and ducts set in fat over the chest muscles." },
        { id: "male", name: "Male", kid: "The testes make sperm cells.", bio: "Testes, epididymis, ductus deferens, seminal vesicles, prostate and penis." },
      ],
    },
    { id: "glands", name: "Glands & immune", kid: "Small organs that send chemical messages or help fight germs.", bio: "Endocrine glands (pituitary, thyroid, adrenals) release hormones; the thymus and spleen are part of the immune system." },
    {
      id: "senses", name: "Eyes & ears", kid: "Your eyes see and your ears hear.", bio: "The eye focuses light onto the retina; the outer ear collects sound.",
      groups: [
        { id: "eye", name: "Eye", kid: "Your eyes work like cameras that send pictures to your brain.", bio: "Cornea and lens focus light on the retina; tear glands keep the surface wet." },
        { id: "ear", name: "Ear", kid: "The part you can see catches sound.", bio: "The auricle funnels sound into the ear canal." },
      ],
    },
    { id: "other", name: "Other", kid: "Other parts inside your body.", bio: "Other internal structures." },
  ],
  vessels: [
    {
      id: "heart", name: "Heart", kid: "Your heart is a strong muscle pump that beats about 100,000 times a day.", bio: "Four chambers, four valves and its own blood supply.",
      groups: [
        { id: "chambers", name: "Chambers & walls", kid: "Two rooms on top fill up, two below squeeze blood out.", bio: "Atria receive blood; ventricles pump it to the lungs (right) and body (left)." },
        { id: "valves", name: "Valves", kid: "Little doors that only open one way, so blood doesn't flow backward.", bio: "Tricuspid, pulmonary, mitral and aortic valves keep flow one-way." },
        { id: "coronary", name: "Coronary arteries", kid: "The heart's own pipes that bring it blood.", bio: "Coronary arteries supply the heart muscle; a blockage causes a heart attack." },
        { id: "cardiac-veins", name: "Heart veins", kid: "Pipes that take used blood away from the heart muscle.", bio: "Cardiac veins drain into the coronary sinus and the right atrium." },
      ],
    },
    {
      id: "arteries", name: "Arteries", kid: "Pipes that carry fresh blood from your heart to every part of you.", bio: "Arteries carry oxygen-rich blood under high pressure from the heart.",
      groups: [
        { id: "main", name: "Aorta", kid: "The biggest pipe, straight out of the heart.", bio: "The aorta and its great branches." },
        { id: "head", name: "Head & neck", kid: "Blood going up to your brain.", bio: "Carotid and vertebral arteries feed the head and brain." },
        { id: "arms", name: "Arms", kid: "Blood going to your arms and hands.", bio: "Subclavian, axillary, brachial, radial and ulnar arteries." },
        { id: "trunk", name: "Chest & belly", kid: "Blood going to your organs.", bio: "Branches of the aorta to the chest wall, gut, kidneys and pelvis." },
        { id: "legs", name: "Legs", kid: "Blood going down to your legs and feet.", bio: "Iliac, femoral, popliteal and tibial arteries." },
      ],
    },
    {
      id: "veins", name: "Veins", kid: "Pipes that bring blood back to your heart.", bio: "Veins return blood to the heart at low pressure, helped by valves and muscle squeeze.",
      groups: [
        { id: "main", name: "Venae cavae", kid: "The two biggest veins, going into the heart.", bio: "The superior and inferior venae cavae and their main tributaries." },
        { id: "head", name: "Head & neck", kid: "Blood coming back from your head.", bio: "Jugular veins and the brain's venous sinuses." },
        { id: "arms", name: "Arms", kid: "Blood coming back from your arms.", bio: "Deep veins beside the arteries and surface veins (cephalic, basilic)." },
        { id: "trunk", name: "Chest & belly", kid: "Blood coming back from your organs.", bio: "Veins of the chest wall, kidneys and pelvis." },
        { id: "gut", name: "Gut (portal)", kid: "Blood from your stomach and intestines goes to the liver first.", bio: "The hepatic portal system carries absorbed nutrients to the liver." },
        { id: "legs", name: "Legs", kid: "Blood coming back up from your legs.", bio: "Deep veins and the long saphenous vein." },
      ],
    },
    { id: "lungs", name: "Lung vessels", kid: "Pipes that take blood to your lungs to pick up oxygen.", bio: "Pulmonary arteries carry oxygen-poor blood to the lungs; pulmonary veins bring it back rich in oxygen." },
  ],
  nervous: [
    {
      id: "brain", name: "Brain", kid: "Your brain is the boss of your body. It thinks, remembers and controls everything.", bio: "About 86 billion neurons in the cerebrum, deep nuclei, brainstem and cerebellum.",
      groups: [
        { id: "cerebrum", name: "Cerebrum (cortex)", kid: "The wrinkly outside part, where you think, see, feel and plan.", bio: "Folded cortex in four lobes on each side, linked by white matter." },
        { id: "deep", name: "Deep brain", kid: "Parts deep inside that handle memory, feelings and habits.", bio: "Thalamus, basal ganglia, hippocampus and amygdala." },
        { id: "brainstem", name: "Brainstem", kid: "Keeps you breathing and your heart beating, even while you sleep.", bio: "Midbrain, pons and medulla run vital reflexes and carry tracts to the spinal cord." },
        { id: "cerebellum", name: "Cerebellum", kid: "Helps you balance and move smoothly.", bio: "Coordinates movement, balance and motor learning." },
        { id: "fluid", name: "Fluid spaces", kid: "Spaces filled with a clear liquid that cushions your brain.", bio: "Ventricles and choroid plexus make and hold cerebrospinal fluid." },
      ],
    },
    {
      id: "nerves", name: "Nerves", kid: "Nerves are like wires that carry messages between your brain and body.", bio: "Cranial nerves serve the head; the spinal cord and its nerves serve the body.",
      groups: [
        { id: "cranial", name: "Cranial nerves", kid: "Nerves that go straight from your brain to your eyes, face and more.", bio: "Twelve pairs of cranial nerves for smell, sight, eye movement, face, hearing, swallowing and more." },
        { id: "spinal", name: "Spinal cord", kid: "A thick cord of nerves inside your backbone.", bio: "Carries signals between brain and body and runs reflexes." },
        { id: "other", name: "Other nerves", kid: "Nerves that reach out across your body.", bio: "Peripheral nerves and ganglia." },
      ],
    },
  ],
};

// Fast lookups: "muscles/arms" and "muscles/arms/hand" → definition.
const DEFS = new Map();
for (const [layer, groups] of Object.entries(SYSTEMS)) {
  for (const g of groups) {
    DEFS.set(`${layer}/${g.id}`, g);
    for (const s of g.groups ?? []) DEFS.set(`${layer}/${g.id}/${s.id}`, s);
  }
}

/** Where a part sits: { layer, group, sub } as ids. */
export function systemOf(part) {
  const [group, sub] = RULES[part.layer](baseName(part.name), part);
  const g = DEFS.get(`${part.layer}/${group}`);
  return { layer: part.layer, group, sub: g?.groups && sub && DEFS.has(`${part.layer}/${group}/${sub}`) ? sub : null };
}

/** The group and subgroup definitions for a part, for write-ups. */
export function systemInfo(part) {
  const s = systemOf(part);
  return { group: DEFS.get(`${s.layer}/${s.group}`) ?? null, sub: s.sub ? DEFS.get(`${s.layer}/${s.group}/${s.sub}`) : null };
}

/**
 * The tree for the side panel: for each layer, its groups with their parts
 * and subgroups. Empty groups are left out.
 * → { [layerId]: [{ key, id, name, ids, subs: [{ key, id, name, ids }] }] }
 */
export function buildSystems(parts) {
  const tree = {};
  for (const [layer, groups] of Object.entries(SYSTEMS)) {
    tree[layer] = groups.map(g => ({
      key: `${layer}/${g.id}`,
      id: g.id,
      name: g.name,
      ids: [],
      subs: (g.groups ?? []).map(s => ({ key: `${layer}/${g.id}/${s.id}`, id: s.id, name: s.name, ids: [] })),
    }));
  }
  for (const p of parts) {
    const s = systemOf(p);
    const g = tree[p.layer]?.find(x => x.id === s.group);
    if (!g) continue;
    g.ids.push(p.id);
    if (s.sub) g.subs.find(x => x.id === s.sub)?.ids.push(p.id);
  }
  for (const layer of Object.keys(tree)) {
    tree[layer] = tree[layer]
      .filter(g => g.ids.length)
      .map(g => ({ ...g, subs: g.subs.filter(s => s.ids.length) }));
  }
  return tree;
}
