// Manufacturing methods for Engineer ToolFox: what each one can hold, what it
// works on, which machines do it, and a simple recommender that turns a part
// description (material, shape, features, tolerance, finish, quantity) into a
// process route. Values are typical job-shop numbers, not guarantees: a good
// shop can beat them and a big or floppy part won't reach them.
//
// tol:  [best, typical] ± size tolerance in mm
// ra:   [best, typical] surface roughness Ra in µm
// caps: [best, typical] geometric tolerance (zone width, mm) for each kind of
//       GD&T control, or missing when the process doesn't make that feature.
// qty:  [from, to] the quantity range where it's economic.
// cost: 1 (cheap per feature) to 5 (expensive).

export const MATERIALS = [
  { id: "al", name: "Aluminium" },
  { id: "steel", name: "Carbon & alloy steel" },
  { id: "stainless", name: "Stainless steel" },
  { id: "hardened", name: "Hardened steel (45+ HRC)" },
  { id: "ti", name: "Titanium" },
  { id: "castiron", name: "Cast iron" },
  { id: "copper", name: "Brass & copper" },
  { id: "plastic", name: "Plastics" },
];

export const SHAPES = [
  { id: "prismatic", name: "Block or plate", hint: "Mostly flat faces, pockets and holes." },
  { id: "round", name: "Round or turned", hint: "Shafts, bushings, pins, discs." },
  { id: "sheet", name: "Sheet metal", hint: "Cut and bent from flat stock." },
  { id: "complex", name: "Complex 3D", hint: "Organic shapes, housings, brackets with curves." },
  { id: "profile", name: "Long constant section", hint: "Same cross-section along its length." },
];

export const FEATURES = [
  { id: "flat", name: "Flat faces" },
  { id: "holes", name: "Holes" },
  { id: "bores", name: "Precision bores" },
  { id: "od", name: "Shafts & outside diameters" },
  { id: "pockets", name: "Pockets & slots" },
  { id: "profile", name: "2D outlines" },
  { id: "threads", name: "Threads" },
  { id: "bends", name: "Bends & flanges" },
  { id: "freeform", name: "Freeform 3D surfaces" },
  { id: "internal", name: "Internal channels" },
  { id: "thin", name: "Thin walls & ribs" },
];

export const QUANTITIES = [
  { value: 1, label: "1" },
  { value: 10, label: "10" },
  { value: 100, label: "100" },
  { value: 1000, label: "1k" },
  { value: 10000, label: "10k" },
  { value: 100000, label: "100k+" },
];

export const RA_STEPS = [0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.3, 12.5, 25];
/** Common names for roughness grades, for people who think in microinches or N-grades. */
export const raName = (ra) => `Ra ${ra} µm · ${Math.round(ra * 39.37)} µin`;

export const CHARS = [
  { id: "size", name: "Size (±)" },
  { id: "flatness", name: "Flatness / straightness" },
  { id: "roundness", name: "Circularity / cylindricity" },
  { id: "orientation", name: "Perpendicularity / parallelism / angularity" },
  { id: "position", name: "Position" },
  { id: "runout", name: "Runout / concentricity" },
  { id: "profile", name: "Profile" },
];

export const FAMILIES = ["Machining", "Grinding & abrasive finishing", "EDM", "Cutting & sheet metal", "Casting & molding", "Forming", "Additive (3D printing)"];

const METALS = ["al", "steel", "stainless", "ti", "castiron", "copper"];
const ALL_METALS = [...METALS, "hardened"];
const CUTTABLE = ["al", "steel", "stainless", "ti", "castiron", "copper", "plastic"];

