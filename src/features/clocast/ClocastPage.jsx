import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cloud, CloudOff, CloudSun, HardDrive, LoaderCircle, RotateCcw } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import HourlyStrip from "./components/HourlyStrip";
import LocationPicker from "./components/LocationPicker";
import OutfitCard from "./components/OutfitCard";
import ProfilePanel from "./components/ProfilePanel";
import WhyPanel from "./components/WhyPanel";
import { activities, activitiesById } from "./data/activities";
import { planOutfit } from "./model/plan";
import { useClocastData } from "./state/useClocastData";
import { fetchForecast } from "../../services/weather/openMeteo";
import { formatHour, formatTemp } from "./units";
import "./clocast.css";

const DURATIONS = [1, 2, 4, 8, 12];
const START_CHOICES = 36;

function SyncBadge({ status, isSignedIn }) {
  if (!isSignedIn) {
    return (
      <p className="cc-sync">
        <HardDrive size={15} aria-hidden="true" />
        Saved on this device.{" "}
        <Link to="/login?next=/clocast">Log in</Link> or <Link to="/signup?next=/clocast">sign up</Link> to keep it everywhere.
      </p>
    );
  }
  const states = {
    syncing: [<LoaderCircle key="i" size={15} className="spin" />, "Syncing…"],
    synced: [<Cloud key="i" size={15} />, "Synced to your account"],
    unavailable: [<HardDrive key="i" size={15} />, "Saved on this device. Account sync isn’t switched on yet."],
    error: [<CloudOff key="i" size={15} />, "Couldn’t sync right now. Your changes are saved on this device."],
    local: [<HardDrive key="i" size={15} />, "Saved on this device"],
  };
  const [icon, text] = states[status] || states.local;
  return (
    <p className={`cc-sync is-${status}`} aria-live="polite">
      {icon}
      {text}
    </p>
  );
}

// Index of the hour that is happening now (or the first one in the future).
function currentHourIndex(hours) {
  const now = Date.now();
  const index = hours.findIndex(hour => hour.time.getTime() + 3600000 > now);
  return index === -1 ? 0 : index;
}

