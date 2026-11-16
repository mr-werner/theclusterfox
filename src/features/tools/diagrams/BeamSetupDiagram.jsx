import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import BeamDiagram from "./BeamDiagram";
import BeamBuilderDiagram from "./BeamBuilderDiagram";
import { Pills } from "./kit";
import { show } from "./helpers";
import { toParams } from "../model/engine";
import { beamWorst, readSectionLabel, sectionUrlFromBeam } from "../model/beamLink";

// The beam page: standard cases, or the free-form beam builder, one switch apart.
// Switching to the builder starts it from the standard case on screen.
// Under the drawing, the section: carry this beam's loads to a real shape and back.

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
      <BeamSection {...props} />
    </>
  );
}

function BeamSection({ calc, values, output, unit }) {
  const navigate = useNavigate();
  const { M, V } = beamWorst(output.results, values);
  const saved = readSectionLabel();
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));
  const named = saved && close(saved.I, values.I) && close(saved.S, values.S) ? saved.label : null;
  const go = () => navigate(sectionUrlFromBeam(toParams(calc, values), { M, V }));
  return (
    <div className="dg-beam-section">
      <div>
        <span className="dg-num-label">Section</span>
        <p>
          <strong>{named || "Your own I and S"}</strong>
          <span className="tf-muted">
            {" "}
            · I {show(values.I, "inertia", unit("inertia"))}
            {values.S > 0 ? ` · S ${show(values.S, "sectionModulus", unit("sectionModulus"))}` : ""}
          </span>
        </p>
      </div>
      <button type="button" className="dg-beam-link" onClick={go} disabled={!Number.isFinite(M)}>
        {named ? "Change the shape" : "Pick a shape"} and see its stress under this beam's worst moment and shear <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
