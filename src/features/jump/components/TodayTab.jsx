import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, CloudOff, LocateFixed, RotateCcw, Thermometer, Wind } from "lucide-react";

import { useWindsAloft } from "../../../components/weather/useWindsAloft";
import WindsAloft from "../../../components/weather/WindsAloft";
import { compass, fetchWindsAloft, formatWindKt } from "../../../services/weather/windsAloft";
import { DROPZONES, dzById } from "../data/dropzones";
import { fmtDist, jumpCall, JUMPER_TYPES, KT_TO_MPH, LEVEL_TEXT, milesBetween, spot } from "../model/jumpcheck";
import { newId } from "../state/jumpStore";
import { DzSelect, HomeButton, Loading } from "./ui";
import { fmtDay, hourLabel, localDay } from "./format";

const mph = kt => (kt == null ? "–" : `${Math.round(kt * KT_TO_MPH)} mph`);
const ft = n => `${(Math.round(n / 100) * 100).toLocaleString("en-US")} ft`;

// The jump check: can you jump at your DZ today and tomorrow, hour by hour,
// and a rough spot for the hour you pick. Winds come from the shared
// winds-aloft module SkyFox and FlyFox use.
export default function TodayTab({ j, dzId, setDz }) {
  const { data, patch } = j;
  const dz = dzById[dzId] ?? dzById[data.homeDz] ?? null;
  const place = useMemo(() => (dz ? { name: dz.name, latitude: dz.lat, longitude: dz.lon } : null), [dz]);
  const winds = useWindsAloft(place, { hours: 48 });
  const type = JUMPER_TYPES.find(t => t.id === data.jumper) ?? JUMPER_TYPES[1];
  const limitMph = data.limitMph ?? type.limitMph;
  const elevationFt = winds.data?.elevationFt ?? dz?.elevFt ?? 0;
  const opts = { limitMph, exitFt: data.exitFt, elevationFt };

  const hours = useMemo(() => {
    if (!winds.data) return [];
    const first = winds.data.hours[0]?.localDay;
    // Today and tomorrow, 6 AM to 9 PM local.
    return winds.data.hours.filter(h => h.localHour >= 6 && h.localHour <= 21 && h.localDay <= nextDay(first));
  }, [winds.data]);
  const calls = useMemo(() => hours.map(h => jumpCall(h, opts)), [hours, limitMph, data.exitFt, elevationFt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState(null);
  // Forecast hours start at the hour it was fetched.
  const now = winds.at;
  const nowIndex = hours.findIndex(h => h.time.getTime() + 3600e3 > now);
  const index = pick != null && pick < hours.length ? pick : Math.max(0, nowIndex);
  const hour = hours[index];
  const call = calls[index];

  const [locating, setLocating] = useState(false);
  function nearest() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const me = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const best = [...DROPZONES].sort((a, b) => milesBetween(me, a) - milesBetween(me, b))[0];
        setLocating(false);
        setDz(best.id);
      },
      () => setLocating(false),
      { maximumAge: 600000, timeout: 10000 }
    );
  }

  if (!dz) {
    return (
      <div className="jf-stack">
        <section className="jf-card jf-hero">
          <div className="jf-hero-text">
            <p className="jf-kicker">Can I jump today?</p>
            <h1>Pick your drop zone</h1>
            <p>JumpFox checks ground winds against your limit, gusts, clouds, rain and the uppers, hour by hour, and works out a rough spot.</p>
          </div>
          <div className="jf-hero-tools">
            <DzSelect value="" onChange={setDz} />
            <button type="button" className="jf-btn is-ghost" onClick={nearest} disabled={locating}>
              <LocateFixed size={15} aria-hidden="true" /> {locating ? "Finding you…" : "Nearest to me"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="jf-stack">
      <section className="jf-card jf-hero">
        <div className="jf-hero-text">
          <p className="jf-kicker">Can I jump today?</p>
          <h1>{dz.name}</h1>
          <p>
            {dz.city}, {dz.state} · field about {ft(elevationFt)} · <a href={dz.website} target="_blank" rel="noreferrer">DZ website</a>
          </p>
          <div className="jf-row">
            <HomeButton isHome={data.homeDz === dz.id} onClick={() => patch({ homeDz: data.homeDz === dz.id ? null : dz.id })} />
            <PlanDay dz={dz} j={j} />
          </div>
        </div>
        <div className="jf-hero-tools">
          <DzSelect value={dz.id} onChange={id => { setDz(id); setPick(null); }} home={data.homeDz} />
          <div className="jf-two-fields">
            <label className="jf-field">
              <span>I'm jumping as</span>
              <select value={type.id} onChange={e => patch({ jumper: e.target.value, limitMph: null })}>
                {JUMPER_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="jf-field">
              <span>Wind limit (mph)</span>
              <input type="number" inputMode="numeric" min={5} max={40} value={limitMph} onChange={e => patch({ limitMph: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <p className="jf-muted jf-small">{type.note}. Your DZ's rules and your instructor come first.</p>
        </div>
      </section>

      {winds.status === "loading" && <Loading>Getting winds and clouds for {dz.name}…</Loading>}
      {winds.status === "error" && (
        <p className="jf-note is-warn" role="alert">
          <CloudOff size={16} aria-hidden="true" /> {winds.error}{" "}
          <button type="button" className="jf-link" onClick={winds.reload}><RotateCcw size={13} aria-hidden="true" /> Try again</button>
        </p>
      )}

      {hour && call && (
        <>
          <section className={`jf-card jf-verdict is-${call.level}`} aria-live="polite">
            <div className="jf-verdict-head">
              <span className={`jf-badge is-${call.level}`}>{LEVEL_TEXT[call.level]}</span>
              <strong>
                {hour.localDay === hours[0].localDay ? "Today" : "Tomorrow"} at {hourLabel(hour.localHour)}
              </strong>
            </div>
            {call.reasons.length ? (
              <ul className="jf-reasons">
                {call.reasons.map(r => (
                  <li key={r.text} className={`is-${r.level}`}>{r.text}</li>
                ))}
              </ul>
            ) : (
              <p>Winds under your limit, clear enough to see the ground, no rain in the forecast.</p>
            )}
            <dl className="jf-stats">
              <div><dt>Ground wind</dt><dd>{hour.surface.speedKt == null ? "–" : `${compass(hour.surface.dir ?? 0)} ${mph(hour.surface.speedKt)}`}</dd>{hour.surface.gustKt != null && <dd className="jf-stat-note">gusts {mph(hour.surface.gustKt)}</dd>}</div>
              <div><dt>Uppers at exit</dt><dd>{call.uppers ? formatWindKt(call.uppers.dir, call.uppers.speedKt) : "–"}</dd><dd className="jf-stat-note">{ft(data.exitFt)} AGL</dd></div>
              <div><dt><Thermometer size={13} aria-hidden="true" /> At altitude</dt><dd>{call.uppers?.tempC == null ? "–" : `${Math.round(call.uppers.tempC)}°C / ${Math.round(call.uppers.tempC * 1.8 + 32)}°F`}</dd><dd className="jf-stat-note">{call.uppers?.tempC != null && call.uppers.tempC < 0 ? "Gloves and layers" : "On the ground " + (hour.surface.tempC == null ? "–" : `${Math.round(hour.surface.tempC * 1.8 + 32)}°F`)}</dd></div>
              <div><dt>Clouds</dt><dd>Low {fmtPct(hour.cloud.low)} · Mid {fmtPct(hour.cloud.mid)}</dd>{hour.cloudBaseFt != null && <dd className="jf-stat-note">base about {ft(hour.cloudBaseFt)} AGL</dd>}</div>
              <div><dt>Rain chance</dt><dd>{fmtPct(hour.precipChance)}</dd></div>
              <div><dt>Visibility</dt><dd>{hour.visibilityM == null ? "–" : `${Math.min(10, hour.visibilityM / 1609).toFixed(hour.visibilityM > 16000 ? 0 : 1)}${hour.visibilityM > 16000 ? "+" : ""} mi`}</dd></div>
            </dl>
          </section>

          <section className="jf-card">
            <div className="jf-row-between">
              <h2><Wind size={18} aria-hidden="true" /> Hour by hour</h2>
              <span className="jf-legend">
                <i className="is-go" /> Jumpable <i className="is-maybe" /> Marginal <i className="is-no" /> No <i /> Dark
              </span>
            </div>
            <Timeline hours={hours} calls={calls} index={index} onPick={setPick} />
          </section>

          <SpotCard hour={hour} data={data} patch={patch} elevationFt={elevationFt} />
        </>
      )}

      <Nearby dz={dz} opts={{ limitMph, exitFt: data.exitFt }} onPick={id => { setDz(id); setPick(null); }} />

      {place && (
        <details className="jf-card jf-details">
          <summary>Full winds aloft for {dz.name}</summary>
          <WindsAloft place={place} title={`Winds aloft over ${dz.name}`} />
        </details>
      )}

      <p className="jf-note">
        Forecast from Open-Meteo's weather models, not an observation. The DZ's manifest, pilot and S&TA make the call on the day: when they say the
        load is on hold, it's on hold.
      </p>
    </div>
  );
}

const fmtPct = v => (v == null ? "–" : `${Math.round(v)}%`);

function nextDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function Timeline({ hours, calls, index, onPick }) {
  const days = [...new Set(hours.map(h => h.localDay))];
  return (
    <div className="jf-timeline">
      {days.map((day, di) => (
        <div key={day} className="jf-tl-day">
          <span className="jf-tl-name">{di === 0 ? "Today" : "Tomorrow"}</span>
          <div className="jf-tl-row" role="group" aria-label={di === 0 ? "Today" : "Tomorrow"}>
            {hours.map((h, i) =>
              h.localDay !== day ? null : (
                <button key={i} type="button" className={`jf-tl-cell is-${calls[i].level}${i === index ? " is-on" : ""}`} onClick={() => onPick(i)} aria-pressed={i === index} title={`${hourLabel(h.localHour)}: ${LEVEL_TEXT[calls[i].level]}`}>
                  <span>{h.localHour % 12 || 12}</span>
                  <small>{h.surface.speedKt == null ? "" : Math.round(Math.max(h.surface.speedKt, h.surface.gustKt ?? 0) * KT_TO_MPH)}</small>
                </button>
              )
            )}
          </div>
        </div>
      ))}
      <p className="jf-muted jf-small">Numbers under each hour are the strongest wind or gust in mph. Tap an hour for details and the spot.</p>
    </div>
  );
}

function SpotCard({ hour, data, patch, elevationFt }) {
  const s = spot(hour, { exitFt: data.exitFt, pullFt: data.pullFt, elevationFt, style: data.style });
  return (
    <section className="jf-card">
      <h2>Spot and jump run</h2>
      <div className="jf-spot">
        <SpotDiagram s={s} />
        <div className="jf-stack is-tight">
          <div className="jf-three-fields">
            <label className="jf-field">
              <span>Exit (ft AGL)</span>
              <input type="number" inputMode="numeric" step={500} min={3000} max={18000} value={data.exitFt} onChange={e => patch({ exitFt: Number(e.target.value) || 13500 })} />
            </label>
            <label className="jf-field">
              <span>Pull (ft AGL)</span>
              <input type="number" inputMode="numeric" step={500} min={2000} max={7000} value={data.pullFt} onChange={e => patch({ pullFt: Number(e.target.value) || 3500 })} />
            </label>
            <label className="jf-field">
              <span>Flying</span>
              <select value={data.style} onChange={e => patch({ style: e.target.value })}>
                <option value="belly">Belly</option>
                <option value="freefly">Freefly</option>
              </select>
            </label>
          </div>
          {s ? (
            <ul className="jf-facts-list">
              <li><strong>Jump run</strong> heading about {String(s.jumpRun.heading).padStart(3, "0")}°, into the uppers, at about {Math.round(s.jumpRun.groundspeedKt)} kt over the ground.</li>
              <li><strong>Between groups</strong> leave at least {s.jumpRun.secondsBetweenGroups} seconds for about 1,000 ft of separation. More for big groups, and freeflyers after belly flyers.</li>
              <li><strong>Freefall</strong> about {Math.round(s.freefall.seconds)} s; you drift {fmtDist(s.freefall.driftFt)} with the {compass(s.freefall.wind.dir)} wind ({Math.round(s.freefall.wind.speedKt)} kt average).</li>
              <li><strong>Open</strong> about {fmtDist(s.open.distFt)} {compass(s.open.bearing)} of the landing area so you can fly back against {Math.round(s.canopy.wind.speedKt * KT_TO_MPH)} mph of wind under canopy.</li>
              <li><strong>Exit</strong> about {fmtDist(s.exit.distFt)} {compass(s.exit.bearing)} of the landing area.</li>
            </ul>
          ) : (
            <p className="jf-muted">Not enough wind data at these altitudes for a spot.</p>
          )}
          <p className="jf-muted jf-small">A rough model to understand the day, not to spot from. Follow the green light, the pilot and your DZ's spotting rules, and look out the door.</p>
        </div>
      </div>
    </section>
  );
}

function SpotDiagram({ s }) {
  if (!s) return null;
  const size = 240;
  const c = size / 2;
  const reach = Math.max(2500, s.exit.distFt, s.open.distFt) * 1.25;
  const k = (c - 18) / reach;
  const P = p => ({ x: c + p.x * k, y: c - p.y * k });
  const exit = P(s.exit);
  const open = P(s.open);
  const h = (s.jumpRun.heading * Math.PI) / 180;
  const dx = Math.sin(h);
  const dy = -Math.cos(h);
  const L = c * 0.9;
  return (
    <svg className="jf-spot-svg" style={{ overflow: "hidden" }} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spot diagram, north up">
      <defs>
        <marker id="jf-spot-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="jf-arrowhead" />
        </marker>
      </defs>
      <clipPath id="jf-spot-clip"><circle cx={c} cy={c} r={c - 6} /></clipPath>
      <circle cx={c} cy={c} r={c - 6} className="jf-spot-ring" />
      <circle cx={c} cy={c} r={(c - 6) / 2} className="jf-spot-ring" />
      <text x={c} y={14} textAnchor="middle" className="jf-dlabel is-small">N</text>
      <line x1={exit.x - dx * L} y1={exit.y - dy * L} x2={exit.x + dx * 30} y2={exit.y + dy * 30} className="jf-jumprun" markerEnd="url(#jf-spot-arrow)" clipPath="url(#jf-spot-clip)" />
      <line x1={exit.x} y1={exit.y} x2={open.x} y2={open.y} className="jf-path is-dash" />
      <line x1={open.x} y1={open.y} x2={c} y2={c} className="jf-path is-dash is-canopy" />
      <rect x={c - 7} y={c - 7} width="14" height="14" rx="3" className="jf-target" />
      <circle cx={open.x} cy={open.y} r="6" className="jf-open-dot" />
      <circle cx={exit.x} cy={exit.y} r="7" className="jf-exit-dot" />
      <text x={exit.x + 10} y={exit.y - 8} className="jf-dlabel is-small">Exit</text>
      <text x={open.x} y={open.y + 20} textAnchor="middle" className="jf-dlabel is-small">Open</text>
      <text x={c} y={c - 12} textAnchor="middle" className="jf-dlabel is-small">DZ</text>
      <text x={6} y={size - 6} className="jf-dlabel is-small">ring {fmtDist(reach / 2)}</text>
    </svg>
  );
}

// The closest other DZs and their call for right now, from one request.
function Nearby({ dz, opts, onPick }) {
  const near = useMemo(
    () => DROPZONES.filter(d => d.id !== dz.id).map(d => ({ ...d, miles: milesBetween(dz, d) })).sort((a, b) => a.miles - b.miles).slice(0, 5).filter(d => d.miles < 400),
    [dz]
  );
  const [state, setState] = useState({ key: null, rows: null });
  const key = near.map(d => d.id).join(",");
  useEffect(() => {
    if (!near.length) return undefined;
    const ctl = new AbortController();
    fetchWindsAloft(near.map(d => ({ latitude: d.lat, longitude: d.lon })), { hours: 3, levels: [850, 700, 600], signal: ctl.signal })
      .then(profiles => setState({ key, rows: profiles.map((p, i) => ({ dz: near[i], call: p.hours[0] ? jumpCall(p.hours[0], { ...opts, elevationFt: p.elevationFt }) : null })) }))
      .catch(e => e.name !== "AbortError" && setState({ key, rows: [] }));
    return () => ctl.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!near.length) return null;
  const rows = state.key === key ? state.rows : null;
  return (
    <section className="jf-card">
      <h2>Other drop zones nearby, right now</h2>
      {!rows ? (
        <Loading>Checking nearby drop zones…</Loading>
      ) : rows.length === 0 ? (
        <p className="jf-muted">Couldn't check nearby drop zones right now.</p>
      ) : (
        <ul className="jf-near">
          {rows.map(r => (
            <li key={r.dz.id}>
              <button type="button" onClick={() => onPick(r.dz.id)}>
                <span className={`jf-badge is-${r.call?.level ?? "none"} is-small`}>{r.call ? LEVEL_TEXT[r.call.level] : "No data"}</span>
                <strong>{r.dz.name}</strong>
                <span className="jf-muted">{Math.round(r.dz.miles)} mi · {r.call?.windMph == null ? "" : `${Math.round(r.call.windMph)} mph`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Puts a jump day at this DZ on your TaskFox calendar.
function PlanDay({ dz, j }) {
  const { data, patch } = j;
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(localDay());
  const upcoming = data.plans.filter(p => p.dzId === dz.id && p.day >= localDay()).sort((a, b) => (a.day < b.day ? -1 : 1));
  function save(e) {
    e.preventDefault();
    if (!day) return;
    patch(d => ({ plans: [...d.plans.filter(p => !(p.dzId === dz.id && p.day === day)), { id: newId("p"), day, dzId: dz.id, note: "" }] }));
    setOpen(false);
  }
  return (
    <>
      {open ? (
        <form className="jf-inline-form" onSubmit={save}>
          <input type="date" value={day} min={localDay()} onChange={e => setDay(e.target.value)} aria-label="Jump day" />
          <button type="submit" className="jf-btn is-small">Add to TaskFox</button>
          <button type="button" className="jf-link" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="jf-btn is-small is-ghost" onClick={() => setOpen(true)}>
          <CalendarPlus size={14} aria-hidden="true" /> Plan a jump day
        </button>
      )}
      {upcoming.map(p => (
        <span key={p.id} className="jf-chip">
          {fmtDay(p.day)}
          <button type="button" aria-label={`Remove ${fmtDay(p.day)}`} onClick={() => patch(d => ({ plans: d.plans.filter(x => x.id !== p.id) }))}>×</button>
        </span>
      ))}
    </>
  );
}
