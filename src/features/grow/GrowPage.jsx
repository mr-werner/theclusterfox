import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Compass, Settings2, Sprout, Sun, Leaf, MapPin, Armchair } from "lucide-react";

import AppBar from "../../components/AppBar";
import { plantsById } from "./data/plants";
import { effectiveClimate, zoneLabel } from "./model/climate";
import { rate } from "./model/care";
import { rateIndoor, roomLight } from "./model/indoor";
import { dayNum, todayKey } from "./model/dates";
import { defaultYard, sunGrid, withMapLight } from "./model/yard";
import { useGrowData } from "./state/useGrowData";
import TodayTab from "./components/TodayTab";
import PlantsTab from "./components/PlantsTab";
import PlantDetail from "./components/PlantDetail";
import CalendarTab from "./components/CalendarTab";
import YardTab from "./components/YardTab";
import GardenTab from "./components/GardenTab";
import IndoorTab from "./components/IndoorTab";
import SettingsSheet from "./components/SettingsSheet";
import "./grow.css";
import "./identity.css";

const TABS = [
  { id: "today", name: "Today", icon: Sun },
  { id: "plants", name: "Plants", icon: Leaf },
  { id: "calendar", name: "Calendar", icon: CalendarDays },
  { id: "yard", name: "Sun & spots", short: "Yard", icon: Compass },
  { id: "indoor", name: "Indoors", icon: Armchair },
  { id: "garden", name: "My garden", icon: Sprout },
];

export default function GrowPage() {
  const store = useGrowData();
  const { data } = store;
  const [params, setParams] = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [today, setToday] = useState(() => todayKey());

  // Roll over at midnight if the app stays open.
  useEffect(() => {
    const t = setInterval(() => setToday(todayKey()), 60000);
    return () => clearInterval(t);
  }, []);

  const climate = useMemo(() => effectiveClimate(data), [data]);
  // The sun map uses your exact latitude; without a place, a typical one for your hemisphere.
  const sunLat = data.place?.latitude ?? climate?.latitude ?? (data.hemisphere === "S" ? -35 : 40);
  const yard = useMemo(() => data.yard ?? defaultYard(), [data.yard]);
  const yardGrid = useMemo(() => sunGrid(yard, sunLat), [yard, sunLat]);
  // Spots placed on the map take their light from it.
  const spots = useMemo(() => withMapLight(data.spots, yardGrid), [data.spots, yardGrid]);
  const view = useMemo(() => ({ ...data, spots, prefs: { ...data.prefs, hemisphere: data.hemisphere } }), [data, spots]);
  const spotsById = useMemo(() => new Map(spots.map(s => [s.id, s])), [spots]);
  const ratingFor = useCallback((plant, light = null) => rate(plant, climate, light), [climate]);
  // Indoors: each room's light from its window, and ratings for your home.
  const hemisphere = climate?.hemisphere ?? data.hemisphere ?? "N";
  const rooms = useMemo(() => data.rooms.map(r => ({ ...r, lightInfo: roomLight(r, hemisphere), lightId: roomLight(r, hemisphere).id })), [data.rooms, hemisphere]);
  const roomsById = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const indoorRating = useCallback((plant, light = null) => rateIndoor(plant, light, data.home), [data.home]);

  // A TaskFox link (?task=…&day=…) opens Today on that day's job; ?entry= opens My garden.
  const taskParam = params.get("task");
  const entryParam = params.get("entry");
  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : entryParam ? "garden" : "today";
  const plant = plantsById.get(params.get("plant")) ?? null;

  const go = useCallback(
    (next, { replace = false, keep = false } = {}) => {
      const base = keep ? Object.fromEntries(params) : {};
      const merged = { ...base, ...next };
      setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== null && v !== "")), { replace });
    },
    [params, setParams]
  );
  const openPlant = useCallback(id => go({ plant: id }, { keep: true }), [go]);
  const closePlant = useCallback(() => go({ plant: null }, { keep: true, replace: true }), [go]);
  const switchTab = id => {
    go({ tab: id === "today" ? null : id });
    window.scrollTo({ top: 0 });
  };

  const ctx = {
    ...store,
    data: view,
    yard,
    yardGrid,
    sunLat,
    sunLatExact: data.place != null || climate?.latitude != null,
    climate,
    today,
    todayNum: dayNum(today),
    spotsById,
    ratingFor,
    indoorRating,
    rooms,
    roomsById,
    hemisphere,
    openPlant,
    go,
    switchTab,
    openSettings: () => setSettingsOpen(true),
    taskParam,
    taskDay: params.get("day"),
    entryParam,
  };

  const placeLabel = data.place ? data.place.name : climate ? `Zone ${zoneLabel(climate.zone)}` : "Set your place";

  return (
    <div className="gf" data-theme={data.prefs.theme}>
      <AppBar appId="growfox">
        <button type="button" className={`gf-place-chip${climate && data.place ? " has-zone" : ""}`} onClick={() => setSettingsOpen(true)} title="Your place, look and settings">
          <MapPin size={15} aria-hidden="true" />
          <span>{placeLabel}</span>
          {climate && data.place && <em>{zoneLabel(climate.zone)}</em>}
          <Settings2 size={15} aria-hidden="true" className="gf-place-gear" />
        </button>
      </AppBar>

      <nav className="gf-tabs" aria-label="GrowFox sections">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" className={t.id === tab ? "active" : ""} aria-current={t.id === tab ? "page" : undefined} onClick={() => switchTab(t.id)}>
              <Icon size={18} aria-hidden="true" />
              <span className="gf-tab-long">{t.name}</span>
              <span className="gf-tab-short">{t.short ?? t.name}</span>
            </button>
          );
        })}
      </nav>

      <main className="gf-main">
        {tab === "today" && <TodayTab g={ctx} />}
        {tab === "plants" && <PlantsTab g={ctx} />}
        {tab === "calendar" && <CalendarTab g={ctx} />}
        {tab === "yard" && <YardTab g={ctx} />}
        {tab === "indoor" && <IndoorTab g={ctx} />}
        {tab === "garden" && <GardenTab g={ctx} />}
      </main>

      {plant && <PlantDetail g={ctx} plant={plant} onClose={closePlant} />}
      {settingsOpen && <SettingsSheet g={ctx} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
