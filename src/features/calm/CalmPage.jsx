import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flower2, ChartLine, Compass, Star } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import SessionCard from "./components/SessionCard";
import SessionSetup from "./components/SessionSetup";
import Player from "./components/Player";
import JourneyTab from "./components/JourneyTab";
import { GOAL_ICONS } from "./components/icons";
import { goals, goalsById, sessions, sessionsById } from "./data/sessions";
import { toIsoDay, summarize } from "./model/stats";
import { useCalmData } from "./state/useCalmData";
import { useVoices } from "./audio/voice";
import "./calm.css";

const TABS = [
  { id: "explore", name: "Explore", icon: Compass },
  { id: "journey", name: "Journey", icon: ChartLine },
];

export default function CalmPage() {
  const { data, setPrefs, toggleFavorite, addHistory, setMood, clearHistory } = useCalmData();
  const voices = useVoices();
  const [params, setParams] = useSearchParams();
  const [run, setRun] = useState(null); // { session, config }

  const tab = params.get("tab") === "journey" ? "journey" : "explore";
  const goal = goalsById.has(params.get("goal")) || params.get("goal") === "favorites" ? params.get("goal") : "all";
  const open = sessionsById.get(params.get("s"));

  const go = (next, scroll = true) => {
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v && v !== "all" && v !== "explore")));
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSession = id => go({ s: id });

  const onComplete = useCallback(
    seconds => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const s = run.session;
      addHistory({
        id,
        date: toIsoDay(new Date()),
        startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
        sessionId: s.id,
        title: s.title,
        goal: s.goal,
        minutes: Math.round((seconds / 60) * 10) / 10,
        planned: run.config.minutes,
        mood: null,
      });
      return { id, minutes: seconds / 60 };
    },
    [run, addHistory]
  );

  const stats = summarize(data.history, toIsoDay(new Date()));
  const favorites = sessions.filter(s => data.favorites.includes(s.id));
  const groups =
    goal === "all"
      ? goals.map(g => ({ goal: g, items: sessions.filter(s => s.goal === g.id) }))
      : goal === "favorites"
        ? [{ goal: { id: "favorites", name: "Favorites", blurb: "The sessions you've starred." }, items: favorites }]
        : [{ goal: goalsById.get(goal), items: sessions.filter(s => s.goal === goal) }];

  return (
    <main className="calm-page cm">
      <SiteHeader />

      <div className="cm-shell">
        <header className="cm-hero">
          <div className="cm-logo" aria-hidden="true">
            <Flower2 size={26} />
          </div>
          <div>
            <p className="cm-eyebrow">CALMFOX</p>
            <h1>Breathe in. Slow down.</h1>
            <p className="cm-lede">
              Guided meditations and breathing exercises with a calm voice that checks in as often as you choose.
              Free, no account, nothing to install.
            </p>
            {stats.sessions > 0 && (
              <p className="cm-pill">
                {stats.minutes} min · {stats.sessions} {stats.sessions === 1 ? "session" : "sessions"}
                {stats.streak > 1 ? ` · ${stats.streak}-day streak` : ""}
              </p>
            )}
          </div>
        </header>

        {!open && (
          <nav className="cm-tabs" aria-label="CalmFox">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go({ tab: t.id })}>
                  <Icon size={17} aria-hidden="true" />
                  {t.name}
                </button>
              );
            })}
          </nav>
        )}

        {open ? (
          <SessionSetup
            key={open.id}
            session={open}
            prefs={data.prefs}
            setPrefs={setPrefs}
            voices={voices}
            favorite={data.favorites.includes(open.id)}
            onToggleFavorite={toggleFavorite}
            onBack={() => go({ goal: params.get("from") || undefined })}
            onStart={({ minutes, voice }) => {
              const p = data.prefs;
              setRun({
                session: open,
                config: {
                  minutes,
                  interval: p.interval,
                  cueMode: p.cueMode,
                  pace: p.pace,
                  voice,
                  rate: p.rate,
                  pitch: p.pitch,
                  voiceVolume: p.voiceVolume,
                  ambient: p.ambient,
                  ambientVolume: p.ambientVolume,
                  bells: p.bells,
                  seed: Math.floor(Math.random() * 1e9) + 1,
                },
              });
            }}
          />
        ) : tab === "journey" ? (
          <JourneyTab history={data.history} onOpen={openSession} onClear={clearHistory} />
        ) : (
          <section className="cm-explore">
            <div className="cm-goals" role="group" aria-label="Goals">
              <button type="button" aria-pressed={goal === "all"} onClick={() => go({}, false)}>
                All
              </button>
              <button type="button" aria-pressed={goal === "favorites"} onClick={() => go({ goal: "favorites" }, false)}>
                <Star size={15} aria-hidden="true" /> Favorites
              </button>
              {goals.map(g => {
                const Icon = GOAL_ICONS[g.id];
                return (
                  <button key={g.id} type="button" aria-pressed={goal === g.id} onClick={() => go({ goal: g.id }, false)}>
                    <Icon size={15} aria-hidden="true" /> {g.name}
                  </button>
                );
              })}
            </div>

            {groups.map(({ goal: g, items }) => {
              const Icon = GOAL_ICONS[g.id] ?? Star;
              return (
                <div key={g.id} className="cm-group">
                  <div className="cm-group-head">
                    <Icon size={18} aria-hidden="true" />
                    <h2>{g.name}</h2>
                    <p className="cm-muted">{g.blurb}</p>
                  </div>
                  {items.length === 0 ? (
                    <p className="cm-muted cm-small">Tap the star on any session to keep it here.</p>
                  ) : (
                    <div className="cm-cards">
                      {items.map(s => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          favorite={data.favorites.includes(s.id)}
                          onOpen={id => go({ s: id, from: goal })}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <p className="cm-credit">
          CalmFox is for everyday relaxation, not medical care. If breathing exercises make you dizzy, stop and breathe
          normally. If you're struggling, please reach out to a doctor or a local support line.
        </p>
      </div>

      {run && (
        <Player
          key={run.config.seed}
          session={run.session}
          config={run.config}
          onComplete={onComplete}
          onMood={setMood}
          onClose={() => setRun(null)}
        />
      )}
    </main>
  );
}
