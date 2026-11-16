import { useMemo, useState } from "react";
import { Copy, Trash2, TreeDeciduous, TreePine, Fence, Warehouse, RotateCw, MapPin, House, Square, RectangleHorizontal, Shovel, Mountain, Grid3x3, Flower2, Search, X, Sun, CloudSun, Map as MapIcon } from "lucide-react";
import { PLANTS, plantsById } from "../data/plants";
import { LIGHT, FACINGS } from "../model/sun";
import { OBJECT_KINDS, SEASONS, HOUSE_SHAPES, MAX_OBJECTS, houseSides, lightShares, sunGrid, shadowGrid, daylightHours, sidePoint, compassName, withMapLight, lightAt, shapeHouse, turnHouse, isTreeKind, localPoint } from "../model/yard";
import { areaOf } from "../model/upkeep";
import { RatingBadge, PlantArt } from "./ui";
import { PlantCare, LawnTips } from "./Upkeep";
import YardMap from "./YardMap";

const FT = 3.28084;
const pct = n => `${Math.round(n * 100)}%`;
const EVERGREEN_TREES = new Set(["whitepine", "spruce", "magnolia", "olive"]);
const GRASSES = PLANTS.filter(p => p.type === "grass");

const SHADE_MAKERS = [
  { kind: "tree", icon: TreeDeciduous },
  { kind: "evergreen", icon: TreePine },
  { kind: "fence", icon: Fence },
  { kind: "shed", icon: Warehouse },
  { kind: "wing", icon: House },
];
const GROUND = [
  { kind: "lawn", icon: Grid3x3 },
  { kind: "bed", icon: Shovel },
  { kind: "raised", icon: RectangleHorizontal },
  { kind: "mulch", icon: Square },
  { kind: "rocks", icon: Mountain },
  { kind: "patio", icon: Grid3x3 },
];
const MODES = [
  { id: "hours", name: "Sun hours", icon: Sun },
  { id: "moment", name: "Shadows", icon: CloudSun },
  { id: "plan", name: "Plan", icon: MapIcon },
];

// Plant spacing like "18–24 in" or "3–4 ft" → a spread radius in meters.
function spreadOf(plant) {
  const m = /(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*(in|ft)/.exec(`${plant.spacing} ${plant.size}`);
  if (!m) return 0.3;
  const n = Number(m[2] ?? m[1]);
  const meters = m[3] === "ft" ? n / FT : n / 39.37;
  return Math.max(0.15, Math.min(6, meters / 2));
}
const hourLabel = h => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
};

