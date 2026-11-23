// PilotFox's knowledge base: short study notes for each subject on the FAA
// knowledge tests. Each topic lists the tests it shows up on. Sections
// carry a heading and a paragraph, a list, or a table ({ head, rows }).
// Sources: 14 CFR Parts 61, 91 and 107, the AIM, the PHAK and the
// Instrument Flying Handbook.

export const TOPICS = [
  {
    id: "airspace",
    title: "Airspace and VFR weather minimums",
    exams: ["par", "spa", "cax", "uag", "ira"],
    sections: [
      {
        h: "The classes at a glance",
        table: {
          head: ["Class", "Where", "To enter"],
          rows: [
            ["A", "18,000 ft MSL up to FL600", "IFR only, with a clearance"],
            ["B", "Around the busiest airports, surface to about 10,000 ft, shaped like an upside-down wedding cake", "An explicit clearance (\"cleared into the Class Bravo\"), a Mode C transponder and ADS-B Out"],
            ["C", "Busy towered airports: a 5 nm core from the surface and a 10 nm shelf from 1,200 ft, both up to about 4,000 ft above the airport", "Two-way radio contact (ATC says your call sign back)"],
            ["D", "Towered airports, surface to about 2,500 ft above the airport", "Two-way radio contact"],
            ["E", "Controlled airspace that isn't A–D: usually from 700 or 1,200 ft above ground, sometimes from the surface", "Nothing for VFR"],
            ["G", "Uncontrolled airspace below Class E", "Nothing"],
          ],
        },
      },
      {
        h: "VFR visibility and cloud clearance (14 CFR 91.155)",
        table: {
          head: ["Airspace", "Visibility", "Distance from clouds"],
          rows: [
            ["Class B", "3 sm", "Clear of clouds"],
            ["Class C, D, and E below 10,000 MSL", "3 sm", "500 below, 1,000 above, 2,000 horizontal"],
            ["Class E at or above 10,000 MSL", "5 sm", "1,000 below, 1,000 above, 1 sm horizontal"],
            ["Class G, 1,200 AGL or lower, day", "1 sm", "Clear of clouds"],
            ["Class G, 1,200 AGL or lower, night", "3 sm", "500 below, 1,000 above, 2,000 horizontal"],
            ["Class G, above 1,200 AGL but below 10,000 MSL", "1 sm day, 3 sm night", "500 below, 1,000 above, 2,000 horizontal"],
            ["Class G, above 1,200 AGL and at or above 10,000 MSL", "5 sm", "1,000 below, 1,000 above, 1 sm horizontal"],
          ],
        },
      },
      {
        h: "Worth remembering",
        list: [
          "\"3-152\" is the most common minimum: 3 miles, 1,000 above, 500 below, 2,000 horizontal.",
          "Inside a Class B, C, D or E surface area you need a 1,000 ft ceiling and 3 sm to fly VFR. Below that, ask for special VFR: 1 sm and clear of clouds (at night only with an instrument rating and an IFR-equipped plane).",
          "Speed limits: 250 knots below 10,000 MSL; 200 knots within 4 nm of a Class C or D airport below 2,500 AGL; 200 knots under a Class B shelf or in a VFR corridor.",
          "A Mode C veil reaches 30 nm around Class B airports: transponder with altitude reporting required from the surface to 10,000 MSL.",
          "Special-use airspace: prohibited (never), restricted (only when not active or with permission), MOAs (VFR allowed, watch for military traffic), warning areas, alert areas and controlled firing areas.",
        ],
      },
    ],
  },
  {
    id: "regs",
    title: "Rules, documents and currency",
    exams: ["par", "spa", "cax", "ira"],
    sections: [
      {
        h: "Documents on board — ARROW",
        list: ["Airworthiness certificate (displayed)", "Registration certificate", "Radio station license (only for international flights)", "Operating limitations (POH/AFM, placards, markings)", "Weight and balance data"],
      },
      {
        h: "Inspections — AV1ATE",
        list: [
          "Annual inspection, every 12 calendar months",
          "VOR check within 30 days (for IFR)",
          "100-hour inspection if the plane is used for hire or flight instruction you provide",
          "Altimeter, altitude reporting and static system every 24 calendar months (for IFR)",
          "Transponder every 24 calendar months",
          "ELT every 12 calendar months; replace the battery after 1 hour of total use or half its useful life",
        ],
      },
      {
        h: "Equipment for day VFR — ATOMATO FLAMES",
        p: "Airspeed indicator, Tachometer, Oil pressure, Manifold pressure (if applicable), Altimeter, Temperature gauge (liquid-cooled engines), Oil temperature, Fuel gauges, Landing gear position (retractable), Anticollision lights (on planes certified after March 11, 1996), Magnetic compass, ELT, Safety belts. At night add FLAPS: Fuses, Landing light (for hire), Anticollision lights, Position lights, Source of electricity.",
      },
      {
        h: "Staying current",
        list: [
          "Flight review every 24 calendar months.",
          "To carry passengers: 3 takeoffs and landings in the last 90 days in the same category and class (full stop in a tailwheel).",
          "At night (1 hour after sunset to 1 hour before sunrise): 3 takeoffs and landings to a full stop in that period.",
          "Medical: a third-class lasts 60 calendar months if you were under 40 when examined, 24 if 40 or older.",
          "Alcohol: 8 hours bottle to throttle and under 0.04% blood alcohol.",
        ],
      },
      {
        h: "Fuel, oxygen and altitudes",
        list: [
          "VFR fuel reserve: enough to reach the destination plus 30 minutes by day, 45 at night.",
          "Oxygen: crew must use it after 30 minutes above 12,500 ft cabin altitude and at all times above 14,000; passengers must be offered it above 15,000.",
          "Minimum safe altitudes: 1,000 ft above the highest obstacle within 2,000 ft over congested areas; 500 ft above the surface elsewhere; over open water or sparse areas, no closer than 500 ft to any person, vessel, vehicle or structure.",
          "VFR cruising altitudes above 3,000 AGL: magnetic course 0–179° odd thousands plus 500 (3,500, 5,500); 180–359° even thousands plus 500 (4,500, 6,500).",
        ],
      },
      {
        h: "Right of way",
        list: [
          "An aircraft in distress has right of way over all others.",
          "Balloon, glider, airship, then airplanes and helicopters — the less maneuverable has the right of way.",
          "Converging at about the same altitude: the aircraft on the right has the right of way.",
          "Head-on: both turn right. Overtaking: pass on the right.",
          "Landing aircraft have right of way; the lower one on final, but don't cut in.",
        ],
      },
      {
        h: "Accidents and incidents (NTSB Part 830)",
        p: "Notify the NTSB immediately after an accident or certain serious incidents (flight control failure, a crewmember unable to act from injury or illness, in-flight fire, a midair collision, more than $25,000 damage to other property, overdue aircraft believed in an accident). The written report is due within 10 days of an accident.",
      },
    ],
  },
  {
    id: "weather",
    title: "Weather theory and reports",
    exams: ["par", "spa", "cax", "ira", "uag"],
    sections: [
      {
        h: "Reading a METAR",
        p: "METAR KDEN 161753Z 27015G25KT 10SM FEW060 BKN120 22/04 A3002 — Denver, the 16th at 17:53 Zulu, wind from 270° true at 15 gusting 25 knots, 10 statute miles, a few clouds at 6,000 ft and broken at 12,000 (the ceiling: the lowest broken or overcast layer), 22 °C, dew point 4 °C, altimeter 30.02. Cloud heights are above ground level; wind direction in METARs and TAFs is true north (the tower and ATIS give magnetic).",
      },
      {
        h: "Flight categories",
        table: {
          head: ["Category", "Ceiling", "Visibility"],
          rows: [
            ["VFR", "Above 3,000 ft", "More than 5 sm"],
            ["Marginal VFR", "1,000 to 3,000 ft", "3 to 5 sm"],
            ["IFR", "500 to below 1,000 ft", "1 to below 3 sm"],
            ["Low IFR", "Below 500 ft", "Below 1 sm"],
          ],
        },
      },
      {
        h: "Stability, clouds and fronts",
        list: [
          "Standard lapse rate: about 2 °C (3.5 °F) cooler per 1,000 ft.",
          "Cloud base estimate: temperature–dew point spread in °C ÷ 2.5 × 1,000 ft (or the spread in °F ÷ 4.4).",
          "Stable air: stratus clouds, steady precipitation, smooth air, poor visibility. Unstable air: cumuliform clouds, showers, turbulence, good visibility.",
          "Cold fronts move fast with a narrow band of showers and thunderstorms; warm fronts bring wide areas of stratus, steady rain and low visibility ahead of them.",
          "A front always brings a wind shift; temperature and pressure change too.",
        ],
      },
      {
        h: "Fog",
        list: [
          "Radiation fog: clear, calm nights over land as the ground cools.",
          "Advection fog: moist air moving over cooler ground or water; it can form with wind and lasts.",
          "Upslope fog: moist, stable air pushed up a slope by wind.",
          "Precipitation-induced fog: warm rain falling through cool air; often with frontal weather.",
          "Steam fog: cold air moving over warmer water.",
        ],
      },
      {
        h: "Thunderstorms and wind shear",
        list: [
          "They need moisture, unstable air and a lifting force.",
          "Three stages: cumulus (updrafts), mature (rain at the surface, up- and downdrafts — the most violent), dissipating (downdrafts).",
          "Stay at least 20 miles from a severe storm; never fly under an anvil or between close storms.",
          "Microbursts: downdrafts up to 6,000 ft a minute lasting about 15 minutes. On approach you first gain airspeed (headwind), then lose it sharply (downdraft and tailwind).",
          "Wind shear can happen at any altitude, including near temperature inversions.",
        ],
      },
      {
        h: "Icing",
        p: "Structural ice needs visible moisture (cloud or rain) at or below freezing. Freezing rain means warmer air above you — climbing can get you out. Clear ice forms from large drops near freezing and is the most dangerous; rime ice forms from small drops in colder clouds. Frost on the wings must be removed: it spoils the airflow and can keep you from flying at all.",
      },
      {
        h: "Winds aloft (FB) code",
        p: "Each group reads DDSS±TT: direction in tens of degrees true, speed in knots, temperature in °C. 2725-08 at 9,000 ft is 270° at 25 knots, minus 8 °C. 9900 is light and variable. For 100–199 knots, 50 is added to the direction: 7319 is 230° at 119 knots. No temperature is given at 3,000 ft, and above 24,000 ft the minus sign is left off. Levels within 1,500 ft of the station are left blank. PilotFox's Winds tab shows the same code for any spot.",
      },
    ],
  },
  {
    id: "aero",
    title: "Aerodynamics and flight",
    exams: ["par", "spa", "cax"],
    sections: [
      {
        h: "Basics",
        list: [
          "Four forces: lift, weight, thrust and drag. In steady unaccelerated flight they balance.",
          "Angle of attack is the angle between the wing's chord line and the relative wind. A wing stalls when it exceeds its critical angle of attack — at any airspeed, attitude or weight.",
          "Induced drag comes from making lift and is greatest at low speed; parasite drag grows with the square of speed.",
          "Ground effect within about one wingspan of the surface reduces induced drag, so a plane can float in landing or lift off before it can climb.",
        ],
      },
      {
        h: "Turns and load factor",
        table: {
          head: ["Bank", "Load factor", "Stall speed rises by"],
          rows: [
            ["30°", "1.15 G", "7%"],
            ["45°", "1.41 G", "19%"],
            ["60°", "2 G", "41%"],
            ["75°", "3.9 G", "97%"],
          ],
        },
      },
      {
        h: "Left-turning tendencies (single-engine, clockwise propeller from the cockpit)",
        list: [
          "Torque reaction: the plane rolls opposite the propeller.",
          "Spiraling slipstream hits the left side of the tail.",
          "P-factor: at high angles of attack the descending right blade takes a bigger bite.",
          "Gyroscopic precession: most noticeable lifting the tail of a taildragger.",
        ],
      },
      {
        h: "Stability and center of gravity",
        list: [
          "A forward CG is more stable, has a higher stall speed and needs more tail-down force.",
          "An aft CG is less stable and makes stall and spin recovery harder or impossible.",
          "Maneuvering speed (VA) drops as weight drops.",
          "Spins need a stall and yaw: recover with power off, ailerons neutral, full opposite rudder, then elevator forward to break the stall (PARE).",
        ],
      },
    ],
  },
  {
    id: "performance",
    title: "Performance, weight and balance",
    exams: ["par", "spa", "cax", "uag"],
    sections: [
      {
        h: "Density altitude",
        p: "High, hot and humid air is thin: the engine makes less power, the propeller less thrust and the wing less lift, so takeoffs are longer and climbs are weaker. Pressure altitude = field elevation + (29.92 − altimeter setting) × 1,000. Density altitude ≈ pressure altitude + 120 × (OAT − standard temperature), where standard is 15 °C minus 2 °C per 1,000 ft.",
      },
      {
        h: "Weight and balance",
        list: [
          "Moment = weight × arm. CG = total moment ÷ total weight.",
          "Avgas weighs 6 lb a gallon, Jet A about 6.7, oil 7.5, water 8.35.",
          "To shift weight: weight moved ÷ total weight = CG change ÷ distance moved.",
          "Overweight: longer takeoff, lower climb rate and ceiling, higher stall speed, more structural stress.",
        ],
      },
      {
        h: "Wind on the runway",
        p: "Crosswind = wind speed × sine of the angle between wind and runway; headwind = speed × cosine. A quick rule: 30° off gives half the wind as crosswind, 45° about 70%, 60° about 90%. Take off and land into the wind when you can — it shortens the ground roll.",
      },
    ],
  },
  {
    id: "nav",
    title: "Navigation and charts",
    exams: ["par", "spa", "cax", "ira"],
    sections: [
      {
        h: "From course to heading",
        list: [
          "True course (from the chart) ± wind correction = true heading.",
          "True heading ± variation = magnetic heading: \"east is least, west is best\" (subtract east, add west).",
          "Magnetic heading ± deviation (from the compass card) = compass heading.",
          "One minute of latitude is one nautical mile; 1 nm = 1.15 statute miles.",
        ],
      },
      {
        h: "Compass errors (northern hemisphere)",
        list: [
          "ANDS: Accelerate North, Decelerate South — on east or west headings speeding up shows a turn north, slowing shows a turn south.",
          "UNOS: Undershoot North, Overshoot South when rolling out of turns by the compass.",
        ],
      },
      {
        h: "VOR",
        list: [
          "The course needle shows which radial you're on, not your heading. TO/FROM tells whether the selected course takes you toward or away from the station.",
          "Each dot on a VOR CDI is 2°; full deflection is 10°.",
          "Flying the reciprocal with TO/FROM mismatched gives reverse sensing.",
          "VOR identifiers in Morse code confirm you're tuned to the right station.",
        ],
      },
      {
        h: "Sectional chart basics",
        list: [
          "Blue airport symbols have a control tower; magenta ones don't.",
          "Blue solid lines: Class B; magenta solid: Class C; dashed blue: Class D; dashed magenta: Class E from the surface; magenta shading: Class E from 700 AGL; blue shading: Class E from 1,200 AGL.",
          "Maximum elevation figures (big numbers in each grid square) show the highest terrain or obstacle plus a margin, in hundreds of feet MSL.",
          "Obstacle heights show MSL in bold and AGL in parentheses.",
        ],
      },
    ],
  },
  {
    id: "human",
    title: "Aeromedical and decision making",
    exams: ["par", "spa", "cax", "uag", "ira"],
    sections: [
      {
        h: "Hypoxia and friends",
        list: [
          "Hypoxic hypoxia: not enough oxygen in the air (altitude).",
          "Hypemic: the blood can't carry oxygen (carbon monoxide, anemia, blood loss).",
          "Stagnant: blood isn't flowing (high G, cold).",
          "Histotoxic: cells can't use oxygen (alcohol, drugs).",
          "Hyperventilation (too much CO₂ breathed off): slow your breathing, talk aloud, or breathe into a bag.",
          "Carbon monoxide: headache, drowsiness; turn off the heater, open fresh air vents.",
        ],
      },
      {
        h: "Spatial disorientation",
        list: [
          "The leans: after a slow roll your inner ear misses, you level and feel banked the other way.",
          "Graveyard spiral: in a prolonged turn you feel level, see altitude dropping, pull back and tighten the spiral.",
          "Coriolis: moving your head in a turn — the most overwhelming. Trust your instruments.",
          "Somatogravic illusion: a fast acceleration feels like a nose-up pitch.",
        ],
      },
      {
        h: "Checklists for yourself",
        list: [
          "IMSAFE: Illness, Medication, Stress, Alcohol, Fatigue, Emotion (or Eating).",
          "PAVE risks: Pilot, Aircraft, enVironment, External pressures.",
          "DECIDE: Detect, Estimate, Choose, Identify, Do, Evaluate.",
        ],
      },
      {
        h: "Hazardous attitudes and their antidotes",
        table: {
          head: ["Attitude", "Antidote"],
          rows: [
            ["Anti-authority: \"Don't tell me.\"", "Follow the rules. They are usually right."],
            ["Impulsivity: \"Do it quickly.\"", "Not so fast. Think first."],
            ["Invulnerability: \"It won't happen to me.\"", "It could happen to me."],
            ["Macho: \"I can do it.\"", "Taking chances is foolish."],
            ["Resignation: \"What's the use?\"", "I'm not helpless. I can make a difference."],
          ],
        },
      },
      {
        h: "Seeing at night and spotting traffic",
        p: "Let your eyes adapt for 30 minutes and use red light. At night look slightly off-center, since the center of the eye has no rods. Scan in 10° sectors, about a second each. Traffic on a collision course doesn't move across your windshield — it just grows.",
      },
    ],
  },
  {
    id: "airport",
    title: "Airport operations",
    exams: ["par", "spa", "cax", "uag"],
    sections: [
      {
        h: "Signs and markings",
        list: [
          "Red sign, white letters: mandatory — runway holding positions and no-entry.",
          "Black sign, yellow letters: you are here (location).",
          "Yellow sign, black letters: direction or destination.",
          "Hold short line: two solid and two dashed yellow lines — stop on the solid side until cleared.",
          "Displaced threshold (white arrows): fine for taxi and takeoff, not for landing. Chevrons (yellow): not for any use.",
        ],
      },
      {
        h: "Light gun signals",
        table: {
          head: ["Signal", "On the ground", "In the air"],
          rows: [
            ["Steady green", "Cleared for takeoff", "Cleared to land"],
            ["Flashing green", "Cleared to taxi", "Return for landing"],
            ["Steady red", "Stop", "Give way, keep circling"],
            ["Flashing red", "Taxi clear of the runway", "Airport unsafe, don't land"],
            ["Flashing white", "Return to starting point", "—"],
            ["Alternating red and green", "Use extreme caution", "Use extreme caution"],
          ],
        },
      },
      {
        h: "Patterns and glide path lights",
        list: [
          "Traffic patterns turn left unless marked otherwise (segmented circle or chart). Enter at 45° to the downwind leg at pattern altitude, typically 1,000 ft above the field.",
          "VASI: red over white, you're alright; red over red, you're dead; white over white, you're high.",
          "PAPI: two white and two red is on glide path; more white is high, more red is low.",
          "At non-towered airports, announce on the CTAF and listen.",
        ],
      },
    ],
  },
  {
    id: "ifr",
    title: "IFR rules and planning",
    exams: ["ira"],
    sections: [
      {
        h: "Instrument currency",
        p: "In the last 6 calendar months: 6 instrument approaches, holding procedures and tasks, and intercepting and tracking courses with navigation systems. Missed it? You have 6 more months to catch up with a safety pilot or in a simulator; after that you need an instrument proficiency check.",
      },
      {
        h: "Do I need an alternate? (1-2-3)",
        p: "If, from 1 hour before to 1 hour after your ETA, the destination forecast is at least a 2,000 ft ceiling and 3 sm visibility, no alternate is needed. Otherwise list one whose forecast at your ETA meets its alternate minimums — the standard ones are 600 ft and 2 sm with a precision approach, 800 ft and 2 sm with a non-precision approach, or, with no approach, weather good enough to descend from the MEA and land VFR. IFR fuel: to the destination, then the alternate, then 45 minutes.",
      },
      {
        h: "Lost communications (14 CFR 91.185)",
        list: [
          "In VFR conditions, stay VFR and land as soon as practicable.",
          "Route — AVEF: Assigned, Vectored (direct from the vector), Expected, Filed.",
          "Altitude — the highest of MEA, Expected and Assigned, for each segment.",
          "Squawk 7600.",
        ],
      },
      {
        h: "VOR checks for IFR (every 30 days)",
        list: ["VOT: ±4°", "Ground checkpoint: ±4°", "Airborne checkpoint: ±6°", "Dual VOR cross-check: within 4° of each other", "Log the date, place, error and sign it."],
      },
      {
        h: "Holding",
        list: [
          "Entries: direct, parallel or teardrop, chosen by your heading relative to the holding course (70° line off the outbound side).",
          "Maximum holding speeds: 200 KIAS up to 6,000 MSL, 230 KIAS 6,001–14,000, 265 KIAS above 14,000.",
          "Inbound leg 1 minute at or below 14,000 MSL, 1½ above.",
          "ATC gives an expect-further-clearance (EFC) time with a holding clearance; if you lose radios, it's when you leave the fix.",
        ],
      },
      {
        h: "Approaches",
        list: [
          "Below DA or MDA only when the visibility is at least what's published, you see the required runway references, and you can make a normal descent to a normal landing.",
          "With only the approach lights in sight you may descend to 100 ft above touchdown zone elevation, unless the red terminating bars or side row bars are also visible.",
          "Precision (ILS, GLS) give lateral and vertical guidance to a DA; LPV is an approach with vertical guidance to a DA; LNAV and VOR approaches go to an MDA.",
          "Standard-rate turn: 3° a second, about TAS ÷ 10 + 7 degrees of bank.",
        ],
      },
    ],
  },
  {
    id: "instruments",
    title: "Flight instruments and their errors",
    exams: ["ira", "par", "cax"],
    sections: [
      {
        h: "Pitot-static",
        list: [
          "Airspeed uses pitot and static pressure; altimeter and vertical speed use only static.",
          "Pitot tube blocked with the drain hole open: airspeed drops to zero. Blocked with drain also blocked: airspeed acts like an altimeter — rising in a climb, falling in a descent.",
          "Static port blocked: altimeter freezes, VSI reads zero, airspeed reads low in a climb and high in a descent. Use the alternate static source, which usually reads a bit high.",
          "\"High to low, look out below\": flying from high pressure (or temperature) to low without resetting the altimeter puts you lower than it shows.",
        ],
      },
      {
        h: "Gyroscopic",
        list: [
          "Gyros rely on rigidity in space and precession.",
          "Attitude and heading indicators are usually vacuum-driven; the turn coordinator is usually electric, so one failure doesn't take all three.",
          "The heading indicator drifts: reset it to the magnetic compass every 15 minutes in straight and level flight.",
          "The turn coordinator shows rate and roll; the ball shows coordination — step on the ball.",
        ],
      },
    ],
  },
  {
    id: "part107",
    title: "Part 107 drone rules",
    exams: ["uag"],
    sections: [
      {
        h: "Operating limits",
        list: [
          "Drone under 55 lb, registered if over 0.55 lb (250 g), with Remote ID.",
          "Keep it within visual line of sight of you or a visual observer — no binoculars for that.",
          "Up to 400 ft above ground; near a structure, up to 400 ft above its top within 400 ft of it.",
          "Top speed 87 knots (100 mph) groundspeed.",
          "At least 3 sm visibility from the control station; stay 500 ft below and 2,000 ft horizontally from clouds.",
          "Class B, C, D and the surface area of Class E need ATC authorization (LAANC or FAA DroneZone). Class G needs none.",
          "Night and civil twilight: anti-collision lights visible for 3 sm.",
          "Over people and moving vehicles only under the operations-over-people categories. Not from a moving vehicle unless over a sparsely populated area.",
          "One drone per pilot unless waived. Most limits can be waived through DroneZone.",
        ],
      },
      {
        h: "Your certificate",
        list: [
          "Be 16, pass the UAG test, apply in IACRA (TSA vetting).",
          "Recurrent online training every 24 calendar months; carry your certificate when flying.",
          "Report to the FAA within 10 days any accident with serious injury or loss of consciousness, or more than $500 of damage to property other than the drone.",
          "No flying within 8 hours of alcohol or at 0.04% or more, and not with a condition that makes it unsafe.",
          "Give way to all crewed aircraft.",
        ],
      },
    ],
  },
  {
    id: "teaching",
    title: "How people learn and how to teach",
    exams: ["foi"],
    sections: [
      {
        h: "Principles of learning",
        list: [
          "Readiness: people learn best when they're ready and see a reason.",
          "Exercise: what's repeated is remembered.",
          "Effect: learning sticks when it comes with a satisfying feeling; frustration weakens it.",
          "Primacy: what's learned first is hardest to unlearn — teach it right the first time.",
          "Intensity: a vivid, real experience teaches more than a dull one.",
          "Recency: what was learned most recently is remembered best — review at the end.",
        ],
      },
      {
        h: "Levels and domains",
        list: [
          "Levels of learning: rote, understanding, application, correlation.",
          "Domains: cognitive (knowledge), affective (attitudes and values), psychomotor (physical skills).",
          "Maslow's needs: physiological, security, belonging, esteem, cognitive and aesthetic, self-actualization — lower needs come first.",
        ],
      },
      {
        h: "Teaching",
        list: [
          "Teaching steps: preparation, presentation, application, assessment.",
          "Telling-and-doing for skills: instructor tells and does, student tells and instructor does, student tells and does, student does and instructor evaluates.",
          "Scenario-based training puts skills into realistic decisions; good debriefs let the student assess first.",
          "Defense mechanisms to recognize: rationalization, projection, denial, reaction formation, fantasy, displacement, repression, compensation.",
          "Good questions are open-ended and have one clear purpose; avoid trick and leading questions.",
        ],
      },
    ],
  },
];

export const topicsById = new Map(TOPICS.map(t => [t.id, t]));
export const topicsFor = examId => TOPICS.filter(t => t.exams.includes(examId));
