import { useRef, useState } from "react";
import { Download, FileJson, Pencil, Plus, Printer, Trash2, Upload } from "lucide-react";

import { DROPZONES, dzById } from "../data/dropzones";
import { estimateFreefall, fmtFreefall, fromBackup, fromCsv, mergeJumps, nextNumber, toBackup, toCsv, totals } from "../model/logbook";
import { cleanJump, JUMP_TYPES, newId, sortJumps } from "../state/jumpStore";
import { download, fmtDay, localDay } from "./format";

const typeName = id => JUMP_TYPES.find(t => t.id === id)?.name ?? id;

// The logbook: log a jump in a few taps, see your totals, and download it
// (spreadsheet, backup, or a printable page) so it's never only in this browser.
export default function LogbookTab({ j }) {
  const { data, patch } = j;
  const t = totals(data);
  const [editing, setEditing] = useState(null); // jump being edited, or "new"
  const [message, setMessage] = useState("");
  const file = useRef(null);

  function save(jump) {
    const clean = cleanJump(jump);
    if (!clean) return;
    patch(d => ({ jumps: sortJumps([...d.jumps.filter(x => x.id !== clean.id), clean]) }));
    setEditing(null);
    setMessage(`Jump #${clean.number} saved.`);
  }

  function remove(jump) {
    if (!window.confirm(`Delete jump #${jump.number}?`)) return;
    patch(d => ({ jumps: d.jumps.filter(x => x.id !== jump.id) }));
  }

  async function load(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      if (/\.json$/i.test(f.name) || text.trim().startsWith("{")) {
        const backup = fromBackup(text);
        const merged = mergeJumps(data.jumps, backup.jumps);
        patch(d => ({ ...backup, homeDz: d.homeDz ?? backup.homeDz, jumps: merged.jumps, plans: [...d.plans, ...backup.plans.filter(p => !d.plans.some(x => x.id === p.id))], events: [...d.events, ...backup.events.filter(p => !d.events.some(x => x.id === p.id))] }));
        setMessage(`Backup loaded: ${merged.added} jumps added${merged.skipped ? `, ${merged.skipped} already here` : ""}.`);
      } else {
        const merged = mergeJumps(data.jumps, fromCsv(text));
        patch({ jumps: merged.jumps });
        setMessage(`${merged.added} jumps added${merged.skipped ? `, ${merged.skipped} already here` : ""}.`);
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  const stamp = localDay();
  return (
    <div className="jf-stack jf-logbook">
      <section className="jf-card jf-hero jf-noprint">
        <div className="jf-hero-text">
          <p className="jf-kicker">Logbook</p>
          <h1>Every jump, kept safe</h1>
          <p>Log jumps here, then download your logbook as a spreadsheet, a backup file or a printable page. It's saved in this browser, so download a copy now and then.</p>
          <div className="jf-row">
            <button type="button" className="jf-btn" onClick={() => setEditing("new")}>
              <Plus size={16} aria-hidden="true" /> Log a jump
            </button>
          </div>
        </div>
        <div className="jf-hero-tools jf-hero-stats">
          <div><span>Jumps</span><strong>{t.jumps}</strong></div>
          <div><span>Freefall</span><strong>{fmtFreefall(t.freefallSec)}</strong></div>
          <div><span>Drop zones</span><strong>{t.dzCount}</strong></div>
          <div><span>Last jump</span><strong>{t.lastDate ? fmtDay(t.lastDate) : "–"}</strong></div>
        </div>
      </section>

      {message && <p className="jf-note jf-noprint" role="status">{message}</p>}

      {editing && <JumpForm key={editing === "new" ? "new" : editing.id} data={data} jump={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}

      <section className="jf-card jf-noprint">
        <h2>Download and restore</h2>
        <div className="jf-row">
          <button type="button" className="jf-btn is-small is-ghost" onClick={() => download(`jumpfox-logbook-${stamp}.csv`, toCsv(data.jumps), "text/csv")} disabled={!data.jumps.length}>
            <Download size={14} aria-hidden="true" /> Spreadsheet (CSV)
          </button>
          <button type="button" className="jf-btn is-small is-ghost" onClick={() => download(`jumpfox-backup-${stamp}.json`, toBackup(data), "application/json")}>
            <FileJson size={14} aria-hidden="true" /> Full backup (JSON)
          </button>
          <button type="button" className="jf-btn is-small is-ghost" onClick={() => window.print()} disabled={!data.jumps.length}>
            <Printer size={14} aria-hidden="true" /> Print or save as PDF
          </button>
          <button type="button" className="jf-btn is-small is-ghost" onClick={() => file.current?.click()}>
            <Upload size={14} aria-hidden="true" /> Load a file
          </button>
          <input ref={file} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={load} />
        </div>
        <Profile data={data} patch={patch} />
      </section>

      <div className="jf-print-head">
        <h1>Skydiving logbook</h1>
        <p>
          {data.profile.name || "—"}
          {data.profile.uspa && ` · USPA #${data.profile.uspa}`}
          {data.profile.license && ` · ${data.profile.license}`} · {t.jumps} jumps · {fmtFreefall(t.freefallSec)} freefall · printed {fmtDay(stamp)}
        </p>
      </div>

      {data.jumps.length ? (
        <div className="jf-table-wrap">
          <table className="jf-table jf-log-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Drop zone</th>
                <th>Aircraft</th>
                <th>Exit / pull</th>
                <th>Freefall</th>
                <th>Type</th>
                <th>Notes</th>
                <th>Signed</th>
                <th className="jf-noprint"><span className="jf-sr">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {data.jumps.map(jump => (
                <tr key={jump.id}>
                  <td className="jf-num">{jump.number}</td>
                  <td>{jump.date}</td>
                  <td>{jump.dzName || dzById[jump.dzId]?.name || ""}</td>
                  <td>{jump.aircraft}</td>
                  <td>{jump.exitFt.toLocaleString("en-US")} / {jump.pullFt.toLocaleString("en-US")}</td>
                  <td>{jump.freefallSec ? `${jump.freefallSec} s` : "–"}</td>
                  <td>{typeName(jump.type)}{jump.canopy ? ` · ${jump.canopy}` : ""}{jump.distanceM != null ? ` · ${jump.distanceM} m` : ""}</td>
                  <td className="jf-notes">{jump.notes}</td>
                  <td>{jump.signedBy}</td>
                  <td className="jf-noprint jf-actions">
                    <button type="button" className="jf-icon-btn" aria-label={`Edit jump ${jump.number}`} onClick={() => { setEditing(jump); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="jf-icon-btn" aria-label={`Delete jump ${jump.number}`} onClick={() => remove(jump)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !editing && (
          <section className="jf-card jf-empty jf-noprint">
            <p>No jumps logged yet. If you've jumped before, put your earlier jump count and freefall time under Your details so license progress counts them.</p>
          </section>
        )
      )}
    </div>
  );
}

function Profile({ data, patch }) {
  const set = (group, k) => e => patch(d => ({ [group]: { ...d[group], [k]: group === "prior" ? Math.max(0, Number(e.target.value) || 0) : e.target.value } }));
  return (
    <details className="jf-profile">
      <summary>Your details (shown on the printed logbook)</summary>
      <div className="jf-form-grid">
        <label className="jf-field"><span>Name</span><input value={data.profile.name} onChange={set("profile", "name")} autoComplete="name" /></label>
        <label className="jf-field"><span>USPA number</span><input value={data.profile.uspa} onChange={set("profile", "uspa")} inputMode="numeric" /></label>
        <label className="jf-field"><span>License</span><input value={data.profile.license} onChange={set("profile", "license")} placeholder="e.g. A-123456" /></label>
        <label className="jf-field"><span>Jumps before JumpFox</span><input type="number" min={0} value={data.prior.jumps} onChange={set("prior", "jumps")} /></label>
        <label className="jf-field"><span>Freefall minutes before JumpFox</span><input type="number" min={0} value={data.prior.freefallMin} onChange={set("prior", "freefallMin")} /></label>
      </div>
    </details>
  );
}

function JumpForm({ data, jump, onSave, onCancel }) {
  const last = data.jumps[0];
  const [v, setV] = useState(() =>
    jump ?? {
      id: newId("j"),
      number: nextNumber(data),
      date: localDay(),
      dzId: last?.dzId || data.homeDz || "",
      dzName: last?.dzName || dzById[data.homeDz]?.name || "",
      aircraft: last?.aircraft || dzById[data.homeDz]?.aircraft?.find(a => a !== "turbine") || "",
      exitFt: last?.exitFt ?? data.exitFt,
      pullFt: last?.pullFt ?? data.pullFt,
      type: last?.type || "solo",
      canopy: last?.canopy || "",
      distanceM: "",
      notes: "",
      signedBy: "",
      freefallSec: null,
    }
  );
  const [autoFf, setAutoFf] = useState(!jump);
  const ff = autoFf ? estimateFreefall(Number(v.exitFt), Number(v.pullFt), v.type) : v.freefallSec;
  const set = k => e => setV(x => ({ ...x, [k]: e.target.value }));
  function pickDz(e) {
    const dz = dzById[e.target.value];
    setV(x => ({ ...x, dzId: e.target.value, dzName: dz?.name ?? x.dzName, aircraft: dz?.aircraft?.find(a => a !== "turbine") ?? x.aircraft }));
  }
  return (
    <form
      className="jf-card jf-jump-form"
      onSubmit={e => {
        e.preventDefault();
        onSave({ ...v, freefallSec: ff ?? 0 });
      }}
    >
      <h2>{jump ? `Edit jump #${jump.number}` : "Log a jump"}</h2>
      <div className="jf-form-grid">
        <label className="jf-field"><span>Jump #</span><input type="number" min={1} value={v.number} onChange={set("number")} required /></label>
        <label className="jf-field"><span>Date</span><input type="date" value={v.date} onChange={set("date")} required /></label>
        <label className="jf-field">
          <span>Drop zone</span>
          <select value={dzById[v.dzId] ? v.dzId : ""} onChange={pickDz}>
            <option value="">Other (type below)</option>
            {DROPZONES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {!dzById[v.dzId] && <label className="jf-field"><span>Drop zone name</span><input value={v.dzName} onChange={set("dzName")} /></label>}
        <label className="jf-field"><span>Aircraft</span><input value={v.aircraft} onChange={set("aircraft")} placeholder="Twin Otter" /></label>
        <label className="jf-field">
          <span>Type</span>
          <select value={v.type} onChange={set("type")}>
            {JUMP_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="jf-field"><span>Exit (ft)</span><input type="number" step={500} value={v.exitFt} onChange={set("exitFt")} /></label>
        <label className="jf-field"><span>Pull (ft)</span><input type="number" step={500} value={v.pullFt} onChange={set("pullFt")} /></label>
        <label className="jf-field">
          <span>Freefall (s) {autoFf && <em className="jf-muted">estimated</em>}</span>
          <input type="number" min={0} value={ff ?? ""} onChange={e => { setAutoFf(false); setV(x => ({ ...x, freefallSec: e.target.value })); }} />
        </label>
        <label className="jf-field"><span>Canopy</span><input value={v.canopy} onChange={set("canopy")} placeholder="Sabre3 170" /></label>
        <label className="jf-field"><span>Distance from target (m)</span><input type="number" min={0} value={v.distanceM ?? ""} onChange={set("distanceM")} /></label>
        <label className="jf-field"><span>Signed by</span><input value={v.signedBy} onChange={set("signedBy")} placeholder="Name and license #" /></label>
        <label className="jf-field is-wide"><span>Notes</span><textarea rows={3} value={v.notes} onChange={set("notes")} placeholder="What you did, what went well, what to work on" /></label>
      </div>
      <div className="jf-row">
        <button type="submit" className="jf-btn">Save jump</button>
        <button type="button" className="jf-btn is-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
