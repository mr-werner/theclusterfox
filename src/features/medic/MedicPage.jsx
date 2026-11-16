import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, ClipboardCheck, HelpCircle } from "lucide-react";

import AppBar from "../../components/AppBar";
import { LEVELS } from "./data/levels";
import { skillById } from "./data/skills";
import { MODE_IDS } from "./model/sim";
import { useMedicData } from "./state/useMedicData";
import LearnTab from "./components/LearnTab";
import SkillsTab from "./components/SkillsTab";
import QuizTab from "./components/QuizTab";
import Runner from "./components/Runner";
import "./medic.css";
import "./identity.css";

const TABS = [
  { id: "learn", name: "Learn", icon: BookOpen },
  { id: "skills", name: "Practicals", icon: ClipboardCheck },
  { id: "quiz", name: "Questions", icon: HelpCircle },
];

export default function MedicPage() {
  const store = useMedicData();
  const { data, setLevel } = store;
  const [params, setParams] = useSearchParams();

  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : "learn";
  const skill = skillById.get(params.get("skill")) ?? null;
  const mode = MODE_IDS.includes(params.get("mode")) ? params.get("mode") : "crawl";

  const go = useCallback(
    next => {
      const merged = { ...Object.fromEntries(params), ...next };
      setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== null && v !== "")));
    },
    [params, setParams]
  );
  const switchTab = id => {
    setParams(id === "learn" ? {} : { tab: id });
    window.scrollTo({ top: 0 });
  };
  const openSkill = (id, m) => go({ tab: "skills", skill: id, mode: m });
  const setMode = m => go({ mode: m });

  const planTitle = skill ? `Practice ${skill.short}` : tab === "quiz" ? "EMS practice questions" : "Study EMS";

  return (
    <div className="mx">
      <AppBar appId="medicfox" planTitle={planTitle} />

      <div className="mx-wrap">
        {skill ? (
          <Runner key={`${skill.id}:${mode}:${data.level}`} skill={skill} mode={mode} level={data.level} store={store} onMode={setMode} />
        ) : (
          <>
            <header className="mx-hero">
              <p className="mx-kicker">EMS certification practice</p>
              <h1>Study for your {LEVELS.find(l => l.id === data.level)?.short} exam</h1>
              <div className="mx-levels" role="radiogroup" aria-label="Your certification level">
                {LEVELS.map(l => (
                  <button key={l.id} type="button" role="radio" aria-checked={data.level === l.id} className={data.level === l.id ? "is-on" : ""} onClick={() => setLevel(l.id)}>
                    {l.short}
                  </button>
                ))}
              </div>
            </header>

            <nav className="mx-tabs" aria-label="MedicFox sections">
              {TABS.map(t => (
                <button key={t.id} type="button" className={tab === t.id ? "is-on" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => switchTab(t.id)}>
                  <t.icon size={17} aria-hidden="true" />
                  <span>{t.name}</span>
                </button>
              ))}
            </nav>

            {tab === "learn" && <LearnTab level={data.level} />}
            {tab === "skills" && <SkillsTab level={data.level} data={data} onOpen={openSkill} />}
            {tab === "quiz" && <QuizTab level={data.level} data={data} onAnswer={store.recordAnswer} />}

            <p className="mx-disclaimer">
              For study only. Scope of practice, protocols and exam rules are set by your state, your medical director and the NREMT, and they change. Check with your program and NREMT.org.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
