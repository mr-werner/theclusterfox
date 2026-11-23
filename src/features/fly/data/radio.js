// Radio lessons for PilotFox. The airports are made up so the frequencies
// can't be mistaken for real ones: always use the chart supplement for a
// real flight. Each step is a "listen" (tune and answer a question) or a
// "call" (tune and say it), with the parts a good call must have.

import { CS_ANY, CS_FULL } from "../model/radio.js";

export const FREQS = [
  { id: "atis", name: "Foxfield ATIS", khz: 127650, note: "Weather and runway in use, on a loop" },
  { id: "gnd", name: "Foxfield Ground", khz: 121700, note: "Taxiing on the ground" },
  { id: "twr", name: "Foxfield Tower", khz: 118300, note: "Runways and the airspace around the airport" },
  { id: "app", name: "Foxfield Approach / Departure", khz: 124350, note: "Radar service and flight following" },
  { id: "ctaf", name: "Kestrel Valley CTAF", khz: 122800, note: "No tower: pilots announce to each other" },
  { id: "guard", name: "Emergency (Guard)", khz: 121500, note: "Monitored everywhere, for emergencies" },
];
export const freqByKhz = khz => FREQS.find(f => f.khz === khz);

const CALL = { label: "Who you are: Skyhawk 1234 Alpha", re: CS_FULL };
const CALL_SHORT = { label: "Your callsign (Skyhawk 34 Alpha is fine now)", re: CS_ANY };

export const ATIS_B =
  "Foxfield Airport information Bravo. One seven five two Zulu. Wind two six zero at eight. Visibility one zero. Few clouds at six thousand. Temperature two two, dewpoint one zero. Altimeter three zero one two. Landing and departing runway two eight. Advise on initial contact you have information Bravo.";
export const ATIS_C =
  "Foxfield Airport information Charlie. One eight five two Zulu. Wind two seven zero at one zero. Visibility one zero. Sky clear. Temperature two four, dewpoint one one. Altimeter three zero zero nine. Landing and departing runway two eight. Advise on initial contact you have information Charlie.";