export default function YardEditor({ g }) {
  const { yard, sunLat, data } = g;
  const units = data.prefs.units;
  const [mode, setMode] = useState("hours");
  const [season, setSeason] = useState("season");
  const [hour, setHour] = useState(15);
  const [selected, setSelected] = useState(null);
  const [picking, setPicking] = useState(null); // { x, y } where a new plant goes

  const grid = useMemo(() => (season === "season" ? g.yardGrid : sunGrid(yard, sunLat, season)), [season, g.yardGrid, yard, sunLat]);
  const moment = useMemo(() => (mode === "moment" ? shadowGrid(yard, sunLat, season, hour) : null), [mode, yard, sunLat, season, hour]);
  const daylight = useMemo(() => daylightHours(sunLat, season), [sunLat, season]);
  const shares = useMemo(() => lightShares(grid), [grid]);
  const sides = useMemo(() => houseSides(yard, sunLat, season).filter(s => s.hours != null), [yard, sunLat, season]);
  const spots = useMemo(() => withMapLight(data.spots, grid), [data.spots, grid]);
  const obj = yard.objects.find(o => o.id === selected) ?? null;
  const spot = data.spots.find(s => s.id === selected) ?? null;
  const full = yard.objects.length >= MAX_OBJECTS;

  const setYard = next => g.setYard(() => next);
  const select = id => {
    setSelected(id);
    setPicking(null);
  };
  const remove = id => {
    const o = yard.objects.find(x => x.id === id);
    if (o?.entryId) g.removeEntry(o.entryId);
    g.removeObject(id);
    setSelected(null);
  };
  const duplicate = id => {
    const o = yard.objects.find(x => x.id === id);
    if (!o || full) return;
    const copy = { ...o, x: Math.min(19, o.x + 1.5), y: Math.max(-19, o.y - 1.5) };
    delete copy.id;
    if (o.entryId) {
      const e = data.garden.find(x => x.id === o.entryId);
      copy.entryId = g.addEntry({ plantId: o.plantId, status: "growing", planted: e?.planted ?? g.today, qty: 1 });
    }
    const newId = g.addObject(o.kind, copy);
    setSelected(newId);
  };
  const onAction = (action, id) => (action === "delete" ? remove(id) : duplicate(id));

  // Where new things land: around the front of the house, spread out a little.
  const dropPoint = (extra = 0) => {
    const p = sidePoint(yard, "open");
    const n = yard.objects.length % 5;
    return { x: Math.max(-18, Math.min(18, p.x + (n - 2) * 2 + extra)), y: Math.max(-18, Math.min(18, p.y + (n % 2) * 1.5)) };
  };
  const add = kind => {
    if (full) return;
    let at = dropPoint();
    if (kind === "fence") at = { x: yard.cx ?? 0, y: Math.min(18.5, (yard.cy ?? 0) + yard.depth / 2 + 8), angle: 90, len: 20 };
    if (kind === "wing") {
      const turned = shapeHouse(yard, "garage", () => "probe").objects.at(-1);
      at = { x: turned.x, y: turned.y, angle: yard.facing };
    }
    if (kind === "tree") at = { ...at, x: at.x - 6, y: at.y + 2 };
    if (kind === "evergreen") at = { ...at, x: at.x + 6, y: at.y + 2 };
    if (kind === "lawn") {
      const grass = GRASSES.map(p => ({ p, s: g.ratingFor(p).score })).sort((a, b) => a.s - b.s)[0].p;
      const entryId = g.addEntry({ plantId: grass.id, status: "growing", planted: null, qty: 1 });
      at = { ...at, plantId: grass.id, entryId };
    }
    setSelected(g.addObject(kind, at));
    setPicking(null);
  };
  const addPlant = (plant, where) => {
    if (full) return;
    const entryId = g.addEntry({ plantId: plant.id, status: "growing", planted: g.today, qty: 1 });
    const at = where ?? dropPoint();
    const kind = plant.type === "tree" ? (EVERGREEN_TREES.has(plant.id) ? "evergreen" : "tree") : "plant";
    const extra = kind === "plant" ? { r: spreadOf(plant) } : { r: 2.5, h: 6 };
    setSelected(g.addObject(kind, { ...at, ...extra, plantId: plant.id, entryId }));
    setPicking(null);
  };

  const legend =
    mode === "hours" ? (
      <>
        {["full", "part", "shade"].map(l => (
          <span key={l}>
            <i className={`gf-ym-key gf-ym-key--${l}`} aria-hidden="true" /> {LIGHT[l].name} <em>{pct(shares[l])}</em>
          </span>
        ))}
      </>
    ) : mode === "moment" ? (
      <>
        <span>
          <i className="gf-ym-key gf-ym-key--dark" aria-hidden="true" /> Shadow
        </span>
        <span>
          <i className="gf-ym-key gf-ym-key--dapple" aria-hidden="true" /> Dappled
        </span>
      </>
    ) : null;

  return (
    <section className="gf-card gf-yardcard">
      <div className="gf-card-head">
        <h2>Your yard</h2>
        <div className="gf-seg gf-seg--small" role="group" aria-label="What the map shows">
          {MODES.map(({ id, name, icon: Icon }) => (
            <button key={id} type="button" className={mode === id ? "on" : ""} onClick={() => setMode(id)}>
              <Icon size={14} aria-hidden="true" /> {name}
            </button>
          ))}
        </div>
      </div>
      {!data.yard && <p className="gf-callout">This is a typical house facing south. Drag it, turn it and pick its shape to match yours, then add your trees, fences, lawn, beds and plants. Everything you place gets real shade from your latitude.</p>}

      <div className="gf-yard-grid">
        <div className="gf-yard-mapcol">
          {mode !== "plan" && (
            <div className="gf-map-bar">
              <div className="gf-seg gf-seg--small" role="group" aria-label="Time of year">
                {Object.entries(SEASONS).map(([id, s]) => (
                  <button key={id} type="button" className={season === id ? "on" : ""} onClick={() => setSeason(id)}>
                    {s.name}
                  </button>
                ))}
              </div>
              {mode === "moment" && daylight && (
                <label className="gf-time">
                  <span>{hourLabel(Math.max(daylight.rise, Math.min(daylight.set, hour)))}</span>
                  <input type="range" min={Math.ceil(daylight.rise * 4) / 4} max={Math.floor(daylight.set * 4) / 4} step="0.25" value={Math.max(daylight.rise, Math.min(daylight.set, hour))} onChange={e => setHour(Number(e.target.value))} aria-label="Time of day" />
                </label>
              )}
            </div>
          )}
          <YardMap
            yard={yard}
            latitude={sunLat}
            mode={mode}
            grid={grid}
            moment={moment}
            season={season}
            spots={spots}
            selected={selected}
            onSelect={select}
            onYard={setYard}
            onSpot={(id, x, y) => g.updateSpot(id, { x, y })}
            onAction={onAction}
            editable
            units={units}
            showSun={mode !== "plan"}
          />
          {legend && (
            <div className="gf-legend gf-legend--map" aria-label="Legend">
              {legend}
              <span>
                <i className="gf-ym-key gf-ym-key--sun" aria-hidden="true" /> Sun's path
              </span>
            </div>
          )}
          <p className="gf-hint">
            {mode === "hours"
              ? `Hours of direct sun a day (${SEASONS[season].name.toLowerCase()}) at ${Math.abs(sunLat).toFixed(1)}°${sunLat >= 0 ? "N" : "S"}, from the sun's path every 15 minutes.`
              : mode === "moment"
                ? moment
                  ? `Shadows at ${hourLabel(hour)} sun time, ${SEASONS[season].name.toLowerCase()}: the sun is ${Math.round(moment.alt)}° up in the ${compassName(moment.az)}.`
                  : "The sun is down at that hour."
                : "Your plan, without the sun layer."}{" "}
            Tap anything to select it, drag to move it, use the corner knob to resize and the round knob to turn it. Ctrl or ⌘ + scroll zooms; drag the background to pan once zoomed in.
          </p>
        </div>

        <div className="gf-yard-tools">
          {picking ? (
            <PlantPicker g={g} onPick={p => addPlant(p, picking.at)} onClose={() => setPicking(null)} />
          ) : selected === "house" ? (
            <HouseEditor g={g} units={units} onDone={() => setSelected(null)} />
          ) : obj ? (
            <ObjectEditor key={obj.id} g={g} o={obj} grid={grid} units={units} full={full} onDone={() => setSelected(null)} onRemove={() => remove(obj.id)} onDuplicate={() => duplicate(obj.id)} onPlantHere={at => setPicking({ at })} />
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
            <div className="gf-tool">
              <h3>Tap anything on the map to edit it</h3>
              <p className="gf-hint">Start with the house: tap it to set which way the front door faces, its size and its shape.</p>
              <button type="button" className="gf-btn gf-btn--small" onClick={() => setSelected("house")}>
                <House size={15} aria-hidden="true" /> Edit the house
              </button>
            </div>
          )}

          <div className="gf-tool">
            <h3>House shape</h3>
            <div className="gf-add-objects">
              {HOUSE_SHAPES.map(s => (
                <button key={s.id} type="button" className="gf-btn gf-btn--ghost gf-btn--small" onClick={() => setYard(shapeHouse(yard, s.id, g.newId))}>
                  <ShapeIcon id={s.id} /> {s.name}
                </button>
              ))}
            </div>
            <p className="gf-hint">Pick the closest shape, then drag the corner knobs to size each part. "Attached garage" adds to what's there.</p>
          </div>

          <div className="gf-tool">
            <h3>Add to your yard</h3>
            <h4>What casts shade</h4>
            <div className="gf-add-objects">
              {SHADE_MAKERS.map(({ kind, icon: Icon }) => (
                <button key={kind} type="button" className={`gf-btn gf-btn--ghost gf-btn--small gf-add--${kind}`} onClick={() => add(kind)} disabled={full}>
                  <Icon size={16} aria-hidden="true" /> {OBJECT_KINDS[kind].name}
                </button>
              ))}
            </div>
            <h4>Ground</h4>
            <div className="gf-add-objects">
              {GROUND.map(({ kind, icon: Icon }) => (
                <button key={kind} type="button" className={`gf-btn gf-btn--ghost gf-btn--small gf-add--${kind}`} onClick={() => add(kind)} disabled={full}>
                  <Icon size={16} aria-hidden="true" /> {OBJECT_KINDS[kind].name}
                </button>
              ))}
            </div>
            <h4>Plants you have</h4>
            <button type="button" className="gf-btn gf-btn--small" onClick={() => setPicking({ at: null })} disabled={full}>
              <Flower2 size={16} aria-hidden="true" /> Add a plant to the map
            </button>
            {full && <p className="gf-hint">That's the most a yard can hold ({MAX_OBJECTS} things).</p>}
          </div>

          <div className="gf-tool">
            <h3>Beside the house</h3>
            <ul className="gf-sides">
              {sides.map(s => (
                <li key={s.id}>
                  <strong>
                    {s.name} <small>faces {s.compass}</small>
                  </strong>
                  <span>{s.hours.toFixed(1)} h</span>
                  <span className={`gf-light gf-light--${s.light}`}>{LIGHT[s.light].name}</span>
                </li>
              ))}
            </ul>
            <p className="gf-hint">A bed about 4 ft out from each wall, {SEASONS[season].name.toLowerCase()}. Neighbors' houses and trees off the map still cut these down.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShapeIcon({ id }) {
  const d = {
    box: "M3 5h10v7H3z",
    L: "M3 4h10v5H8v4H3z",
    T: "M2 4h12v4H10v5H6V8H2z",
    U: "M2 4h12v9h-4V8H6v5H2z",
    garage: "M2 5h8v7H2zM10 7h4v5h-4z",
  }[id];
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="gf-shape-icon">
      <path d={d} />
    </svg>
  );
}

export function LenInput({ label, meters, onChange, units, min, max }) {
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
          step={ft ? 0.5 : 0.1}
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

function TurnInput({ label, value, onChange, half = false }) {
  const v = half ? ((Math.round(value) % 180) + 180) % 180 : ((Math.round(value) % 360) + 360) % 360;
  return (
    <label className="gf-wide">
      <span>
        <RotateCw size={13} aria-hidden="true" /> {label}: {v}°{half ? "" : ` (${compassName(v)})`}
      </span>
      <input type="range" min="0" max={half ? 175 : 355} step="5" value={v - (v % 5)} onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}

function Actions({ onDone, onDuplicate, onRemove, full }) {
  return (
    <div className="gf-form-actions gf-wide">
      <button type="button" className="gf-btn gf-btn--small" onClick={onDone}>
        Done
      </button>
      {onDuplicate && (
        <button type="button" className="gf-btn gf-btn--ghost gf-btn--small" onClick={onDuplicate} disabled={full} title="Duplicate (Ctrl/⌘ + D)">
          <Copy size={15} aria-hidden="true" /> Duplicate
        </button>
      )}
      {onRemove && (
        <button type="button" className="gf-btn gf-btn--danger gf-btn--small" onClick={onRemove} title="Remove (Delete key)">
          <Trash2 size={15} aria-hidden="true" /> Remove
        </button>
      )}
    </div>
  );
}

function HouseEditor({ g, units, onDone }) {
  const { yard } = g;
  const wings = yard.objects.filter(o => o.kind === "wing").length;
  const nearest = FACINGS.reduce((a, f) => (Math.abs(((yard.facing - f.deg + 540) % 360) - 180) < Math.abs(((yard.facing - a.deg + 540) % 360) - 180) ? f : a));
  const face = f => g.setYard(y => turnHouse(y, f));
  return (
    <div className="gf-tool gf-form">
      <h3 className="gf-wide">
        <House size={16} aria-hidden="true" /> Your house
      </h3>
      <label>
        <span>Front door faces</span>
        <select value={FACINGS.some(f => f.deg === yard.facing) ? yard.facing : ""} onChange={e => e.target.value !== "" && face(Number(e.target.value))}>
          {!FACINGS.some(f => f.deg === yard.facing) && <option value="">About {nearest.name.toLowerCase()} ({yard.facing}°)</option>}
          {FACINGS.map(f => (
            <option key={f.id} value={f.deg}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <LenInput label="Height to the roof peak" meters={yard.height} min={2} max={20} units={units} onChange={v => g.setYard({ height: v })} />
      <TurnInput label="Fine turn" value={yard.facing} onChange={face} />
      <LenInput label="Width (along the front)" meters={yard.width} min={3} max={40} units={units} onChange={v => g.setYard({ width: v })} />
      <LenInput label="Depth (front to back)" meters={yard.depth} min={3} max={40} units={units} onChange={v => g.setYard({ depth: v })} />
      <p className="gf-hint gf-wide">
        Stand at the front door and look out: that's the way it faces. Drag the house to move it{wings ? " (its wings come along)" : ""}, the corner knob to size it and the round knob to turn it. The map's turn buttons put any side at the top, like "street at the bottom".
      </p>
      <div className="gf-form-actions gf-wide">
        <button type="button" className="gf-btn gf-btn--small" onClick={onDone}>
          Done
        </button>
        <button type="button" className="gf-btn gf-btn--ghost gf-btn--small" onClick={() => g.setYard({ turn: (yard.facing + 180) % 360 })}>
          Street at the bottom
        </button>
      </div>
    </div>
  );
}

function ObjectEditor({ g, o, grid, units, full, onDone, onRemove, onDuplicate, onPlantHere }) {
  const kind = OBJECT_KINDS[o.kind];
  const set = p => g.updateObject(o.id, p);
  const plant = o.plantId ? plantsById.get(o.plantId) : null;
  const entry = o.entryId ? g.data.garden.find(e => e.id === o.entryId) : null;
  const here = lightAt(grid, o.x, o.y);
  const actions = <Actions onDone={onDone} onDuplicate={onDuplicate} onRemove={onRemove} full={full} />;

  if (o.kind === "plant" && plant) {
    return (
      <div className="gf-tool gf-form">
        <h3 className="gf-wide gf-tool-plant">
          <PlantArt plant={plant} size={30} /> {plant.name}
          {g.climate && here && <RatingBadge result={g.ratingFor(plant, here.light)} compact />}
        </h3>
        <LenInput label="Spread" meters={o.r * 2} min={0.2} max={12} units={units} onChange={v => set({ r: v / 2 })} />
        <label>
          <span>Planted</span>
          <input type="date" value={entry?.planted ?? ""} max={g.today} onChange={e => entry && g.updateEntry(entry.id, { planted: e.target.value || null })} />
        </label>
        <div className="gf-wide">
          <PlantCare g={g} plant={plant} entry={entry} hours={here?.hours ?? null} />
          <button type="button" className="gf-link" onClick={() => g.openPlant(plant.id)}>
            Everything about {plant.name.toLowerCase()}
          </button>
        </div>
        {actions}
      </div>
    );
  }

  const lawn = o.kind === "lawn";
  const grass = lawn ? plantsById.get(o.plantId) ?? GRASSES[0] : null;
  const inside = o.kind === "bed" || o.kind === "raised" ? g.yard.objects.filter(p => p.kind === "plant" && insideGround(o, p)) : [];
  return (
    <div className="gf-tool gf-form">
      <h3 className="gf-wide">
        {o.kind === "evergreen" ? <TreePine size={16} aria-hidden="true" /> : o.kind === "tree" ? <TreeDeciduous size={16} aria-hidden="true" /> : null}
        {plant && isTreeKind(o.kind) ? `${plant.name} (${kind.name.toLowerCase()})` : kind.name}
      </h3>
      {isTreeKind(o.kind) && (
        <div className="gf-seg gf-seg--small gf-wide" role="group" aria-label="Kind of tree">
          <button type="button" className={o.kind === "tree" ? "on" : ""} onClick={() => g.setYard(y => ({ ...y, objects: y.objects.map(x => (x.id === o.id ? { ...x, kind: "tree" } : x)) }))}>
            <TreeDeciduous size={14} aria-hidden="true" /> Leafy (drops leaves)
          </button>
          <button type="button" className={o.kind === "evergreen" ? "on" : ""} onClick={() => g.setYard(y => ({ ...y, objects: y.objects.map(x => (x.id === o.id ? { ...x, kind: "evergreen" } : x)) }))}>
            <TreePine size={14} aria-hidden="true" /> Evergreen
          </button>
        </div>
      )}
      {!kind.ground && <LenInput label="Height" meters={o.h} min={0.3} max={40} units={units} onChange={v => set({ h: v })} />}
      {isTreeKind(o.kind) && <LenInput label="Canopy across" meters={o.r * 2} min={0.6} max={30} units={units} onChange={v => set({ r: v / 2 })} />}
      {o.kind === "fence" && <LenInput label="Length" meters={o.len} min={0.5} max={60} units={units} onChange={v => set({ len: v })} />}
      {(o.kind === "shed" || o.kind === "wing" || kind.ground) && (
        <>
          <LenInput label={o.round ? "Across" : "Width"} meters={o.w} min={0.3} max={40} units={units} onChange={v => set({ w: v })} />
          <LenInput label={o.round ? "Long way" : "Depth"} meters={o.d} min={0.3} max={40} units={units} onChange={v => set({ d: v })} />
        </>
      )}
      {kind.ground && (
        <div className="gf-seg gf-seg--small gf-wide" role="group" aria-label="Shape">
          <button type="button" className={!o.round ? "on" : ""} onClick={() => set({ round: false })}>
            Rectangle
          </button>
          <button type="button" className={o.round ? "on" : ""} onClick={() => set({ round: true })}>
            Oval
          </button>
        </div>
      )}
      {!isTreeKind(o.kind) && <TurnInput label="Turn" value={o.angle} onChange={v => set({ angle: v })} half={o.kind === "fence"} />}
      {lawn && (
        <div className="gf-wide">
          <label>
            <span>Grass</span>
            <select
              value={grass.id}
              onChange={e => {
                set({ plantId: e.target.value });
                if (o.entryId) g.updateEntry(o.entryId, { plantId: e.target.value });
              }}
            >
              {GRASSES.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.season === "warm" ? "warm" : "cool"} season)
                </option>
              ))}
            </select>
          </label>
          <h4>Lawn care this week</h4>
          <LawnTips g={g} grass={grass} areaSqm={areaOf(o)} />
          {here && !grass.sun.includes(here.light) && <p className="gf-callout">This part of the yard gets {LIGHT[here.light].name.toLowerCase()}; {grass.name.toLowerCase()} wants {grass.sun.map(s => LIGHT[s].name.toLowerCase()).join(" or ")}. Try fine fescue in the shady parts.</p>}
        </div>
      )}
      {(o.kind === "bed" || o.kind === "raised") && (
        <div className="gf-wide">
          <p className="gf-hint">{here ? `About ${here.hours.toFixed(1)} h of direct sun in the middle (${LIGHT[here.light].name.toLowerCase()}).` : ""} {inside.length ? `Growing here: ${inside.map(p => plantsById.get(p.plantId)?.name).filter(Boolean).join(", ")}.` : ""}</p>
          <button type="button" className="gf-btn gf-btn--small" onClick={() => onPlantHere({ x: o.x, y: o.y })} disabled={full}>
            <Flower2 size={15} aria-hidden="true" /> Add a plant to this bed
          </button>
        </div>
      )}
      {isTreeKind(o.kind) && plant && (
        <div className="gf-wide">
          <PlantCare g={g} plant={plant} entry={entry} hours={here?.hours ?? null} />
        </div>
      )}
      <p className="gf-hint gf-wide">
        {o.kind === "tree" ? "Leafy trees let some light through in summer and much more in winter. " : o.kind === "evergreen" ? "Evergreens shade all year. " : o.kind === "wing" ? "Part of the house: a garage, addition or porch. " : kind.ground ? "Ground cover casts no shade. " : ""}
        Arrow keys nudge it; [ and ] turn it.
      </p>
      {actions}
    </div>
  );
}

function insideGround(o, p) {
  const { u, v } = localPoint(o, p.x, p.y);
  if (o.round) return (u / (o.d / 2)) ** 2 + (v / (o.w / 2)) ** 2 <= 1;
  return Math.abs(u) <= o.d / 2 && Math.abs(v) <= o.w / 2;
}

function PlantPicker({ g, onPick, onClose }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const words = q.trim().toLowerCase();
    return PLANTS.filter(p => p.type !== "grass" && (!words || `${p.name} ${p.latin}`.toLowerCase().includes(words)))
      .map(p => ({ p, r: g.climate ? g.ratingFor(p) : null }))
      .sort((a, b) => (a.r?.score ?? 0) - (b.r?.score ?? 0) || a.p.name.localeCompare(b.p.name))
      .slice(0, 30);
  }, [q, g]);
  return (
    <div className="gf-tool gf-picker">
      <div className="gf-picker-head">
        <h3>Which plant?</h3>
        <button type="button" className="gf-icon-btn" onClick={onClose} aria-label="Cancel">
          <X size={16} />
        </button>
      </div>
      <label className="gf-search">
        <Search size={16} aria-hidden="true" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tomato, hosta, maple…" aria-label="Search plants" />
      </label>
      <ul>
        {list.map(({ p, r }) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)}>
              <PlantArt plant={p} size={28} />
              <span>{p.name}</span>
              {r && <RatingBadge result={r} compact />}
            </button>
          </li>
        ))}
      </ul>
      <p className="gf-hint">It goes on the map and into My garden, planted today (change the date after). Then drag it to where it grows.</p>
    </div>
  );
}
