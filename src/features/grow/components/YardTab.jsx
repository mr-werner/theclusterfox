import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, TreeDeciduous, TreePine, Fence, Warehouse, RotateCw, MapPin, House } from "lucide-react";
import { PLANTS } from "../data/plants";
import { sunAdvice, sunPosition, keyDays, LIGHT, FACINGS } from "../model/sun";
import { OBJECT_KINDS, SEASONS, dayLength, houseSides, lightShares, sunGrid, sidePoint, compassName, withMapLight, lightAt } from "../model/yard";
import { doyOf } from "../model/dates";
import { PlaceSetup } from "./SettingsSheet";
import { PlantArt, RatingBadge, SunNeeds } from "./ui";
import YardMap from "./YardMap";

const FT = 3.28084;
const SOILS = [
  ["", "Not sure"],
  ["loam", "Loam (crumbly, dark)"],
  ["clay", "Clay (sticky, slow to drain)"],
  ["sand", "Sand (gritty, drains fast)"],
  ["wet", "Stays wet"],
  ["rocky", "Rocky or thin"],
];
const ADD = [
  { kind: "wing", icon: House },
  { kind: "tree", icon: TreeDeciduous },
  { kind: "evergreen", icon: TreePine },
  { kind: "fence", icon: Fence },
  { kind: "shed", icon: Warehouse },
];
const SIDES = [
  { id: "front", name: "Front of the house" },
  { id: "back", name: "Back of the house" },
  { id: "left", name: "Left side (facing the front)" },
  { id: "right", name: "Right side (facing the front)" },
  { id: "open", name: "Open yard" },
];
const COMPASS_TO_FACING = { north: "N", northeast: "NE", east: "E", southeast: "SE", south: "S", southwest: "SW", west: "W", northwest: "NW" };

// A new wing sits against the house's right side, flush with the front: an L.
function wingSpot(yard) {
  const a = (yard.facing * Math.PI) / 180;
  const u = yard.depth / 2 - 3;
  const v = yard.width / 2 + 3;
  const r = n => Math.round(n * 10) / 10;
  return [r(u * Math.sin(a) + v * Math.cos(a)), r(u * Math.cos(a) - v * Math.sin(a))];
}

const hm = h => `${Math.floor(h)} h ${Math.round((h % 1) * 60)} m`;
const pct = n => `${Math.round(n * 100)}%`;

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
      <YardCard g={g} />
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

