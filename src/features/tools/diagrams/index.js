// Diagram-first versions of some calculators. `fields` are the inputs placed on
// the drawing; everything else stays in "More settings" beside it.
import BeamDiagram from "./BeamDiagram";
import TankDiagram from "./TankDiagram";
import PipeDiagram from "./PipeDiagram";
import SectionDiagram from "./SectionDiagram";
import SlopeDiagram from "./SlopeDiagram";

export const DIAGRAMS = {
  beam: { component: BeamDiagram, fields: ["support", "load", "L", "P", "a", "w"], hint: "Drag the load arrow along the beam, or type on the drawing." },
  "tank-volume": { component: TankDiagram, fields: ["shape", "D", "L", "W", "H", "h"], hint: "Drag the level handle up and down, or type the sizes on the drawing." },
  "pressure-drop": { component: PipeDiagram, fields: ["Q", "pipe", "D", "L", "fluid", "mat"], hint: "Type the flow and pipe size on the drawing. The flow lines speed up as velocity rises." },
  "section-properties": { component: SectionDiagram, fields: ["shape", "b", "h", "D", "B", "H", "t", "tf", "tw"], hint: "Type each dimension where it sits on the shape." },
  slope: { component: SlopeDiagram, fields: ["rise", "run"], hint: "Drag the top corner to change the rise." },
};
