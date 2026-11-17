import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PLANTS } from "../data/plants";
import { sunAdvice, sunPosition, keyDays, LIGHT, FACINGS } from "../model/sun";
import { dayLength, houseSides, sidePoint, lightAt } from "../model/yard";
import { doyOf } from "../model/dates";
import { PlaceSetup } from "./SettingsSheet";
import { PlantArt, RatingBadge, SunNeeds } from "./ui";
import YardEditor from "./YardEditor";

const SOILS = [
  ["", "Not sure"],
  ["loam", "Loam (crumbly, dark)"],
  ["clay", "Clay (sticky, slow to drain)"],
  ["sand", "Sand (gritty, drains fast)"],
  ["wet", "Stays wet"],
  ["rocky", "Rocky or thin"],
];
const SIDES = [
  { id: "front", name: "Front of the house" },
  { id: "back", name: "Back of the house" },
  { id: "left", name: "Left side (facing the front)" },
  { id: "right", name: "Right side (facing the front)" },
  { id: "open", name: "Open yard" },
];
const COMPASS_TO_FACING = { north: "N", northeast: "NE", east: "E", southeast: "SE", south: "S", southwest: "SW", west: "W", northwest: "NW" };

const hm = h => `${Math.floor(h)} h ${Math.round((h % 1) * 60)} m`;

export default function YardTab({ g }) {
  const { data } = g;
  const hasPlace = data.place != null;
  return (
    <div className="gf-yard">
      <div className="gf-plants-head">
        <h1>Sun & spots</h1>
        <p className="gf-hint">Where the sun falls on your property, worked out for your exact latitude: the house, trees, fences and sheds all cast real shadows.</p>
      </div>
      {hasPlace ? (
        <SunHere g={g} />
      ) : (
        <section className="gf-card">
          <h2>Where's your garden?</h2>
          <p className="gf-hint">Set your town for sun worked out from your latitude. Until then the map uses a typical {data.hemisphere === "S" ? "southern" : "northern"} hemisphere yard.</p>
          <PlaceSetup g={g} compact />
        </section>
      )}
      <YardEditor g={g} />
      <Spots g={g} />
    </div>
  );
}

// Day length and sun height for the user's own latitude.
function SunHere({ g }) {
  const lat = g.sunLat;
  const days = keyDays(lat);
  const today = doyOf(g.todayNum);
  const advice = sunAdvice(lat);
  const noon = doy => Math.max(0, Math.round(sunPosition(lat, doy, 12).alt));
  const stats = [
    { name: "Today", value: hm(dayLength(lat, today)), hint: `of daylight, noon sun ${noon(today)}° up` },
    { name: `Longest day · ${days.summer.name}`, value: hm(dayLength(lat, days.summer.doy)), hint: `noon sun ${noon(days.summer.doy)}° up` },
    { name: `Shortest day · ${days.winter.name}`, value: hm(dayLength(lat, days.winter.doy)), hint: `noon sun ${noon(days.winter.doy)}° up` },
  ];
  return (
    <section className="gf-card gf-sunhere">
      <h2>
        Sun at {g.data.place.name} · {Math.abs(lat).toFixed(1)}°{lat >= 0 ? "N" : "S"}
      </h2>
      <div className="gf-sun-stats">
        {stats.map(s => (
          <div key={s.name}>
            <small>{s.name}</small>
            <strong>{s.value}</strong>
            <span>{s.hint}</span>
          </div>
        ))}
      </div>
      <p className="gf-hint">{advice.line} The farther from the equator, the bigger the swing: the map below uses your latitude, so a north wall in Seattle and one in Miami come out very differently.</p>
    </section>
  );
}

function Spots({ g }) {
  const { data } = g;
  const [editing, setEditing] = useState(null); // spot id or "new"
  return (
    <section className="gf-card">
      <div className="gf-card-head">
        <h2>Your spots</h2>
        <button type="button" className="gf-btn gf-btn--small" onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" /> Add a spot
        </button>
      </div>
      {!data.spots.length && editing !== "new" && <p className="gf-hint">Name the places you plant: "Front bed", "Back fence", "Under the oak". Each spot gets a pin on the sun map, takes its light from it, and shows the plants that fit.</p>}
      {editing === "new" && <SpotForm g={g} onDone={() => setEditing(null)} />}
      <div className="gf-spot-list">
        {data.spots.map((s, i) =>
          editing === s.id ? <SpotForm key={s.id} g={g} spot={s} onDone={() => setEditing(null)} /> : <SpotCard key={s.id} g={g} spot={s} n={i + 1} onEdit={() => setEditing(s.id)} />
        )}
      </div>
    </section>
  );
}

