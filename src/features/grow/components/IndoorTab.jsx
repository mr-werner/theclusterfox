import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, PawPrint, FlaskConical, ChevronRight } from "lucide-react";
import { INDOOR_PLANTS, SPECIALTY_PLANTS } from "../data/plants";
import { AIR, DISTANCES, INDOOR_LIGHT, LIGHT_ORDER, WINDOWS, roomLight } from "../model/indoor";
import { IndoorLight, PlantArt, RatingBadge } from "./ui";

// The indoor garden: your home's air and pets, the spots by your windows,
// and the houseplants that suit each one.
export default function IndoorTab({ g }) {
  return (
    <div className="gf-indoor">
      <div className="gf-plants-head">
        <h1>Indoors</h1>
        <p className="gf-hint">Your indoor garden: houseplants, windowsill herbs and grows under lights. Tell GrowFox about your windows and your home, and it rates every houseplant for each spot, just like it does for your yard.</p>
      </div>
      <HomeCard g={g} />
      <Rooms g={g} />
      <BestByLight g={g} />
      <SpecialtyCard g={g} />
    </div>
  );
}

function HomeCard({ g }) {
  const { home } = g.data;
  return (
    <section className="gf-card">
      <h2>Your home</h2>
      <div className="gf-home-grid">
        <div>
          <span className="gf-label">Air indoors</span>
          <div className="gf-seg" role="group" aria-label="Indoor air">
            {AIR.map(a => (
              <button key={a.id} type="button" className={home.air === a.id ? "on" : ""} onClick={() => g.setHome({ air: a.id })} title={a.hint}>
                {a.name}
              </button>
            ))}
          </div>
          <p className="gf-hint">{AIR.find(a => a.id === home.air)?.hint}. Ferns, calatheas and orchids want humid air; succulents want it dry.</p>
        </div>
        <label className="gf-toggle gf-pets-toggle">
          <input type="checkbox" checked={home.pets} onChange={e => g.setHome({ pets: e.target.checked })} />
          <PawPrint size={16} aria-hidden="true" /> Cats, dogs or small children at home
        </label>
      </div>
      {home.pets && <p className="gf-hint">Plants that are toxic to pets are flagged on every card. Filter to pet-safe ones in Plants → Indoor.</p>}
    </section>
  );
}

