// Diagram-first versions of some calculators. `fields` are the inputs placed on
// the drawing; everything else stays in "More settings" beside it. `always` means
// the calculator has no plain form (its inputs only make sense on the drawing).
// `pick(values)` lets one calculator choose its fields and hint from its inputs.
import TankDiagram from "./TankDiagram";
import PipeDiagram from "./PipeDiagram";
import SectionDiagram from "./SectionDiagram";
import SlopeDiagram from "./SlopeDiagram";
import BeamSetupDiagram from "./BeamSetupDiagram";
import AxialDiagram from "./AxialDiagram";
import BucklingDiagram from "./BucklingDiagram";
import TorqueDiagram from "./TorqueDiagram";
import GearDiagram from "./GearDiagram";
import BoltDiagram from "./BoltDiagram";
import SpringDiagram from "./SpringDiagram";
import EnergyDiagram from "./EnergyDiagram";
import FanSystemBuilder from "./FanSystemBuilder";
import LoadBuilder from "./LoadBuilder";

export const DIAGRAMS = {
  // The beam page has two drawings: standard cases, and the free-form builder.
  beam: {
    component: BeamSetupDiagram,
    pick: (v) =>
      v.setup === "custom"
        ? { fields: ["setup", "L", "model"], always: true, hint: "Add supports and loads, drag them along the beam, and type values right on the drawing. Tap any item to move, change or remove it." }
        : { fields: ["setup", "support", "load", "L", "P", "a", "w"], hint: "Drag the load arrow along the beam, or type on the drawing. Switch to the beam builder for any supports and loads." },
  },
  "tank-volume": { component: TankDiagram, fields: ["shape", "D", "L", "W", "H", "h"], hint: "Drag the level handle up and down, or type the sizes on the drawing." },
  "pressure-drop": { component: PipeDiagram, fields: ["Q", "pipe", "D", "L", "fluid", "mat"], hint: "Type the flow and pipe size on the drawing. The flow lines speed up as velocity rises." },
  "section-properties": { component: SectionDiagram, fields: ["shape", "b", "h", "D", "B", "H", "s", "t", "tf", "tw"], hint: "Type each dimension where it sits on the shape." },
  "stress-strain": { component: AxialDiagram, fields: ["F", "A", "L", "mat"], hint: "Drag the force handle to pull harder. The bar changes colour as it nears yield." },
  buckling: { component: BucklingDiagram, fields: ["ends", "L", "I", "A", "mat"], hint: "Pick the end supports to see how the column bows." },
  "torque-power": { component: TorqueDiagram, fields: ["P", "n", "tau"], hint: "Type the motor's power and speed. The shaft spins faster as the speed goes up." },
  "gear-ratio": { component: GearDiagram, fields: ["N1", "N2", "n1", "T1"], hint: "Gears are drawn to their tooth counts and turn at their real speed ratio." },
  "bolt-torque": { component: BoltDiagram, fields: ["size", "grade", "pct", "cond", "K"], hint: "Pick the bolt and how the threads are lubricated." },
  spring: { component: SpringDiagram, fields: ["d", "Dm", "Na", "F"], hint: "The spring is drawn to scale: wire, coil size and deflection are real." },
  "energy-motion": { component: EnergyDiagram, fields: ["m", "v", "h"], hint: "Drag the block up or down to change its height." },
  "building-loads": { component: LoadBuilder, fields: ["model"], always: true, hint: "Add each room with its walls, windows, roof, people, lights and equipment. Design conditions are under More settings." },
  "fan-system": { component: FanSystemBuilder, fields: ["Q", "model", "z", "T"], always: true, hint: "List the path the air takes, from intake to the farthest outlet. Each item shows its own pressure loss." },
  slope: { component: SlopeDiagram, fields: ["rise", "run"], hint: "Drag the top corner to change the rise." },
};
