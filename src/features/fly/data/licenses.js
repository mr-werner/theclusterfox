// The path to flying in the US: each FAA certificate or rating, what it
// lets you do, what it takes and what it typically costs. Hours are the
// FAA minimums (14 CFR Part 61) — most people need more. Costs are rough
// 2025–26 US ranges for planning, not quotes.

export const LICENSES = [
  {
    id: "remote",
    name: "Remote Pilot (drone)",
    short: "Part 107",
    exam: "uag",
    age: 16,
    medical: "None",
    hours: "No flight time required",
    weeks: "1–3 weeks of study",
    cost: "$175 test fee (study can be free)",
    lets: [
      "Fly drones under 55 lb for work or pay",
      "Up to 400 ft above ground, in sight, by day or twilight (and at night with lights and the updated test)",
      "Controlled airspace with an FAA authorization (LAANC apps give it in seconds)",
    ],
    needs: [
      "Pass the Unmanned Aircraft General (UAG) knowledge test at an FAA testing center",
      "Apply in IACRA and clear a TSA background check",
      "Free online recurrent training every 24 calendar months",
    ],
  },
  {
    id: "sport",
    name: "Sport Pilot",
    short: "Sport",
    exam: "spa",
    age: 17,
    medical: "A US driver's license is enough",
    hours: "20 hours minimum (15 with an instructor, 5 solo)",
    weeks: "2–4 months part-time",
    cost: "$6,000–$11,000",
    lets: [
      "Fly light-sport category aircraft by day with one passenger",
      "The FAA's 2025 MOSAIC rule widened which aircraft qualify (single-engine, stall speed up to 59 knots), with extra endorsements for things like retractable gear",
      "Good for fun flying close to home; credit counts toward a private certificate later",
    ],
    needs: [
      "Student pilot certificate, then solo",
      "2 hours of cross-country training, 10 takeoffs and landings, one 75 nm solo cross-country",
      "Sport pilot knowledge test and a checkride with an examiner",
    ],
  },
  {
    id: "private",
    name: "Private Pilot",
    short: "PPL",
    exam: "par",
    age: 17,
    medical: "Third-class medical (or BasicMed once you've held one)",
    hours: "40 hours minimum (35 at a Part 141 school); 60–75 is typical",
    weeks: "3–6 months at 2–3 lessons a week",
    cost: "$12,000–$20,000",
    lets: [
      "Fly most single-engine planes, day or night, with passengers",
      "Share flight costs with passengers (but not fly for hire)",
      "The base for every rating that follows",
    ],
    needs: [
      "20 hours with an instructor: 3 cross-country, 3 night (with a 100 nm night cross-country and 10 night landings), 3 by instruments, 3 of checkride prep",
      "10 hours solo: 5 cross-country, one 150 nm trip with three full-stop landings and a 50 nm leg, 3 landings at a towered airport",
      "Private Pilot Airplane (PAR) knowledge test, then the checkride (oral and flight)",
    ],
  },
  {
    id: "instrument",
    name: "Instrument Rating",
    short: "IR",
    exam: "ira",
    age: 17,
    medical: "Same as your pilot certificate",
    hours: "40 hours of instrument time (15 with an instrument instructor) and 50 hours of cross-country as pilot in command",
    weeks: "2–4 months",
    cost: "$9,000–$15,000",
    lets: [
      "Fly in clouds and low visibility under instrument flight rules",
      "File IFR and fly approaches to minimums",
      "Makes trips far more reliable and every pilot sharper",
    ],
    needs: [
      "A 250 nm IFR cross-country with three different kinds of approach",
      "Instrument Rating Airplane (IRA) knowledge test, then the checkride",
    ],
  },
  {
    id: "commercial",
    name: "Commercial Pilot",
    short: "CPL",
    exam: "cax",
    age: 18,
    medical: "Second-class medical to fly for pay",
    hours: "250 hours total (190 at a Part 141 school), 100 as pilot in command",
    weeks: "Usually 6–18 months of time building",
    cost: "$25,000–$45,000 beyond the private, mostly hours",
    lets: [
      "Be paid to fly: aerial photography, banner towing, tours within limits, ferry flights, and as the step to instructing or airlines",
    ],
    needs: [
      "10 hours in a complex, turbine or technically advanced airplane, a 2-hour day and a 2-hour night cross-country with an instructor",
      "Commercial Pilot Airplane (CAX) knowledge test, then the checkride",
    ],
  },
  {
    id: "cfi",
    name: "Flight Instructor",
    short: "CFI",
    exam: "foi",
    age: 18,
    medical: "Only needed if you act as pilot in command while teaching",
    hours: "A commercial certificate with an instrument rating",
    weeks: "1–3 months",
    cost: "$5,000–$9,000",
    lets: ["Teach and endorse students, and build hours while being paid — the most common route to the airlines"],
    needs: [
      "Fundamentals of Instructing (FOI) and Flight Instructor Airplane (FIA) knowledge tests",
      "A demanding checkride where you teach the examiner from the right seat",
    ],
  },
  {
    id: "atp",
    name: "Airline Transport Pilot",
    short: "ATP",
    exam: null,
    age: 23,
    medical: "First-class medical",
    hours: "1,500 hours (1,000–1,250 with an aviation degree, 750 from the military; restricted ATP from 21)",
    weeks: "Years of flying",
    cost: "The ATP Certification Training Program is about $5,000–$8,000; most hours are built while paid",
    lets: ["Captain or first officer at an airline"],
    needs: ["ATP Certification Training Program, then the ATP Multiengine (ATM) knowledge test and checkride, usually during airline training"],
  },
];