function dayLabel(hour, firstDay) {
  if (hour.localDay === firstDay) return "Today";
  const next = new Date(`${firstDay}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return hour.localDay === next.toISOString().slice(0, 10) ? "Tomorrow" : hour.localDay;
}

export default function ClocastPage() {
  const { data, syncStatus, isSignedIn, update, setPlace, toggleSavedPlace, setProfile } = useClocastData();
  const { place, units, profile, tolerance } = data;
  const activity = activitiesById.get(data.activityId) ?? activities[0];

  const [forecast, setForecast] = useState({ key: null, status: "idle", hours: [], error: "" });
  const [startOffset, setStartOffset] = useState(0);
  const [reloads, setReloads] = useState(0);
  const placeKey = place ? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}` : null;

  useEffect(() => {
    if (!placeKey) return undefined;
    const controller = new AbortController();
    const [latitude, longitude] = placeKey.split(",").map(Number);
    fetchForecast({ latitude, longitude }, { signal: controller.signal })
      .then(result => setForecast({ key: placeKey, status: "ready", hours: result.hours, error: "" }))
      .catch(error => {
        if (error.name !== "AbortError") {
          setForecast({ key: placeKey, status: "error", hours: [], error: error.message || "Couldn't load the weather." });
        }
      });
    return () => controller.abort();
  }, [placeKey, reloads]);

  const loading = placeKey && forecast.key !== placeKey;
  const hours = useMemo(() => (forecast.key === placeKey ? forecast.hours : []), [forecast, placeKey]);
  const nowIndex = currentHourIndex(hours);
  const startChoices = hours.slice(nowIndex, nowIndex + START_CHOICES);
  const offset = Math.min(startOffset, Math.max(0, startChoices.length - 1));
  const start = nowIndex + offset;

  const plan = useMemo(() => {
    const windowHours = hours.slice(start, start + data.hours);
    if (!place || !windowHours.length) return null;
    return planOutfit(windowHours, place, activity, {
      profile,
      tolerance,
      shaded: data.shaded,
      formatTemp: celsius => formatTemp(celsius, units),
    });
  }, [hours, start, data.hours, data.shaded, place, activity, profile, tolerance, units]);

  const profileUsed = Boolean(profile.heightCm || profile.weightKg || profile.sex || profile.ageYears);
  const firstDay = startChoices[0]?.localDay;

  return (
    <main className="clocast-page cc">
      <SiteHeader />

      <div className="cc-shell">
        <header className="cc-hero">
          <div className="cc-logo" aria-hidden="true">
            <CloudSun size={28} />
          </div>
          <div>
            <p className="cc-eyebrow">CLOCAST</p>
            <h1>Dress for the forecast.</h1>
            <p className="cc-hero-sub">
              Tell it where you'll be and what you're doing. CloCast runs the weather through the same heat-balance
              science engineers use for thermal comfort and picks your layers.
            </p>
            <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
          </div>
        </header>

        <div className="cc-layout">
          <div className="cc-inputs">
            <section className="cc-panel" aria-labelledby="cc-where-title">
              <p className="cc-eyebrow">STEP 1</p>
              <h2 id="cc-where-title">Where will you be?</h2>
              <LocationPicker
                place={place}
                savedPlaces={data.savedPlaces}
                onPick={setPlace}
                onToggleSaved={toggleSavedPlace}
              />
            </section>

            <section className="cc-panel" aria-labelledby="cc-what-title">
              <p className="cc-eyebrow">STEP 2</p>
              <h2 id="cc-what-title">What are you doing?</h2>
              <div className="cc-activities" role="radiogroup" aria-label="Activity">
                {activities.map(item => {
                  const Icon = item.icon;
                  const selected = item.id === activity.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`cc-activity ${selected ? "is-active" : ""}`}
                      onClick={() => update({ activityId: item.id })}
                    >
                      <Icon size={20} aria-hidden="true" />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="cc-when">
                <label className="cc-field">
                  <span className="cc-label">Heading out</span>
                  <select
                    value={offset}
                    onChange={event => setStartOffset(Number(event.target.value))}
                    disabled={!startChoices.length}
                  >
                    {startChoices.length ? (
                      startChoices.map((hour, index) => (
                        <option key={hour.time.getTime()} value={index}>
                          {index === 0 ? "Now" : `${dayLabel(hour, firstDay)} ${formatHour(hour.localHour)}`}
                        </option>
                      ))
                    ) : (
                      <option value={0}>Now</option>
                    )}
                  </select>
                </label>
                <div className="cc-field">
                  <span className="cc-label">For</span>
                  <div className="cc-segment" role="group" aria-label="How long">
                    {DURATIONS.map(value => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={data.hours === value}
                        onClick={() => update({ hours: value })}
                      >
                        {value} h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="cc-check">
                <input
                  type="checkbox"
                  checked={data.shaded}
                  onChange={event => update({ shaded: event.target.checked })}
                />
                <span>Mostly in the shade (no warmth from direct sun)</span>
              </label>
            </section>

            <ProfilePanel
              profile={profile}
              units={units}
              tolerance={tolerance}
              onProfile={setProfile}
              onUnits={value => update({ units: value })}
              onTolerance={value => update({ tolerance: value })}
            />
          </div>

          <div className="cc-results" aria-live="polite">
            {!place && (
              <section className="cc-panel cc-empty">
                <CloudSun size={36} aria-hidden="true" />
                <h2>Pick a place to get started</h2>
                <p className="cc-muted">Search for a town or use your location. The forecast comes from Open-Meteo.</p>
              </section>
            )}

            {place && loading && (
              <section className="cc-panel cc-empty">
                <LoaderCircle size={30} className="spin" aria-hidden="true" />
                <p className="cc-muted">Getting the forecast for {place.name}…</p>
              </section>
            )}

            {place && !loading && forecast.status === "error" && (
              <section className="cc-panel cc-empty">
                <CloudOff size={30} aria-hidden="true" />
                <p>{forecast.error}</p>
                <button type="button" className="cc-btn" onClick={() => setReloads(n => n + 1)}>
                  <RotateCcw size={15} /> Try again
                </button>
              </section>
            )}

            {plan && !loading && (
              <>
                <OutfitCard plan={plan} />
                <HourlyStrip plan={plan} units={units} />
                <WhyPanel plan={plan} units={units} profileUsed={profileUsed} />
              </>
            )}
          </div>
        </div>

        <p className="cc-credit">
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0).
          Clothing guidance is an estimate, not medical advice.
        </p>
      </div>
    </main>
  );
}
