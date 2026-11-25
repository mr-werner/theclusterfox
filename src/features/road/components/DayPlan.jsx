import { useState } from "react";
import { AlertTriangle, BedDouble, ChevronsDown, ChevronsUp, CloudSun, ExternalLink, Flag, Fuel, Timer, X } from "lucide-react";

import { describeWeather } from "../../../services/weather/openMeteo";
import { dayWiggle, drivingWarning, fmtClock, parseClock, PLAN_KINDS, roadHazard, toClock } from "../model/days";
import { fmtMiles, fmtMinutes } from "../model/geo";
import { STAY_BY_ID, STAY_KINDS, stayLinks } from "../model/stays";
import { addDays } from "../state/roadStore";
import { placeUrl } from "./links";
import { Loading } from "./ui";

const dayName = day => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const money = n => (n === 0 ? "Free" : `$${Math.round(n)}`);
const range = o => (o.price === 0 && o.hi === 0 ? "Free" : o.lo != null && o.hi != null && o.hi !== o.lo ? `about $${o.lo}–$${o.hi}` : `about ${money(o.price)}`);
const hourName = key => {
  const h = Number(key.slice(11, 13));
  return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
};

/**
 * The trip day by day, for one of three plans. Each day has its times,
 * stops, gas, the weather on the road, and where you'll sleep with the
 * other options and their prices.
 */
