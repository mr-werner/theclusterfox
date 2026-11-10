import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ChartLine, Compass, Moon, Star, Sun } from "lucide-react";

import AppBar from "../../components/AppBar";
import SessionCard from "./components/SessionCard";
import SessionSetup from "./components/SessionSetup";
import Player from "./components/Player";
import JourneyTab from "./components/JourneyTab";
import MoodHome from "./components/MoodHome";
import { moodBlurb, moodName, PRACTICES } from "./data/moods";
import BreathBuilder from "./components/BreathBuilder";
import { GOAL_ICONS } from "./components/icons";
import { customBreathSession, goalsById, sessions, sessionsById, styleOf } from "./data/sessions";
import { toIsoDay, summarize } from "./model/stats";
import { useCalmData } from "./state/useCalmData";
import { useVoices } from "./audio/voice";
import "./calm.css";
import "./identity.css";

const TABS = [
  { id: "explore", name: "Explore", icon: Compass },
  { id: "journey", name: "Journey", icon: ChartLine },
];

const VIRTUAL = new Set(["breathe", "quick", "favorites", ...PRACTICES.map(p => p.id)]);

export default function CalmPage() {
  const { data, setPrefs, toggleFavorite, addHistory, setMood, clearHistory } = useCalmData();
  const voices = useVoices();
  const [params, setParams] = useSearchParams();
  const [run, setRun] = useState(null); // { session, config }
  const theme = useTheme(data.prefs.theme);

  const tab = params.get("tab") === "journey" ? "journey" : "explore";
  const goalParam = params.get("goal");
  const goal = goalsById.has(goalParam) || VIRTUAL.has(goalParam) ? goalParam : null;
  const open = sessionsById.get(params.get("s"));
  const custom = useMemo(() => customBreathSession(data.prefs.custom), [data.prefs.custom]);

  const go = (next, scroll = true) => {
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v && v !== "explore")));
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSession = id => go({ s: id, from: goal || undefined });

  const startRun = (session, { minutes, voice }) => {
    const p = data.prefs;
    setRun({
      session,
      config: {
        minutes,
        interval: p.interval,
        cueMode: p.cueMode,
        pace: session.custom ? 1 : p.pace,
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
  };

  const onComplete = useCallback(
    (seconds, planned) => {
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
        planned,
        mood: null,
      });
      return { id, minutes: seconds / 60 };
    },
    [run, addHistory]
  );

  const stats = summarize(data.history, toIsoDay(new Date()));
  const favorites = sessions.filter(s => data.favorites.includes(s.id));
  const practice = PRACTICES.find(p => p.id === goal);
  const items =
    goal === "favorites"
      ? favorites
      : practice
        ? sessions.filter(s => styleOf(s) === practice.style)
        : goal === "quick"
        ? sessions.filter(s => s.minutes <= 5).sort((a, b) => a.minutes - b.minutes)
        : sessions.filter(s => s.goal === goal);

  const setupProps = {
    prefs: data.prefs,
    setPrefs,
    voices,
    onToggleFavorite: toggleFavorite,
  };

  let body;
  if (open) {
    body = (
      <SessionSetup
        key={open.id}
        session={open}
        favorite={data.favorites.includes(open.id)}
        onBack={() => go({ goal: params.get("from") || undefined })}
        onStart={cfg => startRun(open, cfg)}
        {...setupProps}
      />
    );
  } else if (tab === "journey") {
    body = <JourneyTab history={data.history} onOpen={openSession} onClear={clearHistory} />;
  } else if (goal === "breathe") {
    body = (
      <div className="cm-breathe">
        <BackLink onClick={() => go({})} />
        <BreathBuilder value={data.prefs.custom} onChange={c => setPrefs({ custom: c })} />
        <SessionSetup session={custom} favorite={false} hideHead onBack={() => go({})} onStart={cfg => startRun(custom, cfg)} {...setupProps} />
      </div>
    );
  } else if (goal) {
    const Icon = GOAL_ICONS[goal] ?? Star;
    body = (
      <section className="cm-mood-list">
        <BackLink onClick={() => go({})} />
        <header className="cm-mood-head">
          <span className="cm-mood-icon" aria-hidden="true">
            <Icon size={24} strokeWidth={1.6} />
          </span>
          <div>
            <h1>{moodName(goal)}</h1>
            <p className="cm-muted">{moodBlurb(goal)}</p>
          </div>
        </header>
        {goal === "techniques" && (
          <button type="button" className="cm-own-rhythm" onClick={() => go({ goal: "breathe" })}>
            <strong>Set your own rhythm</strong>
            <span>Choose your own seconds for in, hold and out.</span>
          </button>
        )}
        {(goal === "awareness" || goal === "bodyscan") && (
          <p className="cm-free-note">There's no breathing pattern to follow here. Let your breath move however it wants.</p>
        )}
        {items.length === 0 ? (
          <p className="cm-muted cm-small">Tap the star on any session to keep it here.</p>
        ) : (
          <div className="cm-cards">
            {items.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                favorite={data.favorites.includes(s.id)}
                onOpen={openSession}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    );
  } else {
    body = <MoodHome favorites={favorites} onPick={id => go({ goal: id })} onOpenSession={openSession} />;
  }

  return (
    <main className="calm-page cm" data-theme={theme}>
      <AppBar appId="calmfox" planTitle={open ? `${open.title} (CalmFox)` : undefined}>
        <nav className="cm-tabs" aria-label="CalmFox">
          {TABS.map(t => {
            const Icon = t.icon;
            const current = !open && tab === t.id;
            return (
              <button key={t.id} type="button" aria-current={current ? "page" : undefined} onClick={() => go({ tab: t.id })}>
                <Icon size={16} aria-hidden="true" />
                <span>{t.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="cm-theme-btn"
            onClick={() => setPrefs({ theme: theme === "dark" ? "light" : "dark" })}
            aria-label={theme === "dark" ? "Switch to the light environment" : "Switch to the dark environment"}
            title={theme === "dark" ? "Daylight" : "Night"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </AppBar>

      <div className="cm-shell">
        {body}

        {stats.sessions > 0 && !open && tab === "explore" && !goal && (
          <p className="cm-quiet-stat">
            {stats.minutes} quiet {stats.minutes === 1 ? "minute" : "minutes"} so far.
          </p>
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
          onPrefs={setPrefs}
          onClose={() => setRun(null)}
        />
      )}
    </main>
  );
}

function BackLink({ onClick }) {
  return (
    <button type="button" className="cm-back" onClick={onClick}>
      <ArrowLeft size={17} aria-hidden="true" /> What do you need?
    </button>
  );
}

// Light by day, dark at night, unless the listener has picked one.
function useTheme(pref) {
  const [dark, setDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const on = e => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pref === "auto" ? (dark ? "dark" : "light") : pref;
}
