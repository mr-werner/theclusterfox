import { useState } from "react";
import { Bluetooth, MapPin, Smartphone } from "lucide-react";

import { SPORTS } from "../data/events";
import { fmtClock, parseClock } from "../model/units";
import { maxHrFor, runPredictions, zoneTarget, ZONES } from "../model/zones";
import Sensors from "./Sensors";
import { SportIcon, ZoneChip } from "./ui";

const RACES = [
  ["1 mile", 1609.344],
  ["5K", 5000],
  ["10K", 10000],
  ["Half marathon", 21097.5],
  ["Marathon", 42195],
];

function NumberField({ label, value, onChange, min, max, hint, placeholder }) {
  return (
    <label>
      {label}
      <input type="number" inputMode="numeric" min={min} max={max} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** A time typed as text, saved as seconds once it parses. */
function TimeField({ label, seconds, onChange, placeholder, hint }) {
  const [text, setText] = useState(seconds ? fmtClock(seconds) : "");
  const bad = text && !parseClock(text);
  return (
    <label>
      {label}
      <input
        value={text}
        placeholder={placeholder}
        inputMode="numeric"
        aria-invalid={bad || undefined}
        onChange={e => {
          setText(e.target.value);
          const s = parseClock(e.target.value);
          if (s || !e.target.value) onChange(s);
        }}
      />
      {hint && <small>{bad ? "Use h:mm:ss or mm:ss" : hint}</small>}
    </label>
  );
}

export default function SetupTab({ store, sensors }) {
  const { data, setPrefs, setProfile } = store;
  const { prefs, profile } = data;
  const [zoneSport, setZoneSport] = useState(prefs.sport);
  const race = profile.runRace;
  const maxHr = maxHrFor(profile);

  return (
    <div className="pc-setup">
      <section className="pc-card">
        <h2>Your zones</h2>
        <p className="pc-hint">Fill in what you know. Every session works without these, by feel; with them, you get exact paces, watts, splits and heart rates, and live coaching to stay in them.</p>
        <div className="pc-form">
          <NumberField label="Age" value={profile.age} min={10} max={100} onChange={v => setProfile({ age: v })} hint={!profile.maxHr && maxHr ? `Estimated max heart rate ${maxHr}` : null} />
          <NumberField label="Max heart rate" value={profile.maxHr} min={100} max={230} placeholder={maxHr ? String(maxHr) : "e.g. 185"} onChange={v => setProfile({ maxHr: v })} hint="The highest you've seen in an all-out effort" />
          <NumberField label="Resting heart rate" value={profile.restHr} min={30} max={100} placeholder="optional" onChange={v => setProfile({ restHr: v })} hint="Measured lying down after waking" />
        </div>

        <p className="pc-label">
          <SportIcon sport="run" size={15} /> Running: a recent race or hard time trial
        </p>
        <div className="pc-form">
          <label>
            Distance
            <select value={race?.distanceM ?? ""} onChange={e => setProfile({ runRace: e.target.value ? { distanceM: Number(e.target.value), seconds: race?.seconds ?? null } : null })}>
              <option value="">Choose…</option>
              {RACES.map(([name, d]) => (
                <option key={name} value={d}>{name}</option>
              ))}
            </select>
          </label>
          <TimeField label="Time" seconds={race?.seconds} placeholder="25:30" hint="Your finishing time" onChange={s => race?.distanceM && setProfile({ runRace: { distanceM: race.distanceM, seconds: s } })} />
        </div>
        {runPredictions(profile).length > 0 && (
          <p className="pc-predict">
            That predicts{" "}
            {runPredictions(profile)
              .map(p => `${p.name} ${fmtClock(Math.round(p.seconds))}`)
              .join(" · ")}
          </p>
        )}

        <p className="pc-label">
          <SportIcon sport="ride" size={15} /> Cycling and <SportIcon sport="row" size={15} /> rowing
        </p>
        <div className="pc-form">
          <NumberField label="FTP (watts)" value={profile.ftp} min={40} max={700} placeholder="e.g. 220" onChange={v => setProfile({ ftp: v })} hint="95% of your best 20-minute power" />
          <TimeField label="2K erg time" seconds={profile.row2k} placeholder="7:30" hint="Your best 2,000 m on a rowing machine" onChange={s => setProfile({ row2k: s })} />
        </div>

        <div className="pc-sports is-small" role="tablist" aria-label="Show zones for">
          {Object.values(SPORTS).map(s => (
            <button key={s.id} type="button" role="tab" aria-selected={zoneSport === s.id} className={zoneSport === s.id ? "is-on" : ""} onClick={() => setZoneSport(s.id)}>
              <SportIcon sport={s.id} /> {s.name}
            </button>
          ))}
        </div>
        <table className="pc-zones">
          <tbody>
            {[1, 2, 3, 4, 5].map(z => {
              const t = zoneTarget(z, zoneSport, profile, prefs.unit);
              return (
                <tr key={z}>
                  <td>
                    <ZoneChip zone={z} />
                  </td>
                  <td>
                    <strong>{ZONES[z].name}</strong>
                    <small>{ZONES[z].feel}</small>
                  </td>
                  <td>
                    {t.target && <span>{t.target}</span>}
                    {t.rate && <span>{t.rate}</span>}
                    {t.hr && <span>{t.hr}</span>}
                    {!t.target && !t.hr && <span className="pc-muted">by feel</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="pc-card">
        <h2>Settings</h2>
        <div className="pc-form">
          <label>
            Distance in
            <select value={prefs.unit} onChange={e => setPrefs({ unit: e.target.value })}>
              <option value="mi">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </label>
          <label>
            Usual training time
            <input type="time" value={prefs.trainTime ?? ""} onChange={e => setPrefs({ trainTime: e.target.value || null })} />
            <small>Puts sessions at this time in PlanFox</small>
          </label>
        </div>
        <div className="pc-toggles">
          <label>
            <input type="checkbox" checked={prefs.voice} onChange={e => setPrefs({ voice: e.target.checked })} />
            Voice cues for each step, its target, and when you drift out of zone
          </label>
          <label>
            <input type="checkbox" checked={prefs.splitCues} onChange={e => setPrefs({ splitCues: e.target.checked })} />
            Say each {prefs.unit === "km" ? "kilometer" : "mile"} split (500 m when rowing)
          </label>
          <label>
            <input type="checkbox" checked={prefs.keepAwake} onChange={e => setPrefs({ keepAwake: e.target.checked })} />
            Keep the screen on while recording
          </label>
          <label>
            <input type="checkbox" checked={prefs.batterySaver} onChange={e => setPrefs({ batterySaver: e.target.checked })} />
            Battery saver screen while recording: true black with dim numbers, which uses the least power on OLED phones
          </label>
        </div>
      </section>

      <section className="pc-card">
        <h2>Bluetooth sensors</h2>
        <p className="pc-hint">Pair once per visit. Heart rate works for every sport; power meters for riding; Fitness Machine (FTMS) rowers, trainers and treadmills send their distance, pace and power.</p>
        <Sensors sensors={sensors} sport="ride" />
      </section>

      <section className="pc-card pc-limits">
        <h2>What works where</h2>
        <div className="pc-limit">
          <MapPin size={20} aria-hidden="true" />
          <div>
            <strong>GPS</strong>
            <p>
              Works in every modern phone browser while PaceFox is on screen, and PaceFox keeps the screen awake while you record. Websites can't read GPS once the phone locks or you switch to another app; on
              Android Chrome it may carry on briefly, on iPhone it stops. When you come back the gap is counted as a straight line and shown on the workout. For GPS with the screen off, record on a watch and
              import the GPX file in the Log. True background tracking needs an installed app from an app store, which can be built from this same code later.
            </p>
          </div>
        </div>
        <div className="pc-limit">
          <Bluetooth size={20} aria-hidden="true" />
          <div>
            <strong>Bluetooth</strong>
            <p>
              Heart rate straps, power meters and FTMS machines connect directly in Chrome, Edge and Opera on Android, Windows, Mac and ChromeOS. Safari and all iPhone and iPad browsers don't let websites use
              Bluetooth. Spoken prompts are different: they play through any Bluetooth headphones or speaker on every device, with no pairing in PaceFox.
            </p>
          </div>
        </div>
        <div className="pc-limit">
          <Smartphone size={20} aria-hidden="true" />
          <div>
            <strong>Install it</strong>
            <p>Add PaceFox to your home screen (Share → Add to Home Screen on iPhone; Install app in Chrome) so it opens full screen, like an app.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
