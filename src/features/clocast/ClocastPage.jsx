import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Cloud, CloudOff, CloudSun, HardDrive, LoaderCircle, RotateCcw, Sun, Target } from "lucide-react";

import AppBar from "../../components/AppBar";
import LocationPicker from "./components/LocationPicker";
import Coach from "./components/Coach";
import Planner from "./components/Planner";
import ProfilePanel from "./components/ProfilePanel";
import WeatherReport from "./components/WeatherReport";
import WhyPanel from "./components/WhyPanel";
import SkyLayer from "./components/SkyLayer";
import AlertBanner from "./components/AlertBanner";
import { skyFor } from "./model/sky";
import { activities, activitiesById } from "./data/activities";
import { attireById } from "./data/attire";
import { planOutfit } from "./model/plan";
import { useClocastData } from "./state/useClocastData";
import { fetchAirQuality, fetchForecast, withAirQuality } from "../../services/weather/openMeteo";
import { formatTemp } from "./units";
import { windowHours } from "./when";
import "./clocast.css";
import "./identity.css";

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

const TABS = [
  { id: "today", name: "Today", icon: Sun },
  { id: "plan", name: "Planner", icon: CalendarDays },
  { id: "coach", name: "Coach", icon: Target },
];

export default function ClocastPage() {
  const { data, syncStatus, isSignedIn, update, setPlace, toggleSavedPlace, setProfile, savePlan, deletePlan, saveGoal, deleteGoal } =
    useClocastData();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "today";
  const openTab = id => {
    setParams(id === "today" ? {} : { tab: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const { place, units, profile, tolerance } = data;
  const activity = activitiesById.get(data.activityId) ?? activities[0];

  const [forecast, setForecast] = useState({ key: null, status: "idle", data: EMPTY_FORECAST, air: null, error: "", at: 0 });
  const [dayIndex, setDayIndex] = useState(0);
  const [reloads, setReloads] = useState(0);
  const placeKey = place ? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}` : null;

  useEffect(() => {
    if (!placeKey) return undefined;
    const controller = new AbortController();
    const [latitude, longitude] = placeKey.split(",").map(Number);
    // Air quality is a bonus: the forecast still shows without it.
    const air = fetchAirQuality({ latitude, longitude }, { signal: controller.signal }).catch(() => null);
    Promise.all([fetchForecast({ latitude, longitude }, { signal: controller.signal }), air])
      .then(([result, airQuality]) =>
        setForecast({ key: placeKey, status: "ready", data: result, air: airQuality, error: "", at: Date.now() })
      )
      .catch(error => {
        if (error.name !== "AbortError") {
          setForecast({ key: placeKey, status: "error", data: EMPTY_FORECAST, air: null, error: error instanceof TypeError ? "Couldn't reach the weather service. Check your connection and try again." : error.message || "Couldn't load the weather.", at: 0 });
        }
      });
    return () => controller.abort();
  }, [placeKey, reloads]);

  const loading = Boolean(placeKey) && forecast.key !== placeKey;
  const fresh = forecast.key === placeKey;
  const weather = useMemo(
    () => (fresh ? { ...forecast.data, hours: withAirQuality(forecast.data.hours, forecast.air) } : EMPTY_FORECAST),
    [fresh, forecast.data, forecast.air]
  );
  const now = forecast.at;
  const scoreOptions = useMemo(() => ({ profile, tolerance }), [profile, tolerance]);
  const dayKeys = useMemo(() => weather.days.map(d => d.day), [weather.days]);
  const attire = attireById.get(data.attire) ?? attireById.get("casual");

  // Today the outfit covers the next two hours; another day, its daytime.
  const picked = useMemo(() => {
    if (dayIndex === 0) return windowHours(weather.hours, dayKeys, { day: 0, part: "now", duration: 2 });
    return weather.hours.filter(h => h.localDay === dayKeys[dayIndex] && h.localHour >= 9 && h.localHour < 18);
  }, [weather.hours, dayKeys, dayIndex]);
  const attireWhen = dayIndex === 0 ? "next 2 hrs" : "9 AM–6 PM";

  const next24 = useMemo(
    () => windowHours(weather.hours, dayKeys, { day: 0, part: "now", duration: 24 }),
    [weather.hours, dayKeys]
  );

  const plan = useMemo(() => {
    if (!place || !picked.length) return null;
    return planOutfit(picked, place, attire.activity, {
      profile,
      tolerance,
      formatTemp: celsius => formatTemp(celsius, units),
    });
  }, [picked, place, attire, profile, tolerance, units]);

  const profileUsed = Boolean(profile.heightCm || profile.weightKg || profile.sex || profile.ageYears);
  const ready = place && !loading && forecast.status === "ready" && weather.days.length > 0;
  // The sky follows the weather right now; before a forecast loads, a calm daytime sky.
  const sky = ready && weather.current ? skyFor(weather.current.code, weather.current.isDay) : "partly-day";

  return (
    <main className="clocast-page cc" data-sky={sky}>
      <SkyLayer sky={sky} />
      <AppBar appId="clocast" />

      <div className="cc-shell">
        {ready && <AlertBanner place={place} />}

        {!ready && (
        <header className="cc-hero">
          <div className="cc-logo" aria-hidden="true">
            <CloudSun size={26} />
          </div>
          <div>
            <p className="cc-eyebrow">SKYFOX</p>
            <h1>Plan your day around the weather.</h1>
            <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
          </div>
        </header>
        )}

        {ready && tab === "today" && (
          <WeatherReport
            forecast={weather}
            units={units}
            place={place}
            dayIndex={dayIndex}
            next24={next24}
            airNow={forecast.air?.current}
            onPickDay={setDayIndex}
            plan={plan}
            attire={attire}
            attireWhen={attireWhen}
            onAttire={id => update({ attire: id })}
            layers={data.hourlyLayers}
            onLayers={hourlyLayers => update({ hourlyLayers })}
            onUnits={value => update({ units: value })}
            mapLayers={data.mapLayers}
            onMapLayers={mapLayers => update({ mapLayers })}
          />
        )}

        <section className="cc-panel cc-controls" aria-label="Place and time">
          <LocationPicker
            place={place}
            savedPlaces={data.savedPlaces}
            onPick={setPlace}
            onToggleSaved={toggleSavedPlace}
            actions={
              !ready && <span className="cc-segment cc-units" role="group" aria-label="Units">
                {[["us", "°F"], ["metric", "°C"]].map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={units === value} onClick={() => update({ units: value })}>
                    {label}
                  </button>
                ))}
              </span>
            }
          />
        </section>

        {ready && (
          <nav className="cc-tabs" aria-label="SkyFox">
            {TABS.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => openTab(item.id)}>
                  <Icon size={17} aria-hidden="true" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        )}

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

        {ready && tab === "plan" && (
          <Planner
            forecast={weather}
            place={place}
            units={units}
            options={scoreOptions}
            plans={data.plans}
            defaultActivityId={activity.id}
            now={now}
            onSave={savePlan}
            onDelete={deletePlan}
          />
        )}

        {ready && tab === "coach" && (
          <Coach
            forecast={weather}
            place={place}
            options={scoreOptions}
            goals={data.goals}
            plans={data.plans}
            now={now}
            onSaveGoal={saveGoal}
            onDeleteGoal={deleteGoal}
            onSavePlan={savePlan}
            onOpenPlanner={() => openTab("plan")}
          />
        )}

        {ready && tab === "today" && (
          <>
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

        {ready && <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />}

        <p className="cc-credit">
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0).
          Clothing guidance is an estimate, not medical advice.
        </p>
      </div>
    </main>
  );
}
