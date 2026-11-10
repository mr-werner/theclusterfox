import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PLANTS } from "../data/plants";
import { sideReport, sunAdvice, noonShadow, FACINGS, LIGHT, keyDays } from "../model/sun";
import { PlaceSetup } from "./SettingsSheet";
import { PlantArt, RatingBadge, SunNeeds } from "./ui";

const SEASONS = [
  { id: "season", name: "Growing season" },
  { id: "summer", name: "Midsummer" },
  { id: "equinox", name: "Spring & fall" },
  { id: "winter", name: "Midwinter" },
];
const SOILS = [
  ["", "Not sure"],
  ["loam", "Loam (crumbly, dark)"],
  ["clay", "Clay (sticky, slow to drain)"],
  ["sand", "Sand (gritty, drains fast)"],
  ["wet", "Stays wet"],
  ["rocky", "Rocky or thin"],
];
const hoursOf = (side, season) => (season === "season" ? side.season : side[season].total);
const lightOfHours = h => (h >= 6 ? "full" : h >= 3 ? "part" : "shade");

function Compass({ report, season }) {
  const R = 120;
  const wedge = deg => {
    const a0 = ((deg - 22.5 - 90) * Math.PI) / 180;
    const a1 = ((deg + 22.5 - 90) * Math.PI) / 180;
    const r0 = 52;
    const p = (r, a) => `${150 + r * Math.cos(a)} ${150 + r * Math.sin(a)}`;
    return `M${p(r0, a0)} L${p(R, a0)} A${R} ${R} 0 0 1 ${p(R, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
  };
  return (
    <svg className="gf-compass" viewBox="0 0 300 300" role="img" aria-label="Hours of direct sun beside each wall of a house">
      {report.sides
        .filter(s => s.id !== "open")
        .map(s => {
          const h = hoursOf(s, season);
          const a = ((s.deg - 90) * Math.PI) / 180;
          return (
            <g key={s.id}>
              <path d={wedge(s.deg)} className={`gf-wedge gf-wedge--${lightOfHours(h)}`} />
              <text x={150 + 88 * Math.cos(a)} y={150 + 88 * Math.sin(a) - 4} className="gf-wedge-dir">
                {s.id}
              </text>
              <text x={150 + 88 * Math.cos(a)} y={150 + 88 * Math.sin(a) + 12} className="gf-wedge-hours">
                {h.toFixed(h < 10 ? 1 : 0)}h
              </text>
            </g>
          );
        })}
      <rect x="118" y="118" width="64" height="64" rx="6" className="gf-house" />
      <path d="M112 124 L150 96 L188 124" className="gf-roof" />
      <text x="150" y="157" className="gf-house-label">
        House
      </text>
      <text x="150" y="20" className="gf-north">
        N ↑
      </text>
    </svg>
  );
}

export default function YardTab({ g }) {
  const { data } = g;
  const [season, setSeason] = useState("season");
  const lat = data.place?.latitude ?? null;
  const report = useMemo(() => (lat != null ? sideReport(lat) : null), [lat]);

  return (
    <div className="gf-yard">
      <div className="gf-plants-head">
        <h1>Sun & spots</h1>
        <p className="gf-hint">Where the sun falls around your house, worked out for your latitude, and the spots you plant in.</p>
      </div>
      {report ? <SunMap g={g} report={report} season={season} setSeason={setSeason} lat={lat} /> : (
        <section className="gf-card">
          <h2>Where's your garden?</h2>
          <p className="gf-hint">The sun map needs your town (your latitude decides how high the sun gets and which side of the house gets it).</p>
          <PlaceSetup g={g} compact />
        </section>
      )}
      <Spots g={g} report={report} />
    </div>
  );
}

function SunMap({ g, report, season, setSeason, lat }) {
  const advice = sunAdvice(lat);
  const units = g.data.prefs.units;
  const [height, setHeight] = useState(units === "metric" ? 2 : 6);
  const days = keyDays(lat);
  const summer = noonShadow(lat, days.summer.doy, height);
  const winter = noonShadow(lat, days.winter.doy, height);
  const u = units === "metric" ? "m" : "ft";
  const open = report.sides.find(s => s.id === "open");
  return (
    <section className="gf-card gf-sunmap">
      <div className="gf-sunmap-grid">
        <div>
          <Compass report={report} season={season} />
          <div className="gf-seg gf-seg--small" role="group" aria-label="Time of year">
            {SEASONS.map(s => (
              <button key={s.id} type="button" className={season === s.id ? "on" : ""} onClick={() => setSeason(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>{lat >= 0 ? "Northern" : "Southern"} hemisphere sun</h2>
          <p>{advice.line}</p>
          <ul className="gf-sides">
            {report.sides.map(s => {
              const h = hoursOf(s, season);
              return (
                <li key={s.id}>
                  <strong>{s.id === "open" ? "Open ground" : `${s.name} side`}</strong>
                  <span>{h.toFixed(1)} h</span>
                  <span className={`gf-light gf-light--${lightOfHours(h)}`}>{LIGHT[lightOfHours(h)].name}</span>
                  {s.hotAfternoon && <em>hot afternoons</em>}
                </li>
              );
            })}
          </ul>
          <p className="gf-hint">
            Direct sun hours on the ground right beside each wall, with the sun more than 10° up. Open ground gets {open.summer.total} h at midsummer and {open.winter.total} h at midwinter. Trees, fences and neighbors cut these down, so check your real spots and set their light below.
          </p>
          <div className="gf-shadow">
            <label>
              <span>A fence or wall this tall</span>
              <input type="number" min="1" max="100" step="0.5" value={height} onChange={e => setHeight(Number(e.target.value) || 0)} /> {u}
            </label>
            <p>
              casts a noon shadow about <strong>{fmtLen(summer.length, u)}</strong> long at midsummer and <strong>{fmtLen(winter.length, u)}</strong> at midwinter (sun {summer.alt}° and {Math.max(0, winter.alt)}° high). Beds on the shady side within that distance lose midday sun.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
const fmtLen = (n, u) => (Number.isFinite(n) ? `${n} ${u}` : "all day");

function Spots({ g, report }) {
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
      {!data.spots.length && editing !== "new" && <p className="gf-hint">Name the places you plant: "Front bed", "Back fence", "Under the oak". GrowFox suggests the light from the side of the house, rates plants for each spot and shows what fits.</p>}
      {editing === "new" && <SpotForm g={g} report={report} onDone={() => setEditing(null)} />}
      <div className="gf-spot-list">
        {data.spots.map(s =>
          editing === s.id ? (
            <SpotForm key={s.id} g={g} report={report} spot={s} onDone={() => setEditing(null)} />
          ) : (
            <SpotCard key={s.id} g={g} spot={s} onEdit={() => setEditing(s.id)} />
          )
        )}
      </div>
    </section>
  );
}

function SpotCard({ g, spot, onEdit }) {
  const picks = useMemo(
    () =>
      PLANTS.map(p => ({ p, r: g.ratingFor(p, spot.light) }))
        .filter(x => x.r.score <= 2 && x.p.type !== "grass" && (spot.light === "full" ? x.p.sun[0] === "full" : spot.light === "shade" ? x.p.sun.includes("shade") && !x.p.sun.includes("full") : x.p.sun.includes("part")))
        .sort((a, b) => a.r.score - b.r.score)
        .slice(0, 6),
    [g, spot.light]
  );
  const facing = spot.facing === "open" ? "Open ground" : `${FACINGS.find(f => f.id === spot.facing)?.name} side`;
  const growing = g.data.garden.filter(e => e.spotId === spot.id).length;
  return (
    <article className="gf-spot">
      <header>
        <div>
          <h3>{spot.name}</h3>
          <p>
            {facing} · <span className={`gf-light gf-light--${spot.light}`}>{LIGHT[spot.light].name}</span>
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

function SpotForm({ g, report, spot, onDone }) {
  const [name, setName] = useState(spot?.name ?? "");
  const [facing, setFacing] = useState(spot?.facing ?? "S");
  const suggested = report ? report.sides.find(s => s.id === facing)?.light ?? "full" : null;
  const [light, setLight] = useState(spot?.light ?? suggested ?? "full");
  const [touched, setTouched] = useState(Boolean(spot));
  const [soil, setSoil] = useState(spot?.soil ?? "");
  const shownLight = touched ? light : suggested ?? light;

  const save = () => {
    const value = { name: name.trim() || "Garden spot", facing, light: shownLight, soil };
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
        <select value={facing} onChange={e => setFacing(e.target.value)}>
          {FACINGS.map(f => (
            <option key={f.id} value={f.id}>
              {f.name} side of a building
            </option>
          ))}
          <option value="open">Open ground</option>
        </select>
      </label>
      <div>
        <span className="gf-label">Light {suggested && !touched && <em>(suggested from the sun map)</em>}</span>
        <div className="gf-seg" role="group" aria-label="Light">
          {Object.entries(LIGHT).map(([id, l]) => (
            <button key={id} type="button" className={shownLight === id ? "on" : ""} onClick={() => { setLight(id); setTouched(true); }} title={l.hint}>
              <SunNeeds sun={[id]} /> {l.name}
            </button>
          ))}
        </div>
        <p className="gf-hint">Trees or a neighbor's house in the way? Pick less light than suggested.</p>
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
          <button type="button" className="gf-btn gf-btn--danger" onClick={() => { g.removeSpot(spot.id); onDone(); }}>
            <Trash2 size={16} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
