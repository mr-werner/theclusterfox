import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Trees, Armchair, FlaskConical, Scale } from "lucide-react";
import { PLANTS, TYPES, INDOOR_PLANTS, INDOOR_TYPES, SPECIALTY_PLANTS, SPECIALTY_TYPES, LAW_NOTICE, typeOf } from "../data/plants";
import { INDOOR_LIGHT, LIGHT_ORDER } from "../model/indoor";
import AddToStudy from "../../../components/AddToStudy";
import { cadence } from "../model/care";
import { isPlantableNow } from "../model/calendar";
import { IndoorLight, LawChip, PlantArt, RatingBadge, SunNeeds } from "./ui";

const LIGHTS = [
  ["", "Any light"],
  ["full", "Full sun"],
  ["part", "Part sun"],
  ["shade", "Shade"],
];

/** indoor: show indoor light and the indoor rating (light is then an indoor light level). */
export function PlantCard({ g, plant, light = null, indoor: asked }) {
  // Grows either way: show whichever suits you better, outside or in.
  const out = plant.setting !== "indoor" && g.climate ? g.ratingFor(plant, light) : null;
  const inn = plant.setting !== "outdoor" && plant.light ? g.indoorRating(plant, asked ? light : null) : null;
  const indoor = asked ?? (plant.setting === "indoor" || (inn != null && (!out || inn.score < out.score)));
  const r = indoor ? inn : out;
  const water = cadence(plant, indoor ? null : g.climate).find(c => c.id === "water");
  const type = typeOf(plant);
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
          {indoor ? <IndoorLight light={plant.light} /> : <SunNeeds sun={plant.sun} />}
          <span className="gf-water">Water: {water.word.toLowerCase()}</span>
        </span>
        <span className="gf-packet-badges">
          {r && <RatingBadge result={r} />}
          {plant.legal === "restricted" && <LawChip />}
          {indoor && g.data.home.pets && plant.petSafe === false && <span className="gf-pet-chip">Toxic to pets</span>}
        </span>
      </span>
    </button>
  );
}

const VIEWS = [
  { id: "outdoor", name: "Outdoor", icon: Trees },
  { id: "indoor", name: "Indoor", icon: Armchair },
  { id: "specialty", name: "Specialty", icon: FlaskConical },
];

export default function PlantsTab({ g }) {
  const params = new URLSearchParams(window.location.search);
  const view = VIEWS.some(v => v.id === params.get("view")) ? params.get("view") : "outdoor";
  return (
    <>
      <div className="gf-seg gf-view-switch" role="group" aria-label="Which garden">
        {VIEWS.map(v => {
          const Icon = v.icon;
          return (
            <button key={v.id} type="button" className={view === v.id ? "on" : ""} aria-pressed={view === v.id} onClick={() => g.go({ tab: "plants", view: v.id === "outdoor" ? null : v.id })}>
              <Icon size={16} aria-hidden="true" /> {v.name}
            </button>
          );
        })}
      </div>
      {view === "outdoor" && <OutdoorPlants g={g} />}
      {view === "indoor" && <IndoorPlants key="indoor" g={g} />}
      {view === "specialty" && <SpecialtyPlants g={g} />}
    </>
  );
}

