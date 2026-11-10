// Pipe and channel data.

const IN = 0.0254;

// ASME B36.10M welded and seamless steel pipe: NPS, OD in, wall in (Sch 40), wall in (Sch 80).
const SCHED = [
  ["1/8", 0.405, 0.068, 0.095],
  ["1/4", 0.54, 0.088, 0.119],
  ["3/8", 0.675, 0.091, 0.126],
  ["1/2", 0.84, 0.109, 0.147],
  ["3/4", 1.05, 0.113, 0.154],
  ["1", 1.315, 0.133, 0.179],
  ["1-1/4", 1.66, 0.14, 0.191],
  ["1-1/2", 1.9, 0.145, 0.2],
  ["2", 2.375, 0.154, 0.218],
  ["2-1/2", 2.875, 0.203, 0.276],
  ["3", 3.5, 0.216, 0.3],
  ["3-1/2", 4.0, 0.226, 0.318],
  ["4", 4.5, 0.237, 0.337],
  ["5", 5.563, 0.258, 0.375],
  ["6", 6.625, 0.28, 0.432],
  ["8", 8.625, 0.322, 0.5],
  ["10", 10.75, 0.365, 0.594],
  ["12", 12.75, 0.406, 0.688],
  ["14", 14.0, 0.438, 0.75],
  ["16", 16.0, 0.5, 0.844],
  ["18", 18.0, 0.562, 0.938],
  ["20", 20.0, 0.594, 1.031],
  ["24", 24.0, 0.688, 1.219],
];

const STEEL_RHO = 7850;
const WATER_RHO = 998.2;

export const STEEL_PIPE = SCHED.flatMap(([nps, od, w40, w80]) =>
  [
    ["40", w40],
    ["80", w80],
  ].map(([sch, wall]) => {
    const OD = od * IN;
    const t = wall * IN;
    const ID = OD - 2 * t;
    const flowArea = (Math.PI * ID * ID) / 4;
    const metalArea = (Math.PI * (OD * OD - ID * ID)) / 4;
    return {
      nps,
      sch,
      OD,
      t,
      ID,
      flowArea,
      mass: metalArea * STEEL_RHO,
      waterMass: flowArea * WATER_RHO,
    };
  })
);

export const pipeLabel = (p) => `NPS ${p.nps}″ Sch ${p.sch}`;

// Absolute roughness ε (m). Typical values for new pipe; ranges are given where they matter.
export const ROUGHNESS = [
  ["Drawn tubing (copper, brass, glass)", 0.0015e-3, "0.0015 mm"],
  ["PVC, PE and other plastic pipe", 0.0015e-3, "0.0015–0.007 mm"],
  ["Stainless steel", 0.015e-3, "0.015 mm"],
  ["Commercial steel, welded steel", 0.045e-3, "0.045 mm"],
  ["Asphalted cast iron", 0.12e-3, "0.12 mm"],
  ["Galvanized iron", 0.15e-3, "0.15 mm"],
  ["Cast iron", 0.26e-3, "0.26 mm"],
  ["Wood stave", 0.5e-3, "0.18–0.9 mm"],
  ["Concrete (smooth to rough)", 1.0e-3, "0.3–3 mm"],
  ["Riveted steel", 3.0e-3, "0.9–9 mm"],
  ["Rusted steel (moderate)", 0.5e-3, "0.15–1 mm"],
].map(([name, eps, range]) => ({ name, eps, range }));

// Hazen–Williams C (new pipe unless noted).
export const HAZEN_C = [
  ["PVC / plastic", 150],
  ["Copper", 140],
  ["Ductile iron, cement lined", 140],
  ["Concrete", 130],
  ["Steel, new", 120],
  ["Cast iron, new", 130],
  ["Galvanized steel", 120],
  ["Cast iron, 20 years old", 100],
  ["Corrugated steel", 60],
].map(([name, C]) => ({ name, C }));

// Manning roughness n.
export const MANNING_N = [
  ["PVC / smooth plastic", 0.009],
  ["Finished concrete", 0.012],
  ["Unfinished concrete", 0.014],
  ["Brick in mortar", 0.015],
  ["Corrugated metal", 0.024],
  ["Earth channel, clean", 0.022],
  ["Earth channel, with grass", 0.03],
  ["Natural stream, clean", 0.035],
  ["Natural stream, weedy", 0.07],
  ["Rock cut", 0.04],
].map(([name, n]) => ({ name, n }));

// Minor loss coefficients K (fully turbulent, typical).
export const MINOR_LOSSES = [
  ["90° elbow, standard (threaded)", 1.5],
  ["90° elbow, long radius (flanged)", 0.2],
  ["45° elbow", 0.4],
  ["Tee, flow through run", 0.4],
  ["Tee, flow through branch", 1.5],
  ["Gate valve, fully open", 0.15],
  ["Globe valve, fully open", 10],
  ["Ball valve, fully open", 0.05],
  ["Butterfly valve, fully open", 0.5],
  ["Swing check valve", 2],
  ["Pipe entrance, sharp edged", 0.5],
  ["Pipe entrance, rounded", 0.05],
  ["Pipe exit into tank", 1],
].map(([name, K]) => ({ name, K }));

// ASTM B88 copper water tube: nominal size, OD in, wall in (Type K), wall in (Type L).
const COPPER = [
  ["1/2", 0.625, 0.049, 0.04],
  ["3/4", 0.875, 0.065, 0.045],
  ["1", 1.125, 0.065, 0.05],
  ["1-1/4", 1.375, 0.065, 0.055],
  ["1-1/2", 1.625, 0.072, 0.06],
  ["2", 2.125, 0.083, 0.07],
  ["2-1/2", 2.625, 0.095, 0.08],
  ["3", 3.125, 0.109, 0.09],
  ["4", 4.125, 0.134, 0.11],
  ["5", 5.125, 0.16, 0.125],
  ["6", 6.125, 0.192, 0.14],
];

export const COPPER_TUBE = COPPER.flatMap(([size, od, wk, wl]) =>
  [
    ["K", wk],
    ["L", wl],
  ].map(([type, wall]) => ({ size, type, OD: od * IN, t: wall * IN, ID: (od - 2 * wall) * IN }))
);
