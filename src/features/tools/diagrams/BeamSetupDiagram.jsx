import BeamDiagram from "./BeamDiagram";
import BeamBuilderDiagram from "./BeamBuilderDiagram";
import { Pills } from "./kit";

// The beam page: standard cases, or the free-form beam builder, one switch apart.
// Switching to the builder starts it from the standard case on screen.

const SETUPS = [
  { value: "simple", label: "Standard cases" },
  { value: "custom", label: "Beam builder" },
];

export default function BeamSetupDiagram(props) {
  const { values, set } = props;
  const Drawing = values.setup === "custom" ? BeamBuilderDiagram : BeamDiagram;
  return (
    <>
      <div className="dg-setup">
        <Pills label="Beam setup" options={SETUPS} value={values.setup === "custom" ? "custom" : "simple"} onChange={(x) => set("setup", x)} />
      </div>
      <Drawing {...props} />
    </>
  );
}