function OutdoorPlants({ g }) {
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
        <AddToStudy app="growfox" deck={type || "kinds"} title={type ? TYPES.find(t => t.id === type)?.name ?? "Plants" : "Sort plants by kind"} />
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

function IndoorPlants({ g }) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [light, setLight] = useState("");
  const [roomId, setRoomId] = useState(params.get("room") ?? "");
  const [petSafe, setPetSafe] = useState(g.data.home.pets);
  const [easy, setEasy] = useState(false);
  const room = g.roomsById.get(roomId);
  const activeLight = room ? room.lightId : light || null;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INDOOR_PLANTS.filter(p => !type || p.type === type)
      .filter(p => !q || `${p.name} ${p.latin} ${p.type} ${p.tags.join(" ")}`.toLowerCase().includes(q))
      .filter(p => !petSafe || p.petSafe)
      .map(p => ({ p, r: g.indoorRating(p, activeLight) }))
      .filter(x => !easy || x.r.score <= 2)
      .sort((a, b) => a.r.score - b.r.score || a.p.name.localeCompare(b.p.name));
  }, [query, type, petSafe, easy, activeLight, g]);
  const suited = list.filter(x => x.r.score < 6);
  const unsuited = list.filter(x => x.r.score === 6);

  return (
    <div className="gf-plants">
      <div className="gf-plants-head">
        <h1>Houseplants{room ? ` for ${room.name}` : ""}</h1>
        <p className="gf-hint">Sorted from easiest to hardest for your home{activeLight ? ` in ${INDOOR_LIGHT[activeLight].name.toLowerCase()} light` : ""}. Set your windows, air and pets on the Indoors tab.</p>
      </div>
      <div className="gf-toolbar">
        <div className="gf-search">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pothos, fern, succulent…" aria-label="Search houseplants" />
        </div>
      </div>
      <div className="gf-chips" role="group" aria-label="Houseplant type">
        <button type="button" className={!type ? "on" : ""} onClick={() => setType("")}>
          All
        </button>
        {INDOOR_TYPES.map(t => (
          <button key={t.id} type="button" className={type === t.id ? "on" : ""} onClick={() => setType(type === t.id ? "" : t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="gf-filters">
        <label>
          <span>Light</span>
          <select value={light} onChange={e => { setLight(e.target.value); setRoomId(""); }}>
            <option value="">Any light</option>
            {LIGHT_ORDER.slice().reverse().map(id => (
              <option key={id} value={id}>
                {INDOOR_LIGHT[id].name} light
              </option>
            ))}
          </select>
        </label>
        {g.rooms.length > 0 && (
          <label>
            <span>Fits my spot</span>
            <select value={roomId} onChange={e => { setRoomId(e.target.value); setLight(""); }}>
              <option value="">Any spot</option>
              {g.rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} · {INDOOR_LIGHT[r.lightId].name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="gf-toggle">
          <input type="checkbox" checked={petSafe} onChange={e => setPetSafe(e.target.checked)} /> Pet safe only
        </label>
        <label className="gf-toggle">
          <input type="checkbox" checked={easy} onChange={e => setEasy(e.target.checked)} /> Easy here
        </label>
      </div>
      <p className="gf-count-line">{suited.length} houseplants</p>
      <div className="gf-grid">
        {suited.map(({ p }) => (
          <PlantCard key={p.id} g={g} plant={p} light={activeLight} indoor />
        ))}
      </div>
      {unsuited.length > 0 && (
        <details className="gf-unsuited">
          <summary className="gf-btn gf-btn--ghost">{unsuited.length} too dark for this spot</summary>
          <div className="gf-grid">
            {unsuited.map(({ p }) => (
              <PlantCard key={p.id} g={g} plant={p} light={activeLight} indoor />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SpecialtyPlants({ g }) {
  const [type, setType] = useState("");
  const list = SPECIALTY_PLANTS.filter(p => !type || p.type === type);
  return (
    <div className="gf-plants">
      <div className="gf-plants-head">
        <h1>Specialty grows</h1>
        <p className="gf-hint">Mushrooms and plants that take more than a care tag: each one has a stage-by-stage guide to growing, harvesting and storing it safely.</p>
      </div>
      <aside className="gf-law-banner" role="note">
        <Scale size={20} aria-hidden="true" />
        <div>
          <strong>Check your local law first.</strong> Cannabis and psilocybin mushrooms are illegal to grow in many countries, states and cities, even for personal use, and the penalties can be serious. {LAW_NOTICE}
        </div>
      </aside>
      <div className="gf-chips" role="group" aria-label="Specialty type">
        <button type="button" className={!type ? "on" : ""} onClick={() => setType("")}>
          All
        </button>
        {SPECIALTY_TYPES.map(t => (
          <button key={t.id} type="button" className={type === t.id ? "on" : ""} onClick={() => setType(type === t.id ? "" : t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="gf-grid">
        {list.map(p => (
          <PlantCard key={p.id} g={g} plant={p} />
        ))}
      </div>
    </div>
  );
}
