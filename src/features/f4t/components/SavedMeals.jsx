import { useEffect, useState } from "react";
import { Save, Copy, Trash2 } from "lucide-react";

const STORAGE_KEY = "f4t-saved-meals-v1";
function loadMeals() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function cloneMealItems(items) {
  // Retain USDA food data and serving sizes, but create fresh React item IDs.
  return items.map(item => ({ ...item, id: crypto.randomUUID() }));
}

/** Requires the same meal and setMeal state already used by F4TPage. */
export default function SavedMeals({ meal, setMeal }) {
  const [saved, setSaved] = useState(loadMeals);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {}
  }, [saved]);
  const selected = saved.find(m => m.id === selectedId);
  const canSave = Array.isArray(meal) && meal.length > 0;
  function saveNew() {
    const label = name.trim();
    if (!canSave || !label) return;
    const entry = { id: crypto.randomUUID(), name: label, items: cloneMealItems(meal), updatedAt: new Date().toISOString() };
    setSaved(prev => [...prev, entry]);
    setSelectedId(entry.id);
  }
  function updateSelected() {
    if (!selected || !canSave) return;
    setSaved(prev => prev.map(m => m.id === selectedId
      ? { ...m, name: name.trim() || m.name, items: cloneMealItems(meal), updatedAt: new Date().toISOString() }
      : m));
  }
  function loadSelected() {
    if (!selected) return;
    // Replaces current meal intentionally; confirmation avoids losing unsaved edits.
    if (meal.length && !window.confirm(`Replace the current meal with "${selected.name}"?`)) return;
    setMeal(cloneMealItems(selected.items));
    setName(selected.name);
  }
  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} (copy)`, items: cloneMealItems(selected.items), updatedAt: new Date().toISOString() };
    setSaved(prev => [...prev, copy]);
    setSelectedId(copy.id);
    setName(copy.name);
  }
  function deleteSelected() {
    if (!selected || !window.confirm(`Delete saved meal "${selected.name}"?`)) return;
    setSaved(prev => prev.filter(m => m.id !== selectedId));
    setSelectedId("");
    setName("");
  }
  return (
    <section aria-label="Saved meals" style={{ margin: "20px 0" }}>
      <h3>Saved meals</h3>
      <p>Save your food selections and serving sizes for later.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <select aria-label="Choose saved meal" value={selectedId} onChange={e => {
          const id = e.target.value;
          setSelectedId(id);
          setName(saved.find(m => m.id === id)?.name || "");
        }}>
          <option value="">Select a saved meal</option>
          {saved.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button type="button" disabled={!selected} onClick={loadSelected}>Load meal</button>
        <button type="button" disabled={!selected} onClick={duplicateSelected} title="Duplicate saved meal"><Copy size={16} /> Duplicate</button>
        <button type="button" disabled={!selected} onClick={deleteSelected} title="Delete saved meal"><Trash2 size={16} /> Delete</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input aria-label="Meal name" placeholder="Meal name" value={name} onChange={e => setName(e.target.value)} />
        <button type="button" disabled={!canSave || !name.trim()} onClick={saveNew}><Save size={16} /> Save new</button>
        <button type="button" disabled={!selected || !canSave} onClick={updateSelected}>Update saved meal</button>
      </div>
      <small>Changes to the current meal are not saved until you select Save new or Update saved meal. Stored only in this browser.</small>
    </section>
  );
}
