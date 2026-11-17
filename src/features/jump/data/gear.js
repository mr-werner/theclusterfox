// Where to buy skydiving gear, and what a first rig costs. Links go to the
// store or maker's own site.

export const STORES = [
  { name: "Chuting Star", url: "https://www.chutingstar.com", text: "Big US dealer: rigs, canopies, helmets, altimeters, used gear." },
  { name: "Square One", url: "https://www.square1.com", text: "Dealer with shops at Perris, Eloy and other DZs." },
  { name: "Para Gear", url: "https://www.paragear.com", text: "Huge catalog of gear, rigging supplies and accessories." },
  { name: "Dropzone.com classifieds", url: "https://www.dropzone.com", text: "Used gear for sale. Have a rigger inspect anything before you jump it." },
];

export const MAKERS = [
  { group: "Containers", items: [
    { name: "UPT (Vector, Micron)", url: "https://www.uptvector.com" },
    { name: "Sun Path (Javelin)", url: "https://www.sunpath.com" },
    { name: "Mirage Systems", url: "https://www.mirage-systems.com" },
    { name: "Velocity Sports (Infinity)", url: "https://www.velocitysportsequipment.com" },
  ] },
  { group: "Canopies", items: [
    { name: "Performance Designs", url: "https://www.performancedesigns.com" },
    { name: "Aerodyne", url: "https://www.flyaerodyne.com" },
    { name: "NZ Aerosports (Icarus)", url: "https://www.nzaerosports.com" },
  ] },
  { group: "AADs", items: [
    { name: "CYPRES", url: "https://www.cypres.aero" },
    { name: "Vigil", url: "https://www.vigil.aero" },
  ] },
  { group: "Helmets and altimeters", items: [
    { name: "Cookie Composites", url: "https://www.cookiecomposites.com" },
    { name: "Tonfly", url: "https://www.tonfly.com" },
    { name: "Alti-2", url: "https://www.alti-2.com" },
    { name: "L&B (audibles)", url: "https://www.l-and-b.dk" },
  ] },
  { group: "Suits", items: [
    { name: "Tony Suits", url: "https://www.tonysuits.com" },
    { name: "Squirrel", url: "https://www.squirrel.ws" },
  ] },
];

export const FIRST_RIG = [
  { item: "Container (harness and container)", used: "$800–$2,000", fresh: "$2,500–$3,500", note: "Must fit you. New ones are made to your measurements and take months." },
  { item: "Main canopy", used: "$800–$1,800", fresh: "$2,500–$3,300", note: "Size it with your instructor's downsizing advice, not your friends'." },
  { item: "Reserve canopy", used: "$900–$1,800", fresh: "$2,000–$2,800", note: "Check its age and repack history." },
  { item: "AAD (CYPRES or Vigil)", used: "$600–$1,200", fresh: "$1,500–$1,900", note: "Check the service and end-of-life dates before buying used." },
  { item: "Altimeter", used: "$150–$250", fresh: "$250–$400" },
  { item: "Audible altimeter", used: "$100–$200", fresh: "$200–$350" },
  { item: "Helmet", used: "$150–$350", fresh: "$300–$800" },
  { item: "Jumpsuit", used: "$100–$300", fresh: "$350–$700", note: "Optional at first, useful to adjust your fall rate." },
];

export const GEAR_TIPS = [
  "Rent student gear until your A license. Your canopy size will change fast at first.",
  "A used rig needs a rigger's inspection before you jump it, every time you buy one.",
  "Write down the serial numbers and dates of manufacture: insurance, resale and safety notices need them.",
  "Reserves get repacked every 180 days in the US. Put the due date on your PlanFox calendar.",
];