export default function DayPlan({ route, plans, planId, setPlan, start, to, data, patch, places, corridor, gas, weather, focus, setFocus, onRemove, canEdit, busy, openDay, townName }) {
  const plan = plans[planId] ?? plans.planned;
  const { days, nights } = plan;
  const budget = data.drive.budget;
  const flex = data.drive.flex;

  return (
    <>
      <div className="rf-plans" role="radiogroup" aria-label="Which plan">
        {PLAN_KINDS.filter(k => plans[k.id]).map(k => {
          const p = plans[k.id];
          const drive = p.days.reduce((s, d) => s + d.driveMinutes, 0);
          const longest = Math.max(...p.days.map(d => d.driveMinutes));
          return (
            <button key={k.id} type="button" role="radio" aria-checked={k.id === planId} className={k.id === planId ? "is-on" : ""} onClick={() => setPlan(k.id)}>
              <strong>
                {k.id === "further" ? <ChevronsUp size={15} aria-hidden="true" /> : k.id === "earlier" ? <ChevronsDown size={15} aria-hidden="true" /> : null}
                {k.name}
              </strong>
              <span>
                {p.days.length} day{p.days.length > 1 ? "s" : ""} · up to {fmtMinutes(longest)} a day
              </span>
              <small>{k.delta ? `${k.delta > 0 ? "+" : "−"}${fmtMinutes(flex)} a day` : `${fmtMinutes(drive)} driving`}</small>
            </button>
          );
        })}
      </div>
      {corridor.state === "loading" && <Loading>Finding towns, places to stay and gas along the way{corridor.progress ? ` (${corridor.progress.done} of ${corridor.progress.total} stretches)` : ""}…</Loading>}
      {corridor.state === "error" && <p className="rf-note is-warn">{corridor.error} Nights are placed by driving time for now.</p>}

      <ol className="rf-daylist">
        {days.map((d, i) => {
          const day = start ? addDays(start, i) : null;
          const night = nights[i];
          const warn = drivingWarning(Math.round((d.driveMinutes / 60) * 10) / 10);
          const items = [...d.stops.map(s => ({ type: "stop", mile: s.mile, s })), ...gas.filter(g => g.mile > (d.exactFrom ?? d.fromMile) + 0.5 && g.mile <= (d.exactTo ?? d.toMile) + 0.5).map(g => ({ type: "gas", mile: g.mile, g }))].sort((a, b) => a.mile - b.mile);
          const wx = weather.filter(w => w.day === i);
          return (
            <li key={i} className={openDay === i + 1 ? "is-open" : ""}>
              <div className="rf-day-head">
                <span className="rf-day-num">Day {i + 1}</span>
                {day && <span className="rf-muted">{dayName(day)}</span>}
                <span className="rf-day-nums">
                  {fmtMinutes(d.driveMinutes)} driving · {fmtMiles(d.toMile - d.fromMile)}
                  {d.stopMinutes ? ` · ${fmtMinutes(d.stopMinutes)} at stops` : ""}
                  {d.breakMinutes ? ` · ${fmtMinutes(d.breakMinutes)} of breaks` : ""}
                </span>
              </div>
              {Number.isFinite(d.startClock) && (
                <DayTimes d={d} i={i} data={data} patch={patch} />
              )}
              {warn && d.driveMinutes > 8 * 60 && (
                <p className={`rf-daywarn ${warn.level === "danger" ? "is-danger" : ""}`}>
                  <AlertTriangle size={13} aria-hidden="true" /> {fmtMinutes(d.driveMinutes)} behind the wheel. {warn.level === "danger" ? "Share the driving." : "Take a break every 2 hours."}
                </p>
              )}
              {wx.length > 0 && <WeatherStrip points={wx} townName={townName} />}
              <ul className="rf-stops">
                {items.map(it =>
                  it.type === "stop" ? (
                    <Stop key={it.s.id} s={it.s} n={route.stops.indexOf(it.s) + 1} focus={focus} setFocus={setFocus} onRemove={canEdit ? onRemove : null} busy={busy} />
                  ) : (
                    <li key={`gas${it.mile}`} className="rf-gas">
                      <Fuel size={16} aria-hidden="true" />
                      <div className="rf-stop-body">
                        <strong>{it.g.station ? `Gas up: ${it.g.station.name}` : `Gas up around mile ${it.g.mile}`}</strong>
                        <span className="rf-muted">
                          mile {Math.round(it.g.mile)}
                          {it.g.anchor ? ` · while you're at ${it.g.anchor.name}` : it.g.station?.truck ? " · truck stop" : ""}
                          {it.g.station?.open24 ? " · open 24 hours" : ""}
                          {!it.g.station ? " · no station mapped here, fill up before" : ""}
                        </span>
                        {it.g.station && (
                          <span className="rf-stop-links">
                            <a href={placeUrl(it.g.station)} target="_blank" rel="noreferrer">
                              Map <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          </span>
                        )}
                      </div>
                    </li>
                  )
                )}
                {d.end ? (
                  <Night night={night} d={d} day={day} budget={budget} route={route} data={data} places={places} />
                ) : (
                  <li className="rf-night">
                    <Flag size={16} aria-hidden="true" />
                    <div className="rf-stop-body">
                      <strong>Arrive in {to.name}</strong>
                      {Number.isFinite(d.endClock) && <span className="rf-muted">around {fmtClock(d.endClock)}</span>}
                    </div>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function DayTimes({ d, i, data, patch }) {
  const [open, setOpen] = useState(false);
  const own = data.dayTimes?.[i];
  const set = (k, v) => patch(x => ({ dayTimes: { ...x.dayTimes, [i]: { ...x.dayTimes?.[i], [k]: v } } }));
  const reset = () =>
    patch(x => {
      const next = { ...x.dayTimes };
      delete next[i];
      return { dayTimes: next };
    });
  const late = d.endClock > data.drive.finish + (own?.finish != null ? own.finish - data.drive.finish : 0) + 10;
  return (
    <div className="rf-daytimes">
      <span>
        <Timer size={13} aria-hidden="true" /> Leave {fmtClock(d.startClock)} · arrive about {fmtClock(d.endClock)}
        {late ? " (a little past your stop time, to reach a place to sleep)" : ""}
      </span>
      <button type="button" className="rf-link" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {own ? "Times changed for this day" : "Change this day's times"}
      </button>
      {open && (
        <span className="rf-daytimes-edit">
          <label>
            Start <input type="time" value={toClock(own?.start ?? data.drive.start)} onChange={e => parseClock(e.target.value) != null && set("start", parseClock(e.target.value))} />
          </label>
          <label>
            Done by <input type="time" value={toClock(own?.finish ?? data.drive.finish)} onChange={e => {
              const v = parseClock(e.target.value);
              if (v != null) set("finish", v <= (own?.start ?? data.drive.start) ? v + 1440 : v);
            }} />
          </label>
          {own && (
            <button type="button" className="rf-link" onClick={reset}>
              Use my usual times
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function Stop({ s, n, focus, setFocus, onRemove, busy }) {
  return (
    <li className={focus === s.id ? "is-focus" : ""}>
      <button type="button" className="rf-stop-num" onClick={() => setFocus(s.id)} aria-label={`Show ${s.name} on the map`}>
        {n}
      </button>
      <div className="rf-stop-body">
        <strong>{s.name}</strong>
        <span className="rf-muted">
          <span className={`rf-chip rf-chip--${s.theme}`}>{s.label}</span> mile {Math.round(s.mile)}
          {Number.isFinite(s.off) && s.off >= 1 ? ` · ${s.off} mi off the fastest road` : ""} · plan {fmtMinutes(s.minutes)}
        </span>
        <span className="rf-stop-links">
          {s.wiki && (
            <a href={s.wiki} target="_blank" rel="noreferrer">
              About <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          <a href={placeUrl(s)} target="_blank" rel="noreferrer">
            Map <ExternalLink size={12} aria-hidden="true" />
          </a>
        </span>
      </div>
      {onRemove && (
        <button type="button" className="rf-icon-btn" onClick={() => onRemove(s.id)} aria-label={`Skip ${s.name}`} title="Skip this stop" disabled={busy}>
          <X size={15} />
        </button>
      )}
    </li>
  );
}

function WeatherStrip({ points, townName }) {
  const known = points.filter(p => p.weather);
  if (!known.length && points.some(p => p.failed)) return <p className="rf-muted rf-small rf-wx-later"><CloudSun size={13} aria-hidden="true" /> The weather service isn't answering right now, so the forecast on the road is missing. Plan again in a minute.</p>;
  if (!known.length) return <p className="rf-muted rf-small rf-wx-later"><CloudSun size={13} aria-hidden="true" /> The forecast for this day shows up about two weeks before.</p>;
  return (
    <ul className="rf-wx" aria-label="Weather on the road">
      {known.map(p => {
        const w = p.weather;
        const hazard = roadHazard(w);
        return (
          <li key={`${p.mile}-${p.minutes}`} className={hazard ? "is-hazard" : ""} title={hazard ?? undefined}>
            <span className="rf-wx-time">{hourName(w.local)}</span>
            <strong>{Math.round(w.temp)}°</strong>
            <span>{describeWeather(w.code)}{w.rain >= 30 ? `, ${w.rain}%` : ""}</span>
            <span className="rf-muted">{townName(p) ?? `mile ${p.mile}`}</span>
            {hazard && (
              <em>
                <AlertTriangle size={12} aria-hidden="true" /> {hazard}
              </em>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Night({ night, d, day, budget, route, data, places }) {
  const [more, setMore] = useState(false);
  const pick = night?.pick;
  const pref = data.drive.stay;
  const links = pick && day ? stayLinks(pick, { checkin: day, checkout: addDays(day, 1) }) : pick ? stayLinks(pick) : [];
  const others = night ? STAY_KINDS.map(k => night.options[k.id]).filter(o => o && o !== pick) : [];
  const cheaper = pick && budget && !pick.inBudget ? others.filter(o => o.inBudget).sort((a, b) => Math.abs(a.mile - pick.mile) - Math.abs(b.mile - pick.mile))[0] : null;
  const wiggle = more ? dayWiggle(route.route, d, { drive: data.drive, hoursPerDay: data.hoursPerDay, places }) : null;

  return (
    <li className="rf-night">
      <BedDouble size={16} aria-hidden="true" />
      <div className="rf-stop-body">
        {pick ? (
          <>
            <strong>
              {pick.kind === "city" ? `Sleep in ${pick.name}` : `${STAY_BY_ID[pick.kind].short}: ${pick.name}`}
              {pick.kind !== pref && <em className="rf-muted"> (no {STAY_BY_ID[pref].short.toLowerCase()} near here)</em>}
            </strong>
            <span className="rf-muted">
              mile {Math.round(pick.mile)} ·{" "}
              {pick.kind === "city" ? `${pick.count} hotel${pick.count > 1 ? "s" : ""}, ${range(pick)} a night` : `${money(pick.price)}${pick.price ? " a night (estimate)" : ""}`}
              {budget > 0 && (pick.inBudget ? <span className="rf-fit is-ok"> {pick.kind === "city" ? `${pick.fit} within your $${budget}` : `within your $${budget}`}</span> : <span className="rf-fit is-over"> over your ${budget}</span>)}
            </span>
            {cheaper && (
              <span className="rf-muted rf-small">
                Cheaper nearby: {STAY_BY_ID[cheaper.kind].short} {cheaper.name}, {money(cheaper.price)} (mile {Math.round(cheaper.mile)})
              </span>
            )}
          </>
        ) : (
          <strong>Sleep around mile {d.toMile}</strong>
        )}
        <span className="rf-stop-links">
          {links.map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
              {l.label} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ))}
          {night && (others.length > 0 || places.length > 0) && (
            <button type="button" className="rf-link" onClick={() => setMore(m => !m)} aria-expanded={more}>
              {more ? "Fewer options" : "Other options & wiggle room"}
            </button>
          )}
        </span>
        {more && (
          <div className="rf-night-more">
            {others.length > 0 && (
              <ul className="rf-options-list">
                {others.map(o => (
                  <li key={o.kind}>
                    <span className="rf-chip">{STAY_BY_ID[o.kind].short}</span> {o.kind === "city" ? `${o.name}: ${o.count} hotels, ${range(o)}` : `${o.name}, ${money(o.price)}`} · mile {Math.round(o.mile)}
                    {budget > 0 && !o.inBudget ? <span className="rf-fit is-over"> over budget</span> : null}
                    {" "}
                    <a href={stayLinks(o)[0].href} target="_blank" rel="noreferrer">
                      {stayLinks(o)[0].label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {pick?.kind === "city" && pick.hotels?.length > 0 && (
              <p className="rf-muted rf-small">
                Hotels mapped here: {pick.hotels.slice(0, 6).map(h => `${h.name} (~$${h.price})`).join(", ")}
                {pick.hotels.length > 6 ? ` and ${pick.hotels.length - 6} more` : ""}.
              </p>
            )}
            {wiggle && (wiggle.further || wiggle.earlier) && (
              <ul className="rf-options-list">
                {wiggle.further && (
                  <li>
                    <ChevronsUp size={13} aria-hidden="true" /> Feeling good? {wiggle.further.pick.kind === "arrive" ? "Push on to your destination." : `Push on to ${wiggle.further.pick.name} (mile ${Math.round(wiggle.further.pick.mile)}, about +${fmtMinutes(Math.max(5, wiggle.further.extra))})`}
                  </li>
                )}
                {wiggle.earlier && wiggle.earlier.extra < 0 && (
                  <li>
                    <ChevronsDown size={13} aria-hidden="true" /> Had enough? Stop at {wiggle.earlier.pick.name} (mile {Math.round(wiggle.earlier.pick.mile)}, about −{fmtMinutes(-wiggle.earlier.extra)})
                  </li>
                )}
              </ul>
            )}
            <p className="rf-muted rf-small">Prices are estimates from each hotel's brand and the town's size. Check before you book.</p>
          </div>
        )}
      </div>
    </li>
  );
}
