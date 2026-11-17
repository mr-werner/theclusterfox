import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Mic, MicOff, Radio, RotateCcw, Send, Volume2, VolumeX, X } from "lucide-react";

import { FREQS, LESSONS, PHONETIC_TABLE, freqByKhz, lessonById } from "../data/radio";
import { fmtFreq, gradeCall, parseFreq, turnKnob } from "../model/radio";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

function say(text, on) {
  if (!on || !canSpeak || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.08;
  const voice = window.speechSynthesis.getVoices().find(v => /^en[-_]US/i.test(v.lang));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

// Talk to the tower: tune the radio and make the calls a student pilot
// makes on a real flight, typed or spoken, with feedback on each part.
export default function RadioTab() {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const lesson = lessonById(lessonId);
  const [stepIx, setStepIx] = useState(0);
  const [active, setActive] = useState(121500);
  const [standby, setStandby] = useState(118000);
  const [voice, setVoice] = useState(false);
  const [showBasics, setShowBasics] = useState(false);

  useEffect(() => () => canSpeak && window.speechSynthesis.cancel(), []);

  const pickLesson = id => {
    setLessonId(id);
    setStepIx(0);
  };

  const step = lesson.steps[stepIx];
  const done = stepIx >= lesson.steps.length;
  const nextLesson = LESSONS[LESSONS.findIndex(l => l.id === lessonId) + 1];

  return (
    <div className="fy-stack">
      <section className="fy-card fy-hero">
        <div className="fy-hero-text">
          <p className="fy-kicker">Radio practice</p>
          <h1>Talk to the tower</h1>
          <p>Tune the radio and make each call yourself, typed or out loud. Every call answers four questions: who you're calling, who you are, where you are, and what you want.</p>
        </div>
        <div className="fy-hero-tools">
          {canSpeak && (
            <button type="button" className="fy-btn is-small is-ghost" onClick={() => setVoice(v => !v)} aria-pressed={voice}>
              {voice ? <><Volume2 size={14} /> ATC voice on</> : <><VolumeX size={14} /> ATC voice off</>}
            </button>
          )}
          <button type="button" className="fy-link" aria-expanded={showBasics} onClick={() => setShowBasics(v => !v)}>
            How to say letters and numbers <ChevronDown size={14} />
          </button>
        </div>
      </section>

      {showBasics && (
        <section className="fy-card">
          <h2>The phonetic alphabet</h2>
          <div className="fy-phonetic">
            {PHONETIC_TABLE.map(([l, w]) => (
              <span key={l}><strong>{l}</strong> {w}</span>
            ))}
          </div>
          <p className="fy-muted">
            Say numbers one digit at a time: runway 28 is "two eight", 121.7 is "one two one point seven". Pilots say "niner" for 9 so it isn't heard as "nein", and altitudes in thousands and hundreds: 3,500 is "three thousand five hundred". Once a controller shortens your callsign (Skyhawk 34 Alpha), you can too.
          </p>
        </section>
      )}

      <div className="fy-seg is-wrap" role="tablist" aria-label="Lesson">
        {LESSONS.map(l => (
          <button key={l.id} type="button" role="tab" aria-selected={l.id === lessonId} className={l.id === lessonId ? "is-on" : ""} onClick={() => pickLesson(l.id)}>
            {l.name}
          </button>
        ))}
      </div>

      <div className="fy-radio-layout">
        <div className="fy-stack">
          <RadioPanel active={active} standby={standby} setActive={setActive} setStandby={setStandby} />
          {done ? (
            <section className="fy-card">
              <h2><Check size={18} /> Lesson complete</h2>
              <p className="fy-muted">{lesson.name}: all {lesson.steps.length} calls made.</p>
              <div className="fy-quick">
                <button type="button" className="fy-btn is-small is-ghost" onClick={() => setStepIx(0)}><RotateCcw size={14} /> Do it again</button>
                {nextLesson && <button type="button" className="fy-btn is-small" onClick={() => pickLesson(nextLesson.id)}>Next: {nextLesson.name}</button>}
              </div>
            </section>
          ) : (
            <StepCard key={`${lessonId}-${stepIx}`} lesson={lesson} step={step} ix={stepIx} active={active} voice={voice} onNext={() => setStepIx(i => i + 1)} />
          )}
        </div>
        <section className="fy-card fy-freqs">
          <h2>Frequencies <small>practice airports</small></h2>
          <p className="fy-muted">Tap one to put it in standby, then flip it to active.</p>
          <ul className="fy-list">
            {FREQS.map(f => (
              <li key={f.id}>
                <div>
                  <strong>{f.name}</strong>
                  <p className="fy-muted">{f.note}</p>
                </div>
                <button type="button" className="fy-chip fy-mono" onClick={() => setStandby(f.khz)}>{fmtFreq(f.khz)}</button>
              </li>
            ))}
          </ul>
          <p className="fy-disclaimer">Foxfield and Kestrel Valley are made up. On a real flight, take frequencies from the chart or the Chart Supplement.</p>
        </section>
      </div>
    </div>
  );
}

function RadioPanel({ active, standby, setActive, setStandby }) {
  const [typed, setTyped] = useState("");
  const [bad, setBad] = useState(false);
  const name = freqByKhz(active)?.name;
  const submit = e => {
    e.preventDefault();
    const khz = parseFreq(typed);
    if (khz == null) {
      setBad(true);
      return;
    }
    setStandby(khz);
    setTyped("");
    setBad(false);
  };
  return (
    <section className="fy-card fy-radio" aria-label="COM radio">
      <div className="fy-radio-face">
        <div className="fy-radio-win">
          <span>COM 1 · ACTIVE</span>
          <strong>{fmtFreq(active)}</strong>
          <em>{name ?? "nobody here"}</em>
        </div>
        <button type="button" className="fy-radio-flip" onClick={() => { setActive(standby); setStandby(active); }} aria-label="Swap active and standby">
          <ArrowLeftRight size={20} />
        </button>
        <div className="fy-radio-win is-stby">
          <span>STANDBY</span>
          <strong>{fmtFreq(standby)}</strong>
          <em>{freqByKhz(standby)?.name ?? " "}</em>
        </div>
      </div>
      <div className="fy-radio-knobs">
        <div className="fy-knob" aria-label="Big knob: megahertz">
          <button type="button" onClick={() => setStandby(turnKnob(standby, "big", -1))} aria-label="Big knob down">−</button>
          <span>MHz</span>
          <button type="button" onClick={() => setStandby(turnKnob(standby, "big", 1))} aria-label="Big knob up">+</button>
        </div>
        <div className="fy-knob" aria-label="Small knob: kilohertz">
          <button type="button" onClick={() => setStandby(turnKnob(standby, "small", -1))} aria-label="Small knob down">−</button>
          <span>kHz</span>
          <button type="button" onClick={() => setStandby(turnKnob(standby, "small", 1))} aria-label="Small knob up">+</button>
        </div>
        <form className="fy-radio-type" onSubmit={submit}>
          <input inputMode="decimal" value={typed} onChange={e => { setTyped(e.target.value); setBad(false); }} placeholder="Type 121.7" aria-label="Type a standby frequency" aria-invalid={bad} />
          <button type="submit" className="fy-btn is-small is-ghost">Set</button>
        </form>
      </div>
      {bad && <p className="fy-note is-warn">Radios tune 118.000 to 136.975, like 121.7 or 118.30.</p>}
    </section>
  );
}

function StepCard({ lesson, step, ix, active, voice, onNext }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [shown, setShown] = useState(false);
  const [picked, setPicked] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const tuned = active === step.freq;
  const want = freqByKhz(step.freq);

  // Play what you hear when the step opens (or when you tune the ATIS in).
  useEffect(() => {
    if (step.heard) say(step.heard, voice);
  }, [step, voice]);
  useEffect(() => {
    if (step.kind === "listen" && tuned) say(step.broadcast, voice);
  }, [step, tuned, voice]);
  useEffect(() => () => recRef.current?.abort(), []);

  const transmit = e => {
    e?.preventDefault();
    if (!text.trim()) return;
    if (!tuned) {
      const on = freqByKhz(active);
      setResult({ wrongFreq: true, on });
      return;
    }
    const g = gradeCall(text, step.expect);
    setResult(g);
    if (g.ok) say(step.reply, voice);
  };

  const listen = () => {
    if (!Recognition) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = ev => {
      const said = Array.from(ev.results).map(r => r[0].transcript).join(" ");
      setText(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    setResult(null);
    rec.start();
  };

  const passed = result?.ok || shown || (step.kind === "listen" && picked === step.answer);

  return (
    <section className="fy-card fy-step">
      <div className="fy-row-between">
        <p className="fy-kicker">{lesson.name} · {ix + 1} of {lesson.steps.length}</p>
        <span className={`fy-pill${tuned ? "" : " is-warn"}`}>{tuned ? `On ${want?.name ?? fmtFreq(step.freq)}` : "Not tuned yet"}</span>
      </div>
      <p className="fy-step-situation">{step.situation}</p>
      {step.heard && (
        <blockquote className="fy-heard">
          <Radio size={16} aria-hidden="true" />
          <span>{step.heard}</span>
          {canSpeak && <button type="button" className="fy-icon-btn" onClick={() => say(step.heard, true)} aria-label="Play it"><Volume2 size={16} /></button>}
        </blockquote>
      )}

      {step.kind === "listen" ? (
        tuned ? (
          <>
            <blockquote className="fy-heard is-atis">
              <Radio size={16} aria-hidden="true" />
              <span>{step.broadcast}</span>
              {canSpeak && <button type="button" className="fy-icon-btn" onClick={() => say(step.broadcast, true)} aria-label="Play it"><Volume2 size={16} /></button>}
            </blockquote>
            <p><strong>{step.question}</strong></p>
            <div className="fy-choices">
              {step.choices.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className={`fy-choice${picked === i ? (i === step.answer ? " is-right" : " is-wrong") : ""}`}
                  onClick={() => setPicked(i)}
                  disabled={picked === step.answer}
                >
                  {c}
                </button>
              ))}
            </div>
            {picked != null && picked !== step.answer && <p className="fy-note is-warn">Not quite. Listen again.</p>}
          </>
        ) : (
          <p className="fy-note is-warn">Static. Set {fmtFreq(step.freq)} in standby and flip it to active to hear the {want?.name ?? "broadcast"}.</p>
        )
      ) : (
        <form className="fy-call" onSubmit={transmit}>
          <textarea
            value={text}
            onChange={e => {
              setText(e.target.value);
              setResult(null);
            }}
            rows={3}
            placeholder={listening ? "Listening…" : "Type your call, or tap the mic and say it"}
            aria-label="Your radio call"
          />
          <div className="fy-quick">
            <button type="submit" className="fy-btn is-small" disabled={!text.trim()}><Send size={14} /> Transmit</button>
            {Recognition && (
              <button type="button" className={`fy-btn is-small is-ghost${listening ? " is-live" : ""}`} onClick={listen} aria-pressed={listening}>
                {listening ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Say it</>}
              </button>
            )}
            {!shown && <button type="button" className="fy-link" onClick={() => setShown(true)}>Show me</button>}
          </div>
        </form>
      )}

      {result?.wrongFreq && (
        <p className="fy-note is-warn">
          You transmitted on {fmtFreq(active)}{result.on ? ` (${result.on.name})` : ", where nobody is listening"}. This call goes to {want?.name} on {fmtFreq(step.freq)}.
        </p>
      )}
      {result && !result.wrongFreq && (
        <ul className="fy-grade">
          {result.parts.map(p => (
            <li key={p.label} className={p.ok ? "is-ok" : p.optional ? "is-opt" : "is-miss"}>
              {p.ok ? <Check size={15} /> : <X size={15} />} {p.label}
            </li>
          ))}
        </ul>
      )}
      {result && !result.wrongFreq && !result.ok && <p className="fy-note is-warn">Missing a piece or two. Fix it and transmit again.</p>}
      {shown && step.example && (
        <p className="fy-example"><span>A good call:</span> "{step.example}"</p>
      )}
      {step.note && passed && <p className="fy-muted">{step.note}</p>}
      {passed && step.kind === "call" && step.reply && (
        <blockquote className="fy-heard is-reply">
          <Radio size={16} aria-hidden="true" />
          <span>{step.reply}</span>
        </blockquote>
      )}
      {passed && (
        <button type="button" className="fy-btn" onClick={onNext}>{result?.ok || picked === step.answer ? "Next call" : "Got it, next"}</button>
      )}
    </section>
  );
}
