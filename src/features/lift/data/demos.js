// Two key poses per movement. The demo eases from `a` to `b` and back.
// Coordinates are in a 200 × 180 box (top at y = -24) with the floor at
// y = 150; the figure faces right. Hands and feet are targets for the
// elbows and knees to reach (see model/figure.js).

const STAND = { hip: [100, 77], t: 0, hand: [101, 79], foot: [100, 146] };
const LYING_BENCH = { hip: [80, 104], t: 90, foot: [62, 146], kneeBend: 1 };
const HANG = { hip: [100, 78], t: 2, hand: [104, -12], foot: [92, 140] };
const BENT_OVER = { hip: [88, 80], t: 75, foot: [100, 146], hand: [131, 114] };

export const demos = {
  squat: {
    a: { ...STAND, hand: [110, 50] },
    b: { hip: [82, 110], t: 35, hand: [128, 86], foot: [100, 146] },
  },
  hinge: {
    a: { ...STAND, hand: [103, 80] },
    b: { ...BENT_OVER },
  },
  deadlift: {
    a: { hip: [84, 98], t: 52, hand: [114, 120], foot: [100, 146] },
    b: { ...STAND, hand: [103, 80] },
  },
  lunge: {
    a: { hip: [99, 80], t: 0, hand: [100, 82], foot: [122, 146], foot2: [76, 143] },
    b: { hip: [99, 108], t: 0, hand: [100, 110], foot: [122, 146], foot2: [76, 143], toe: [9, 5] },
  },
  stepup: {
    a: { hip: [96, 80], t: 4, hand: [98, 82], foot: [126, 108], foot2: [88, 146] },
    b: { hip: [124, 46], t: 0, hand: [125, 48], foot: [126, 108], foot2: [110, 96] },
    props: ["box"],
  },
  pushup: {
    a: { hip: [88, 116], t: 78, hand: [130, 148], foot: [21, 138], toe: [3, 9] },
    b: { hip: [86, 128], t: 86, hand: [128, 148], foot: [19, 140], toe: [3, 9] },
  },
  pike: {
    a: { hip: [100, 80], t: 135, hand: [140, 148], foot: [62, 146], toe: [5, 8], elbowBend: -1 },
    b: { hip: [100, 90], t: 152, hand: [140, 148], foot: [62, 146], toe: [5, 8], elbowBend: -1 },
  },
  bench: {
    a: { ...LYING_BENCH, hand: [124, 58], elbowBend: -1 },
    b: { ...LYING_BENCH, hand: [114, 84], elbowBend: -1 },
    props: ["bench"],
  },
  floorpress: {
    a: { hip: [80, 142], t: 90, foot: [44, 146], kneeBend: 1, hand: [124, 96], elbowBend: -1 },
    b: { hip: [80, 142], t: 90, foot: [44, 146], kneeBend: 1, hand: [130, 126], elbowBend: -1 },
  },
  skull: {
    a: { ...LYING_BENCH, hand: [124, 58], elbowBend: -1 },
    b: { ...LYING_BENCH, hand: [146, 86], elbowBend: -1 },
    props: ["bench"],
  },
  "press-forward": {
    a: { ...STAND, hand: [116, 46], elbowBend: 1 },
    b: { ...STAND, hand: [146, 38] },
    pulley: [20, 36],
  },
  overhead: {
    a: { ...STAND, hand: [108, 26], elbowBend: 1 },
    b: { ...STAND, hand: [102, -12] },
  },
  "overhead-ext": {
    a: { ...STAND, hand: [102, -12], elbowBend: -1 },
    b: { ...STAND, hand: [86, 10], elbowBend: -1 },
  },
  dip: {
    a: { hip: [98, 78], t: 10, hand: [104, 80], foot: [82, 130] },
    b: { hip: [96, 102], t: 16, hand: [104, 80], foot: [80, 150] },
    props: ["dipbars"],
  },
  "bench-dip": {
    a: { hip: [90, 102], shoulder: [86, 58], hand: [80, 104], foot: [150, 146] },
    b: { hip: [92, 126], shoulder: [88, 82], hand: [80, 104], foot: [150, 146] },
    props: ["lowbench"],
  },
  lateral: {
    a: { ...STAND, front: true, hand: [114, 82], hand2: [86, 82], foot: [108, 146], foot2: [92, 146], elbowBend: -1 },
    b: { ...STAND, front: true, hand: [158, 38], hand2: [42, 38], foot: [108, 146], foot2: [92, 146], elbowBend: -1 },
  },
  pullapart: {
    a: { ...STAND, front: true, hand: [108, 48], hand2: [92, 48], foot: [108, 146], foot2: [92, 146] },
    b: { ...STAND, front: true, hand: [158, 40], hand2: [42, 40], foot: [108, 146], foot2: [92, 146] },
  },
  shrug: {
    a: { ...STAND, front: true, hand: [114, 82], hand2: [86, 82], foot: [108, 146], foot2: [92, 146], elbowBend: -1 },
    b: { ...STAND, front: true, shrug: 7, hand: [114, 75], hand2: [86, 75], foot: [108, 146], foot2: [92, 146], elbowBend: -1 },
  },
  windmill: {
    a: { ...STAND, front: true, hand: [114, -12], hand2: [87, 80], foot: [112, 146], foot2: [88, 146] },
    b: { hip: [104, 80], t: -50, front: true, hand: [96, -6], hand2: [86, 116], foot: [112, 146], foot2: [88, 146] },
  },
  curl: {
    a: { ...STAND, hand: [103, 80] },
    b: { ...STAND, hand: [112, 38], elbowBend: 1 },
  },
  pushdown: {
    a: { ...STAND, hand: [124, 54] },
    b: { ...STAND, hand: [104, 79] },
    pulley: [120, -22],
  },
  row: {
    a: { ...BENT_OVER },
    b: { ...BENT_OVER, hand: [120, 84] },
  },
  "row-seated": {
    a: { hip: [80, 136], t: 4, hand: [126, 100], foot: [148, 140] },
    b: { hip: [80, 136], t: -4, hand: [100, 110] },
    pulley: [176, 132],
  },
  "row-inverted": {
    a: { hip: [84, 134], t: 78, hand: [132, 84], foot: [16, 144], toe: [3, 7] },
    b: { hip: [88, 116], t: 72, hand: [132, 84], foot: [20, 144], toe: [3, 7] },
    props: ["lowbar"],
  },
  pullup: {
    a: { ...HANG },
    b: { hip: [100, 52], t: 0, hand: [104, -12], foot: [94, 116] },
    props: ["bar"],
  },
  hang: {
    a: { ...HANG },
    b: { ...HANG, hip: [100, 75], foot: [92, 137] },
    props: ["bar"],
  },
  "hang-raise": {
    a: { ...HANG },
    b: { ...HANG, foot: [126, 92] },
    props: ["bar"],
  },
  pulldown: {
    a: { hip: [90, 112], t: 0, hand: [98, 22], foot: [128, 146] },
    b: { hip: [90, 112], t: -10, hand: [104, 66] },
    pulley: [98, -22],
    props: ["seat"],
  },
  carry: {
    a: { ...STAND, hand: [102, 80], foot: [112, 146], foot2: [88, 146] },
    b: { ...STAND, hand: [102, 80], foot: [88, 146], foot2: [112, 146] },
  },
  plank: {
    a: { hip: [88, 128], t: 84, hand: [154, 146], foot: [20, 140], toe: [3, 9], elbowBend: -1 },
    b: { hip: [88, 126], t: 84, hand: [154, 146], foot: [20, 140], toe: [3, 9], elbowBend: -1 },
  },
  sideplank: {
    a: { hip: [100, 132], t: 72, hand: [164, 146], foot: [32, 142], toe: [8, 4], elbowBend: -1 },
    b: { hip: [100, 122], t: 70, hand: [164, 146], foot: [32, 142], toe: [8, 4], elbowBend: -1 },
  },
  deadbug: {
    a: { hip: [70, 140], t: 90, hand: [114, 94], foot: [36, 104], kneeBend: 1, toe: [0, -8] },
    b: { hip: [70, 140], t: 90, hand: [156, 132], hand2: [114, 94], foot: [36, 104], foot2: [2, 134], kneeBend: 1, toe: [0, -8] },
  },
  crunch: {
    a: { hip: [100, 140], t: -90, hand: [46, 130], foot: [134, 146], kneeBend: -1, elbowBend: -1 },
    b: { hip: [100, 140], t: -58, hand: [54, 104], foot: [134, 146], kneeBend: -1, elbowBend: -1 },
  },
  "kneel-crunch": {
    a: { hip: [92, 100], t: 8, hand: [106, 28], foot: [68, 146], toe: [-6, 3] },
    b: { hip: [92, 104], t: 68, hand: [138, 86], foot: [68, 146], toe: [-6, 3] },
    pulley: [110, -22],
  },
  legraise: {
    a: { hip: [96, 142], t: -90, hand: [96, 146], foot: [164, 140], toe: [4, -8], elbowBend: -1 },
    b: { hip: [96, 142], t: -90, hand: [96, 146], foot: [100, 72], toe: [8, 0] },
  },
  twist: {
    a: { hip: [96, 140], t: -24, hand: [116, 114], foot: [142, 142], kneeBend: 1 },
    b: { hip: [96, 140], t: -24, hand: [94, 128], foot: [142, 142], kneeBend: 1 },
  },
  superman: {
    a: { hip: [96, 144], t: 90, hand: [188, 144], foot: [26, 146], toe: [-2, 8] },
    b: { hip: [96, 144], t: 78, hand: [182, 122], foot: [28, 136], toe: [-2, 8] },
  },
  birddog: {
    a: { hip: [70, 108], t: 90, hand: [114, 148], foot: [40, 146], toe: [-8, 2] },
    b: { hip: [70, 108], t: 90, hand: [160, 104], hand2: [114, 148], foot: [40, 146], foot2: [-2, 104], toe: [-8, 2] },
  },
  bridge: {
    a: { hip: [90, 142], shoulder: [46, 144], hand: [90, 146], foot: [126, 146], elbowBend: -1 },
    b: { hip: [92, 116], shoulder: [52, 140], hand: [90, 146], foot: [126, 146], elbowBend: -1 },
  },
  swing: {
    a: { hip: [84, 84], t: 62, hand: [98, 118], foot: [100, 146] },
    b: { ...STAND, hand: [144, 38] },
  },
  nordic: {
    a: { hip: [100, 104], t: 0, hand: [110, 74], foot: [66, 146], toe: [-6, 3], kneeBend: -1, elbowBend: -1 },
    b: { hip: [118, 116], t: 40, hand: [158, 128], foot: [66, 146], toe: [-6, 3], kneeBend: -1, elbowBend: -1 },
  },
  legcurl: {
    a: { hip: [90, 140], t: 90, hand: [150, 146], foot: [20, 142], toe: [-2, 8] },
    b: { hip: [90, 140], t: 90, hand: [150, 146], foot: [76, 106], toe: [-6, -6] },
  },
  legpress: {
    a: { hip: [110, 122], shoulder: [74, 98], hand: [104, 128], foot: [126, 74], toe: [6, -6] },
    b: { hip: [110, 122], shoulder: [74, 98], hand: [104, 128], foot: [150, 60], toe: [6, -6] },
    props: ["recline"],
  },
  legext: {
    a: { hip: [90, 110], t: -4, hand: [96, 112], foot: [122, 144], toe: [8, 4] },
    b: { hip: [90, 110], t: -4, hand: [96, 112], foot: [158, 100], toe: [4, -8] },
    props: ["seat"],
  },
  wallsit: {
    a: { hip: [80, 112], t: 0, hand: [96, 112], foot: [114, 146] },
    b: { hip: [80, 113], t: 0, hand: [96, 113], foot: [114, 146] },
    props: ["wall"],
  },
  calf: {
    a: { ...STAND, hand: [102, 80] },
    b: { ...STAND, hip: [100, 69], hand: [102, 72], foot: [100, 139], toe: [6, 10] },
  },
};

// A finish pose only lists what moves; the rest stays where it started.
for (const demo of Object.values(demos)) {
  const { a, b } = demo;
  demo.b = { foot: a.foot, toe: a.toe, front: a.front, elbowBend: a.elbowBend, kneeBend: a.kneeBend, ...b };
}

// Movements that look the same from the side borrow another's demo.
const ALIASES = { fly: "bench", "reverse-fly": "lateral", wrist: "curl" };

export function demoFor(id) {
  return demos[id] ?? demos[ALIASES[id]] ?? demos.squat;
}
