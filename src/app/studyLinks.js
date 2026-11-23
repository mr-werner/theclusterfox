// How the other ClusterFox apps share what they teach with StudyFox.
//
// StudyFox never copies an app's material. It keeps a list of the decks
// you added ("medicfox:airway-basics") and, when you study, asks the app's
// studyLink module for that deck's current contents. Fix a question in
// MedicFox and StudyFox shows the fixed one the next time you review.
//
// A studyLink module exports:
//   decks() -> [{ id, title, blurb?, group? }]        (may be async)
//     Everything this app offers to StudyFox. group heads a section in
//     StudyFox's library ("Airway", "GD&T").
//   deck(id) -> { id, title, blurb?, href, cards, questions?, facts?,
//                 problems?, diagrams? } or null      (may be async)
//     href     opens this material in the app itself.
//     cards    [{ id, front, back, group?, href? }]: a term and what it means.
//              group sorts cards into categories ("Form", "Location").
//     questions [{ id, text, choices, answer, why? }]: one best answer.
//     facts    [{ id, text, blank }]: a sentence and the words to blank
//              out of it for fill in the blank. blank must appear in text.
//     problems (seed) -> { id, text, answer, unit, tolerance, why } | null
//              A worked problem with fresh numbers for each seed. answer is
//              a number; tolerance is the allowed relative error.
//     diagrams [{ title, href, blurb? }]: interactive pages in the app.
//
// Ids must stay stable: StudyFox keys your review schedule by them.
// The app's name, icon and color come from src/app/apps.js by app id.

export const STUDY_LINKS = [
  { app: "medicfox", load: () => import("../features/medic/model/studyLink.js") },
  { app: "flyfox", load: () => import("../features/fly/model/studyLink.js") },
  { app: "toolfox", load: () => import("../features/tools/model/studyLink.js") },
  { app: "bodyfox", load: () => import("../features/body/model/studyLink.js") },
  { app: "growfox", load: () => import("../features/grow/model/studyLink.js") },
  { app: "bookfox", load: () => import("../features/book/model/studyLink.js") },
];

export const studyLinkFor = app => STUDY_LINKS.find(l => l.app === app) ?? null;

/** The StudyFox page for one added deck. */
export const studyDeckHref = (app, id) => `/study?deck=${encodeURIComponent(`${app}:${id}`)}`;