function YardCard({ g }) {
  const { yard, sunLat, data } = g;
  const units = data.prefs.units;
  const [season, setSeason] = useState("season");
  const [selected, setSelected] = useState(null);
  const grid = useMemo(() => (season === "season" ? g.yardGrid : sunGrid(yard, sunLat, season)), [season, g.yardGrid, yard, sunLat]);
  const shares = useMemo(() => lightShares(grid), [grid]);
  const sides = useMemo(() => houseSides(yard, sunLat, season).filter(s => s.hours != null), [yard, sunLat, season]);
  const spots = useMemo(() => withMapLight(data.spots, grid), [data.spots, grid]);
  const open = lightAt(grid, ...Object.values(sidePoint(yard, "open")));
  const obj = yard.objects.find(o => o.id === selected) ?? null;
  const spot = data.spots.find(s => s.id === selected) ?? null;

  const move = (id, x, y) => {
    if (yard.objects.some(o => o.id === id)) g.updateObject(id, { x, y });
    else g.updateSpot(id, { x, y });
  };
  const add = kind => {
    const n = yard.objects.length;
    const spotFor = { tree: [-8 + (n % 3) * 3, 9], evergreen: [9, 9 - (n % 3) * 3], fence: [0, 13.5], shed: [-10, -9], wing: wingSpot(yard) }[kind];
    const at = { x: spotFor[0], y: spotFor[1], ...(kind === "fence" ? { angle: 90, len: 20 } : kind === "wing" ? { angle: yard.facing } : {}) };
    const id = g.addObject(kind, at);
    setSelected(id);
  };

  return (
    <section className="gf-card gf-yardcard">
      <div className="gf-card-head">
        <h2>Your yard's sun map</h2>
        <div className="gf-seg gf-seg--small" role="group" aria-label="Time of year">
          {Object.entries(SEASONS).map(([id, s]) => (
            <button key={id} type="button" className={season === id ? "on" : ""} onClick={() => setSeason(id)}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
      {!data.yard && <p className="gf-callout">This is a typical house with its front facing south. Turn and size it to match yours, then add the trees, fences and sheds that shade your yard.</p>}
      <div className="gf-yard-grid">
        <div className="gf-yard-mapcol">
          <YardMap yard={yard} grid={grid} latitude={sunLat} season={season} spots={spots} selected={selected} onSelect={setSelected} onMove={move} editable units={units} />
          <div className="gf-legend gf-legend--map" aria-label="Legend">
            {["full", "part", "shade"].map(l => (
              <span key={l}>
                <i className={`gf-ym-key gf-ym-key--${l}`} aria-hidden="true" /> {LIGHT[l].name} <em>{pct(shares[l])}</em>
              </span>
            ))}
            <span>
              <i className="gf-ym-key gf-ym-key--sun" aria-hidden="true" /> Sun's path
            </span>
          </div>
          <p className="gf-hint">
            Hours of direct sun a day ({SEASONS[season].name.toLowerCase()}), from the sun's real path at {Math.abs(sunLat).toFixed(1)}°{sunLat >= 0 ? "N" : "S"} every 15 minutes. Drag trees, fences, sheds and your spots to where they really are. Each square is about {units === "metric" ? "80 cm" : "2½ ft"} across.
          </p>
        </div>

        <div className="gf-yard-tools">
          {obj ? (
            <ObjectEditor key={obj.id} g={g} o={obj} units={units} onDone={() => setSelected(null)} />
          ) : spot ? (
            <div className="gf-tool">
              <h3>
                <MapPin size={16} aria-hidden="true" /> {spot.name}
              </h3>
              <p className="gf-hint">Drag the pin to move this spot. Edit its name, soil and light under Your spots.</p>
              <button type="button" className="gf-btn gf-btn--ghost gf-btn--small" onClick={() => setSelected(null)}>
                Done
              </button>
            </div>
          ) : (
            <HouseEditor g={g} units={units} />
          )}

          <div className="gf-tool">
            <h3>Shape your house and add what casts shade</h3>
            <div className="gf-add-objects">
              {ADD.map(({ kind, icon: Icon }) => (
                <button key={kind} type="button" className="gf-btn gf-btn--ghost gf-btn--small" onClick={() => add(kind)} disabled={yard.objects.length >= 40}>
                  <Icon size={16} aria-hidden="true" /> {OBJECT_KINDS[kind].name}
                </button>
              ))}
            </div>
          </div>

          <div className="gf-tool">
            <h3>Beside the house</h3>
            <ul className="gf-sides">
              {sides.map(s => (
                <li key={s.id}>
                  <strong>
                    {s.name} <small>faces {s.compass}</small>
                  </strong>
                  <span>{s.hours == null ? "–" : `${s.hours.toFixed(1)} h`}</span>
                  <span className={`gf-light gf-light--${s.light}`}>{LIGHT[s.light].name}</span>
                </li>
              ))}
              {open && (
                <li>
                  <strong>Open yard out front</strong>
                  <span>{open.hours.toFixed(1)} h</span>
                  <span className={`gf-light gf-light--${open.light}`}>{LIGHT[open.light].name}</span>
                </li>
              )}
            </ul>
            <p className="gf-hint">A bed about 4 ft out from each wall. Neighbors' houses and trees off the map still cut these down.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LenInput({ label, meters, onChange, units, min, max }) {
  const [text, setText] = useState(null);
  const ft = units !== "metric";
  const shown = ft ? Math.round(meters * FT * 2) / 2 : Math.round(meters * 10) / 10;
  return (
    <label>
      <span>{label}</span>
      <span className="gf-unit-input">
        <input
          type="number"
          inputMode="decimal"
          step={ft ? 1 : 0.5}
          min={ft ? Math.ceil(min * FT) : min}
          max={ft ? Math.floor(max * FT) : max}
          value={text ?? shown}
          onChange={e => {
            setText(e.target.value);
            const v = Number(e.target.value);
            const m = ft ? v / FT : v;
            if (e.target.value !== "" && Number.isFinite(m) && m >= min && m <= max) onChange(Math.round(m * 100) / 100);
          }}
          onBlur={() => setText(null)}
        />
        <em>{ft ? "ft" : "m"}</em>
      </span>
    </label>
  );
}

function HouseEditor({ g, units }) {
  const { yard } = g;
  const nearest = FACINGS.reduce((a, f) => (Math.abs(((yard.facing - f.deg + 540) % 360) - 180) < Math.abs(((yard.facing - a.deg + 540) % 360) - 180) ? f : a));
  return (
    <div className="gf-tool gf-form">
      <h3 className="gf-wide">Your house (main block)</h3>
      <label>
        <span>Front door faces</span>
        <select value={FACINGS.some(f => f.deg === yard.facing) ? yard.facing : ""} onChange={e => e.target.value !== "" && g.setYard({ facing: Number(e.target.value) })}>
          {!FACINGS.some(f => f.deg === yard.facing) && <option value="">About {nearest.name.toLowerCase()} ({yard.facing}°)</option>}
          {FACINGS.map(f => (
            <option key={f.id} value={f.deg}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>
          <RotateCw size={13} aria-hidden="true" /> Fine turn: {yard.facing}° ({compassName(yard.facing)})
        </span>
        <input type="range" min="0" max="355" step="5" value={yard.facing} onChange={e => g.setYard({ facing: Number(e.target.value) })} />
      </label>
      <LenInput label="Width (along the front)" meters={yard.width} min={3} max={40} units={units} onChange={v => g.setYard({ width: v })} />
      <LenInput label="Depth (front to back)" meters={yard.depth} min={3} max={40} units={units} onChange={v => g.setYard({ depth: v })} />
      <LenInput label="Height to the roof peak" meters={yard.height} min={2} max={20} units={units} onChange={v => g.setYard({ height: v })} />
      <p className="gf-hint">Stand at your front door and look out: that's the way it faces. A phone compass helps. Not a plain box? Add a house wing below for each garage, addition or porch to trace its shape.</p>
    </div>
  );
}

function ObjectEditor({ g, o, units, onDone }) {
  const kind = OBJECT_KINDS[o.kind];
  const set = p => g.updateObject(o.id, p);
  return (
    <div className="gf-tool gf-form">
      <h3 className="gf-wide">{kind.name}</h3>
      <LenInput label="Height" meters={o.h} min={0.3} max={40} units={units} onChange={v => set({ h: v })} />
      {(o.kind === "tree" || o.kind === "evergreen") && <LenInput label="Canopy across" meters={o.r * 2} min={0.6} max={30} units={units} onChange={v => set({ r: v / 2 })} />}
      {o.kind === "fence" && <LenInput label="Length" meters={o.len} min={0.5} max={40} units={units} onChange={v => set({ len: v })} />}
      {(o.kind === "shed" || o.kind === "wing") && (
        <>
          <LenInput label="Width" meters={o.w} min={0.5} max={20} units={units} onChange={v => set({ w: v })} />
          <LenInput label="Depth" meters={o.d} min={0.5} max={20} units={units} onChange={v => set({ d: v })} />
        </>
      )}
      {o.kind !== "tree" && o.kind !== "evergreen" && (
        <label>
          <span>
            <RotateCw size={13} aria-hidden="true" /> Turn: {Math.round(((o.angle % 180) + 180) % 180)}°
          </span>
          <input type="range" min="0" max="175" step="5" value={Math.round(((o.angle % 180) + 180) % 180)} onChange={e => set({ angle: Number(e.target.value) })} />
        </label>
      )}
      <p className="gf-hint">{kind.leaf === "deciduous" ? "Leafy trees let some light through in summer and drop their leaves in winter. " : o.kind === "wing" ? "A garage, addition or porch joined to the house. Use a few to trace an L, T or U shape. " : ""}Drag it on the map, or select it and use the arrow keys.</p>
      <div className="gf-form-actions">
        <button type="button" className="gf-btn gf-btn--small" onClick={onDone}>
          Done
        </button>
        <button
          type="button"
          className="gf-btn gf-btn--danger gf-btn--small"
          onClick={() => {
            g.removeObject(o.id);
            onDone();
          }}
        >
          <Trash2 size={15} aria-hidden="true" /> Remove
        </button>
      </div>
    </div>
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
