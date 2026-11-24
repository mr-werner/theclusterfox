// Skydiving events and boogies that come around every year. Dates move
// each year, so this says when they usually happen and links to the
// organizer; save one with its real date to put it on your TaskFox calendar.
// month: 1-12, when it usually starts. dzId links to the host drop zone.

export const EVENTS = [
  { id: "zhills-thanksgiving", name: "Thanksgiving Boogie", where: "Skydive City Z-Hills, Zephyrhills FL", dzId: "zhills", month: 11, when: "Thanksgiving week", url: "https://skydivecity.com", text: "One of the biggest boogies in the US: load organizers for every discipline, big planes and a party every night." },
  { id: "eloy-holiday", name: "Holiday Boogie", where: "Skydive Arizona, Eloy AZ", dzId: "eloy", month: 12, when: "Between Christmas and New Year", url: "https://skydiveaz.com", text: "Warm desert jumping at the end of the year with a big fleet and organizers." },
  { id: "chicago-summerfest", name: "Summerfest", where: "Skydive Chicago, Ottawa IL", dzId: "chicago", month: 6, when: "Late June into early July", url: "https://skydivechicago.com", text: "A week-plus summer boogie with organized loads, canopy courses, camping and evening events." },
  { id: "lost-prairie", name: "Lost Prairie Boogie", where: "Skydive Lost Prairie, Marion MT", month: 7, lat: 48.0700, lon: -114.7000, when: "Late July into early August", url: "https://skydivelostprairie.com", text: "Jumping into a mountain valley in Montana. A long-running classic with camping on the field." },
  { id: "uspa-nationals", name: "USPA National Skydiving Championships", where: "Host DZ changes each year", month: 9, when: "Late summer or early fall", url: "https://www.uspa.org", text: "Formation, freefly, canopy piloting, accuracy and more. Anyone with a license can enter a novice category, or just go watch." },
  { id: "pia", name: "PIA Symposium", where: "Host city changes", month: 2, when: "Every other year, usually late winter", url: "https://www.pia.com", text: "The Parachute Industry Association's gear show: every manufacturer, safety talks and seminars." },
  { id: "perris-events", name: "Perris event weekends", where: "Skydive Perris, Perris CA", dzId: "perris", month: null, when: "Most months", url: "https://skydiveperris.com", text: "Big-way camps, freefly camps and themed weekends through the year. Check their calendar." },
  { id: "deland-events", name: "DeLand camps and boogies", where: "Skydive DeLand, DeLand FL", dzId: "deland", month: null, when: "Through the year", url: "https://skydivedeland.com", text: "Skills camps and holiday boogies, with Florida weather in the winter." },
];

export const EVENT_LINKS = [
  { name: "USPA events", url: "https://www.uspa.org", text: "Nationals, Safety Day (usually March) and USPA-sanctioned events." },
  { name: "Your home DZ's calendar", url: null, text: "Most boogies and skills camps are posted on the drop zone's own site and social pages first." },
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
