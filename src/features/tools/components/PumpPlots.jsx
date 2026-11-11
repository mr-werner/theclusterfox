import Chart from "./Chart";
import { fromSI, unitLabel, fmt } from "../model/units";
import { runLabel, tagsFor } from "../model/pumpSystem";

// Pump system results: the head–flow chart (system curve, pump curve, NPSH
// available and required) and a run-by-run loss breakdown.

const COLORS = { sys: "#5cc8ff", pump: "#c6a6ff", npsh: "#7be0a0", req: "#ff7f6b" };

export default function PumpPlots({ v, unit }) {
  const { curves, s, op } = v;
  const series = [{ points: curves.sys, color: COLORS.sys, label: "System curve (head needed)" }];
  if (curves.pump.length) series.push({ points: curves.pump, color: COLORS.pump, label: "Pump curve" });
  series.push({ points: curves.npsh, color: COLORS.npsh, label: "NPSH available" });
  if (curves.req.length) series.push({ points: curves.req, color: COLORS.req, label: "NPSH required", dashed: true });
  const marker = op ? { x: op.Q, y: op.H } : { x: v.Q, y: s.TDH };
  const L = unit("length");
  const val = (x, dim) => `${fmt(fromSI(x, dim, unit(dim)))} ${unitLabel(dim, unit(dim))}`;

  const sTags = tagsFor(s.sRows.map((r) => r.run), "s");
  const dTags = tagsFor(s.dRows.map((r) => r.run), "d");
  const rows = [...s.sRows.map((r, i) => ({ ...r, tag: sTags[i] })), ...s.dRows.map((r, i) => ({ ...r, tag: dTags[i] }))];

  return (
    <section className="tf-card tf-visual tf-pump-plots">
      <h3 className="tf-visual-title">
        Head against flow · {op ? "dot = where the pump settles" : "dot = your design point"}
      </h3>
      <Chart series={series} x={{ label: "Flow", dim: "flow", unit: unit("flow"), min: 0 }} y={{ label: "Head", dim: "length", unit: L, min: 0 }} marker={marker} />

      <h3 className="tf-visual-title">Losses by run at design flow</h3>
      <div className="tf-table-scroll">
        <table className="tf-table tf-pump-table">
          <thead>
            <tr>
              <th className="is-text">Run</th>
              <th>Velocity</th>
              <th>Reynolds</th>
              <th>ΣK fittings</th>
              <th>Pipe friction</th>
              <th>Fittings</th>
              <th>Equipment</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tag}>
                <td className="is-text">
                  <strong>{r.tag}</strong> {r.run.name || runLabel(r.run)}
                  <span className="tf-pump-sub">
                    {r.equip ? `${runLabel(r.run)} · ${r.run.cv > 0 ? `Cv ${fmt(r.run.cv, 3)}` : `${val(r.run.dp, "pressure")} at design flow`}` : `${runLabel(r.run)} · ID ${val(r.D, "smallLength")} · ${val(r.run.L, "length")}`}
                  </span>
                </td>
                <td>{r.equip ? "—" : val(r.v, "velocity")}</td>
                <td>{r.equip ? "—" : fmt(r.Re, 3)}</td>
                <td>{r.equip ? "—" : fmt(r.K, 3)}</td>
                <td>{r.equip ? "—" : val(r.hPipe, "length")}</td>
                <td>{r.equip ? "—" : val(r.hFit, "length")}</td>
                <td>{r.hEquip ? val(r.hEquip, "length") : "—"}</td>
                <td>
                  <strong>{val(r.h, "length")}</strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="is-text">Suction total</td>
              <td colSpan="6" />
              <td>
                <strong>{val(s.hfS, "length")}</strong>
              </td>
            </tr>
            <tr>
              <td className="is-text">Discharge total</td>
              <td colSpan="6" />
              <td>
                <strong>{val(s.hfD, "length")}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
