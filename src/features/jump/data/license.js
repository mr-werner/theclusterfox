// The USPA path from first jump to D license. Numbers follow USPA's Skydiver's
// Information Manual (SIM, section 3); the SIM is the final word and changes
// now and then, so each license links to it.

export const SIM_URL = "https://www.uspa.org/sim";

export const FIRST_STEPS = [
  {
    id: "tandem",
    name: "Tandem",
    cost: "$230–$350",
    time: "Half a day",
    text: "You're harnessed to an instructor who handles the exit, the parachute and the landing. Most DZs log it as your first jump, and some count a tandem toward student training.",
    good: "Finding out if you love it before you commit.",
  },
  {
    id: "aff",
    name: "AFF (Accelerated Freefall)",
    cost: "$2,500–$4,000 to the A license",
    time: "A few weekends to a few months",
    text: "A day of ground school, then you jump your own parachute from full altitude with one or two instructors holding your harness. About seven levels teach stability, turns, forward movement and flips, then coach jumps and solos get you to 25 jumps.",
    good: "The fastest route to jumping on your own. The most common program.",
  },
  {
    id: "sl",
    name: "Static line / IAD",
    cost: "Cheaper per jump, more jumps",
    time: "Similar to AFF, sometimes longer",
    text: "Your parachute opens as you leave the plane at 3,500 to 4,500 ft, so you learn canopy skills first. After a few clear-and-pulls you move on to short freefalls and build up.",
    good: "Learning on a budget, or if you like to take things in small steps. Fewer DZs offer it.",
  },
  {
    id: "tunnel",
    name: "Tunnel first, then AFF",
    cost: "$500–$1,200 of tunnel time",
    time: "A few visits",
    text: "Learn body flight in a wind tunnel before AFF. You arrive stable and confident, and pass levels the first time more often.",
    good: "Anyone who lives near a tunnel. It usually pays for itself in fewer repeated levels.",
  },
];

// jumps and freefallMin are the hard numbers JumpFox can check from your logbook.
export const LICENSES = [
  {
    id: "A",
    name: "A license",
    jumps: 25,
    freefallMin: 0,
    needs: [
      "25 jumps",
      "Finish the Integrated Student Program and get your A-license Proficiency Card signed",
      "Five group freefall jumps with a USPA coach or instructor",
      "Pack your own main parachute under supervision",
      "Pass the A-license written and oral exam",
      "A check dive with an instructor",
    ],
    lets: ["Jump without supervision", "Pack your own main", "Jump with other licensed skydivers", "Do group jumps and start learning freefly and tracking"],
  },
  {
    id: "B",
    name: "B license",
    jumps: 50,
    freefallMin: 30,
    needs: [
      "50 jumps and 30 minutes of freefall time",
      "Land within 10 meters of a target on 10 jumps",
      "A canopy course (USPA's Basic Canopy Proficiency card)",
      "Group freefall jumps",
      "Pass the B-license written exam",
    ],
    lets: ["Train for night jumps", "Work toward the USPA Coach rating (100 jumps)", "Jump at more DZs without a check jump"],
  },
  {
    id: "C",
    name: "C license",
    jumps: 200,
    freefallMin: 60,
    needs: ["200 jumps and 60 minutes of freefall time", "Land within 2 meters of a target on 25 jumps", "Pass the C-license written exam"],
    lets: ["Jump with a camera (USPA recommends 200 jumps)", "Take a wingsuit first-flight course", "Instructor ratings like AFF, IAD and static line", "Some demo jumps"],
  },
  {
    id: "D",
    name: "D license",
    jumps: 500,
    freefallMin: 180,
    needs: ["500 jumps and 3 hours of freefall time", "Two night jumps", "Pass the D-license written exam"],
    lets: ["Every instructor rating, including tandem (with a medical and time in the sport)", "Pro demo jumps into stadiums and events", "Organizing and load organizing big-ways"],
  },
];

export const RATINGS = [
  { name: "USPA Coach", needs: "100 jumps and an A license, plus a coach course", text: "Lets you take students on group jumps after AFF." },
  { name: "Wingsuit first flight", needs: "200 jumps in the last 18 months (USPA recommendation)", text: "A first-flight course with a wingsuit instructor." },
  { name: "Camera flying", needs: "200 jumps (USPA recommendation)", text: "Start with small, well-mounted cameras and simple jumps." },
  { name: "AFF / IAD / Static-line Instructor", needs: "C license and experience requirements", text: "Teach students. Each rating has its own course." },
  { name: "Tandem Instructor", needs: "500 jumps, 3 years in the sport, a medical and a manufacturer course", text: "Take first-timers on tandems." },
  { name: "PRO rating", needs: "D license and demo experience", text: "Jump into stadiums and crowded areas." },
];

export const LICENSE_TIPS = [
  "Jump often while you're a student. Long gaps mean refresher training and repeated levels.",
  "Buy blocks of jump tickets once you're licensed: most DZs give a discount for 10 or more.",
  "Log every jump the same day, and get it signed. You'll need it for each license.",
  "Take a canopy course early, not just for the B license. Most injuries happen under canopy.",
  "Don't downsize your canopy just because your friends did. Follow your DZ's downsizing guidance.",
];
