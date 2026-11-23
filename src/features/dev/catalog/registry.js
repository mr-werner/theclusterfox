import * as loaders from "./loaders.js";

// The apps with a "see everything" catalog in the developer area. LiftFox
// has its own view (with the animated demos); the rest use the generic list.
export const CATALOGS = [
  { appId: "liftfox", what: "Every exercise with its animated demo, steps and tips", custom: true },
  { appId: "cookfox", what: "Every recipe, by meal", load: loaders.cookfox },
  { appId: "growfox", what: "Every plant with its care schedule", load: loaders.growfox },
  { appId: "medicfox", what: "Skill sheets, study topics and every practice question with answers", load: loaders.medicfox },
  { appId: "flyfox", what: "Study topics and every test question with answers", load: loaders.flyfox },
  { appId: "calmfox", what: "Every session and how it opens", load: loaders.calmfox },
  { appId: "toolfox", what: "Every builder, calculator and reference table", load: loaders.toolfox },
  { appId: "bodyfox", what: "Every body part write-up", load: loaders.bodyfox },
];

export const catalogFor = appId => CATALOGS.find(c => c.appId === appId) ?? null;
