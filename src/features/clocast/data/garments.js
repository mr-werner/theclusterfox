// Garment insulation in clo, from the garment tables in ISO 9920 and
// ASHRAE 55 (Table 5.2.2.2B), rounded. Underwear is counted but not listed.

export const garments = {
  // Everyday
  underwear: { name: "Underwear", clo: 0.04, region: "base", hidden: true },
  tee: { name: "T-shirt", clo: 0.08, region: "top" },
  longSleeve: { name: "Long-sleeve shirt", clo: 0.25, region: "top" },
  thermalTop: { name: "Thermal base-layer top", clo: 0.2, region: "top" },
  thinSweater: { name: "Light sweater or hoodie", clo: 0.25, region: "top" },
  thickSweater: { name: "Thick sweater", clo: 0.36, region: "top" },
  fleece: { name: "Fleece jacket", clo: 0.4, region: "top" },
  lightJacket: { name: "Light jacket", clo: 0.25, region: "outer" },
  puffer: { name: "Insulated puffer jacket", clo: 0.55, region: "outer" },
  parka: { name: "Heavy winter parka", clo: 0.8, region: "outer" },
  shorts: { name: "Shorts", clo: 0.06, region: "legs" },
  trousers: { name: "Light trousers or chinos", clo: 0.15, region: "legs" },
  jeans: { name: "Jeans or heavy trousers", clo: 0.24, region: "legs" },
  thermalBottoms: { name: "Thermal leggings underneath", clo: 0.15, region: "legs" },
  snowPants: { name: "Insulated snow pants", clo: 0.45, region: "legs" },
  sandals: { name: "Sandals", clo: 0.02, region: "feet" },
  socks: { name: "Socks", clo: 0.02, region: "feet" },
  sneakers: { name: "Sneakers", clo: 0.02, region: "feet" },
  woolSocks: { name: "Warm wool socks", clo: 0.06, region: "feet" },
  boots: { name: "Insulated boots", clo: 0.1, region: "feet" },

  // Active wear
  briefs: { name: "Sport underwear", clo: 0.03, region: "base", hidden: true },
  techTee: { name: "Breathable tech tee", clo: 0.08, region: "top" },
  techLong: { name: "Long-sleeve tech top", clo: 0.15, region: "top" },
  thermalBase: { name: "Thermal base layer", clo: 0.2, region: "top" },
  gridFleece: { name: "Light fleece mid-layer", clo: 0.25, region: "top" },
  windVest: { name: "Wind vest", clo: 0.1, region: "outer" },
  shell: { name: "Light wind jacket", clo: 0.18, region: "outer" },
  insulatedShell: { name: "Insulated active jacket", clo: 0.35, region: "outer" },
  puffyVest: { name: "Puffy vest over the jacket", clo: 0.2, region: "outer" },
  runShorts: { name: "Athletic shorts", clo: 0.06, region: "legs" },
  tights: { name: "Leggings or tights", clo: 0.12, region: "legs" },
  thermalTights: { name: "Thermal tights", clo: 0.2, region: "legs" },
  windPants: { name: "Wind pants over tights", clo: 0.1, region: "legs" },
  sportSocks: { name: "Sport socks", clo: 0.02, region: "feet" },
  trainers: { name: "Trainers", clo: 0.02, region: "feet" },
  sportWoolSocks: { name: "Wool sport socks", clo: 0.04, region: "feet" },
};

// Outfits from lightest to warmest. Each is built from the garments above
// and its total is worked out with McCullough's equation (ASHRAE 55):
// ensemble clo = 0.835 × Σ garment clo + 0.161.
const ladders = {
  everyday: [
    { name: "Summer light", items: ["underwear", "tee", "shorts", "sandals"] },
    { name: "Tee and shorts", items: ["underwear", "tee", "shorts", "socks", "sneakers"] },
    { name: "Tee and trousers", items: ["underwear", "tee", "trousers", "socks", "sneakers"] },
    { name: "Long sleeves", items: ["underwear", "longSleeve", "trousers", "socks", "sneakers"] },
    { name: "Light layer", items: ["underwear", "tee", "jeans", "thinSweater", "socks", "sneakers"] },
    { name: "Fleece weather", items: ["underwear", "longSleeve", "jeans", "fleece", "socks", "sneakers"] },
    { name: "Sweater and jacket", items: ["underwear", "longSleeve", "thickSweater", "lightJacket", "jeans", "socks", "sneakers"] },
    { name: "Winter coat", items: ["underwear", "thermalTop", "thickSweater", "puffer", "jeans", "woolSocks", "boots"] },
    { name: "Deep winter", items: ["underwear", "thermalTop", "fleece", "parka", "thermalBottoms", "jeans", "woolSocks", "boots"] },
    { name: "Arctic", items: ["underwear", "thermalTop", "thickSweater", "fleece", "parka", "thermalBottoms", "snowPants", "woolSocks", "boots"] },
  ],
  active: [
    { name: "Shorts and tee", items: ["briefs", "techTee", "runShorts", "sportSocks", "trainers"] },
    { name: "Shorts and sleeves", items: ["briefs", "techLong", "runShorts", "sportSocks", "trainers"] },
    { name: "Tights and sleeves", items: ["briefs", "techLong", "tights", "sportSocks", "trainers"] },
    { name: "Add a vest", items: ["briefs", "techLong", "windVest", "tights", "sportSocks", "trainers"] },
    { name: "Wind jacket", items: ["briefs", "techLong", "shell", "tights", "sportSocks", "trainers"] },
    { name: "Thermal layers", items: ["briefs", "thermalBase", "shell", "thermalTights", "sportWoolSocks", "trainers"] },
    { name: "Three layers", items: ["briefs", "thermalBase", "gridFleece", "shell", "thermalTights", "sportWoolSocks", "trainers"] },
    { name: "Winter active", items: ["briefs", "thermalBase", "gridFleece", "insulatedShell", "thermalTights", "windPants", "sportWoolSocks", "trainers"] },
    { name: "Bitter cold active", items: ["briefs", "thermalBase", "gridFleece", "insulatedShell", "puffyVest", "thermalTights", "windPants", "sportWoolSocks", "trainers"] },
  ],
};

export function ensembleClo(items) {
  const sum = items.reduce((total, id) => total + garments[id].clo, 0);
  return 0.835 * sum + 0.161;
}

export const outfitLadders = Object.fromEntries(
  Object.entries(ladders).map(([key, list]) => [
    key,
    list.map((outfit, level) => ({ ...outfit, level, clo: ensembleClo(outfit.items) })),
  ])
);