export const PROCESSES = [
  // Machining ----------------------------------------------------------------
  {
    id: "milling",
    name: "CNC milling (3-axis)",
    family: "Machining",
    role: "both",
    machines: ["3-axis vertical machining center (VMC)", "Horizontal machining center (HMC)", "Manual knee mill (Bridgeport-type) for one-offs"],
    how: "A spinning cutter removes material from a block clamped to a moving table. The default for prismatic metal and plastic parts.",
    tol: [0.01, 0.05],
    ra: [0.8, 3.2],
    caps: { flatness: [0.01, 0.03], orientation: [0.01, 0.03], position: [0.02, 0.05], profile: [0.02, 0.1], roundness: [0.01, 0.03] },
    materials: CUTTABLE,
    shapes: ["prismatic", "complex", "profile"],
    features: ["flat", "holes", "pockets", "profile", "threads", "thin", "bores"],
    qty: [1, 5000],
    cost: 2,
    tooling: "Fixtures and vises only",
    good: "Any prismatic part in any quantity up to a few thousand. Holes, pockets, faces and threads in one setup.",
    limits: "Internal sharp corners take the cutter radius. Deep narrow pockets and thin walls chatter. Each extra side is another setup.",
  },
  {
    id: "milling5",
    name: "5-axis CNC milling",
    family: "Machining",
    role: "both",
    machines: ["5-axis trunnion machining center", "5-axis head-head gantry mill", "3+2 indexing mill"],
    how: "The part or the spindle also tilts, so the cutter can reach angled faces and curved surfaces in one setup.",
    tol: [0.01, 0.05],
    ra: [0.4, 1.6],
    caps: { flatness: [0.01, 0.03], orientation: [0.01, 0.025], position: [0.015, 0.04], profile: [0.01, 0.05], roundness: [0.01, 0.03] },
    materials: CUTTABLE,
    shapes: ["prismatic", "complex"],
    features: ["flat", "holes", "pockets", "profile", "freeform", "thin", "threads", "bores"],
    qty: [1, 2000],
    cost: 3,
    tooling: "Low, mostly fixturing",
    good: "Impellers, housings, aerospace brackets, molds, anything with angled holes or sculpted surfaces. Fewer setups means features line up better.",
    limits: "Higher hourly rate and longer programming than 3-axis.",
  },
  {
    id: "turning",
    name: "CNC turning",
    family: "Machining",
    role: "both",
    machines: ["CNC lathe (2-axis)", "Turn-mill center with live tooling and Y-axis", "Manual engine lathe for one-offs"],
    how: "The part spins in a chuck while a stationary tool cuts it. Makes diameters, faces, grooves, bores and threads that are naturally concentric.",
    tol: [0.005, 0.025],
    ra: [0.4, 1.6],
    caps: { flatness: [0.005, 0.02], roundness: [0.003, 0.01], runout: [0.005, 0.02], orientation: [0.01, 0.025], position: [0.02, 0.05], profile: [0.01, 0.05] },
    materials: CUTTABLE,
    shapes: ["round"],
    features: ["od", "bores", "holes", "flat", "threads", "profile"],
    qty: [1, 20000],
    cost: 1,
    tooling: "None to low",
    good: "Shafts, pins, bushings, flanges. Diameters turned in one chucking are concentric to each other almost for free.",
    limits: "Only round features unless the lathe has live tooling. Long thin shafts deflect and need a tailstock or steady rest.",
  },
  {
    id: "swiss",
    name: "Swiss-type turning",
    family: "Machining",
    role: "primary",
    machines: ["Swiss-type sliding headstock lathe (guide bushing)"],
    how: "Bar stock slides through a guide bushing right next to the tool, so long slender parts don't bend while cut.",
    tol: [0.003, 0.01],
    ra: [0.2, 0.8],
    caps: { roundness: [0.002, 0.005], runout: [0.003, 0.01], position: [0.01, 0.025], profile: [0.01, 0.03] },
    materials: ["al", "steel", "stainless", "ti", "copper", "plastic"],
    shapes: ["round"],
    features: ["od", "holes", "threads", "bores", "profile", "flat"],
    qty: [500, 1000000],
    cost: 2,
    tooling: "Low, but setup takes hours",
    good: "Small, long, precise turned parts in volume: medical screws, connector pins, watch parts.",
    limits: "Bar under about ⌀32 mm. Long setups make one-offs expensive.",
  },
  {
    id: "drilling",
    name: "Drilling",
    family: "Machining",
    role: "both",
    machines: ["Drill press", "Done on a machining center or lathe", "Radial arm drill for big parts", "Gun drilling machine for deep holes"],
    how: "A twist drill makes a round hole. Fast and cheap, but the hole size, roundness and position are only fair.",
    tol: [0.05, 0.1],
    ra: [3.2, 6.3],
    caps: { position: [0.05, 0.15], orientation: [0.05, 0.1], roundness: [0.02, 0.05] },
    materials: CUTTABLE,
    shapes: ["prismatic", "round", "complex", "sheet", "profile"],
    features: ["holes"],
    qty: [1, 1000000],
    cost: 1,
    tooling: "None",
    good: "Clearance holes, tap drills, anything where ±0.1 is fine.",
    limits: "Drills wander, so for tight position spot-drill first or bore. Not a finish operation for fits.",
  },
  {
    id: "reaming",
    name: "Reaming",
    family: "Machining",
    role: "finish",
    machines: ["Machine reamer on a machining center or lathe", "Hand reamer for repairs"],
    how: "A multi-flute tool takes a few tenths of a mm from a drilled hole, giving a precise size and good finish.",
    tol: [0.005, 0.012],
    ra: [0.8, 1.6],
    caps: { roundness: [0.005, 0.01] },
    materials: CUTTABLE,
    shapes: ["prismatic", "round", "complex", "profile"],
    features: ["holes", "bores"],
    qty: [1, 1000000],
    cost: 1,
    tooling: "Standard reamers (custom for odd sizes)",
    good: "Dowel holes and H7 fits. Cheap way to get a precise size.",
    limits: "Follows the existing hole, so it doesn't fix position or straightness. Bore first if position is tight.",
  },
  {
    id: "boring",
    name: "Precision boring",
    family: "Machining",
    role: "finish",
    machines: ["Fine-boring head on a machining center", "Jig borer", "Boring bar on a lathe", "Horizontal boring mill for large work"],
    how: "A single-point tool on an adjustable head enlarges a hole. Because the tool sets the path, it corrects position and straightness as well as size.",
    tol: [0.003, 0.01],
    ra: [0.4, 1.6],
    caps: { roundness: [0.002, 0.005], position: [0.005, 0.015], orientation: [0.005, 0.01], runout: [0.005, 0.01] },
    materials: CUTTABLE,
    shapes: ["prismatic", "round", "complex"],
    features: ["bores", "holes"],
    qty: [1, 10000],
    cost: 2,
    tooling: "None to low",
    good: "Bearing bores, any large hole with tight position, and holes that must line up with each other (line boring).",
    limits: "Slower than reaming. Small holes (under about ⌀6 mm) are hard to bore.",
  },
  {
    id: "threading",
    name: "Tapping, thread milling and rolling",
    family: "Machining",
    role: "finish",
    machines: ["Tapping on a machining center", "Thread mill (helical interpolation)", "Thread rolling machine", "Single-point threading on a lathe"],
    how: "Taps cut internal threads in one pass. Thread mills cut any size with one tool. Rolling forms external threads by squeezing, which makes them stronger.",
    tol: [0.01, 0.05],
    ra: [0.8, 3.2],
    caps: { position: [0.05, 0.1] },
    materials: CUTTABLE,
    shapes: ["prismatic", "round", "complex", "sheet", "profile"],
    features: ["threads"],
    qty: [1, 1000000],
    cost: 1,
    tooling: "Standard taps, dies, rolls",
    good: "Any standard thread. Thread class (6H, 6g, 2B, 3A) sets the tolerance rather than a ± number.",
    limits: "Tapping hard or gummy materials breaks taps; thread milling is safer there.",
  },
  // Grinding and abrasive finishing --------------------------------------------
  {
    id: "surface-grind",
    name: "Surface grinding",
    family: "Grinding & abrasive finishing",
    role: "finish",
    machines: ["Reciprocating surface grinder with magnetic chuck", "Rotary surface grinder", "Double-disc grinder for both faces at once"],
    how: "A grinding wheel passes over a part held on a magnetic chuck, taking a few µm per pass. Gives very flat, parallel faces, even on hardened steel.",
    tol: [0.002, 0.005],
    ra: [0.1, 0.4],
    caps: { flatness: [0.002, 0.005], orientation: [0.002, 0.005] },
    materials: [...ALL_METALS],
    shapes: ["prismatic", "sheet", "round"],
    features: ["flat"],
    qty: [1, 100000],
    cost: 3,
    tooling: "None",
    good: "Die plates, gauge blocks, ground flat stock, hardened wear plates, parallel spacers.",
    limits: "Flat faces only. Non-magnetic materials need special fixturing. Takes off only small amounts.",
  },
  {
    id: "cyl-grind",
    name: "Cylindrical grinding (OD / ID)",
    family: "Grinding & abrasive finishing",
    role: "finish",
    machines: ["OD cylindrical grinder between centers", "ID grinder", "Universal grinder"],
    how: "The part turns between centers while a wheel grinds the diameter. Holds tight size, roundness and runout to the centers.",
    tol: [0.0013, 0.005],
    ra: [0.1, 0.4],
    caps: { roundness: [0.0005, 0.002], runout: [0.002, 0.005], flatness: [0.002, 0.005] },
    materials: [...ALL_METALS],
    shapes: ["round"],
    features: ["od", "bores"],
    qty: [1, 100000],
    cost: 3,
    tooling: "None to low",
    good: "Bearing journals, hardened pins and shafts, ground bores, seal surfaces.",
    limits: "Slow. Removes only small amounts, so turn close first. Shoulders need wheel clearance or an undercut.",
  },
  {
    id: "centerless",
    name: "Centerless grinding",
    family: "Grinding & abrasive finishing",
    role: "finish",
    machines: ["Centerless grinder (through-feed or in-feed)"],
    how: "The part rides on a blade between a grinding wheel and a regulating wheel, with no centers. Very fast for plain diameters.",
    tol: [0.002, 0.005],
    ra: [0.2, 0.4],
    caps: { roundness: [0.001, 0.003] },
    materials: [...ALL_METALS, "plastic"],
    shapes: ["round"],
    features: ["od"],
    qty: [100, 10000000],
    cost: 2,
    tooling: "Low",
    good: "Pins, rollers, dowels and bar stock in volume.",
    limits: "No datum axis, so runout to other features isn't controlled. Can leave odd lobing (3 or 5 lobes) that a micrometer won't see.",
  },
  {
    id: "honing",
    name: "Honing",
    family: "Grinding & abrasive finishing",
    role: "finish",
    machines: ["Vertical or horizontal honing machine", "Flex hone for deburring"],
    how: "Abrasive stones expand inside a bore while rotating and stroking. Corrects roundness and taper and leaves a cross-hatch finish.",
    tol: [0.002, 0.005],
    ra: [0.05, 0.2],
    caps: { roundness: [0.001, 0.003] },
    materials: [...ALL_METALS],
    shapes: ["prismatic", "round", "complex"],
    features: ["bores"],
    qty: [1, 1000000],
    cost: 3,
    tooling: "Low",
    good: "Engine cylinders, hydraulic cylinders, valve bores, gear bores.",
    limits: "Follows the existing axis; doesn't fix position. Bores only.",
  },
  {
    id: "lapping",
    name: "Lapping and polishing",
    family: "Grinding & abrasive finishing",
    role: "finish",
    machines: ["Single or double-sided lapping machine", "Hand lap and optical flat", "Polishing wheel"],
    how: "Loose abrasive between the part and a flat plate wears off peaks a micron at a time. The finest flatness and finish you can buy.",
    tol: [0.0005, 0.002],
    ra: [0.025, 0.1],
    caps: { flatness: [0.0003, 0.001], orientation: [0.001, 0.002], roundness: [0.0005, 0.001] },
    materials: [...ALL_METALS, "plastic"],
    shapes: ["prismatic", "round", "sheet"],
    features: ["flat", "od"],
    qty: [1, 100000],
    cost: 5,
    tooling: "Low",
    good: "Seal faces, gauge blocks, valve seats, optical and vacuum surfaces.",
    limits: "Removes almost nothing, so the part must already be close. Slow and costly.",
  },
  // EDM ----------------------------------------------------------------------
  {
    id: "wire-edm",
    name: "Wire EDM",
    family: "EDM",
    role: "both",
    machines: ["Wire EDM machine (4/5-axis taper cutting)"],
    how: "A thin brass wire is fed through the part while sparks erode it, like a precise bandsaw. Cuts any conductive material, including hardened steel.",
    tol: [0.003, 0.01],
    ra: [0.2, 1.6],
    caps: { profile: [0.005, 0.01], position: [0.005, 0.01], orientation: [0.005, 0.01], flatness: [0.005, 0.01] },
    materials: [...ALL_METALS],
    shapes: ["prismatic", "sheet", "profile"],
    features: ["profile", "holes", "pockets", "thin"],
    qty: [1, 500],
    cost: 4,
    tooling: "None (needs a start hole for inside cuts)",
    good: "Punch and die sets, gears, splines, sharp inside corners, hardened parts after heat treatment.",
    limits: "Only through-cuts (straight or tapered walls). Slow, and only conductive materials.",
  },
  {
    id: "sinker-edm",
    name: "Sinker EDM",
    family: "EDM",
    role: "both",
    machines: ["Ram (sinker) EDM with graphite or copper electrodes"],
    how: "A shaped electrode is plunged into the part and sparks erode its shape in reverse. Makes blind shapes in hard steel.",
    tol: [0.005, 0.025],
    ra: [0.2, 1.6],
    caps: { profile: [0.01, 0.025], position: [0.01, 0.02] },
    materials: [...ALL_METALS],
    shapes: ["prismatic", "complex"],
    features: ["pockets", "freeform", "holes"],
    qty: [1, 500],
    cost: 5,
    tooling: "Electrodes must be made first",
    good: "Mold cavities, sharp blind corners, ribs too deep to mill, hexes and splines in blind holes.",
    limits: "Slow, and the electrodes cost money and time.",
  },
  // Cutting and sheet metal ----------------------------------------------------
  {
    id: "laser",
    name: "Laser cutting",
    family: "Cutting & sheet metal",
    role: "primary",
    machines: ["Fiber laser cutter (metals)", "CO₂ laser (plastics, wood, thin metal)", "Tube laser"],
    how: "A focused beam melts or vaporises a path through flat sheet. Fast, no tooling, fine detail.",
    tol: [0.05, 0.1],
    ra: [1.6, 6.3],
    caps: { profile: [0.05, 0.15], position: [0.05, 0.1] },
    materials: ["al", "steel", "stainless", "ti", "copper", "plastic"],
    shapes: ["sheet"],
    features: ["profile", "holes", "pockets"],
    qty: [1, 50000],
    cost: 1,
    tooling: "None",
    good: "Flat sheet up to about 25 mm steel. Brackets, panels, gussets, enclosures before bending.",
    limits: "Edges have a slight taper and heat-affected zone. Small holes under the sheet thickness are poor.",
  },
  {
    id: "waterjet",
    name: "Abrasive waterjet",
    family: "Cutting & sheet metal",
    role: "primary",
    machines: ["Abrasive waterjet table (often with taper compensation)"],
    how: "Water at very high pressure, with garnet grit, erodes through almost anything with no heat.",
    tol: [0.05, 0.13],
    ra: [3.2, 6.3],
    caps: { profile: [0.05, 0.2], position: [0.05, 0.15] },
    materials: [...ALL_METALS, "plastic"],
    shapes: ["sheet", "prismatic"],
    features: ["profile", "holes", "pockets"],
    qty: [1, 1000],
    cost: 2,
    tooling: "None",
    good: "Thick plate (100 mm+), hardened steel, titanium, stone, glass, composites. No heat-affected zone.",
    limits: "Slower than laser on thin sheet. Edges taper slightly unless the head compensates.",
  },
  {
    id: "plasma",
    name: "Plasma cutting",
    family: "Cutting & sheet metal",
    role: "primary",
    machines: ["CNC plasma table", "High-definition plasma", "Handheld plasma torch"],
    how: "An electric arc through gas melts a kerf through conductive plate. Cheap and fast on thick steel.",
    tol: [0.25, 0.5],
    ra: [6.3, 12.5],
    caps: { profile: [0.4, 1.0], position: [0.3, 0.8] },
    materials: ["al", "steel", "stainless", "copper"],
    shapes: ["sheet"],
    features: ["profile", "holes"],
    qty: [1, 20000],
    cost: 1,
    tooling: "None",
    good: "Structural plate, base plates, gussets, parts that will be welded.",
    limits: "Rough, beveled edges and dross. Holes need drilling if they must be accurate.",
  },
  {
    id: "punching",
    name: "Turret punching",
    family: "Cutting & sheet metal",
    role: "primary",
    machines: ["CNC turret punch press", "Punch-laser combination machine"],
    how: "Standard punches and dies stamp holes and shapes out of sheet one hit at a time. Can also form louvers and countersinks.",
    tol: [0.05, 0.1],
    ra: [3.2, 6.3],
    caps: { position: [0.05, 0.1], profile: [0.1, 0.2] },
    materials: ["al", "steel", "stainless", "copper", "plastic"],
    shapes: ["sheet"],
    features: ["holes", "profile", "pockets"],
    qty: [10, 50000],
    cost: 1,
    tooling: "Standard tool library; custom shapes cost extra",
    good: "Electrical panels and enclosures with lots of holes and cut-outs in thin sheet.",
    limits: "Sheet up to about 6 mm. Curves are nibbled and show scallops.",
  },
  {
    id: "press-brake",
    name: "Press brake bending",
    family: "Cutting & sheet metal",
    role: "primary",
    machines: ["CNC press brake with back gauge", "Panel bender", "Folding machine"],
    how: "A punch pushes sheet into a V-die to make a straight bend. Laser-cut blanks plus bending make most sheet metal parts.",
    tol: [0.1, 0.25],
    ra: [1.6, 6.3],
    caps: { orientation: [0.2, 0.5], profile: [0.25, 0.5], position: [0.2, 0.4] },
    materials: ["al", "steel", "stainless", "copper"],
    shapes: ["sheet"],
    features: ["bends", "flat"],
    qty: [1, 50000],
    cost: 1,
    tooling: "Standard punches and dies",
    good: "Brackets, chassis, enclosures, channels. Angle tolerance about ±0.5°, ±0.25° with care.",
    limits: "Tolerances stack across each bend. Holes near bends distort. Minimum flange length depends on thickness.",
  },
  {
    id: "stamping",
    name: "Stamping (progressive die)",
    family: "Cutting & sheet metal",
    role: "primary",
    machines: ["Mechanical or servo stamping press", "Progressive die", "Transfer press"],
    how: "Strip runs through a die that cuts and forms the part a step at a time, one part per press stroke.",
    tol: [0.025, 0.08],
    ra: [0.8, 3.2],
    caps: { position: [0.03, 0.08], profile: [0.05, 0.15], orientation: [0.1, 0.3], flatness: [0.05, 0.2] },
    materials: ["al", "steel", "stainless", "copper"],
    shapes: ["sheet"],
    features: ["holes", "profile", "bends", "pockets"],
    qty: [10000, 100000000],
    cost: 1,
    tooling: "High: the die costs thousands to hundreds of thousands",
    good: "Very high volume brackets, clips, terminals, automotive panels. Cents per part.",
    limits: "Die cost and lead time only pay off at volume. Design changes mean die changes.",
  },
  // Casting and molding --------------------------------------------------------
  {
    id: "sand-cast",
    name: "Sand casting",
    family: "Casting & molding",
    role: "primary",
    machines: ["Green sand molding line", "No-bake (resin) sand molds", "Foundry furnace and ladle"],
    how: "Molten metal is poured into a cavity packed in sand around a pattern. Cheap tooling, any size, rough finish.",
    tol: [0.5, 1.0],
    ra: [6.3, 25],
    caps: { flatness: [0.5, 1.5], profile: [1.0, 2.0], position: [0.8, 1.5] },
    materials: ["al", "steel", "stainless", "castiron", "copper"],
    shapes: ["complex", "prismatic"],
    features: ["freeform", "internal", "pockets", "flat"],
    qty: [1, 10000],
    cost: 1,
    tooling: "Low: a wood, plastic or printed pattern",
    good: "Pump housings, engine blocks, machine bases, anything big. Cast close, then machine the critical faces and bores.",
    limits: "Rough surface and loose tolerances. Needs draft and machining allowance on functional faces.",
  },
  {
    id: "investment",
    name: "Investment casting",
    family: "Casting & molding",
    role: "primary",
    machines: ["Wax injection press", "Ceramic shell dipping line", "Vacuum or air casting"],
    how: "A wax copy is coated in ceramic, the wax is melted out, and metal is poured into the shell. Fine detail and smooth surfaces.",
    tol: [0.1, 0.25],
    ra: [1.6, 3.2],
    caps: { profile: [0.2, 0.5], flatness: [0.1, 0.3], position: [0.15, 0.3] },
    materials: ["al", "steel", "stainless", "ti", "copper"],
    shapes: ["complex"],
    features: ["freeform", "thin", "internal", "pockets"],
    qty: [50, 50000],
    cost: 2,
    tooling: "Medium: an aluminium wax die (or printed patterns for low volume)",
    good: "Turbine blades, valve bodies, firearm and medical parts, small complex steel parts that would be costly to machine.",
    limits: "Size limited (mostly under about 1 kg to tens of kg). Critical bores still get machined.",
  },
  {
    id: "die-cast",
    name: "Die casting",
    family: "Casting & molding",
    role: "primary",
    machines: ["Cold-chamber die casting machine (aluminium)", "Hot-chamber machine (zinc, magnesium)"],
    how: "Molten non-ferrous metal is injected at high pressure into a steel die. Fast, accurate, and thin walls are possible.",
    tol: [0.05, 0.1],
    ra: [0.8, 1.6],
    caps: { profile: [0.1, 0.25], flatness: [0.05, 0.2], position: [0.05, 0.15] },
    materials: ["al", "copper"],
    shapes: ["complex", "prismatic"],
    features: ["freeform", "thin", "pockets", "holes", "flat"],
    qty: [5000, 1000000],
    cost: 1,
    tooling: "High: hardened steel dies",
    good: "Housings for electronics and power tools, gearbox cases, brackets in volume.",
    limits: "Aluminium, zinc and magnesium only. Porosity means critical sealing faces are often machined.",
  },
  {
    id: "injection",
    name: "Injection molding",
    family: "Casting & molding",
    role: "primary",
    machines: ["Injection molding machine (hydraulic or electric)", "Steel or aluminium mold"],
    how: "Melted plastic is forced into a cooled mold and ejected seconds later. The cheapest way to make plastic parts in volume.",
    tol: [0.025, 0.1],
    ra: [0.05, 0.8],
    caps: { profile: [0.05, 0.2], flatness: [0.05, 0.25], position: [0.03, 0.1], roundness: [0.03, 0.1] },
    materials: ["plastic"],
    shapes: ["complex", "prismatic", "round"],
    features: ["freeform", "thin", "holes", "pockets", "threads", "flat"],
    qty: [1000, 10000000],
    cost: 1,
    tooling: "High: molds cost a few thousand to six figures",
    good: "Almost every plastic product: enclosures, clips, caps, gears, medical disposables.",
    limits: "Needs draft, even wall thickness and no undercuts (or costly slides). Shrink and warp limit tolerance on big parts.",
  },
  {
    id: "forging",
    name: "Closed-die forging",
    family: "Forming",
    role: "primary",
    machines: ["Forging press or hammer", "Upsetter", "Ring rolling mill"],
    how: "Hot metal is hammered or pressed into a die, so the grain flows with the shape. Very strong parts.",
    tol: [0.25, 0.5],
    ra: [3.2, 6.3],
    caps: { profile: [0.5, 1.0], flatness: [0.3, 0.8] },
    materials: ["al", "steel", "stainless", "ti", "copper"],
    shapes: ["complex", "round"],
    features: ["freeform", "flat"],
    qty: [500, 1000000],
    cost: 2,
    tooling: "High: hardened dies",
    good: "Crankshafts, connecting rods, wrenches, aircraft fittings. Machine the bores and faces afterwards.",
    limits: "Needs draft and a parting line with flash. Loose tolerances until machined.",
  },
  {
    id: "extrusion",
    name: "Extrusion",
    family: "Forming",
    role: "primary",
    machines: ["Aluminium extrusion press", "Plastic extrusion line"],
    how: "A heated billet is pushed through a shaped die like toothpaste, making long lengths of one cross-section.",
    tol: [0.1, 0.25],
    ra: [0.8, 1.6],
    caps: { profile: [0.15, 0.4], flatness: [0.1, 0.3] },
    materials: ["al", "copper", "plastic"],
    shapes: ["profile"],
    features: ["profile", "thin", "internal"],
    qty: [500, 10000000],
    cost: 1,
    tooling: "Low to medium: dies are fairly cheap",
    good: "Heat sinks, T-slot framing, window frames, rails, tubing.",
    limits: "Only constant sections. Straightness and twist are per metre and add up on long parts.",
  },
  // Additive ----------------------------------------------------------------
  {
    id: "fdm",
    name: "FDM 3D printing",
    family: "Additive (3D printing)",
    role: "primary",
    machines: ["FDM / FFF printer (desktop or industrial)"],
    how: "A heated nozzle lays down melted plastic filament layer by layer.",
    tol: [0.15, 0.3],
    ra: [6.3, 12.5],
    caps: { profile: [0.2, 0.5], flatness: [0.2, 0.5], position: [0.2, 0.4] },
    materials: ["plastic"],
    shapes: ["complex", "prismatic"],
    features: ["freeform", "internal", "pockets", "holes", "thin"],
    qty: [1, 50],
    cost: 1,
    tooling: "None",
    good: "Prototypes, jigs and fixtures, one-off brackets.",
    limits: "Visible layers, weaker between layers, holes print undersize. Ream or drill critical holes.",
  },
  {
    id: "sla",
    name: "SLA / resin printing",
    family: "Additive (3D printing)",
    role: "primary",
    machines: ["SLA laser resin printer", "DLP / LCD resin printer"],
    how: "Light cures liquid resin layer by layer. Fine detail and a smooth surface.",
    tol: [0.05, 0.1],
    ra: [0.4, 1.6],
    caps: { profile: [0.05, 0.15], flatness: [0.1, 0.25], position: [0.05, 0.15] },
    materials: ["plastic"],
    shapes: ["complex", "prismatic"],
    features: ["freeform", "internal", "thin", "pockets", "holes"],
    qty: [1, 100],
    cost: 2,
    tooling: "None",
    good: "Appearance models, dental and medical models, small detailed parts, molds for casting.",
    limits: "Resins can be brittle and creep. Parts need supports and post-curing.",
  },
  {
    id: "sls",
    name: "SLS / MJF nylon printing",
    family: "Additive (3D printing)",
    role: "primary",
    machines: ["Selective laser sintering (SLS) printer", "HP Multi Jet Fusion (MJF)"],
    how: "Nylon powder is fused layer by layer; the loose powder supports the part, so no supports are needed.",
    tol: [0.15, 0.3],
    ra: [3.2, 6.3],
    caps: { profile: [0.2, 0.4], flatness: [0.2, 0.5], position: [0.2, 0.3] },
    materials: ["plastic"],
    shapes: ["complex", "prismatic"],
    features: ["freeform", "internal", "thin", "pockets", "holes"],
    qty: [1, 5000],
    cost: 2,
    tooling: "None",
    good: "Functional nylon parts, snap fits, ducting, low-volume production in place of molding.",
    limits: "Grainy surface. Big flat areas warp.",
  },
  {
    id: "metal-am",
    name: "Metal 3D printing (laser powder bed)",
    family: "Additive (3D printing)",
    role: "primary",
    machines: ["Laser powder bed fusion (DMLS / SLM / LPBF)", "Binder jetting plus sintering"],
    how: "A laser melts fine metal powder one layer at a time. Makes shapes no other process can, such as internal cooling channels and lattices.",
    tol: [0.05, 0.1],
    ra: [6.3, 12.5],
    caps: { profile: [0.1, 0.2], flatness: [0.1, 0.3], position: [0.1, 0.2] },
    materials: ["al", "steel", "stainless", "ti"],
    shapes: ["complex"],
    features: ["freeform", "internal", "thin"],
    qty: [1, 1000],
    cost: 5,
    tooling: "None, but needs build plates and support removal",
    good: "Conformal-cooled mold inserts, aerospace brackets, medical implants, manifolds with internal passages.",
    limits: "Rough as-built surface and residual stress. Functional faces and holes are machined after printing.",
  },
];

