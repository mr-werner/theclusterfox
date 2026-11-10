import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { PLANTS, TYPES } from "../data/plants";
import { cadence } from "../model/care";
import { isPlantableNow } from "../model/calendar";
import { PlantArt, RatingBadge, SunNeeds } from "./ui";

const LIGHTS = [
  ["", "Any light"],
  ["full", "Full sun"],
  ["part", "Part sun"],
  ["shade", "Shade"],
];

export function PlantCard({ g, plant, light = null }) {
  const r = g.climate ? g.ratingFor(plant, light) : null;
  const water = cadence(plant, g.climate).find(c => c.id === "water");
  const type = TYPES.find(t => t.id === plant.type);
  return (
    <button type="button" className="gf-packet" onClick={() => g.openPlant(plant.id)} style={{ "--tint": plant.color }}>
      <span className="gf-packet-art">
        <PlantArt plant={plant} size={72} />
      </span>
      <span className="gf-packet-body">
        <small>{type.one}</small>
        <strong>{plant.name}</strong>
        <em>{plant.latin}</em>
        <span className="gf-packet-meta">
          <SunNeeds sun={plant.sun} />
          <span className="gf-water">Water: {water.word.toLowerCase()}</span>
        </span>
        {r && <RatingBadge result={r} />}
      </span>
    </button>
  );
}

export default function PlantsTab({ g }) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState("");
  const [type, setType] = useState(params.get("type") ?? "");
  const [light, setLight] = useState("");
  const [spotId, setSpotId] = useState("");
  const [now, setNow] = useState(params.get("now") === "1");
  const [easy, setEasy] = useState(false);
  const [lowCare, setLowCare] = useState(false);
  const [showUnsuited, setShowUnsuited] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { climate, todayNum } = g;

  const spot = g.spotsById.get(spotId);
  const activeLight = spot ? spot.light : light || null;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLANTS.filter(p => !type || p.type === type)
      .filter(p => !q || `${p.name} ${p.latin} ${p.type} ${p.tags.join(" ")}`.toLowerCase().includes(q))
      .filter(p => !activeLight || p.sun.includes(activeLight))
      .filter(p => !now || !climate || isPlantableNow(p, climate, todayNum))
      .filter(p => !lowCare || cadence(p, climate).every(c => c.word !== "Daily" && (c.id !== "water" || c.word !== "Weekly")))
      .map(p => ({ p, r: climate ? g.ratingFor(p, activeLight) : null }))
      .filter(x => !easy || !x.r || x.r.score <= 2)
      .sort((a, b) => (a.r && b.r ? a.r.score - b.r.score : 0) || a.p.name.localeCompare(b.p.name));
  }, [query, type, activeLight, now, lowCare, easy, climate, todayNum, g]);

  const suited = list.filter(x => !x.r || x.r.score < 6);
  const unsuited = list.filter(x => x.r && x.r.score === 6);
  const activeCount = [light || spotId, now, easy, lowCare].filter(Boolean).length;

  return (
    <div className="gf-plants">
      <div className="gf-plants-head">
        <h1>Plants {climate ? "for your area" : ""}</h1>
        <p className="gf-hint">{climate ? "Sorted from easiest to hardest to keep alive where you live." : "Set your place to see how each one does where you live."}</p>
      </div>
      <div className="gf-toolbar">
        <div className="gf-search">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tomato, maple, shade…" aria-label="Search plants" />
        </div>
        <button type="button" className={`gf-btn gf-btn--ghost${activeCount ? " on" : ""}`} onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={16} aria-hidden="true" /> Filters{activeCount ? ` · ${activeCount}` : ""}
        </button>
      </div>
      <div className="gf-chips" role="group" aria-label="Plant type">
        <button type="button" className={!type ? "on" : ""} onClick={() => setType("")}>
          All
        </button>
        {TYPES.map(t => (
          <button key={t.id} type="button" className={type === t.id ? "on" : ""} onClick={() => setType(type === t.id ? "" : t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {filtersOpen && (
        <div className="gf-filters">
          <label>
            <span>Light</span>
            <select value={light} onChange={e => { setLight(e.target.value); setSpotId(""); }}>
              {LIGHTS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {g.data.spots.length > 0 && (
            <label>
              <span>Fits my spot</span>
              <select value={spotId} onChange={e => { setSpotId(e.target.value); setLight(""); }}>
                <option value="">Any spot</option>
                {g.data.spots.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="gf-toggle">
            <input type="checkbox" checked={now} onChange={e => setNow(e.target.checked)} /> Can plant now
          </label>
          <label className="gf-toggle">
            <input type="checkbox" checked={easy} onChange={e => setEasy(e.target.checked)} /> Easy here
          </label>
          <label className="gf-toggle">
            <input type="checkbox" checked={lowCare} onChange={e => setLowCare(e.target.checked)} /> Low care (no daily jobs)
          </label>
        </div>
      )}
      <p className="gf-count-line">{suited.length} plants</p>
      <div className="gf-grid">
        {suited.map(({ p }) => (
          <PlantCard key={p.id} g={g} plant={p} light={activeLight} />
        ))}
      </div>
      {unsuited.length > 0 && (
        <div className="gf-unsuited">
          <button type="button" className="gf-btn gf-btn--ghost" onClick={() => setShowUnsuited(s => !s)} aria-expanded={showUnsuited}>
            {showUnsuited ? "Hide" : "Show"} {unsuited.length} that won't last here
          </button>
          {showUnsuited && (
            <div className="gf-grid">
              {unsuited.map(({ p }) => (
                <PlantCard key={p.id} g={g} plant={p} light={activeLight} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
