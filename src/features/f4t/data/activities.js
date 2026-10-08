
export const activityCategories = [
  "Bicycling",
  "Conditioning Exercise",
  "Dancing",
  "Fishing & Hunting",
  "Home Activities",
  "Home Repair",
  "Inactivity",
  "Lawn & Garden",
  "Miscellaneous",
  "Music Playing",
  "Occupation",
  "Running",
  "Self Care",
  "Sexual Activity",
  "Sports",
  "Transportation",
  "Walking",
  "Water Activities",
  "Winter Activities",
  "Religious Activities",
  "Volunteer Activities",
  "Video Games",
];

/*
 * Activity data from your original 2024 Adult
 * Compendium entries.
 *
 * Each Compendium code is preserved as the ID.
 * Multiple entries with the same name are
 * grouped by ExerciseResults.jsx, allowing
 * users to adjust speed or intensity.
 */

export const activities = [
  // =====================================
  // BICYCLING
  // =====================================

  {
    id: "01010",
    category: "Bicycling",
    name: "Bicycling",
    description: "<10 mph, leisure, commuting or pleasure",
    met: 4.0,
    speedMinMph: null,
    speedMaxMph: 10,
    adjustmentType: "speed",
  },
  {
    id: "01018",
    category: "Bicycling",
    name: "Bicycling",
    description: "Leisure, 5.5 mph",
    met: 3.5,
    speedMph: 5.5,
    adjustmentType: "speed",
  },
  {
    id: "01019",
    category: "Bicycling",
    name: "Bicycling",
    description: "Leisure, 9.4 mph",
    met: 5.8,
    speedMph: 9.4,
    adjustmentType: "speed",
  },
  {
    id: "01020",
    category: "Bicycling",
    name: "Bicycling",
    description: "10–11.9 mph, light effort",
    met: 6.8,
    speedMinMph: 10,
    speedMaxMph: 11.9,
    adjustmentType: "speed",
  },
  {
    id: "01030",
    category: "Bicycling",
    name: "Bicycling",
    description: "12–13.9 mph, moderate effort",
    met: 8.0,
    speedMinMph: 12,
    speedMaxMph: 13.9,
    adjustmentType: "speed",
  },
  {
    id: "01040",
    category: "Bicycling",
    name: "Bicycling",
    description: "14–15.9 mph, vigorous effort",
    met: 10.0,
    speedMinMph: 14,
    speedMaxMph: 15.9,
    adjustmentType: "speed",
  },
  {
    id: "01050",
    category: "Bicycling",
    name: "Bicycling",
    description: "16–19 mph, very fast",
    met: 12.0,
    speedMinMph: 16,
    speedMaxMph: 19,
    adjustmentType: "speed",
  },
  {
    id: "01060",
    category: "Bicycling",
    name: "Bicycling",
    description: ">20 mph, racing",
    met: 16.8,
    speedMinMph: 20,
    speedMaxMph: null,
    adjustmentType: "speed",
  },

  // Mountain Biking

  {
    id: "01009",
    category: "Bicycling",
    name: "Mountain Biking",
    description: "General",
    met: 8.5,
    adjustmentType: "intensity",
  },
  {
    id: "01003",
    category: "Bicycling",
    name: "Mountain Biking",
    description: "Uphill, vigorous",
    met: 14.0,
    adjustmentType: "intensity",
  },
  {
    id: "01004",
    category: "Bicycling",
    name: "Mountain Biking",
    description: "Competitive racing",
    met: 16.0,
    adjustmentType: "intensity",
  },

  // Electric Bicycling

  {
    id: "01080",
    category: "Bicycling",
    name: "E-Bike",
    description: "No electronic support",
    met: 6.8,
    adjustmentType: "intensity",
  },
  {
    id: "01084",
    category: "Bicycling",
    name: "E-Bike",
    description: "Light electronic support",
    met: 6.0,
    adjustmentType: "intensity",
  },
  {
    id: "01088",
    category: "Bicycling",
    name: "E-Bike",
    description: "High electronic support",
    met: 4.0,
    adjustmentType: "intensity",
  },

  // Stationary Bicycling

  {
    id: "01210",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "25–30 watts",
    met: 3.5,
    wattsMin: 25,
    wattsMax: 30,
    adjustmentType: "watts",
  },
  {
    id: "01214",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "50 watts",
    met: 4.0,
    wattsMin: 50,
    wattsMax: 50,
    adjustmentType: "watts",
  },
  {
    id: "01218",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "70–80 watts",
    met: 5.8,
    wattsMin: 70,
    wattsMax: 80,
    adjustmentType: "watts",
  },
  {
    id: "01220",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "90–100 watts",
    met: 6.0,
    wattsMin: 90,
    wattsMax: 100,
    adjustmentType: "watts",
  },
  {
    id: "01224",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "101–125 watts",
    met: 6.8,
    wattsMin: 101,
    wattsMax: 125,
    adjustmentType: "watts",
  },
  {
    id: "01228",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "126–150 watts",
    met: 8.0,
    wattsMin: 126,
    wattsMax: 150,
    adjustmentType: "watts",
  },
  {
    id: "01232",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "151–199 watts",
    met: 10.3,
    wattsMin: 151,
    wattsMax: 199,
    adjustmentType: "watts",
  },
  {
    id: "01236",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "200–229 watts",
    met: 10.8,
    wattsMin: 200,
    wattsMax: 229,
    adjustmentType: "watts",
  },
  {
    id: "01240",
    category: "Bicycling",
    name: "Stationary Bike",
    description: "230–250 watts",
    met: 12.5,
    wattsMin: 230,
    wattsMax: 250,
    adjustmentType: "watts",
  },

  // Spin Class

  {
    id: "01270",
    category: "Bicycling",
    name: "Spin Class",
    description: "Stationary RPM/spin bike class",
    met: 9.0,
    adjustmentType: "none",
  },

  // =====================================
  // CONDITIONING EXERCISE
  // =====================================

  // Elliptical

  {
    id: "02048",
    category: "Conditioning Exercise",
    name: "Elliptical",
    description: "Moderate effort",
    met: 5.0,
    adjustmentType: "intensity",
  },
  {
    id: "02049",
    category: "Conditioning Exercise",
    name: "Elliptical",
    description: "Vigorous effort",
    met: 9.0,
    adjustmentType: "intensity",
  },

  // Calisthenics

  {
    id: "02024",
    category: "Conditioning Exercise",
    name: "Calisthenics",
    description: "Light effort",
    met: 2.8,
    adjustmentType: "intensity",
  },
  {
    id: "02022",
    category: "Conditioning Exercise",
    name: "Calisthenics",
    description: "Moderate effort",
    met: 3.8,
    adjustmentType: "intensity",
  },
  {
    id: "02020",
    category: "Conditioning Exercise",
    name: "Calisthenics",
    description: "Vigorous effort",
    met: 7.5,
    adjustmentType: "intensity",
  },

  // Circuit Training

  {
    id: "02034",
    category: "Conditioning Exercise",
    name: "Circuit Training",
    description: "Light effort",
    met: 3.5,
    adjustmentType: "intensity",
  },
  {
    id: "02035",
    category: "Conditioning Exercise",
    name: "Circuit Training",
    description: "Moderate effort",
    met: 5.0,
    adjustmentType: "intensity",
  },
  {
    id: "02040",
    category: "Conditioning Exercise",
    name: "Circuit Training",
    description: "Vigorous, kettlebells/aerobic movement",
    met: 7.5,
    adjustmentType: "intensity",
  },

  // Weight Training

  {
    id: "02054",
    category: "Conditioning Exercise",
    name: "Weight Training",
    description: "Multiple exercises, 8–15 reps",
    met: 3.5,
    adjustmentType: "intensity",
  },
  {
    id: "02052",
    category: "Conditioning Exercise",
    name: "Weight Training",
    description: "Squats/deadlifts, slow or explosive",
    met: 5.0,
    adjustmentType: "intensity",
  },
  {
    id: "02050",
    category: "Conditioning Exercise",
    name: "Weight Training",
    description: "Vigorous effort",
    met: 6.0,
    adjustmentType: "intensity",
  },

  // Kettlebells

  {
    id: "02058",
    category: "Conditioning Exercise",
    name: "Kettlebell Swings",
    description: "General",
    met: 9.8,
    adjustmentType: "none",
  },
];
