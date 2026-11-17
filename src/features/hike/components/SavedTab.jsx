import { useEffect, useState } from "react";
import { CalendarDays, CloudOff, Download, Footprints, Trash2 } from "lucide-react";

import { toGpx } from "../model/gpx";
import { PACES, summarize } from "../model/profile";
import { pruneTiles, storageUsed } from "../offline";
import { duration } from "../state/hikeStore";
import { download } from "./ui";

// Your trails (saved, planned and offline), past hikes with GPX export,
// and settings.
export default function SavedTab({ h, f, openTrail }) {
  const { data, patch } = h;
  const [space, setSpace] = useState(null);
  useEffect(() => {
    storageUsed().then(setSpace);
  }, [data.trails]);

  const saved = data.trails.filter(t => t.saved || t.plan || t.offline);
  const removeTrail = async id => {
    const rest = data.trails.filter(t => t.id !== id);
    patch({ trails: rest });
    await pruneTiles(rest).catch(() => {});
  };

  return (
    <div className="hk-saved">
      <section className="hk-card">
        <h2>Your trails</h2>
        {!saved.length && <p className="hk-muted">Trails you save, plan or keep offline show up here.</p>}
        <ul className="hk-list">
          {saved.map(t => {
            const s = t.profile.length > 1 ? summarize(t.profile, t.shape, data.pace, t.sac) : null;
            return (
              <li key={t.id}>
                <button type="button" className="hk-list-main" onClick={() => openTrail(t.id)}>
                  <strong>{t.name}</strong>
                  <span>{s ? `${f.dist(s.distanceM)} · ${f.ele(s.gain)} climb · ${duration(s.minutes)}` : ""}</span>
                  <span className="hk-list-tags">
                    {t.plan && <em><CalendarDays size={13} aria-hidden="true" /> {new Date(`${t.plan.day}T12:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</em>}
                    {t.offline && <em><CloudOff size={13} aria-hidden="true" /> Offline</em>}
                  </span>
                </button>
                <button type="button" className="hk-icon-btn" onClick={() => removeTrail(t.id)} aria-label={`Remove ${t.name}`} title="Remove">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        {space && <p className="hk-fine">This site is using about {space.usedMb} MB on this device.</p>}
      </section>

      <section className="hk-card">
        <h2><Footprints size={18} aria-hidden="true" /> Past hikes</h2>
        {!data.hikes.length && <p className="hk-muted">Hikes you record show up here, ready to download as GPX.</p>}
        <ul className="hk-list">
          {data.hikes.map(x => {
            const trail = data.trails.find(t => t.id === x.trailId);
            return (
              <li key={x.id}>
                <div className="hk-list-main">
                  <strong>{x.name}</strong>
                  <span>
                    {new Date(x.startedAt * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {f.dist(x.distance)} · {duration(x.moving / 60)} moving · {f.ele(x.gain)} climbed
                  </span>
                </div>
                <button type="button" className="hk-icon-btn" onClick={() => download(`${x.name.replace(/[^\w -]+/g, "").trim() || "hike"}.gpx`, toGpx({ name: x.name, points: x.points, planned: trail?.line }))} aria-label={`Download ${x.name} as GPX`} title="Download GPX">
                  <Download size={16} />
                </button>
                <button type="button" className="hk-icon-btn" onClick={() => patch(d => ({ hikes: d.hikes.filter(y => y.id !== x.id) }))} aria-label={`Delete ${x.name}`} title="Delete">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="hk-card hk-settings">
        <h2>Settings</h2>
        <div className="hk-setting">
          <span>Units</span>
          <div className="hk-seg" role="group" aria-label="Units">
            {[["us", "Miles, feet, °F"], ["metric", "Km, metres, °C"]].map(([id, name]) => (
              <button key={id} type="button" className={data.units === id ? "is-on" : ""} aria-pressed={data.units === id} onClick={() => patch({ units: id })}>{name}</button>
            ))}
          </div>
        </div>
        <div className="hk-setting">
          <span>Your hiking pace</span>
          <div className="hk-seg" role="group" aria-label="Pace">
            {PACES.map(p => (
              <button key={p.id} type="button" className={data.pace === p.id ? "is-on" : ""} aria-pressed={data.pace === p.id} onClick={() => patch({ pace: p.id })}>{p.name}</button>
            ))}
          </div>
          <small>Times use Tobler's hiking function, adjusted by this. Average is about 5 km/h (3 mph) on the flat.</small>
        </div>
      </section>
    </div>
  );
}