export const LESSONS = [
  {
    id: "depart",
    name: "Depart a towered airport",
    blurb: "From the ramp at Foxfield to the departure frequency: ATIS, ground, tower.",
    steps: [
      {
        kind: "listen",
        freq: 127650,
        situation: "You're parked at the Foxfield FBO, ready to go. First get the airport's recorded information. Tune the ATIS: 127.65.",
        broadcast: ATIS_B,
        question: "Which runway is in use, and what's the information letter?",
        choices: ["Runway 10, information Alpha", "Runway 28, information Bravo", "Runway 28, information Charlie"],
        answer: 1,
      },
      {
        kind: "call",
        freq: 121700,
        situation: "Call Ground for taxi. You're at the FBO ramp, you have Bravo, and you're leaving VFR to the north.",
        expect: [
          { label: "Who you're calling: Foxfield Ground", re: /\bfoxfield ground\b/ },
          CALL,
          { label: "Where you are: at the FBO or ramp", re: /\b(fbo|ramp|parking|tie ?down)/ },
          { label: "That you have the ATIS: with Bravo", re: /\b(with|have|information)( information)? b\b/ },
          { label: "What you want: taxi (for VFR departure north)", re: /\btaxi\b/ },
        ],
        example: "Foxfield Ground, Skyhawk 1234 Alpha, at the FBO ramp with Bravo, request taxi for VFR departure to the north.",
        reply: "Skyhawk 34 Alpha, Foxfield Ground, runway 28, taxi via Alpha, hold short of runway 28.",
      },
      {
        kind: "call",
        freq: 121700,
        situation: "Read back the taxi clearance. Always read back the runway, the hold short instruction and your callsign.",
        heard: "Skyhawk 34 Alpha, Foxfield Ground, runway 28, taxi via Alpha, hold short of runway 28.",
        expect: [
          { label: "The runway: 28", re: /\b28\b/ },
          { label: "The route: via Alpha", re: /\bvia a\b/ },
          { label: "The hold short instruction", re: /\bhold(ing)? short\b/ },
          CALL_SHORT,
        ],
        example: "Runway 28, taxi via Alpha, hold short runway 28, Skyhawk 34 Alpha.",
        reply: null,
      },
      {
        kind: "call",
        freq: 118300,
        situation: "Run-up done, you're holding short of runway 28. Switch to Tower (118.3) and tell them you're ready.",
        expect: [
          { label: "Who you're calling: Foxfield Tower", re: /\bfoxfield tower\b/ },
          CALL_SHORT,
          { label: "Where you are: holding short (or at) runway 28", re: /\b(holding short|hold short|at)( of)?( runway)? 28\b/ },
          { label: "What you want: ready for departure (or takeoff)", re: /\bready\b/ },
          { label: "Which way you're going: north (optional)", re: /\bnorth/, optional: true },
        ],
        example: "Foxfield Tower, Skyhawk 1234 Alpha, holding short runway 28, ready for departure, northbound.",
        reply: "Skyhawk 34 Alpha, Foxfield Tower, wind 260 at 8, runway 28, cleared for takeoff. Right crosswind departure approved.",
      },
      {
        kind: "call",
        freq: 118300,
        situation: "Read back the takeoff clearance.",
        heard: "Skyhawk 34 Alpha, Foxfield Tower, wind 260 at 8, runway 28, cleared for takeoff. Right crosswind departure approved.",
        expect: [
          { label: "Cleared for takeoff", re: /\bcleared (for )?take ?off\b/ },
          { label: "The runway: 28", re: /\b28\b/ },
          { label: "Right crosswind (optional)", re: /\bright crosswind\b/, optional: true },
          CALL_SHORT,
        ],
        example: "Cleared for takeoff runway 28, right crosswind, Skyhawk 34 Alpha.",
        reply: "Skyhawk 34 Alpha, contact Foxfield Departure 124.35. Good day.",
      },
      {
        kind: "call",
        freq: 118300,
        situation: "Five miles out, Tower hands you off. Read back the new frequency before you switch.",
        heard: "Skyhawk 34 Alpha, contact Foxfield Departure 124.35. Good day.",
        expect: [
          { label: "The frequency: 124.35", re: /\b124\.35\b/ },
          CALL_SHORT,
        ],
        example: "Departure on 124.35, Skyhawk 34 Alpha. Good day.",
        reply: null,
      },
    ],
  },
  {
    id: "arrive",
    name: "Return and land",
    blurb: "Back to Foxfield: get the ATIS, call the tower from 10 miles out, fly the pattern, land and taxi in.",
    steps: [
      {
        kind: "listen",
        freq: 127650,
        situation: "About 20 miles south of Foxfield. Get the current ATIS on 127.65 before you call the tower.",
        broadcast: ATIS_C,
        question: "What's the altimeter setting?",
        choices: ["30.12", "30.09", "29.92"],
        answer: 1,
      },
      {
        kind: "call",
        freq: 118300,
        situation: "You're 10 miles south at 3,500 feet with Charlie, inbound to land. Call Foxfield Tower (118.3).",
        expect: [
          { label: "Who you're calling: Foxfield Tower", re: /\bfoxfield tower\b/ },
          CALL,
          { label: "Where you are: 10 miles south", re: /\b10 (miles|mile|nm|nautical)?\s*(miles )?south\b/ },
          { label: "Your altitude: 3,500", re: /\b3500\b/ },
          { label: "What you want: inbound for landing", re: /\b(landing|land|inbound)\b/ },
          { label: "That you have the ATIS: with Charlie", re: /\b(with|have|information)( information)? c\b/ },
        ],
        example: "Foxfield Tower, Skyhawk 1234 Alpha, 10 miles south at 3,500, inbound for landing with Charlie.",
        reply: "Skyhawk 34 Alpha, Foxfield Tower, make left traffic for runway 28. Enter left downwind, report midfield.",
      },
      {
        kind: "call",
        freq: 118300,
        situation: "Read back the pattern entry.",
        heard: "Skyhawk 34 Alpha, Foxfield Tower, make left traffic for runway 28. Enter left downwind, report midfield.",
        expect: [
          { label: "Left downwind (or left traffic)", re: /\bleft (downwind|traffic)\b/ },
          { label: "The runway: 28", re: /\b28\b/ },
          { label: "Report midfield", re: /\bmidfield\b/ },
          CALL_SHORT,
        ],
        example: "Left downwind runway 28, report midfield, Skyhawk 34 Alpha.",
        reply: null,
      },
      {
        kind: "call",
        freq: 118300,
        situation: "You're on left downwind, abeam the middle of the runway. Make the report Tower asked for.",
        expect: [
          { label: "Who you're calling: Foxfield Tower (or just Tower)", re: /\btower\b/ },
          CALL_SHORT,
          { label: "Midfield left downwind", re: /\bmidfield\b/ },
          { label: "The runway: 28 (optional)", re: /\b28\b/, optional: true },
        ],
        example: "Foxfield Tower, Skyhawk 34 Alpha, midfield left downwind runway 28.",
        reply: "Skyhawk 34 Alpha, runway 28, cleared to land.",
      },
      {
        kind: "call",
        freq: 118300,
        situation: "Read back the landing clearance.",
        heard: "Skyhawk 34 Alpha, runway 28, cleared to land.",
        expect: [
          { label: "Cleared to land", re: /\bcleared (to )?land\b/ },
          { label: "The runway: 28", re: /\b28\b/ },
          CALL_SHORT,
        ],
        example: "Cleared to land runway 28, Skyhawk 34 Alpha.",
        reply: "Skyhawk 34 Alpha, turn left at Charlie, contact Ground point seven.",
      },
      {
        kind: "call",
        freq: 118300,
        situation: "You've landed and are slowing down. Read back the exit and the frequency change. (\"Point seven\" means 121.7.)",
        heard: "Skyhawk 34 Alpha, turn left at Charlie, contact Ground point seven.",
        expect: [
          { label: "Left at Charlie", re: /\bleft (at|on)? ?c\b/ },
          { label: "Ground on (point seven or 121.7)", re: /(^|\s)(121\.7|\.7)\b/ },
          CALL_SHORT,
        ],
        example: "Left at Charlie, Ground point seven, Skyhawk 34 Alpha.",
        reply: null,
      },
      {
        kind: "call",
        freq: 121700,
        situation: "Clear of the runway on taxiway Charlie. Switch to Ground (121.7) and ask to taxi to the FBO.",
        expect: [
          { label: "Who you're calling: Foxfield Ground", re: /\bfoxfield ground\b/ },
          CALL_SHORT,
          { label: "Where you are: clear of runway 28 at Charlie", re: /\b(clear|off)\b.*\b(c|28)\b/ },
          { label: "What you want: taxi to the FBO (or ramp)", re: /\btaxi\b.*\b(fbo|ramp|parking)\b/ },
        ],
        example: "Foxfield Ground, Skyhawk 34 Alpha, clear of runway 28 at Charlie, taxi to the FBO.",
        reply: "Skyhawk 34 Alpha, taxi to the FBO via Charlie and Alpha.",
      },
    ],
  },
  {
    id: "ctaf",
    name: "No tower (CTAF)",
    blurb: "Kestrel Valley has no tower. Nobody answers: you announce where you are so other pilots know.",
    steps: [
      {
        kind: "call",
        freq: 122800,
        situation: "Ten miles east of Kestrel Valley at 4,500 feet, planning to land on runway 17. Tune the CTAF (122.8) and announce yourself.",
        expect: [
          { label: "Start with who you're talking to: Kestrel Valley traffic", re: /^kestrel valley traffic\b/ },
          CALL,
          { label: "Where you are: 10 miles east", re: /\b10 (miles |nm )?east\b/ },
          { label: "Your altitude: 4,500", re: /\b4500\b/ },
          { label: "Your plan: landing (runway 17)", re: /\b(land|landing|inbound)\b/ },
          { label: "End with the airport: Kestrel Valley", re: /\bkestrel valley$/ },
        ],
        example: "Kestrel Valley traffic, Skyhawk 1234 Alpha, 10 miles east at 4,500, inbound for landing runway 17, Kestrel Valley.",
        reply: null,
        note: "You say the airport's name first and last because several airports may share the same frequency.",
      },
      {
        kind: "call",
        freq: 122800,
        situation: "You're entering the left downwind for runway 17 on the 45° entry. Announce it.",
        expect: [
          { label: "Kestrel Valley traffic", re: /^kestrel valley traffic\b/ },
          CALL_SHORT,
          { label: "Entering (45 for) left downwind", re: /\b(entering|on|45)\b.*\bleft downwind\b/ },
          { label: "The runway: 17", re: /\b17\b/ },
          { label: "Kestrel Valley at the end", re: /\bkestrel valley$/ },
        ],
        example: "Kestrel Valley traffic, Skyhawk 34 Alpha, entering left downwind runway 17, Kestrel Valley.",
        reply: null,
      },
      {
        kind: "call",
        freq: 122800,
        situation: "Turning left base for runway 17.",
        expect: [
          { label: "Kestrel Valley traffic", re: /^kestrel valley traffic\b/ },
          CALL_SHORT,
          { label: "Left base", re: /\bleft base\b/ },
          { label: "The runway: 17", re: /\b17\b/ },
          { label: "Kestrel Valley at the end", re: /\bkestrel valley$/ },
        ],
        example: "Kestrel Valley traffic, Skyhawk 34 Alpha, left base runway 17, Kestrel Valley.",
        reply: null,
      },
      {
        kind: "call",
        freq: 122800,
        situation: "Turning final for runway 17. Say what you'll do: a full stop landing.",
        expect: [
          { label: "Kestrel Valley traffic", re: /^kestrel valley traffic\b/ },
          CALL_SHORT,
          { label: "Final", re: /\bfinal\b/ },
          { label: "The runway: 17", re: /\b17\b/ },
          { label: "Full stop (optional)", re: /\bfull stop\b/, optional: true },
          { label: "Kestrel Valley at the end", re: /\bkestrel valley$/ },
        ],
        example: "Kestrel Valley traffic, Skyhawk 34 Alpha, final runway 17, full stop, Kestrel Valley.",
        reply: null,
      },
      {
        kind: "call",
        freq: 122800,
        situation: "Landed and taxiing off the runway. Let everyone know the runway is clear.",
        expect: [
          { label: "Kestrel Valley traffic", re: /^kestrel valley traffic\b/ },
          CALL_SHORT,
          { label: "Clear of runway 17", re: /\bclear\b.*\b17\b/ },
          { label: "Kestrel Valley at the end", re: /\bkestrel valley$/ },
        ],
        example: "Kestrel Valley traffic, Skyhawk 34 Alpha, clear of runway 17, Kestrel Valley.",
        reply: null,
      },
    ],
  },
  {
    id: "following",
    name: "Flight following",
    blurb: "Ask radar controllers to watch over you and call out traffic on a cross-country flight.",
    steps: [
      {
        kind: "call",
        freq: 124350,
        situation: "You're 12 miles south of Foxfield at 4,500 feet, headed to Kestrel Valley. Controllers may be busy, so the first call is short: who they are, who you are, and that you have a request. Tune 124.35.",
        expect: [
          { label: "Who you're calling: Foxfield Approach (or Departure)", re: /\bfoxfield (approach|departure)\b/ },
          CALL,
          { label: "Just say you have a request", re: /\brequest\b/ },
        ],
        example: "Foxfield Approach, Skyhawk 1234 Alpha, VFR request.",
        reply: "Skyhawk 1234 Alpha, Foxfield Approach, say request.",
      },
      {
        kind: "call",
        freq: 124350,
        situation: "Now give the details: your type (a Cessna 172 with GPS, \"slash G\"), where you are, your altitude, and what you want.",
        heard: "Skyhawk 1234 Alpha, Foxfield Approach, say request.",
        expect: [
          CALL,
          { label: "Your type: Cessna 172 (slash G)", re: /\b(cessna )?172\b|\bskyhawk\b.*\bslash g\b/ },
          { label: "Where you are: 12 miles south of Foxfield", re: /\b12 (miles |nm )?south\b/ },
          { label: "Your altitude: 4,500", re: /\b4500\b/ },
          { label: "What you want: flight following to Kestrel Valley", re: /\bflight following\b.*\bkestrel\b|\bkestrel\b.*\bflight following\b/ },
        ],
        example: "Skyhawk 1234 Alpha is a Cessna 172 slash G, 12 miles south of Foxfield at 4,500, request flight following to Kestrel Valley.",
        reply: "Skyhawk 1234 Alpha, squawk 4521.",
      },
      {
        kind: "call",
        freq: 124350,
        situation: "Read back the transponder code, then set it.",
        heard: "Skyhawk 1234 Alpha, squawk 4521.",
        expect: [
          { label: "The code: 4521", re: /\b4521\b/ },
          CALL_SHORT,
        ],
        example: "Squawk 4521, Skyhawk 1234 Alpha.",
        reply: "Skyhawk 1234 Alpha, radar contact 12 miles south of Foxfield, 4,500. Altimeter 30.09.",
      },
      {
        kind: "call",
        freq: 124350,
        situation: "A traffic call: you look and see it. Tell the controller.",
        heard: "Skyhawk 34 Alpha, traffic two o'clock, five miles, northbound, altitude indicates 5,500.",
        expect: [
          { label: "Traffic in sight (or looking)", re: /\b(traffic|contact)\b.*\b(in sight|insight)\b|\b(in sight|looking)\b/ },
          CALL_SHORT,
        ],
        example: "Traffic in sight, Skyhawk 34 Alpha.",
        reply: "Skyhawk 34 Alpha, thanks. Maintain VFR.",
      },
    ],
  },
  {
    id: "mayday",
    name: "Emergency",
    blurb: "The engine quits. Who you call matters less than saying the right things, fast.",
    steps: [
      {
        kind: "call",
        freq: 121500,
        situation: "The engine has failed 8 miles south of Foxfield at 3,000 feet. You've picked a field to land in and there are 2 people aboard. You're not talking to anyone yet, so use the emergency frequency, 121.5.",
        expect: [
          { label: "Mayday, said three times", re: /\bmayday mayday mayday\b/ },
          CALL,
          { label: "What's wrong: engine failure", re: /\bengine\b/ },
          { label: "Where you are: 8 miles south of Foxfield", re: /\b8 (miles |nm )?south\b/ },
          { label: "Your altitude: 3,000", re: /\b3000\b/ },
          { label: "What you'll do: land in a field", re: /\b(field|forced landing|land)\b/ },
          { label: "People aboard: 2 (souls on board)", re: /\b2 (souls|people|aboard|on board|pob|persons)\b/ },
        ],
        example: "Mayday, Mayday, Mayday, Skyhawk 1234 Alpha, engine failure, 8 miles south of Foxfield at 3,000, landing in a field, 2 souls on board.",
        reply: "Skyhawk 1234 Alpha, Foxfield Approach, roger Mayday. Squawk 7700 if able. Report when on the ground.",
        note: "Fly the airplane first: best glide speed, pick a field, then talk. Squawk 7700 if you have time.",
      },
    ],
  },
];

export const lessonById = id => LESSONS.find(l => l.id === id) ?? LESSONS[0];

export const PHONETIC_TABLE = [
  ["A", "Alfa"], ["B", "Bravo"], ["C", "Charlie"], ["D", "Delta"], ["E", "Echo"], ["F", "Foxtrot"], ["G", "Golf"],
  ["H", "Hotel"], ["I", "India"], ["J", "Juliett"], ["K", "Kilo"], ["L", "Lima"], ["M", "Mike"], ["N", "November"],
  ["O", "Oscar"], ["P", "Papa"], ["Q", "Quebec"], ["R", "Romeo"], ["S", "Sierra"], ["T", "Tango"], ["U", "Uniform"],
  ["V", "Victor"], ["W", "Whiskey"], ["X", "X-ray"], ["Y", "Yankee"], ["Z", "Zulu"],
];
