import { useMemo, useState } from "react";
import { Plus, Check, Lightbulb } from "lucide-react";
import { TYPES, TAGS } from "../data/plants";
import { cadence, CADENCE_WORDS, FREQ, KINDS } from "../model/care";
import { ACTIONS, ANCHORS, anchorDays, nextWindows } from "../model/calendar";
import { zoneLabel } from "../model/climate";
import { sideReport, LIGHT } from "../model/sun";
import { shortDate, yearOf } from "../model/dates";
import { PlantArt, RatingBadge, Sheet, SunNeeds } from "./ui";
import { YearStrip } from "./CalendarTab";

const WATER = ["", "Low: handles dry spells", "Average", "High: likes steady moisture"];
const HEAT = ["", "Prefers cool summers", "Average", "Loves heat"];
const PERIOD_NAMES = { growing: "through the growing season", summer: "in summer", spring: "in spring", lateSpring: "in late spring", fall: "in fall", winter: "in winter", all: "all year", harvest: "while it's producing" };

function careWhen(c, climate, year) {
  const freq = FREQ[c.freq];
  if (c.freq === "never") return "Never";
  const first = c.firstYear ? " (first year)" : "";
  if (c.freq === "yearly") {
    const names = (c.anchors.length ? c.anchors : ["spring"]).map(a => {
      const when = climate ? anchorDays(a, climate, year)[1] : null;
      return `${ANCHORS[a]?.name.toLowerCase() ?? a}${when != null ? ` (≈ ${shortDate(when)})` : ""}`;
    });
    return `Once a year${names.length > 1 ? " each" : ""}: ${names.join(", ")}${first}`;
  }
  return `${freq.name} ${PERIOD_NAMES[c.anchors[0] ?? "growing"] ?? ""}${first}`;
}

