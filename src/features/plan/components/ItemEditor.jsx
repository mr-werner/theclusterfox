import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";

import { activities } from "../../clocast/data/activities";
import { ITEM_KINDS, REPEATS } from "../state/planStore";
import PlaceSearch from "./PlaceSearch";

const PLACEHOLDERS = {
  event: "Dinner with friends, concert, appointment",
  task: "Renew registration, call the dentist",
  bill: "Rent, electric, phone",
  deadline: "Project due, application closes",
  training: "Long run, bike ride",
};

export default function ItemEditor({ item, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(() => ({
    kind: "event",
    title: "",
    repeat: "none",
    place: null,
    outdoor: false,
    notes: "",
    ...item,
    time: item.time ?? "",
    until: item.until ?? "",
    amount: item.amount ?? "",
    activityId: item.activityId ?? "run-easy",
    minutes: item.minutes ?? 60,
  }));
  const dialog = useRef(null);
  const set = change => setDraft(current => ({ ...current, ...change }));

  useEffect(() => {
    const node = dialog.current;
    node?.showModal?.();
    return () => node?.close?.();
  }, []);

  function submit(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.day) return;
    onSave({
      ...draft,
      title: draft.title.trim(),
      time: draft.time || null,
      until: draft.repeat !== "none" && draft.until ? draft.until : null,
      amount: draft.kind === "bill" && draft.amount !== "" ? Number(draft.amount) : null,
      activityId: draft.kind === "training" ? draft.activityId : null,
      minutes: draft.kind === "training" ? Number(draft.minutes) : null,
      place: draft.kind === "event" || draft.kind === "training" ? draft.place : null,
      outdoor: draft.kind === "event" && draft.outdoor,
    });
  }

  return (
    <dialog ref={dialog} className="pf-dialog" onCancel={onClose} aria-labelledby="pf-editor-title">
      <form onSubmit={submit} className="pf-form">
        <header className="pf-dialog-head">
          <h2 id="pf-editor-title">{item.id ? "Edit" : "Add to your calendar"}</h2>
          <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="pf-segment" role="group" aria-label="Kind">
          {ITEM_KINDS.map(kind => (
            <button key={kind.id} type="button" aria-pressed={draft.kind === kind.id} onClick={() => set({ kind: kind.id })}>
              {kind.name}
            </button>
          ))}
        </div>

        <label className="pf-field">
          <span>Title</span>
          <input value={draft.title} onChange={e => set({ title: e.target.value })} placeholder={PLACEHOLDERS[draft.kind]} required maxLength={120} autoFocus />
        </label>

        <div className="pf-field-row">
          <label className="pf-field">
            <span>{draft.kind === "bill" || draft.kind === "deadline" ? "Due" : "Date"}</span>
            <input type="date" value={draft.day} onChange={e => set({ day: e.target.value })} required />
          </label>
          <label className="pf-field">
            <span>Time (optional)</span>
            <input type="time" value={draft.time} onChange={e => set({ time: e.target.value })} />
          </label>
        </div>

        <div className="pf-field-row">
          <label className="pf-field">
            <span>Repeats</span>
            <select value={draft.repeat} onChange={e => set({ repeat: e.target.value })}>
              {REPEATS.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {draft.repeat !== "none" && (
            <label className="pf-field">
              <span>Until (optional)</span>
              <input type="date" value={draft.until} min={draft.day} onChange={e => set({ until: e.target.value })} />
            </label>
          )}
        </div>

        {draft.kind === "bill" && (
          <label className="pf-field">
            <span>Amount (optional)</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" />
          </label>
        )}

        {draft.kind === "training" && (
          <div className="pf-field-row">
            <label className="pf-field">
              <span>Activity</span>
              <select value={draft.activityId} onChange={e => set({ activityId: e.target.value })}>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Minutes</span>
              <select value={draft.minutes} onChange={e => set({ minutes: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120, 180].map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {(draft.kind === "event" || draft.kind === "training") && (
          <div className="pf-field">
            <span>Where (optional)</span>
            <PlaceSearch place={draft.place} onPick={place => set({ place })} placeholder="City or town, for weather and nearby games" allowLocate={false} allowClear />
            {draft.kind === "event" && (
              <label className="pf-check">
                <input type="checkbox" checked={draft.outdoor} onChange={e => set({ outdoor: e.target.checked })} />
                It's outside (warn me about rain and tell me what to wear)
              </label>
            )}
          </div>
        )}

        <label className="pf-field">
          <span>Notes (optional)</span>
          <textarea rows={2} value={draft.notes} onChange={e => set({ notes: e.target.value })} maxLength={1000} />
        </label>

        <footer className="pf-dialog-foot">
          {item.id && (
            <button type="button" className="pf-btn pf-btn-danger" onClick={() => onDelete(item.id)}>
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          )}
          <span className="pf-spacer" />
          <button type="button" className="pf-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="pf-btn pf-btn-primary">
            Save
          </button>
        </footer>
      </form>
    </dialog>
  );
}
