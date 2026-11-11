import { useState } from "react";
import { Copy, FolderOpen, Plus, Save, Trash2 } from "lucide-react";
import { Num, Choice } from "./kit";
import { show } from "./helpers";
import Chart from "../components/Chart";
import LoadLocation from "./LoadLocation";
import { parseProject, stringifyProject, newRoom, ORIENTATIONS, MASS } from "../model/loads";

// Rooms as cards. Each card holds the room's size, people, lights, equipment,
// air and its walls, windows, roof and floor, and shows its own peak loads.
// Projects can be saved in this browser by name.

const STORE = "toolfox-load-projects";
const readSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}") || {};
  } catch {
    return {};
  }
};
const writeSaved = (all) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
};

const ORIENT = ORIENTATIONS.filter((o) => !o.horizontal).map((o) => ({ value: o.id, label: o.label }));
const GLASS_ORIENT = ORIENTATIONS.map((o) => ({ value: o.id, label: o.label }));
const MASS_OPTS = Object.entries(MASS).map(([value, m]) => ({ value, label: m.label }));
const COLOR = [
  { value: "0", label: "Light colour" },
  { value: "1", label: "Dark colour" },
];
const SHADE = [
  { value: "1", label: "No blinds" },
  { value: "0.85", label: "Light blinds or shades" },
  { value: "0.7", label: "Reflective blinds or shades" },
];
const PARTS = [
  ["walls", "Walls", "#c6a6ff"],
  ["roof", "Roof", "#ff7aa8"],
  ["glassCond", "Glass conduction", "#5cc8ff"],
  ["solar", "Sun through glass", "#ffd25c"],
  ["people", "People", "#ff8a4c"],
  ["lights", "Lights", "#7be0c3"],
  ["equip", "Equipment", "#62d6c9"],
  ["infil", "Infiltration", "#9aa39f"],
];
const HEAT_PARTS = [
  ["walls", "Walls", "#c6a6ff"],
  ["glass", "Windows", "#5cc8ff"],
  ["roof", "Roof", "#ff7aa8"],
  ["floor", "Floor", "#d9b38c"],
  ["infil", "Infiltration", "#9aa39f"],
  ["oa", "Outdoor air", "#ff8a4c"],
];
const hourLabel = (h) => `${String(h - 1).padStart(2, "0")}:00`;

