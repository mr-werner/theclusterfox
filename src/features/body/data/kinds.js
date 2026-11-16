// What a kind of part is, for parts without a write-up of their own.
// Keys are kinds from the anatomy data (see scripts/anatomy/build-models.mjs).

export const KINDS = {
  vertebra: {
    label: "Vertebra",
    text: "One of the stacked bones of the spine. Together they hold you upright, carry your weight down to the pelvis and wrap around the spinal cord to protect it. The bony knobs you feel along your back are their spinous processes, where back muscles and ligaments attach.",
  },
  rib: {
    label: "Rib",
    text: "A curved bone that forms the rib cage with the other ribs. The cage protects the heart and lungs, and it lifts and swings outward with every breath so the lungs can fill.",
  },
  tooth: {
    label: "Tooth",
    text: "An adult (permanent) tooth. Front teeth cut, canines grip and tear, and premolars and molars crush and grind food so it is easier to swallow and digest. Enamel on the crown is the hardest substance in the body.",
  },
  "costal cartilage": {
    label: "Costal cartilage",
    text: "Flexible cartilage joining the front end of a rib to the breastbone. Its give lets the chest expand when you breathe and helps absorb blows to the chest.",
  },
  "intervertebral disk": {
    label: "Intervertebral disc",
    text: "A tough, springy pad between two vertebrae. It has a fibrous outer ring and a soft gel centre, cushions the spine and lets it bend and twist. A disc that bulges or tears can press on nearby nerves.",
  },
  "phalanx of finger": {
    label: "Finger bone (phalanx)",
    text: "One of the small bones of a finger or thumb. Each finger has three, the thumb has two. Their hinge joints let you curl the fingers to grip and pinch.",
  },
  "phalanx of toe": {
    label: "Toe bone (phalanx)",
    text: "One of the small bones of a toe. The big toe has two, the others three. The toes help with balance and push you off the ground as you walk.",
  },
  "carpal bone": {
    label: "Wrist bone (carpal)",
    text: "One of eight small bones of the wrist, set in two rows. They glide against each other so the hand can bend and tilt, and they form the floor of the carpal tunnel.",
  },
  "tarsal bone": {
    label: "Ankle and foot bone (tarsal)",
    text: "One of seven bones at the back of the foot, including the heel bone and the talus. They carry your full body weight and shape the arches of the foot.",
  },
  "metacarpal bone": {
    label: "Hand bone (metacarpal)",
    text: "One of five long bones in the palm, one under each finger. Their heads are your knuckles.",
  },
  "metatarsal bone": {
    label: "Foot bone (metatarsal)",
    text: "One of five long bones in the middle of the foot. Their heads form the ball of the foot, which takes the push-off when you walk or run. Stress fractures are common here in runners.",
  },
  "sesamoid bone": {
    label: "Sesamoid bone",
    text: "A small bone set inside a tendon. It acts like a pulley, giving the tendon a better angle to pull and protecting it from wear.",
  },
  "long bone": {
    label: "Long bone",
    text: "A bone longer than it is wide, with a hollow shaft and wider ends. Long bones act as levers for the muscles, carry weight, and their marrow makes blood cells.",
  },
  "short bone": {
    label: "Short bone",
    text: "A small, roughly cube-shaped bone. Short bones give stability with a little movement, like those in the wrist and ankle.",
  },
  "flat bone": {
    label: "Flat bone",
    text: "A thin, flattened bone. Flat bones protect what lies beneath them (like the skull over the brain) and give broad surfaces for muscles to attach.",
  },
  "irregular bone": {
    label: "Irregular bone",
    text: "A bone with a complex shape that fits a special job, such as the bones of the face and skull base.",
  },
  "bone organ": {
    label: "Bone",
    text: "Living bone tissue. Bones support the body, protect organs, anchor muscles, store calcium and make blood cells in their marrow.",
  },
  "cartilage organ": {
    label: "Cartilage",
    text: "Firm, rubbery tissue that is smoother and more flexible than bone. It shapes the nose, ears, larynx and airways and keeps them open.",
  },
  ligament: {
    label: "Ligament",
    text: "A band of tough, fibrous tissue that ties bone to bone (or holds an organ in place). Ligaments steady joints and stop them moving the wrong way.",
  },
  "extra-ocular muscle": {
    label: "Eye muscle",
    text: "One of the small muscles that aim the eyeball. Six of them work together so both eyes point at the same thing; if they don't, you see double.",
  },
  "muscle of face": {
    label: "Face muscle",
    text: "A muscle of facial expression. Unlike most muscles, these pull on skin rather than bone, making smiles, frowns, squints and blinks. They are moved by the facial nerve.",
  },
  "muscle of head": {
    label: "Head muscle",
    text: "A muscle of the head, many of them for chewing, swallowing or moving the eye and palate.",
  },
  "muscle of neck": {
    label: "Neck muscle",
    text: "A muscle of the neck. Neck muscles turn and tilt the head, steady it, help you swallow and speak, and some lift the ribs when you breathe hard.",
  },
  "muscle of pectoral girdle": {
    label: "Shoulder muscle",
    text: "A muscle around the shoulder blade and collarbone. These steer the shoulder blade and the upper arm, and keep the shoulder joint centred.",
  },
  "muscle of upper limb": {
    label: "Arm muscle",
    text: "A muscle of the arm, forearm or hand. Arm muscles bend and straighten the elbow, turn the forearm, and the many small ones move the wrist and fingers.",
  },
  "muscle of lower limb": {
    label: "Leg muscle",
    text: "A muscle of the hip, thigh, leg or foot. These carry you through standing, walking, running and jumping, and keep you balanced.",
  },
  "muscle of trunk": {
    label: "Trunk muscle",
    text: "A muscle of the chest, belly or back. Trunk muscles help you breathe, brace the spine, and bend and twist the body.",
  },
  "muscle of back": {
    label: "Back muscle",
    text: "A muscle of the back. These hold the spine upright and extend, bend and twist it.",
  },
  "muscle organ": {
    label: "Muscle",
    text: "A skeletal muscle. Muscles pull (never push) on the bones they attach to through tendons, so most work in opposing pairs.",
  },
  "coronary artery": {
    label: "Coronary artery",
    text: "One of the arteries that feed the heart muscle itself. A blockage here starves part of the heart of oxygen, which is what a heart attack is.",
  },
  "branch of right coronary artery": {
    label: "Branch of the right coronary artery",
    text: "A branch of the right coronary artery, which usually feeds the right side of the heart, the bottom of the heart and the heart's natural pacemaker.",
  },
  "branch of left coronary artery": {
    label: "Branch of the left coronary artery",
    text: "A branch of the left coronary artery, which feeds most of the heart's main pumping chamber, the left ventricle.",
  },
  "cardiac vein": {
    label: "Cardiac vein",
    text: "A vein that drains used blood from the heart muscle into the coronary sinus, which empties into the right atrium.",
  },
  "pulmonary artery": {
    label: "Pulmonary artery",
    text: "Carries blood low in oxygen from the right side of the heart into the lungs. It is the one artery coloured blue in atlases, because its blood is going to pick up oxygen.",
  },
  "pulmonary vein": {
    label: "Pulmonary vein",
    text: "Brings freshly oxygenated blood from the lungs back to the left side of the heart. It is the one vein coloured red in atlases.",
  },
  "systemic artery": {
    label: "Artery",
    text: "Carries oxygen-rich blood away from the heart under pressure. Arteries have thick, elastic, muscular walls; where one runs close to the skin you can feel its pulse.",
  },
  artery: {
    label: "Artery",
    text: "A vessel carrying blood away from the heart, out to the organs and tissues.",
  },
  "portal vein": {
    label: "Portal vein",
    text: "Part of the hepatic portal system: veins that carry blood from the stomach, intestines and spleen to the liver, so nutrients and toxins are processed before reaching the rest of the body.",
  },
  "systemic vein": {
    label: "Vein",
    text: "Returns used blood to the heart. Veins have thinner walls and lower pressure than arteries; in the limbs one-way valves and squeezing muscles push the blood back up.",
  },
  vein: {
    label: "Vein",
    text: "A vessel carrying blood back toward the heart from the organs and tissues.",
  },
  "gyrus of neuraxis": {
    label: "Brain fold (gyrus)",
    text: "A ridge on the surface of the brain. Folding packs a large sheet of grey matter (the cortex) into the skull. Different gyri handle different jobs.",
  },
  "segment of brain": {
    label: "Brain region",
    text: "A region of the brain, the body's control centre for thought, movement, senses and the automatic jobs that keep you alive.",
  },
  "segment of neural tree organ": {
    label: "Nerve",
    text: "A nerve: a bundle of nerve fibres carrying signals between the brain or spinal cord and the body.",
  },
  nerve: {
    label: "Nerve",
    text: "A bundle of nerve fibres carrying signals between the brain or spinal cord and the body.",
  },
  "segment of bronchial tree": {
    label: "Airway (bronchial tree)",
    text: "Part of the branching airways of a lung. Each branch splits into smaller ones, ending in millions of tiny air sacs where oxygen passes into the blood.",
  },
  "segment of tracheobronchial tree": {
    label: "Airway",
    text: "Part of the airway tree that carries air from the throat into the lungs.",
  },
  "zone of small intestine": {
    label: "Small intestine",
    text: "A stretch of the small intestine, about 6 metres of tube where most digestion finishes and nutrients are absorbed through millions of finger-like villi.",
  },
  "segment of biliary tree": {
    label: "Bile duct",
    text: "Part of the duct system that carries bile from the liver to the gallbladder and on to the small intestine, where bile helps digest fat.",
  },
};

export const kindInfo = kind => (kind && KINDS[kind]) || null;