function SpotCard({ g, spot, n, onEdit }) {
  const picks = useMemo(
    () =>
      PLANTS.map(p => ({ p, r: g.ratingFor(p, spot.light) }))
        .filter(x => x.r.score <= 2 && x.p.type !== "grass" && (spot.light === "full" ? x.p.sun[0] === "full" : spot.light === "shade" ? x.p.sun.includes("shade") && !x.p.sun.includes("full") : x.p.sun.includes("part")))
        .sort((a, b) => a.r.score - b.r.score)
        .slice(0, 6),
    [g, spot.light]
  );
  const where = spot.x != null ? (spot.mapHours != null ? `${spot.mapHours.toFixed(1)} h of sun on the map` : "On the map") : spot.facing === "open" ? "Open ground" : `${FACINGS.find(f => f.id === spot.facing)?.name} side`;
  const growing = g.data.garden.filter(e => e.spotId === spot.id).length;
  return (
    <article className="gf-spot">
      <header>
        <div>
          <h3>
            {spot.x != null && <span className={`gf-pin-num gf-pin-num--${spot.light}`}>{n}</span>}
            {spot.name}
          </h3>
          <p>
            {where} · <span className={`gf-light gf-light--${spot.light}`}>{LIGHT[spot.light].name}</span>
            {spot.x != null && !spot.auto && " (set by hand)"}
            {spot.soil && ` · ${SOILS.find(s => s[0] === spot.soil)?.[1].split(" (")[0]}`}
            {growing > 0 && ` · ${growing} planted`}
          </p>
        </div>
        <button type="button" className="gf-icon-btn" onClick={onEdit} aria-label={`Edit ${spot.name}`}>
          <Pencil size={16} />
        </button>
      </header>
      {picks.length > 0 && (
        <>
          <h4>Easy picks for this spot</h4>
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
      <button type="button" className="gf-link" onClick={() => g.go({ tab: "plants" })}>
        Browse everything that fits
      </button>
    </article>
  );
}

function SpotForm({ g, spot, onDone }) {
  const { yard, yardGrid } = g;
  const [name, setName] = useState(spot?.name ?? "");
  const [side, setSide] = useState(spot?.x != null ? "map" : "front");
  const [light, setLight] = useState(spot?.light ?? "full");
  const [auto, setAuto] = useState(spot ? spot.auto || spot.x == null : true);
  const [soil, setSoil] = useState(spot?.soil ?? "");
  const point = side === "map" ? { x: spot.x, y: spot.y } : sidePoint(yard, side);
  const mapped = lightAt(yardGrid, point.x, point.y);
  const shownLight = auto && mapped ? mapped.light : light;
  const facing = side === "open" || side === "map" ? spot?.facing ?? "open" : COMPASS_TO_FACING[houseSides(yard, g.sunLat).find(s => s.id === side)?.compass] ?? "open";

  const save = () => {
    const value = { name: name.trim() || "Garden spot", facing, light: shownLight, auto: Boolean(auto && mapped), x: point.x, y: point.y, soil };
    if (spot) g.updateSpot(spot.id, value);
    else g.addSpot(value);
    onDone();
  };
  return (
    <div className="gf-form gf-spot-form">
      <label>
        <span>Name</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Front bed" maxLength={60} />
      </label>
      <label>
        <span>Where is it?</span>
        <select value={side} onChange={e => setSide(e.target.value)}>
          {spot?.x != null && <option value="map">Where I put it on the map</option>}
          {SIDES.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="gf-label">
          Light {auto && mapped && <em>(from the sun map: {mapped.hours.toFixed(1)} h of direct sun)</em>}
        </span>
        <div className="gf-seg" role="group" aria-label="Light">
          {Object.entries(LIGHT).map(([id, l]) => (
            <button
              key={id}
              type="button"
              className={shownLight === id ? "on" : ""}
              onClick={() => {
                setLight(id);
                setAuto(false);
              }}
              title={l.hint}
            >
              <SunNeeds sun={[id]} /> {l.name}
            </button>
          ))}
        </div>
        <p className="gf-hint">
          {auto ? "Drag the pin on the map later to fine-tune. A neighbor's house or a tree off the map in the way? Pick less light." : "Set by hand. "}
          {!auto && mapped && (
            <button type="button" className="gf-link" onClick={() => setAuto(true)}>
              Use the map's {LIGHT[mapped.light].name.toLowerCase()} instead
            </button>
          )}
        </p>
      </div>
      <label>
        <span>Soil</span>
        <select value={soil} onChange={e => setSoil(e.target.value)}>
          {SOILS.map(([id, n]) => (
            <option key={id} value={id}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="gf-form-actions">
        <button type="button" className="gf-btn" onClick={save}>
          {spot ? "Save" : "Add spot"}
        </button>
        <button type="button" className="gf-btn gf-btn--ghost" onClick={onDone}>
          Cancel
        </button>
        {spot && (
          <button
            type="button"
            className="gf-btn gf-btn--danger"
            onClick={() => {
              g.removeSpot(spot.id);
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