export default function PlantDetail({ g, plant, onClose }) {
  const { climate, data, todayNum } = g;
  const type = TYPES.find(t => t.id === plant.type);
  const r = climate ? g.ratingFor(plant) : null;
  const care = cadence(plant, climate);
  const windows = climate ? nextWindows(plant, climate, todayNum) : [];
  const year = yearOf(todayNum);
  const inGarden = data.garden.filter(e => e.plantId === plant.id);
  const sides = useMemo(() => (data.place ? sideReport(data.place.latitude).sides : null), [data.place]);

  return (
    <Sheet title={plant.name} onClose={onClose} wide>
      <div className="gf-detail" style={{ "--tint": plant.color }}>
        <header className="gf-detail-hero">
          <span className="gf-detail-art">
            <PlantArt plant={plant} size={110} />
          </span>
          <div>
            <small>{type.one}</small>
            <h1>{plant.name}</h1>
            <em>{plant.latin}</em>
            <div className="gf-tags">
              {plant.tags.map(t => (
                <span key={t} className={`gf-tag gf-tag--${t}`}>
                  {TAGS[t]}
                </span>
              ))}
            </div>
          </div>
        </header>

        {r && (
          <section className={`gf-block gf-verdict gf-verdict--${r.score}`}>
            <h3>How hard to keep alive here</h3>
            <div className="gf-verdict-row">
              <RatingBadge result={r} />
              <span>{r.rating.hint}</span>
            </div>
            {r.reasons.length > 0 && (
              <ul className="gf-reasons">
                {r.reasons.map(x => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {data.spots.length > 0 && (
              <div className="gf-spot-fit">
                <h4>In your spots</h4>
                <ul>
                  {data.spots.map(s => (
                    <li key={s.id}>
                      <span>{s.name}</span>
                      <RatingBadge result={g.ratingFor(plant, s.light)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="gf-block">
          <h3>Where to plant it</h3>
          <p className="gf-light-need">
            <SunNeeds sun={plant.sun} withText />
          </p>
          <p>{plant.sun.map(s => LIGHT[s].hint).join(" · ")}</p>
          {sides && <WhereOnProperty plant={plant} sides={sides} />}
          <p className="gf-hint">Soil: {plant.soil}. Spacing: {plant.spacing}. Grows {plant.size}.</p>
        </section>

        <section className="gf-block">
          <h3>When to plant</h3>
          {climate ? (
            <>
              <ul className="gf-windows">
                {windows.slice(0, 4).map(w => (
                  <li key={`${w.action}${w.start}`} className={w.open ? "open" : ""}>
                    <span className={`gf-dot gf-dot--${w.action}`} aria-hidden="true" />
                    <strong>{ACTIONS[w.action].name}</strong>
                    <span>
                      {shortDate(w.start)} – {shortDate(w.end)}
                    </span>
                    {w.open && <em>Now</em>}
                    {w.best && <em className="best">Best time</em>}
                  </li>
                ))}
              </ul>
              <YearStrip plant={plant} climate={climate} year={year} today={todayNum} label />
            </>
          ) : (
            <p className="gf-hint">Set your place to see dates for your area.</p>
          )}
        </section>

        <section className="gf-block">
          <h3>How often it needs you</h3>
          <div className="gf-cadence" role="table" aria-label="Care frequency">
            <div className="gf-cadence-row gf-cadence-head" role="row">
              <span role="columnheader" />
              {CADENCE_WORDS.map(w => (
                <span key={w} role="columnheader">
                  {w}
                </span>
              ))}
            </div>
            {care.map(c => (
              <div key={c.id} className="gf-cadence-row" role="row">
                <span role="rowheader">{c.name}</span>
                {CADENCE_WORDS.map(w => (
                  <span key={w} role="cell" className={c.word === w ? "on" : ""}>
                    {c.word === w ? <Check size={14} strokeWidth={3} aria-label={w} /> : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <ul className="gf-care-list">
            {plant.care.map((c, i) => (
              <li key={i}>
                <strong>{KINDS[c.kind].name}</strong>
                <span>{careWhen(c, climate, year)}</span>
                {c.note && <p>{c.note}</p>}
              </li>
            ))}
          </ul>
          {care.some(c => c.adjusted) && <p className="gf-hint">Watering is bumped up a step for your dry summers.</p>}
        </section>

        <section className="gf-block gf-facts-block">
          <h3>At a glance</h3>
          <dl className="gf-facts">
            <div>
              <dt>Hardy in</dt>
              <dd>{plant.zones ? `Zones ${plant.zones[0]}–${plant.zones[1]}` : plant.when === "coolSow" || plant.when === "coolVeg" ? "Cool season, takes light frost" : "Frost tender, one season"}</dd>
            </div>
            {plant.days && (
              <div>
                <dt>Days to {plant.type === "annual" ? "bloom" : "harvest"}</dt>
                <dd>{plant.days}</dd>
              </div>
            )}
            <div>
              <dt>Water</dt>
              <dd>{WATER[plant.water]}</dd>
            </div>
            <div>
              <dt>Heat</dt>
              <dd>{HEAT[plant.heat]}</dd>
            </div>
            {plant.season && (
              <div>
                <dt>Grass type</dt>
                <dd>{plant.season === "cool" ? "Cool season (green spring and fall)" : "Warm season (green in summer, brown in winter)"}</dd>
              </div>
            )}
            {climate && (
              <div>
                <dt>Your zone</dt>
                <dd>{zoneLabel(climate.zone)}</dd>
              </div>
            )}
          </dl>
          <p className="gf-tip">
            <Lightbulb size={16} aria-hidden="true" /> {plant.tip}
          </p>
        </section>

        <AddToGarden g={g} plant={plant} inGarden={inGarden} windows={windows} />
      </div>
    </Sheet>
  );
}

function WhereOnProperty({ plant, sides }) {
  const walls = sides.filter(s => s.id !== "open");
  const fits = walls.filter(s => plant.sun.includes(s.light));
  const best = plant.sun[0];
  const ideal = walls.filter(s => s.light === best);
  const hot = walls.filter(s => s.hotAfternoon).map(s => s.name.toLowerCase());
  let text;
  if (best === "full") text = ideal.length ? `Beds along the ${list(ideal)} side${ideal.length > 1 ? "s" : ""} of your house, or open ground away from trees.` : "Open ground away from buildings and trees.";
  else if (best === "part") text = `${fits.length ? `The ${list(fits.filter(s => s.light === "part").length ? fits.filter(s => s.light === "part") : fits)} side of your house` : "A spot"} with morning sun and afternoon shade, or the dappled shade of a tree.`;
  else text = `${ideal.length ? `The ${list(ideal)} side of your house` : "Under trees"}, or wherever trees and buildings block most direct sun.`;
  return (
    <p className="gf-where">
      <strong>On your property:</strong> {text}
      {plant.heat === 1 && hot.length > 0 && ` Avoid the hot afternoon sun on the ${hot.join(" and ")} side.`}
    </p>
  );
}

const list = sides => {
  const names = sides.map(s => s.name.toLowerCase());
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
};

function AddToGarden({ g, plant, inGarden, windows }) {
  const [open, setOpen] = useState(false);
  const plantNow = windows.some(w => w.open);
  const [status, setStatus] = useState("growing");
  const [spotId, setSpotId] = useState("");
  const [planted, setPlanted] = useState(g.today);
  const [qty, setQty] = useState(1);

  const save = () => {
    g.addEntry({ plantId: plant.id, status, spotId: spotId || null, planted: status === "growing" ? planted : null, qty: Number(qty) || 1 });
    setOpen(false);
  };

  return (
    <section className="gf-block gf-add">
      {inGarden.length > 0 && (
        <p className="gf-in-garden">
          <Check size={16} aria-hidden="true" /> In your garden{inGarden.length > 1 ? ` (${inGarden.length} plantings)` : ""}.{" "}
          <button type="button" className="gf-link" onClick={() => g.go({ tab: "garden", entry: inGarden[0].id })}>
            See it
          </button>
        </p>
      )}
      {!open ? (
        <button type="button" className="gf-btn gf-btn--big" onClick={() => setOpen(true)}>
          <Plus size={18} aria-hidden="true" /> {inGarden.length ? "Add another planting" : "Add to my garden"}
        </button>
      ) : (
        <div className="gf-form">
          <div className="gf-seg" role="group" aria-label="Status">
            <button type="button" className={status === "growing" ? "on" : ""} onClick={() => setStatus("growing")}>
              It's in the ground
            </button>
            <button type="button" className={status === "planned" ? "on" : ""} onClick={() => setStatus("planned")}>
              Planning to plant
            </button>
          </div>
          {status === "growing" ? (
            <label>
              <span>Planted on</span>
              <input type="date" value={planted} max={g.today} onChange={e => setPlanted(e.target.value)} />
            </label>
          ) : (
            <p className="gf-hint">{plantNow ? "Its planting window is open now." : "You'll get a reminder"} on your Today list and in PlanFox when it's time to plant.</p>
          )}
          <label>
            <span>Spot</span>
            <select value={spotId} onChange={e => setSpotId(e.target.value)}>
              <option value="">No particular spot</option>
              {g.data.spots.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} · {LIGHT[s.light].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>How many</span>
            <input type="number" min="1" max="999" value={qty} onChange={e => setQty(e.target.value)} />
          </label>
          <div className="gf-form-actions">
            <button type="button" className="gf-btn" onClick={save}>
              Add
            </button>
            <button type="button" className="gf-btn gf-btn--ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