export const processById = Object.fromEntries(PROCESSES.map((p) => [p.id, p]));

/** How well a capability [best, typical] meets a requirement. 2 = comfortably, 1 = with care, 0 = no. */
export function fit(cap, need) {
  if (!cap || !Number.isFinite(need)) return cap ? 2 : 0;
  if (need >= cap[1] - 1e-12) return 2;
  if (need >= cap[0] - 1e-12) return 1;
  return 0;
}

/** Processes that can hold a GD&T or size requirement, best fits first. Used on the GD&T pages. */
export function capableOf(char, value, { material, feature } = {}) {
  return PROCESSES.map((p) => {
    const cap = char === "size" ? p.tol.map((t) => t * 2) : p.caps[char];
    const f = cap ? fit(cap, value) : 0;
    return { p, cap, f };
  })
    .filter((x) => x.cap && x.f > 0 && (!material || x.p.materials.includes(material)) && (!feature || x.p.features.includes(feature)))
    .sort((a, b) => b.f - a.f || a.p.cost - b.p.cost || b.cap[1] - a.cap[1]);
}

const QTY_WORDS = (q) => (q >= 100000 ? "100k+" : q >= 1000 ? `${q / 1000}k` : String(q));

/**
 * Rate every process for a part and build a suggested route.
 * need: { material, shape, features: [], tol (± mm), ra (µm), qty, char?, charTol? }
 */