// What separates one flight school from another, and what to ask.
export const SCHOOL_TIPS = [
  {
    title: "Part 61 or Part 141?",
    body: "Both lead to the same certificate. Part 141 schools follow an FAA-approved syllabus with stage checks and lower hour minimums (35 hours for private), which suits full-time students and the GI Bill. Part 61 instructors can tailor the lessons to your schedule, which suits part-time learners. Most people finish near the national average either way.",
  },
  {
    title: "Fly often",
    body: "Two to three lessons a week is the single best way to save money. With long gaps you spend each lesson relearning the last one.",
  },
  {
    title: "Ask before you sign",
    list: [
      "How many airplanes, and how often are they down for maintenance?",
      "How many instructors, and how long do they usually stay?",
      "Can I book two or three lessons a week, weeks ahead?",
      "What's the wet hourly rate (fuel included) for the plane and the instructor?",
      "What did your last ten private pilots spend, all-in?",
      "Do you have a simulator I can log time in?",
      "Is there a block-time discount, and is prepaid money protected?",
    ],
  },
  {
    title: "Before your first lesson",
    list: [
      "Book a discovery flight ($100–$250) at two schools and compare",
      "Get your FAA medical early (find an Aviation Medical Examiner on the FAA site) so nothing surprises you after you've paid for lessons",
      "Create an IACRA account for your student pilot certificate",
      "Start studying for the knowledge test now — PilotFox's Study tab has practice tests",
    ],
  },
  {
    title: "Paying for it",
    body: "Look at AOPA, EAA, Women in Aviation, Ninety-Nines and local airport scholarships; flying clubs (often 30–40% cheaper than renting); aviation financing; and the GI Bill at approved Part 141 schools.",
  },
];

export const FREE_RESOURCES = [
  { name: "Pilot's Handbook of Aeronautical Knowledge (PHAK)", by: "FAA", href: "https://www.faa.gov/aviation/phak", note: "The core textbook for every written test." },
  { name: "Airplane Flying Handbook", by: "FAA", href: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook", note: "How each maneuver is flown." },
  { name: "Instrument Flying Handbook", by: "FAA", href: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_flying_handbook", note: "For the instrument rating." },
  { name: "Aeronautical Information Manual (AIM)", by: "FAA", href: "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/", note: "Procedures, airspace, phraseology." },
  { name: "Airman Certification Standards (ACS)", by: "FAA", href: "https://www.faa.gov/training_testing/testing/acs", note: "Exactly what each checkride tests." },
  { name: "Sample knowledge test questions", by: "FAA", href: "https://www.faa.gov/training_testing/testing/test_questions", note: "Official samples for each test." },
  { name: "Remote pilot study guide and free recurrent training", by: "FAA", href: "https://www.faa.gov/uas/commercial_operators", note: "Everything for Part 107." },
  { name: "Aviation Medical Examiner locator", by: "FAA", href: "https://www.faa.gov/pilots/amelocator", note: "Find a doctor for your medical." },
  { name: "VFR sectional charts", by: "FAA", href: "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/", note: "Free downloads of every chart." },
  { name: "Aviation Weather Center", by: "NOAA", href: "https://aviationweather.gov", note: "Official METARs, TAFs, winds aloft and hazards." },
  { name: "Flight Training Magazine and Air Safety Institute courses", by: "AOPA", href: "https://www.aopa.org/training-and-safety", note: "Free online courses and videos." },
];
