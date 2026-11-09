import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChefHat, Compass, BookHeart, UserRound, Timer, Play } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import DiscoverTab from "./components/DiscoverTab";
import RecipeDetail from "./components/RecipeDetail";
import PrepChecklist from "./components/PrepChecklist";
import CookMode from "./components/CookMode";
import Feedback from "./components/Feedback";
import PlanB from "./components/PlanB";
import MyRecipesTab from "./components/MyRecipesTab";
import ProfileTab from "./components/ProfileTab";
import { clockText } from "./components/format";
import { recipesById } from "./data/recipes";
import { emptyFilters } from "./model/discover";
import * as S from "./model/session";
import { useCookData } from "./state/useCookData";
import { ringAlarm, useNow } from "./state/device";
import "./cook.css";

const TABS = [
  { id: "discover", name: "Discover", icon: Compass },
  { id: "mine", name: "My Recipes", icon: BookHeart },
  { id: "profile", name: "My Kitchen", icon: UserRound },
];

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function CookPage() {
  const store = useCookData();
  const { data, setPrefs, updateSession, addHistory } = store;
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [planB, setPlanB] = useState(false);
  const [finished, setFinished] = useState(null); // { recipeId, minutes, servings }

  const recipe = recipesById.get(params.get("r")) ?? null;
  const session = recipe ? data.sessions[recipe.id] ?? null : null;
  const requested = recipe ? params.get("view") : null;
  const view = finished && recipe?.id === finished.recipeId ? "done" : requested === "cook" && session ? "cook" : requested === "prep" && session ? "prep" : recipe ? "detail" : "tabs";
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "discover";

  const go = useCallback(
    (next, { replace = false } = {}) => {
      setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== "")), { replace });
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );

  // One clock drives every timer display and alarm, whichever screen is open.
  const hasTimers = Object.values(data.sessions).some(s => s.timers.some(t => t.endsAt));
  const now = useNow(hasTimers);
  useEffect(() => {
    for (const s of Object.values(data.sessions)) {
      for (const t of S.dueTimers(s, now)) {
        const r = recipesById.get(s.recipeId);
        ringAlarm(`${t.label} timer is done`, `${r.title}, step ${t.step + 1}`);
        updateSession(s.recipeId, x => (x ? S.markRung(x, t.step) : x));
      }
    }
  }, [now, data.sessions, updateSession]);

  const update = useCallback(fn => recipe && updateSession(recipe.id, s => (s ? fn(s) : s)), [recipe, updateSession]);

  const startPrep = servings => {
    updateSession(recipe.id, S.newSession(recipe, servings));
    go({ r: recipe.id, view: "prep" });
  };

  const resume = id => {
    const s = data.sessions[id];
    go({ r: id, view: s?.phase === "cooking" ? "cook" : "prep" });
  };

  const finishCooking = () => {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000));
    setFinished({ recipeId: recipe.id, minutes, servings: session.servings });
  };

  const saveFeedback = answers => {
    addHistory({
      id: newId(),
      recipeId: recipe.id,
      title: recipe.title,
      date: new Date().toISOString(),
      servings: finished.servings,
      minutes: finished.minutes,
      status: "cooked",
      rating: answers.rating ?? null,
      again: answers.again ?? null,
      timing: answers.timing ?? null,
      note: answers.note ?? "",
    });
    updateSession(recipe.id, null);
    setFinished(null);
    go({ tab: "mine" });
  };

  const endSession = (reason, mode) => {
    setPlanB(false);
    if (mode === "end") {
      addHistory({
        id: newId(),
        recipeId: recipe.id,
        title: recipe.title,
        date: new Date().toISOString(),
        servings: session.servings,
        minutes: 0,
        status: "stopped",
        rating: null,
        again: null,
        timing: null,
        note: reason ?? "",
      });
      updateSession(recipe.id, null);
      go({ tab: "mine" });
    } else {
      go({ tab: "mine" });
    }
  };

  // The newest unfinished session, shown as a banner when you're elsewhere.
  const resumeTarget = Object.values(data.sessions)
    .filter(s => s.recipeId !== recipe?.id || view === "detail")
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const resumeRecipe = resumeTarget && recipesById.get(resumeTarget.recipeId);
  const runningTimer = resumeTarget?.timers.find(t => t.endsAt);

  const fullScreen = view === "cook" || view === "done";

  return (
    <main className="cook-page ck" data-theme={data.prefs.theme}>
      {!fullScreen && (
        <div className="ck-topbar">
          <SiteHeader />
        </div>
      )}

      {view === "cook" && (
        <CookMode
          recipe={recipe}
          session={session}
          prefs={data.prefs}
          setPrefs={setPrefs}
          update={update}
          now={now}
          onExit={() => go({ r: recipe.id })}
          onFinish={finishCooking}
          onPlanB={() => setPlanB(true)}
        />
      )}

      {view === "done" && <Feedback recipe={recipe} minutes={finished.minutes} onSave={saveFeedback} />}

      {!fullScreen && (
        <div className="ck-shell">
          {view === "tabs" && (
            <header className="ck-hero">
              <div className="ck-logo" aria-hidden="true">
                <ChefHat size={28} />
              </div>
              <div>
                <p className="ck-eyebrow">COOKFOX</p>
                <h1>What sounds good tonight?</h1>
                <p className="ck-lede">
                  Recipes that fit how you like to eat, with step-by-step cooking that remembers where you left off. Free, no account, nothing to install.
                </p>
              </div>
            </header>
          )}

          {resumeRecipe && view !== "prep" && (
            <button type="button" className="ck-resume" onClick={() => resume(resumeRecipe.id)}>
              <Play size={18} aria-hidden="true" />
              <span>
                <strong>Pick up where you left off:</strong> {resumeRecipe.title}
                {resumeTarget.phase === "cooking" ? `, step ${resumeTarget.step + 1}` : ""}
              </span>
              {runningTimer && (
                <span className="ck-timer-chip">
                  <Timer size={13} aria-hidden="true" /> {runningTimer.label} {S.timerState(runningTimer, now).finished ? "done!" : clockText(S.timerState(runningTimer, now).left)}
                </span>
              )}
            </button>
          )}

          {view === "tabs" && (
            <>
              <nav className="ck-tabs" aria-label="CookFox">
                {TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go({ tab: t.id === "discover" ? undefined : t.id }, { replace: true })}>
                      <Icon size={17} aria-hidden="true" />
                      {t.name}
                    </button>
                  );
                })}
              </nav>

              {tab === "discover" && (
                <DiscoverTab
                  data={data}
                  filters={filters}
                  setFilters={setFilters}
                  onOpen={id => go({ r: id })}
                  onToggleFavorite={store.toggleFavorite}
                  onEditProfile={() => go({ tab: "profile" })}
                />
              )}
              {tab === "mine" && (
                <MyRecipesTab
                  data={data}
                  now={now}
                  onOpen={id => go({ r: id })}
                  onResume={resume}
                  onDiscard={id => updateSession(id, null)}
                  onToggleFavorite={store.toggleFavorite}
                  onCookAgain={h => go({ r: h.recipeId, servings: h.servings })}
                  onRemoveHistory={store.removeHistory}
                  onClearHistory={store.clearHistory}
                />
              )}
              {tab === "profile" && <ProfileTab data={data} setPrefs={setPrefs} setProfile={store.setProfile} resetProfile={store.resetProfile} />}
            </>
          )}

          {view === "detail" && (
            <RecipeDetail
              key={`${recipe.id}-${params.get("servings") ?? ""}`}
              recipe={recipe}
              data={data}
              setPrefs={setPrefs}
              initialServings={params.get("servings") ? Number(params.get("servings")) : undefined}
              favorite={data.favorites.includes(recipe.id)}
              onToggleFavorite={store.toggleFavorite}
              onBack={() => go({})}
              onStart={startPrep}
              onResume={() => resume(recipe.id)}
              onDiscardSession={() => updateSession(recipe.id, null)}
              onPlanB={() => setPlanB(true)}
            />
          )}

          {view === "prep" && (
            <PrepChecklist
              recipe={recipe}
              session={session}
              prefs={data.prefs}
              setPrefs={setPrefs}
              update={update}
              onBack={() => go({ r: recipe.id })}
              onCook={() => {
                update(S.startCooking);
                go({ r: recipe.id, view: "cook" });
              }}
              onPlanB={() => setPlanB(true)}
            />
          )}

          <p className="ck-credit">
            CookFox recipes are original to The ClusterFox. Nutrition is estimated and not medical advice. With allergies, always check labels.
          </p>
        </div>
      )}

      {planB && recipe && <PlanB recipe={recipe} cooking={view === "cook"} onClose={() => setPlanB(false)} onEndSession={endSession} />}
    </main>
  );
}