export function recommend(need) {
  const rated = PROCESSES.map((p) => rate(p, need));
  const primaries = rated
    .filter((r) => r.p.role !== "finish" && r.material && r.shape)
    .sort((a, b) => b.score - a.score || a.p.cost - b.p.cost);
  const best = primaries[0] || null;
  const route = [];
  if (best) {
    const short = best.tol === 0 || best.ra === 0 || (need.char && best.char === 0);
    route.push({
      step: "Make the part",
      p: best.p,
      why: short ? "Makes the shape close to size. The tight features are finished in the next step." : best.status === "good" ? "Holds your tolerance and finish as normal practice." : "Holds it, but near its limit or off its best quantity. Expect higher cost.",
    });
    const features = need.features?.length ? need.features : [];
    const shortTol = best.tol === 0;
    const shortRa = best.ra === 0;
    const shortChar = need.char && best.char === 0;
    for (const fId of features) {
      const shaped = best.p.features.includes(fId);
      if (shaped && !shortTol && !shortRa && !shortChar) continue;
      const finisher = rated
        .filter((r) => r.p.id !== best.p.id && r.p.role !== "primary" && r.material && r.p.features.includes(fId) && r.tol > 0 && r.ra > 0 && (!need.char || r.char > 0 || !r.p.caps[need.char]))
        .sort((a, b) => finishCost(a) - finishCost(b))[0];
      const fName = FEATURES.find((f) => f.id === fId)?.name.toLowerCase();
      if (finisher) {
        if (!route.some((s) => s.p.id === finisher.p.id))
          route.push({ step: shaped ? `Finish the ${fName}` : `Add the ${fName}`, p: finisher.p, why: shaped ? `${best.p.name} can't reach the tolerance or finish on its own.` : `${best.p.name} doesn't make ${fName}.` });
      } else if (!shaped) {
        route.push({ step: `Add the ${fName}`, p: null, why: `Nothing in the list makes ${fName} on this material and shape at that tolerance. Loosen the tolerance or change the design.` });
      }
    }
  }
  const order = (r) => ({ good: 0, care: 1, finish: 2, step: 3, no: 4 })[r.status];
  return { route, rated: rated.sort((a, b) => order(a) - order(b) || b.score - a.score || a.p.cost - b.p.cost), best };
}

