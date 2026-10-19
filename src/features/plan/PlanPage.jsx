import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BellRing, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Cloud, CloudOff, HardDrive, Layers, List, LoaderCircle, Plus } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import { formatTemp } from "../clocast/units";
import { AgendaView, MonthView, YearView } from "./components/CalendarViews";
import DayPanel, { Tip } from "./components/DayPanel";
import ItemEditor from "./components/ItemEditor";
import LayerPanel from "./components/LayerPanel";
import PlaceSearch from "./components/PlaceSearch";
import { addDays, dayKey, dayRange, monthGrid, monthName, parseDay, todayKey } from "./model/dates";
import { buildEntries, expandItems } from "./model/entries";
import { headsUp } from "./model/insights";
import { usePlanData } from "./state/usePlanData";
import { useLayerData } from "./state/useLayerData";
import "./plan.css";

const VIEWS = [
  { id: "month", name: "Month", icon: CalendarDays },
  { id: "agenda", name: "Agenda", icon: List },
  { id: "year", name: "Year", icon: CalendarRange },
];
const AGENDA_DAYS = 30;

function SyncBadge({ status, isSignedIn }) {
  if (!isSignedIn) {
    return (
      <p className="pf-sync">
        <HardDrive size={15} aria-hidden="true" />
        <span>
          Saved on this device. <Link to="/login?next=/plan">Log in</Link> or <Link to="/signup?next=/plan">sign up</Link> to keep it everywhere.
        </span>
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
    <p className={`pf-sync is-${status}`} aria-live="polite">
      {icon}
      {text}
    </p>
  );
}

const placeKey = place => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;

export default function PlanPage() {
  const { data, update, saveItem, deleteItem, toggleDone, toggleLayer, syncStatus, isSignedIn } = usePlanData();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some(v => v.id === params.get("view")) ? params.get("view") : "month";
  const setView = id => setParams(id === "month" ? {} : { view: id });

  const today = todayKey();
  // Hours already gone today are skipped when picking the best time outside.
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState(today);
  const [anchor, setAnchor] = useState(today);
  const [editing, setEditing] = useState(null);
  const [showLayers, setShowLayers] = useState(false);
  const [showAllTips, setShowAllTips] = useState(false);

  const anchorDate = parseDay(anchor);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const [from, to] = useMemo(() => {
    if (view === "year") return [`${year}-01-01`, `${year}-12-31`];
    if (view === "agenda") return [anchor, addDays(anchor, AGENDA_DAYS - 1)];
    const weeks = monthGrid(year, month);
    return [weeks[0][0], weeks[weeks.length - 1][6]];
  }, [view, year, month, anchor]);

  const layerData = useLayerData(data, from, to);
  const { forecast, awayForecasts, holidays, games } = layerData;

  const instances = useMemo(() => expandItems(data.items, from, to), [data.items, from, to]);
  const entriesByDay = useMemo(
    () =>
      buildEntries({
        layers: data.layers,
        instances,
        holidays,
        games,
        movies: layerData.movies,
        releases: layerData.releases,
        feedEvents: layerData.feedEvents,
        teams: data.teams,
      }),
    [data.layers, data.teams, instances, holidays, games, layerData.movies, layerData.releases, layerData.feedEvents]
  );
  const forecastByDay = useMemo(() => new Map((forecast?.days ?? []).map(d => [d.day, d])), [forecast]);

  // The heads-up list always looks at the next two weeks (and anything
  // left undone in the last month), whatever is on screen.
  const upcoming = useMemo(() => expandItems(data.items, addDays(today, -30), addDays(today, 14)), [data.items, today]);
  const tips = useMemo(
    () =>
      headsUp({
        today,
        forecast: data.layers.weather || data.layers.car || data.layers.garden || data.layers.training ? forecast : null,
        place: data.place,
        instances: upcoming.filter(i => data.layers[{ event: "events", task: "tasks", bill: "bills", deadline: "deadlines", training: "training" }[i.kind]]),
        games: data.layers.sports ? games : [],
        holidays: data.layers.holidays ? holidays : [],
        layers: data.layers,
        formatTemp: (c, opts) => formatTemp(c, data.units, opts),
        trainingActivityId: data.trainingActivityId,
        forecastFor: place => awayForecasts.get(placeKey(place)) ?? null,
        now,
      }),
    [now, today, forecast, data.place, data.layers, data.units, data.trainingActivityId, upcoming, games, holidays, awayForecasts]
  );
  const tipsByDay = useMemo(() => {
    const map = new Map();
    for (const tip of tips) {
      if (!map.has(tip.day)) map.set(tip.day, []);
      map.get(tip.day).push(tip);
    }
    return map;
  }, [tips]);

  function move(step) {
    if (view === "year") setAnchor(dayKey(new Date(year + step, month, 1)));
    else if (view === "agenda") setAnchor(addDays(anchor, step * AGENDA_DAYS));
    else setAnchor(dayKey(new Date(year, month + step, 1)));
  }

  function goToday() {
    setAnchor(today);
    setSelected(today);
  }

  function select(day) {
    setSelected(day);
    if (view === "month" && parseDay(day).getMonth() !== month) setAnchor(day);
  }

  const openNew = day => setEditing({ day: day ?? selected, kind: "event" });
  const openEdit = instance => setEditing(data.items.find(i => i.id === (instance.itemId ?? instance.id)) ?? null);

  const title = view === "year" ? String(year) : view === "agenda" ? `Next ${AGENDA_DAYS} days` : monthName(year, month);
  const overdue = tips.filter(t => t.kind === "overdue");
  const ahead = tips.filter(t => t.kind !== "overdue");
  const shownTips = showAllTips ? ahead : ahead.slice(0, 5);

  return (
    <main className="plan-page pf">
      <SiteHeader />

      <div className="pf-shell">
        <header className="pf-hero">
          <div className="pf-mark" aria-hidden="true">
            <CalendarRange size={26} />
          </div>
          <div className="pf-hero-text">
            <p className="pf-eyebrow">PLANFOX</p>
            <h1>Plan around everything.</h1>
            <p className="pf-muted">Weather, what to wear, car checks, games, holidays, releases and your own plans on one calendar. Turn on only what helps you decide.</p>
          </div>
          <div className="pf-hero-side">
            <PlaceSearch place={data.place} onPick={place => update({ place })} />
            <div className="pf-segment pf-units" role="group" aria-label="Units">
              {[["us", "°F"], ["metric", "°C"]].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={data.units === value} onClick={() => update({ units: value })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />

        {(ahead.length > 0 || overdue.length > 0) && (
          <section className="pf-panel pf-heads" aria-label="Heads up">
            <h2>
              <BellRing size={18} aria-hidden="true" /> Heads up
            </h2>
            <ul className="pf-tips">
              {overdue.map((tip, i) => (
                <Tip key={`o${i}`} tip={tip} today={today} />
              ))}
              {shownTips.map((tip, i) => (
                <Tip key={i} tip={tip} showDay today={today} />
              ))}
            </ul>
            {ahead.length > 5 && (
              <button type="button" className="pf-link-btn" onClick={() => setShowAllTips(v => !v)}>
                {showAllTips ? "Show fewer" : `Show all ${ahead.length}`}
              </button>
            )}
          </section>
        )}

        <div className="pf-toolbar">
          <div className="pf-segment" role="group" aria-label="View">
            {VIEWS.map(v => {
              const Icon = v.icon;
              return (
                <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                  <Icon size={15} aria-hidden="true" /> {v.name}
                </button>
              );
            })}
          </div>
          <div className="pf-nav">
            <button type="button" className="pf-icon-btn" onClick={() => move(-1)} aria-label="Previous">
              <ChevronLeft size={18} />
            </button>
            <h2 className="pf-title">{title}</h2>
            <button type="button" className="pf-icon-btn" onClick={() => move(1)} aria-label="Next">
              <ChevronRight size={18} />
            </button>
            <button type="button" className="pf-btn" onClick={goToday}>
              Today
            </button>
          </div>
          <div className="pf-actions">
            <button type="button" className="pf-btn" aria-expanded={showLayers} onClick={() => setShowLayers(v => !v)}>
              <Layers size={15} aria-hidden="true" /> Layers
            </button>
            <button type="button" className="pf-btn pf-btn-primary" onClick={() => openNew()}>
              <Plus size={15} aria-hidden="true" /> Add
            </button>
          </div>
        </div>

        {showLayers && (
          <LayerPanel
            data={data}
            update={update}
            toggleLayer={toggleLayer}
            status={layerData.status}
            errors={layerData.errors}
            feedErrors={layerData.feedErrors}
            onClose={() => setShowLayers(false)}
          />
        )}

        <div className={`pf-main is-${view}`}>
          <div className="pf-calendar">
            {view === "month" && (
              <MonthView
                year={year}
                month={month}
                today={today}
                selected={selected}
                entriesByDay={entriesByDay}
                forecastByDay={forecastByDay}
                units={data.units}
                showWeather={data.layers.weather}
                onSelect={select}
              />
            )}
            {view === "agenda" && (
              <AgendaView
                days={dayRange(from, to)}
                today={today}
                entriesByDay={entriesByDay}
                forecastByDay={forecastByDay}
                tipsByDay={tipsByDay}
                units={data.units}
                showWeather={data.layers.weather}
                onSelect={select}
              />
            )}
            {view === "year" && (
              <YearView
                year={year}
                today={today}
                entriesByDay={entriesByDay}
                onPickMonth={m => {
                  setAnchor(dayKey(new Date(year, m, 1)));
                  setView("month");
                }}
              />
            )}
          </div>

          {view !== "year" && (
            <DayPanel
              key={selected}
              day={selected}
              today={today}
              now={now}
              entries={entriesByDay.get(selected) ?? []}
              tips={(tipsByDay.get(selected) ?? []).filter(t => t.kind !== "overdue")}
              forecast={forecast}
              place={data.place}
              units={data.units}
              layers={data.layers}
              awayForecasts={awayForecasts}
              trainingActivityId={data.trainingActivityId}
              onTrainingActivity={id => update({ trainingActivityId: id })}
              onAdd={openNew}
              onEdit={openEdit}
              onToggleDone={toggleDone}
            />
          )}
        </div>

        <footer className="pf-credits">
          <p>
            Weather from <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>, clothing advice from{" "}
            <Link to="/clocast">CloCast</Link>, game schedules from ESPN, movie dates from <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>
            {data.layers.games && (
              <>
                , game releases from <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>
              </>
            )}
            {data.country !== "US" && data.layers.holidays && (
              <>
                , holidays from <a href="https://date.nager.at" target="_blank" rel="noreferrer">Nager.Date</a>
              </>
            )}
            . This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </footer>
      </div>

      {editing && (
        <ItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSave={item => {
            saveItem(item);
            setSelected(item.day);
            setEditing(null);
          }}
          onDelete={id => {
            deleteItem(id);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