function Rooms({ g }) {
  const [editing, setEditing] = useState(null);
  return (
    <section className="gf-card">
      <div className="gf-card-head">
        <h2>Your indoor spots</h2>
        <button type="button" className="gf-btn gf-btn--small" onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" /> Add a spot
        </button>
      </div>
      {!g.rooms.length && editing !== "new" && <p className="gf-hint">Name the places you keep plants: "Kitchen sill", "Living room corner", "Grow tent". Pick the window they're near and GrowFox works out the light there and the plants that fit.</p>}
      {editing === "new" && <RoomForm g={g} onDone={() => setEditing(null)} />}
      <div className="gf-spot-list">
        {g.rooms.map(r => (editing === r.id ? <RoomForm key={r.id} g={g} room={r} onDone={() => setEditing(null)} /> : <RoomCard key={r.id} g={g} room={r} onEdit={() => setEditing(r.id)} />))}
      </div>
    </section>
  );
}

function picksFor(g, light, n = 6) {
  return INDOOR_PLANTS.map(p => ({ p, r: g.indoorRating(p, light) }))
    .filter(x => x.r.score <= 2 && x.p.light[0] === light && (!g.data.home.pets || x.p.petSafe))
    .sort((a, b) => a.r.score - b.r.score || a.p.name.localeCompare(b.p.name))
    .slice(0, n);
}

function RoomCard({ g, room, onEdit }) {
  const picks = useMemo(() => picksFor(g, room.lightId), [g, room.lightId]);
  const growing = g.data.garden.filter(e => e.roomId === room.id).length;
  const win = WINDOWS.find(w => w.id === room.window);
  return (
    <article className="gf-spot">
      <header>
        <div>
          <h3>{room.name}</h3>
          <p>
            {win?.name}
            {room.window !== "grow" && room.window !== "none" && ` · ${DISTANCES.find(d => d.id === room.distance)?.name.toLowerCase()}`} · <span className={`gf-light gf-light--in-${room.lightId}`}>{INDOOR_LIGHT[room.lightId].name} light</span>
            {growing > 0 && ` · ${growing} growing`}
          </p>
          <p className="gf-hint">{room.lightInfo.why}.</p>
        </div>
        <button type="button" className="gf-icon-btn" onClick={onEdit} aria-label={`Edit ${room.name}`}>
          <Pencil size={16} />
        </button>
      </header>
      {picks.length > 0 && (
        <>
          <h4>Easy picks for this spot{g.data.home.pets ? " (pet safe)" : ""}</h4>
          <div className="gf-picks">
            {picks.map(({ p, r }) => (
              <button key={p.id} type="button" className="gf-pick" onClick={() => g.openPlant(p.id)}>
                <PlantArt plant={p} size={30} />
                <span>{p.name}</span>
                <RatingBadge result={r} compact />
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className="gf-link" onClick={() => g.go({ tab: "plants", view: "indoor", room: room.id })}>
        Browse everything that fits
      </button>
    </article>
  );
}

function RoomForm({ g, room, onDone }) {
  const [name, setName] = useState(room?.name ?? "");
  const [win, setWin] = useState(room?.window ?? "S");
  const [distance, setDistance] = useState(room?.distance ?? "near");
  const [light, setLight] = useState(room?.light ?? "");
  const auto = roomLight({ window: win, distance }, g.hemisphere);
  const shown = light || auto.id;
  const save = () => {
    const value = { name: name.trim() || "Indoor spot", window: win, distance, light };
    if (room) g.updateRoom(room.id, value);
    else g.addRoom(value);
    onDone();
  };
  const hasWindow = win !== "grow" && win !== "none";
  return (
    <div className="gf-form gf-spot-form">
      <label>
        <span>Name</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Kitchen windowsill" maxLength={60} />
      </label>
      <label>
        <span>Nearest window</span>
        <select value={win} onChange={e => setWin(e.target.value)}>
          {WINDOWS.map(w => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      {hasWindow && (
        <label>
          <span>How close?</span>
          <select value={distance} onChange={e => setDistance(e.target.value)}>
            {DISTANCES.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="gf-wide">
        <span className="gf-label">Light {!light && <em>(from the window: {auto.why.toLowerCase()})</em>}</span>
        <div className="gf-seg" role="group" aria-label="Light">
          {LIGHT_ORDER.slice().reverse().map(id => (
            <button key={id} type="button" className={shown === id ? "on" : ""} onClick={() => setLight(id === auto.id ? "" : id)} title={INDOOR_LIGHT[id].hint}>
              <IndoorLight light={[id]} /> {INDOOR_LIGHT[id].name}
            </button>
          ))}
        </div>
        <p className="gf-hint">{INDOOR_LIGHT[shown].hint}. Trees, porches or a building outside the window? Pick less light.</p>
      </div>
      <div className="gf-form-actions">
        <button type="button" className="gf-btn" onClick={save}>
          {room ? "Save" : "Add spot"}
        </button>
        <button type="button" className="gf-btn gf-btn--ghost" onClick={onDone}>
          Cancel
        </button>
        {room && (
          <button
            type="button"
            className="gf-btn gf-btn--danger"
            onClick={() => {
              g.removeRoom(room.id);
              onDone();
            }}
          >
            <Trash2 size={16} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

// Without rooms set up (or as a quick reference): the easiest plants for each light level.
function BestByLight({ g }) {
  const columns = useMemo(() => LIGHT_ORDER.slice().reverse().map(l => ({ l, picks: picksFor(g, l, 5) })), [g]);
  return (
    <section className="gf-card">
      <div className="gf-card-head">
        <h2>Easiest for your home</h2>
        <button type="button" className="gf-link" onClick={() => g.go({ tab: "plants", view: "indoor" })}>
          All houseplants <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="gf-light-cols">
        {columns.map(({ l, picks }) => (
          <div key={l}>
            <h4>
              <IndoorLight light={[l]} /> {INDOOR_LIGHT[l].name} light
            </h4>
            <p className="gf-hint">{INDOOR_LIGHT[l].hint}</p>
            {picks.length ? (
              <ul className="gf-light-list">
                {picks.map(({ p, r }) => (
                  <li key={p.id}>
                    <button type="button" className="gf-pick" onClick={() => g.openPlant(p.id)}>
                      <PlantArt plant={p} size={30} />
                      <span>{p.name}</span>
                      <RatingBadge result={r} compact />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gf-hint">Nothing easy for this light with your settings.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SpecialtyCard({ g }) {
  const indoorish = SPECIALTY_PLANTS.filter(p => p.setting !== "outdoor");
  return (
    <section className="gf-card gf-specialty-teaser">
      <FlaskConical size={26} aria-hidden="true" />
      <div>
        <h2>Specialty grows</h2>
        <p>Step-by-step guides for {indoorish.map(p => p.name.toLowerCase()).join(", ")} and more: each stage, how to harvest, how to store it, and how to stay safe. Some are illegal in many places, so each guide starts with what to know about the law.</p>
        <button type="button" className="gf-btn" onClick={() => g.go({ tab: "plants", view: "specialty" })}>
          See specialty guides
        </button>
      </div>
    </section>
  );
}
