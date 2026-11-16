// The FAA knowledge tests FlyFox helps you study for. Lengths and time
// limits follow the FAA's testing matrix; all pass at 70%.

export const EXAMS = [
  { id: "par", code: "PAR", name: "Private Pilot", license: "private", questions: 60, minutes: 150, blurb: "Rules, weather, airspace, navigation, aerodynamics and performance for your first certificate." },
  { id: "uag", code: "UAG", name: "Remote Pilot (Part 107)", license: "remote", questions: 60, minutes: 120, blurb: "Drone rules, airspace, charts, weather and loading for commercial drone flying." },
  { id: "spa", code: "SPA", name: "Sport Pilot", license: "sport", questions: 40, minutes: 120, blurb: "The private pilot basics, trimmed to light-sport flying." },
  { id: "ira", code: "IRA", name: "Instrument Rating", license: "instrument", questions: 60, minutes: 150, blurb: "IFR rules, instruments, approaches, holding, weather and planning for flight in the clouds." },
  { id: "cax", code: "CAX", name: "Commercial Pilot", license: "commercial", questions: 100, minutes: 180, blurb: "Deeper aerodynamics, performance, systems and the rules for flying for hire." },
  { id: "foi", code: "FOI", name: "Fundamentals of Instructing", license: "cfi", questions: 50, minutes: 150, blurb: "How people learn and how to teach, for flight and ground instructors." },
];

export const PASS = 0.7;

export const examsById = new Map(EXAMS.map(e => [e.id, e]));