export default function LoadBuilder({ values: v, set, output, unit, setUnit }) {
  const rooms = parseProject(v.model);
  const vis = output.visual?.type === "loads" ? output.visual : null;
  const [open, setOpen] = useState(0);
  const [saved, setSaved] = useState(readSaved);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const save = (next) => set("model", stringifyProject(next));
  const updRoom = (i, patch) => save(rooms.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const updRow = (i, key, j, col, val) => updRoom(i, { [key]: rooms[i][key].map((row, k) => (k === j ? row.map((c, n) => (n === col ? val : c)) : row)) });
  const addRow = (i, key, row) => updRoom(i, { [key]: [...rooms[i][key], row] });
  const delRow = (i, key, j) => updRoom(i, { [key]: rooms[i][key].filter((_, k) => k !== j) });

  const num = (label, dim, value, onValue) => (
    <Num label={label} dim={dim} value={value} unit={unit(dim)} onUnit={(u) => setUnit(dim, u)} onValue={(x) => Number.isFinite(x) && x >= 0 && onValue(x)} />
  );
  const roomNum = (i, key, label, dim) => num(label, dim, rooms[i][key], (x) => updRoom(i, { [key]: x }));
  const rowNum = (i, key, j, col, label, dim) => num(label, dim, rooms[i][key][j][col], (x) => updRow(i, key, j, col, x));
  const rowPick = (i, key, j, col, label, options, asNumber) => (
    <Choice label={label} value={String(rooms[i][key][j][col])} options={options} onChange={(x) => updRow(i, key, j, col, asNumber ? Number(x) : x)} />
  );

  function saveProject() {
    const n = name.trim() || `Project ${Object.keys(saved).length + 1}`;
    const all = { ...readSaved(), [n]: { model: v.model, at: Date.now() } };
    if (writeSaved(all)) {
      setSaved(all);
      setName(n);
      setNote(`Saved “${n}” in this browser.`);
    } else setNote("This browser isn't letting the page save. Copy the page link instead; it holds the whole project.");
  }
  function loadProject(n) {
    const p = saved[n];
    if (!p) return;
    set("model", p.model);
    setName(n);
    setNote(`Opened “${n}”.`);
  }
  function deleteProject(n) {
    const all = { ...readSaved() };
    delete all[n];
    writeSaved(all);
    setSaved(all);
    setNote(`Deleted “${n}”.`);
  }

  const H = (x) => show(x * (vis?.margin ?? 1), "heatRate", unit("heatRate"));

  return (
    <div className="dg-builder ld">
      <div className="ld-projects" role="group" aria-label="Saved projects">
        <label className="dg-pick ld-name">
          <span className="dg-num-label">Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My building" />
        </label>
        <div className="dg-add">
          <button type="button" onClick={saveProject}>
            <Save size={13} aria-hidden="true" /> Save in this browser
          </button>
          {Object.keys(saved).length > 0 && (
            <label className="dg-pick">
              <span className="dg-num-label">
                <FolderOpen size={11} aria-hidden="true" /> Open saved
              </span>
              <select value="" onChange={(e) => loadProject(e.target.value)}>
                <option value="">Choose…</option>
                {Object.keys(saved).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {saved[name] && (
            <button type="button" onClick={() => deleteProject(name)}>
              <Trash2 size={13} aria-hidden="true" /> Delete saved
            </button>
          )}
        </div>
        {note && <p className="tf-muted tf-small">{note}</p>}
      </div>

      <LoadLocation values={v} set={set} unit={unit} />

      <div className="ld-rooms">
        {rooms.map((room, i) => {
          const r = vis?.rooms[i];
          return (
            <details key={i} className="ld-room" open={open === i} onToggle={(e) => (e.currentTarget.open ? setOpen(i) : open === i && setOpen(-1))}>
              <summary>
                <span className="ld-room-name">{room.n || `Room ${i + 1}`}</span>
                {r && (
                  <span className="ld-room-sum">
                    <span>
                      Cooling <strong>{H(r.peakSens + r.peakLat)}</strong> at {hourLabel(r.peakHour)}
                    </span>
                    <span>
                      Supply <strong>{show(r.Qsup * (vis.margin ?? 1), "airflow", unit("airflow"))}</strong>
                    </span>
                    <span>
                      Heating <strong>{H(r.heat)}</strong>
                    </span>
                  </span>
                )}
              </summary>
              <div className="ld-body">
                <div className="dg-item-fields">
                  <label className="dg-pick ld-name">
                    <span className="dg-num-label">Room name</span>
                    <input value={room.n} onChange={(e) => updRoom(i, { n: e.target.value })} />
                  </label>
                  {roomNum(i, "A", "Floor area", "area")}
                  {roomNum(i, "H", "Ceiling height", "length")}
                  <Choice label="Construction" value={room.mass} options={MASS_OPTS} onChange={(mass) => updRoom(i, { mass })} />
                </div>

                <h4 className="ld-sub">People, lights and equipment</h4>
                <div className="dg-item-fields">
                  {roomNum(i, "ppl", "People", "none")}
                  {roomNum(i, "ps", "Sensible heat each", "smallPower")}
                  {roomNum(i, "pl", "Latent heat each", "smallPower")}
                  {roomNum(i, "lt", "Lighting", "powerDensity")}
                  {roomNum(i, "eq", "Equipment", "powerDensity")}
                </div>

                <h4 className="ld-sub">Air</h4>
                <div className="dg-item-fields">
                  {roomNum(i, "ach", "Infiltration (air changes/h)", "none")}
                  {roomNum(i, "oap", "Outdoor air per person", "ventRate")}
                  {roomNum(i, "oaa", "Outdoor air per floor area", "airflowArea")}
                </div>

                <h4 className="ld-sub">Outside walls (gross, windows included)</h4>
                {room.w.map((row, j) => (
                  <div key={j} className="ld-row">
                    <div className="dg-item-fields">
                      {rowPick(i, "w", j, 0, "Faces", ORIENT)}
                      {rowNum(i, "w", j, 1, "Area", "area")}
                      {rowNum(i, "w", j, 2, "U-value", "htc")}
                      {rowPick(i, "w", j, 3, "Weight", MASS_OPTS)}
                      {rowPick(i, "w", j, 4, "Outside", COLOR, true)}
                    </div>
                    <button type="button" className="dg-item-del" onClick={() => delRow(i, "w", j)} aria-label="Remove wall" title="Remove wall">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <h4 className="ld-sub">Windows and skylights</h4>
                {room.g.map((row, j) => (
                  <div key={j} className="ld-row">
                    <div className="dg-item-fields">
                      {rowPick(i, "g", j, 0, "Faces", GLASS_ORIENT)}
                      {rowNum(i, "g", j, 1, "Area", "area")}
                      {rowNum(i, "g", j, 2, "U-value", "htc")}
                      {rowNum(i, "g", j, 3, "SHGC", "none")}
                      {rowPick(i, "g", j, 4, "Inside", SHADE, true)}
                    </div>
                    <button type="button" className="dg-item-del" onClick={() => delRow(i, "g", j)} aria-label="Remove window" title="Remove window">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <h4 className="ld-sub">Roof and floor</h4>
                {room.r ? (
                  <div className="ld-row">
                    <div className="dg-item-fields">
                      {num("Roof area", "area", room.r[0], (x) => updRoom(i, { r: [x, room.r[1], room.r[2], room.r[3]] }))}
                      {num("Roof U-value", "htc", room.r[1], (x) => updRoom(i, { r: [room.r[0], x, room.r[2], room.r[3]] }))}
                      <Choice label="Weight" value={room.r[2]} options={MASS_OPTS} onChange={(x) => updRoom(i, { r: [room.r[0], room.r[1], x, room.r[3]] })} />
                      <Choice label="Outside" value={String(room.r[3])} options={COLOR} onChange={(x) => updRoom(i, { r: [room.r[0], room.r[1], room.r[2], Number(x)] })} />
                    </div>
                    <button type="button" className="dg-item-del" onClick={() => updRoom(i, { r: 0 })} aria-label="Remove roof" title="Remove roof">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}
                {room.f ? (
                  <div className="ld-row">
                    <div className="dg-item-fields">
                      {num("Floor over unheated space, area", "area", room.f[0], (x) => updRoom(i, { f: [x, room.f[1]] }))}
                      {num("Floor U-value", "htc", room.f[1], (x) => updRoom(i, { f: [room.f[0], x] }))}
                    </div>
                    <button type="button" className="dg-item-del" onClick={() => updRoom(i, { f: 0 })} aria-label="Remove floor" title="Remove floor">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}

                <div className="dg-add ld-add">
                  <button type="button" onClick={() => addRow(i, "w", ["N", 20, 0.45, "medium", 0])}>
                    <Plus size={13} aria-hidden="true" /> Wall
                  </button>
                  <button type="button" onClick={() => addRow(i, "g", ["N", 3, 2.5, 0.4, 1])}>
                    <Plus size={13} aria-hidden="true" /> Window
                  </button>
                  {!room.r && (
                    <button type="button" onClick={() => updRoom(i, { r: [room.A, 0.2, "light", 0] })}>
                      <Plus size={13} aria-hidden="true" /> Roof
                    </button>
                  )}
                  {!room.f && (
                    <button type="button" onClick={() => updRoom(i, { f: [room.A, 0.3] })}>
                      <Plus size={13} aria-hidden="true" /> Floor over unheated space
                    </button>
                  )}
                  <button type="button" onClick={() => (save([...rooms.slice(0, i + 1), { ...room, n: `${room.n} copy` }, ...rooms.slice(i + 1)]), setOpen(i + 1))}>
                    <Copy size={13} aria-hidden="true" /> Duplicate room
                  </button>
                  <button type="button" className="is-danger" onClick={() => save(rooms.filter((_, k) => k !== i))}>
                    <Trash2 size={13} aria-hidden="true" /> Remove room
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="dg-add ld-add">
        <button type="button" onClick={() => (save([...rooms, newRoom(rooms.length + 1)]), setOpen(rooms.length))}>
          <Plus size={13} aria-hidden="true" /> Add a room
        </button>
      </div>

      {vis && (
        <>
          <div className="ld-heat" aria-label="Heating load at the winter design temperature">
            <h3 className="tf-visual-title">Heating load at the winter design temperature</h3>
            <p className="ld-heat-total">
              <strong>{H(vis.heat)}</strong>
              <span className="tf-muted tf-small">
                {show(v.Twin, "temp", unit("temp"))} outside, {show(v.Tih, "temp", unit("temp"))} inside: ΔT {show(vis.dTheat, "dtemp", unit("dtemp"))}. No credit for sun, people, lights or equipment.
              </span>
            </p>
            {vis.heat > 0 ? (
              (() => {
                const tot = HEAT_PARTS.reduce((a, [k]) => a + Math.max(0, vis.heatParts[k]), 0) || 1;
                return (
                  <>
                    <div className="fs-stack">
                      {HEAT_PARTS.map(([k, label, c]) => (vis.heatParts[k] > 0 ? <i key={k} style={{ width: `${(vis.heatParts[k] / tot) * 100}%`, background: c }} title={label} /> : null))}
                    </div>
                    <div className="tf-legend">
                      {HEAT_PARTS.filter(([k]) => vis.heatParts[k] > 0.5).map(([k, label, c]) => (
                        <span key={k}>
                          <i style={{ background: c }} />
                          {label} {H(vis.heatParts[k])}
                        </span>
                      ))}
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="tf-muted tf-small">The winter design temperature isn't below the heating setpoint, so there's nothing to heat.</p>
            )}
          </div>
          <div className="fs-chart">
            <h3 className="tf-visual-title">Building cooling load through the design day</h3>
            <Chart
              series={[
                { points: vis.block.map((q, k) => ({ x: k + 1, y: (q + vis.blockLat[k]) * vis.margin })), color: "#7be0c3", label: "Rooms, total" },
                { points: vis.block.map((q, k) => ({ x: k + 1, y: q * vis.margin })), color: "#5cc8ff", label: "Rooms, sensible", dashed: true },
              ]}
              x={{ label: "Solar hour", min: 1, max: 24 }}
              y={{ label: "Load", dim: "heatRate", unit: unit("heatRate"), min: 0 }}
              marker={{ x: vis.blockHour, y: (vis.block[vis.blockHour - 1] + vis.blockLat[vis.blockHour - 1]) * vis.margin }}
            />
          </div>
          <div className="fs-budget" aria-label="Where the sensible load comes from at the peak hour">
            <h3 className="tf-visual-title">Sensible room load at {hourLabel(vis.blockHour)}, by source</h3>
            {(() => {
              const tot = PARTS.reduce((a, [k]) => a + Math.max(0, vis.breakdown[k]), 0) || 1;
              return (
                <>
                  <div className="fs-stack">
                    {PARTS.map(([k, label, c]) => (vis.breakdown[k] > 0 ? <i key={k} style={{ width: `${(vis.breakdown[k] / tot) * 100}%`, background: c }} title={label} /> : null))}
                  </div>
                  <div className="tf-legend">
                    {PARTS.filter(([k]) => Math.abs(vis.breakdown[k]) > 0.5).map(([k, label, c]) => (
                      <span key={k}>
                        <i style={{ background: c }} />
                        {label} {H(vis.breakdown[k])}
                      </span>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
