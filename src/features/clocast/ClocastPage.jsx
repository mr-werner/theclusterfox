import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cloud, CloudOff, CloudSun, HardDrive, LoaderCircle, RotateCcw, TreePine } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import LocationPicker from "./components/LocationPicker";
import OutfitCard from "./components/OutfitCard";
import ProfilePanel from "./components/ProfilePanel";
import WeatherReport from "./components/WeatherReport";
import WhenPicker from "./components/WhenPicker";
import WhyPanel from "./components/WhyPanel";
import { activities, activitiesById } from "./data/activities";
import { planOutfit } from "./model/plan";
import { useClocastData } from "./state/useClocastData";
import { fetchForecast } from "../../services/weather/openMeteo";
import { formatTemp } from "./units";
import { dayName, describeWindow, DURATIONS, PARTS, partAvailable, windowHours } from "./when";
import "./clocast.css";

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

const EMPTY_FORECAST = { hours: [], days: [], current: null };

export default function ClocastPage() {
  const { data, syncStatus, isSignedIn, update, setPlace, toggleSavedPlace, setProfile } = useClocastData();
  const { place, units, profile, tolerance } = data;
  const activity = activitiesById.get(data.activityId) ?? activities[0];

  const [forecast, setForecast] = useState({ key: null, status: "idle", data: EMPTY_FORECAST, error: "" });
  const [choice, setChoice] = useState({ day: 0, part: "now" });
  const [reloads, setReloads] = useState(0);
  const placeKey = place ? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}` : null;

  useEffect(() => {
    if (!placeKey) return undefined;
    const controller = new AbortController();
    const [latitude, longitude] = placeKey.split(",").map(Number);
    fetchForecast({ latitude, longitude }, { signal: controller.signal })
      .then(result => setForecast({ key: placeKey, status: "ready", data: result, error: "" }))
      .catch(error => {
        if (error.name !== "AbortError") {
          setForecast({ key: placeKey, status: "error", data: EMPTY_FORECAST, error: error.message || "Couldn't load the weather." });
        }
      });
    return () => controller.abort();
  }, [placeKey, reloads]);

  const loading = Boolean(placeKey) && forecast.key !== placeKey;
  const weather = forecast.key === placeKey ? forecast.data : EMPTY_FORECAST;
  const dayKeys = useMemo(() => weather.days.map(d => d.day), [weather.days]);
  const duration = DURATIONS.includes(data.hours) ? data.hours : 2;

  // Fall back to the first part of the day that hasn't passed yet.
  let part = choice.part;
  if (weather.hours.length && !partAvailable(weather.hours, dayKeys, choice.day, part)) {
    part = PARTS.find(p => partAvailable(weather.hours, dayKeys, choice.day, p.id))?.id ?? "now";
  }
  const when = { day: choice.day, part, duration };

  const picked = useMemo(
    () => windowHours(weather.hours, dayKeys, { day: choice.day, part, duration }),
    [weather.hours, dayKeys, choice.day, part, duration]
  );

  const next24 = useMemo(
    () => windowHours(weather.hours, dayKeys, { day: 0, part: "now", duration: 24 }),
    [weather.hours, dayKeys]
  );

  const plan = useMemo(() => {
    if (!place || !picked.length) return null;
    return planOutfit(picked, place, activity, {
      profile,
      tolerance,
      shaded: data.shaded,
      formatTemp: celsius => formatTemp(celsius, units),
    });
  }, [picked, data.shaded, place, activity, profile, tolerance, units]);

  function changeWhen(next) {
    setChoice({ day: next.day, part: next.part });
    if (next.duration !== duration) update({ hours: next.duration });
  }

  const profileUsed = Boolean(profile.heightCm || profile.weightKg || profile.sex || profile.ageYears);
  const partName = PARTS.find(p => p.id === part)?.name.toLowerCase();
  const windowLabel =
    part === "now"
      ? `Next ${duration === 1 ? "hour" : `${duration} hours`}`
      : choice.day === 0
        ? `This ${partName}`
        : `${dayName(dayKeys[choice.day], choice.day)} ${partName}`;
  const ready = place && !loading && forecast.status === "ready" && weather.days.length > 0;

  return (
    <main className="clocast-page cc">
      <SiteHeader />

      <div className="cc-shell">
        <header className="cc-hero">
          <div className="cc-logo" aria-hidden="true">
            <CloudSun size={26} />
          </div>
          <div>
            <p className="cc-eyebrow">CLOCAST</p>
            <h1>Dress for the forecast.</h1>
            <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
          </div>
        </header>

        <section className="cc-panel cc-controls" aria-label="Place and time">
          <LocationPicker
            place={place}
            savedPlaces={data.savedPlaces}
            onPick={setPlace}
            onToggleSaved={toggleSavedPlace}
            actions={
              <span className="cc-segment cc-units" role="group" aria-label="Units">
                {[["us", "°F"], ["metric", "°C"]].map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={units === value} onClick={() => update({ units: value })}>
                    {label}
                  </button>
                ))}
              </span>
            }
          />
          {ready && <WhenPicker hours={weather.hours} days={dayKeys} when={when} onChange={changeWhen} />}
        </section>

        {!place && (
          <section className="cc-panel cc-empty">
            <CloudSun size={36} aria-hidden="true" />
            <h2>Pick a place to get started</h2>
            <p className="cc-muted">Search for a town or use your location to see the forecast and what to wear.</p>
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

        {ready && (
          <>
            <WeatherReport
              forecast={weather}
              units={units}
              place={place}
              dayIndex={choice.day}
              highlight={picked}
              next24={next24}
              onPickDay={day => setChoice(current => ({ ...current, day }))}
            />

            <section className="cc-panel cc-wear" aria-labelledby="cc-wear-title">
              <div className="cc-wear-head">
                <div>
                  <p className="cc-eyebrow">WHAT TO WEAR</p>
                  <h2 id="cc-wear-title">What are you doing?</h2>
                </div>
                <label className="cc-switch">
                  <input
                    type="checkbox"
                    checked={data.shaded}
                    onChange={event => update({ shaded: event.target.checked })}
                  />
                  <span className="cc-switch-track" aria-hidden="true" />
                  <TreePine size={15} aria-hidden="true" />
                  <span>In the shade</span>
                </label>
              </div>

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
                      title={item.hint}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              {plan ? (
                <OutfitCard
                  plan={plan}
                  summary={[activity.name, windowLabel, describeWindow(picked), data.shaded && "In the shade"].filter(Boolean).join(" · ")}
                />
              ) : (
                <p className="cc-note">That part of the day has already passed. Pick another time above.</p>
              )}
            </section>

            <ProfilePanel
              profile={profile}
              units={units}
              tolerance={tolerance}
              onProfile={setProfile}
              onTolerance={value => update({ tolerance: value })}
            />

            {plan && <WhyPanel plan={plan} units={units} profileUsed={profileUsed} />}
          </>
        )}

        <p className="cc-credit">
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0).
          Clothing guidance is an estimate, not medical advice.
        </p>
      </div>
    </main>
  );
}
