// Where each calculator's principle shows up in real work: the industries
// that lean on it (`fields`) and a few concrete jobs it does (`examples`).

export const USES = {
  // Fluids
  "pump-system": {
    fields: ["Water and wastewater", "Building services", "Agriculture", "Chemical and process plants", "Oil and gas"],
    examples: ["Picking a booster pump for a tall building", "Checking a sump or well pump won't cavitate", "Sizing a transfer pump between tanks", "Hot water and boiler feed systems"],
  },
  "pipe-velocity": {
    fields: ["Plumbing", "Fire protection", "Process piping", "Irrigation"],
    examples: ["Keeping water lines under about 2 to 3 m/s to avoid noise and water hammer", "Slurry lines kept fast enough that solids don't settle", "First-pass pipe sizing before a full pressure drop check"],
  },
  reynolds: {
    fields: ["Aerospace", "Automotive", "Chemical engineering", "Biomedical", "Pipelines"],
    examples: ["Deciding which friction formula applies in a pipe", "Wind tunnel and scale model testing", "Blood flow in arteries and medical devices", "Mixing tanks and reactors"],
  },
  "pressure-drop": {
    fields: ["Process plants", "HVAC hydronics", "Oil and gas pipelines", "Hydraulics", "Fire protection"],
    examples: ["Sizing chilled and hot water loops", "Pipeline pumping station spacing", "Hydraulic hose sizing on machinery", "Checking a filter or long run won't starve the outlet"],
  },
  "hazen-williams": {
    fields: ["Water utilities", "Fire sprinkler design", "Irrigation", "Civil engineering"],
    examples: ["Municipal water main sizing", "Fire sprinkler hydraulic calculations (NFPA 13)", "Farm and landscape irrigation lines"],
  },
  hydrostatic: {
    fields: ["Civil and dam engineering", "Marine and diving", "Tank design", "Instrumentation"],
    examples: ["Loads on dam walls, tank floors and retaining walls", "Level sensors that read depth from pressure", "Water tower supply pressure", "Dive depth and submarine hull loads"],
  },
  "pump-power": {
    fields: ["Water and wastewater", "Building services", "Mining", "Agriculture", "Energy auditing"],
    examples: ["Picking the motor size for a pump", "Estimating a pump's yearly electricity cost", "Comparing efficiencies when replacing an old pump"],
  },
  orifice: {
    fields: ["Oil and gas", "Process control", "Power plants", "Water treatment"],
    examples: ["Gas and steam flow metering", "Restriction orifices that limit flow", "Balancing flow between branches", "Custody transfer meters (ISO 5167)"],
  },
  manning: {
    fields: ["Civil and stormwater", "Agriculture", "Sewers", "Environmental engineering"],
    examples: ["Sizing roadside ditches and culverts", "Gravity sewer and storm drain design", "Irrigation canals", "River and flood capacity checks"],
  },
  buoyancy: {
    fields: ["Naval architecture", "Offshore", "Pipelines", "Civil (groundwater)"],
    examples: ["Boat and pontoon design", "Weighting pipelines and tanks so they don't float out of wet ground", "Buoys and floats", "Diving ballast and ROVs"],
  },
  "tank-drain": {
    fields: ["Process plants", "Agriculture", "Fire safety", "Water treatment"],
    examples: ["Emergency dump and drain sizing", "Batch tank cycle times", "Gravity-fed water supplies", "Rainwater barrel and cistern outlets"],
  },

  // Heat
  "heat-energy": {
    fields: ["Building services", "Food processing", "Manufacturing", "Energy and utilities"],
    examples: ["Sizing a water heater or how long it takes to recover", "Heating a process tank or pool", "Thermal storage and energy cost estimates", "Cooling down product after cooking"],
  },
  conduction: {
    fields: ["Building construction", "Refrigeration", "Industrial insulation", "Electronics"],
    examples: ["Wall, roof and window heat loss", "Choosing insulation to meet energy code R-values", "Cold room and freezer panels", "Heat through a thermal pad or PCB"],
  },
  convection: {
    fields: ["Electronics cooling", "Automotive", "HVAC", "Power generation", "Food processing"],
    examples: ["Heat sink and enclosure cooling", "Radiators and intercoolers", "Heat loss from bare pipes and tanks", "Ovens, fryers and chillers"],
  },
  radiation: {
    fields: ["Aerospace and space", "Furnaces and kilns", "Building science", "Fire safety"],
    examples: ["Spacecraft and satellite thermal control", "Furnace and kiln design", "Radiant heaters and heat shields", "Low-e window coatings"],
  },
  "thermal-expansion": {
    fields: ["Piping and pipelines", "Bridges and rail", "Precision machining", "Electronics", "Aerospace"],
    examples: ["Expansion loops and joints in steam lines", "Gaps in bridge decks and rails", "Shrink fits for bearings and gears", "Solder joint stress between chips and boards"],
  },
  lmtd: {
    fields: ["Chemical and refining", "Power plants", "HVAC", "Food and dairy", "Marine"],
    examples: ["Sizing shell-and-tube and plate heat exchangers", "Condensers and boilers", "Chiller and heat pump coils", "Pasteurisers and engine coolers"],
  },

  // Air and HVAC
  psychrometrics: {
    fields: ["HVAC", "Building science", "Agriculture and greenhouses", "Pharmaceutical and clean rooms", "Weather"],
    examples: ["Designing cooling coils that also dehumidify", "Preventing condensation and mould", "Grain drying and greenhouse climate", "Humidity control in museums and data centres"],
  },
  "air-heat": {
    fields: ["HVAC", "Data centres", "Industrial ventilation"],
    examples: ["How much air a room needs to stay cool", "Sizing an electric duct heater", "Server room and enclosure cooling airflow"],
  },
  "duct-size": {
    fields: ["HVAC design", "Industrial exhaust", "Clean rooms"],
    examples: ["Sizing supply and return ducts", "Keeping air quiet in bedrooms and studios", "Converting round ducts to rectangles that fit a ceiling"],
  },
  "standard-atmosphere": {
    fields: ["Aviation and aerospace", "Engines and turbines", "HVAC at altitude", "Meteorology"],
    examples: ["Aircraft performance and density altitude", "Derating engines, fans and burners at high sites", "Calibrating altimeters", "Drone and rocket design"],
  },
  "ideal-gas": {
    fields: ["Chemical engineering", "Compressed air and gas", "Laboratory work", "Safety"],
    examples: ["Gas cylinder and tank contents", "Gas flow metering", "Whether a leaking gas rises or pools", "Balloon and airship lift"],
  },
  "fan-system": {
    fields: ["HVAC", "Industrial ventilation and dust collection", "Commercial kitchens", "Agriculture"],
    examples: ["Picking a fan from a catalogue for a duct system", "Kitchen hood exhaust", "Barn and greenhouse ventilation", "Correcting fan performance for altitude"],
  },
  "building-loads": {
    fields: ["HVAC design", "Architecture", "Energy consulting", "Building codes"],
    examples: ["Sizing the air conditioner, furnace or heat pump", "Comparing glazing and insulation choices", "Supply airflow and fresh air for each room", "Checking a contractor's equipment size"],
  },

  // Mechanics and structures
  beam: {
    fields: ["Building construction", "Bridges", "Machine design", "Cranes and material handling", "Aerospace"],
    examples: ["Floor joists, headers and steel beams", "Shelving and mezzanines", "Crane runways and hoist beams", "Trailer frames, machine bases and wing spars"],
  },
  "section-properties": {
    fields: ["Structural engineering", "Mechanical design", "Fabrication", "Aerospace"],
    examples: ["Comparing tubes, channels and I-beams for stiffness per weight", "Checking a custom welded section", "Frame and chassis tubing choice", "Feeding I and S into the beam and buckling tools"],
  },
  "stress-strain": {
    fields: ["Structural engineering", "Rigging and lifting", "Mechanical design", "Materials testing"],
    examples: ["Tie rods, hangers and cables", "Bolt stretch", "Lifting lugs and slings", "Reading tensile test results"],
  },
  buckling: {
    fields: ["Building construction", "Scaffolding and shoring", "Machine design", "Aerospace"],
    examples: ["Columns and posts", "Truss and brace members in compression", "Hydraulic cylinder rods and jack screws", "Thin struts in aircraft and bicycles"],
  },
  "torque-power": {
    fields: ["Machine design", "Automotive", "Industrial drives", "Marine", "Wind energy"],
    examples: ["Sizing a motor shaft or drive shaft", "Converting motor horsepower and rpm to torque", "Propeller shafts", "Conveyor and pump drives"],
  },
  "gear-ratio": {
    fields: ["Automotive", "Robotics", "Industrial machinery", "Cycling", "Agriculture"],
    examples: ["Choosing a gearbox to slow a motor down", "Belt and pulley drives", "Sprocket choice on bikes and motorcycles", "Winches and hoists"],
  },
  "bolt-torque": {
    fields: ["Automotive", "Aerospace", "Wind energy", "Steel construction", "Pressure vessels and piping"],
    examples: ["Torque specs for engine and wheel bolts", "Flange bolting that won't leak", "Structural steel connections", "Wind turbine tower bolts"],
  },
  spring: {
    fields: ["Automotive", "Consumer products", "Valves and instruments", "Industrial machinery"],
    examples: ["Suspension and valve springs", "Return springs in switches and pens", "Pressure relief valves", "Die and press springs"],
  },
  "energy-motion": {
    fields: ["Safety engineering", "Automotive", "Sports and recreation", "Physics education"],
    examples: ["Crash barrier and guard design", "Fall protection and drop tests", "Flywheels and energy storage", "Roller coasters and ride design"],
  },

  // Electrical
  "ohms-law": {
    fields: ["Electronics", "Electrical trades", "Automotive", "Hobby and education"],
    examples: ["Picking an LED resistor", "Finding a heater's current and power", "Fault finding with a multimeter", "Fuse sizing"],
  },
  "voltage-drop": {
    fields: ["Electrical contracting", "Solar and off-grid", "RV, marine and automotive", "Industrial power"],
    examples: ["Sizing wire for a long run to a shed or pump", "Solar array and battery cables", "Low-voltage landscape lighting", "Feeders to motors so they start properly"],
  },
  "resistor-code": {
    fields: ["Electronics repair", "Prototyping", "Education"],
    examples: ["Identifying parts on an old circuit board", "Sorting a parts drawer", "Building kits and breadboards"],
  },
  "series-parallel": {
    fields: ["Electronics design", "Repair", "Audio"],
    examples: ["Making an odd resistor value from standard ones", "Combining capacitors for a power supply", "Speaker impedance when wiring several together"],
  },
  "rc-time": {
    fields: ["Electronics design", "Audio", "Sensors and instrumentation", "Power electronics"],
    examples: ["Simple timers and delays", "Button debounce circuits", "Low-pass filters on sensor signals", "Tone controls and crossovers"],
  },
  "three-phase": {
    fields: ["Industrial power", "Commercial buildings", "Utilities", "Data centres"],
    examples: ["Motor current for breaker and wire sizing", "Generator and transformer kVA sizing", "Power factor correction", "Checking a panel's load"],
  },
  "battery-runtime": {
    fields: ["Solar and off-grid", "RV and marine", "Backup power (UPS)", "Electric vehicles", "Field equipment"],
    examples: ["How long a battery bank runs a cabin or camper", "UPS backup time for servers", "Choosing between 12, 24 and 48 V banks", "Remote sensor and camera power"],
  },

  // Geometry and math
  "tank-volume": {
    fields: ["Fuel distribution", "Agriculture", "Process plants", "Water storage"],
    examples: ["Dipstick readings on horizontal fuel tanks", "Water tank and cistern capacity", "Chemical stock checks", "Ordering a fuel delivery"],
  },
  shapes: {
    fields: ["Construction", "Fabrication", "Landscaping", "Manufacturing"],
    examples: ["Concrete for footings and slabs", "Paint and coating area", "Material weight and cost estimates", "Hoppers and cones from flat sheet"],
  },
  slope: {
    fields: ["Civil and road design", "Roofing and carpentry", "Accessibility", "Landscaping and drainage"],
    examples: ["Wheelchair ramps (1:12)", "Roof pitch and rafter length", "Drain and sewer fall", "Driveways, paths and grading"],
  },
  interpolate: {
    fields: ["Every engineering discipline", "Science and lab work", "Finance"],
    examples: ["Reading steam and refrigerant tables", "Values between rows of a code table", "Calibration charts", "Material properties between listed temperatures"],
  },
};
