// Fuel heating values (MJ/kg) and typical densities (kg/m³ for liquids/solids,
// at 15 °C and 1 atm for gases). Higher (HHV) includes the latent heat of the water
// formed; lower (LHV) does not. Commercial fuels vary by blend.

const FUELS = [
  ["Hydrogen", "Gas", 141.8, 120.0, 0.0852],
  ["Methane", "Gas", 55.5, 50.0, 0.678],
  ["Natural gas (typical)", "Gas", 52.2, 47.1, 0.75],
  ["Propane", "Gas", 50.35, 46.35, 1.87],
  ["n-Butane", "Gas", 49.5, 45.75, 2.48],
  ["Gasoline (typical)", "Liquid", 46.5, 43.4, 745],
  ["Diesel (typical)", "Liquid", 45.6, 42.8, 840],
  ["Jet A / kerosene", "Liquid", 46.2, 43.2, 800],
  ["Heating oil no. 2", "Liquid", 45.5, 42.7, 850],
  ["Ethanol", "Liquid", 29.7, 26.8, 789],
  ["Methanol", "Liquid", 22.9, 20.1, 792],
  ["Biodiesel (B100)", "Liquid", 40.2, 37.5, 880],
  ["Coal, bituminous (typical)", "Solid", 30.0, 29.0, 1350],
  ["Coal, lignite (typical)", "Solid", 15.0, 13.5, 1250],
  ["Wood, oven dry", "Solid", 20.0, 18.6, 500],
  ["Wood pellets", "Solid", 19.0, 17.5, 650],
];

export const FUEL_TABLE = FUELS.map(([name, state, hhv, lhv, rho]) => ({
  name,
  state,
  hhv: hhv * 1e6,
  lhv: lhv * 1e6,
  rho,
  hhvVol: hhv * 1e6 * rho,
}));