/** Cheapest adequate finishing step first; a comfortable fit is worth about one cost step. */
const finishCost = (r) => r.p.cost - (r.tol + r.ra + r.char) / 2 + (r.qtyOk ? 0 : 1);

function rate(p, need) {
  const why = [];
  const material = p.materials.includes(need.material);
  const shape = p.role === "finish" ? true : p.shapes.includes(need.shape);
  const tol = fit(p.tol, need.tol);
  const ra = fit([p.ra[0], p.ra[1]], need.ra);
  const char = need.char ? fit(need.char === "size" ? p.tol.map((t) => t * 2) : p.caps[need.char], need.charTol) : 2;
  const qtyOk = need.qty >= p.qty[0] && need.qty <= p.qty[1];
  const covered = (need.features || []).filter((f) => p.features.includes(f));
  const missing = (need.features || []).filter((f) => !p.features.includes(f));

  if (!material) why.push(`Doesn't work with ${MATERIALS.find((m) => m.id === need.material)?.name.toLowerCase()}.`);
  if (!p.shapes.includes(need.shape) && p.role !== "finish") why.push(`Not a way to make a ${SHAPES.find((s) => s.id === need.shape)?.name.toLowerCase()} part.`);
  if (tol === 2) why.push(`Holds ±${need.tol} mm comfortably (typical ±${p.tol[1]}).`);
  else if (tol === 1) why.push(`Can hold ±${need.tol} mm with care (best about ±${p.tol[0]}, typical ±${p.tol[1]}). Expect slower cutting and more inspection.`);
  else why.push(`Can't hold ±${need.tol} mm (best about ±${p.tol[0]}).`);
  if (ra === 2) why.push(`Leaves Ra ${p.ra[1]} µm or better as standard.`);
  else if (ra === 1) why.push(`Reaches Ra ${need.ra} µm only with fine finishing passes (best about Ra ${p.ra[0]}).`);
  else why.push(`Too rough for Ra ${need.ra} µm (best about Ra ${p.ra[0]}).`);
  if (need.char) {
    const name = CHARS.find((c) => c.id === need.char)?.name.toLowerCase();
    const cap = need.char === "size" ? null : p.caps[need.char];
    if (need.char !== "size") {
      if (!cap) why.push(`Doesn't really control ${name}.`);
      else if (char === 2) why.push(`Holds ${name} of ${need.charTol} mm comfortably (typical ${cap[1]}).`);
      else if (char === 1) why.push(`Holds ${name} of ${need.charTol} mm with care (best about ${cap[0]}).`);
      else why.push(`Can't hold ${name} of ${need.charTol} mm (best about ${cap[0]}).`);
    }
  }
  if (!qtyOk) why.push(need.qty < p.qty[0] ? `Usually only pays off from about ${QTY_WORDS(p.qty[0])} parts (${p.tooling.toLowerCase()}).` : `Above about ${QTY_WORDS(p.qty[1])} parts, other processes get cheaper per part.`);
  else why.push(`Economic at ${QTY_WORDS(need.qty)} parts.`);
  if (missing.length && p.role !== "finish") why.push(`Doesn't make: ${missing.map((f) => FEATURES.find((x) => x.id === f)?.name.toLowerCase()).join(", ")}.`);

  let status;
  const usable = material && (p.role === "finish" ? covered.length > 0 : shape);
  if (!usable) status = "no";
  else if (p.role === "finish") status = tol === 0 || ra === 0 || char === 0 ? "no" : "step";
  else if (tol === 0 || ra === 0 || char === 0) status = "finish";
  else if (tol === 1 || ra === 1 || char === 1 || !qtyOk) status = "care";
  else status = "good";

  const score = (material ? 10 : 0) + (shape ? 10 : 0) + tol * 3 + ra * 2 + char * 3 + (qtyOk ? 4 : 0) + covered.length * 2 - missing.length * 2 - p.cost;
  return { p, material, shape, tol, ra, char, qtyOk, covered, missing, status, score, why };
}
