import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bug, Check, Heart, Lightbulb, MessageSquare } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import { apps } from "../../app/apps";
import { useAuth } from "../../context/AuthContext";
import { withNext } from "../../lib/redirect";
import { appForPath } from "./pages";
import { sendFeedback } from "./feedbackApi";
import "./site.css";

const KINDS = [
  { id: "bug", label: "Something's broken", icon: Bug, hint: "What were you doing, and what happened instead?" },
  { id: "idea", label: "An idea", icon: Lightbulb, hint: "What would make this better, or what app should we build next?" },
  { id: "praise", label: "Something I like", icon: Heart, hint: "What's working well for you?" },
  { id: "other", label: "Something else", icon: MessageSquare, hint: "Tell us anything." },
];

// Only send people back to pages on this site.
const safeFrom = from => (typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/");

/**
 * Feedback: anyone can say what is or isn't working. It goes to the
 * developer area (/dev), along with the page it was sent from.
 */
export default function FeedbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const from = safeFrom(params.get("from"));
  const fromApp = apps.find(a => a.id === params.get("app")) ?? appForPath(from);

  const [kind, setKind] = useState("bug");
  const [appId, setAppId] = useState(fromApp?.id ?? "");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState({ status: "idle", error: "" });

  const hint = KINDS.find(k => k.id === kind)?.hint;

  async function submit(event) {
    event.preventDefault();
    if (message.trim().length < 3) {
      setState({ status: "idle", error: "Write a little more so we know what you mean." });
      return;
    }
    setState({ status: "sending", error: "" });
    try {
      await sendFeedback({ kind, message, contact, page: from, app: appId || null, website });
      setState({ status: "sent", error: "" });
    } catch (error) {
      setState({ status: "idle", error: error.message });
    }
  }

  return (
    <main className="site-page">
      <SiteHeader />

      <div className="site-container">
        <button type="button" className="site-back" onClick={() => navigate(from)}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>

        <header className="site-heading">
          <p className="eyebrow">HELP SHAPE THE CLUSTER</p>
          <h1>Send feedback</h1>
          <p>
            Tell us what's broken, what's confusing, or what you wish was here. Every message is read by the
            person who builds The ClusterFox.
          </p>
        </header>

        {state.status === "sent" ? (
          <section className="site-card site-sent">
            <span className="site-sent-icon" aria-hidden="true">
              <Check size={26} />
            </span>
            <h2>Thanks, it's on its way.</h2>
            <p>Your feedback was sent{fromApp ? ` about ${fromApp.fullName ?? fromApp.subtitle}` : ""}.</p>
            <div className="site-actions">
              <button type="button" className="site-button site-button--primary" onClick={() => navigate(from)}>
                Go back
              </button>
              <button
                type="button"
                className="site-button"
                onClick={() => {
                  setMessage("");
                  setState({ status: "idle", error: "" });
                }}
              >
                Send another
              </button>
            </div>
          </section>
        ) : (
          <form className="site-card site-form" onSubmit={submit}>
            <fieldset className="site-kinds">
              <legend>What kind of feedback?</legend>
              {KINDS.map(k => {
                const Icon = k.icon;
                return (
                  <label key={k.id} className={`site-kind ${kind === k.id ? "is-on" : ""}`}>
                    <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} />
                    <Icon size={17} aria-hidden="true" />
                    <span>{k.label}</span>
                  </label>
                );
              })}
            </fieldset>

            <label className="site-field">
              <span>Which app?</span>
              <select value={appId} onChange={e => setAppId(e.target.value)}>
                <option value="">The site in general</option>
                {apps.map(app => (
                  <option key={app.id} value={app.id}>
                    {app.fullName ?? app.subtitle}
                  </option>
                ))}
              </select>
            </label>

            <label className="site-field">
              <span>Your message</span>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                maxLength={4000}
                placeholder={hint}
                required
              />
            </label>

            {!isAuthenticated && (
              <label className="site-field">
                <span>
                  Email or name <small>(optional, if you'd like a reply)</small>
                </span>
                <input type="text" value={contact} onChange={e => setContact(e.target.value)} maxLength={200} autoComplete="email" />
              </label>
            )}

            {/* People never see this; bots fill it in. */}
            <label className="site-honeypot" aria-hidden="true">
              Website
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
            </label>

            <p className="site-muted">
              {isAuthenticated ? (
                <>Sent as {user?.name || "your account"}. </>
              ) : (
                <>
                  Sent anonymously. <Link to={withNext("/login", `/feedback?from=${encodeURIComponent(from)}`)}>Sign in</Link> so we can follow up.{" "}
                </>
              )}
              We'll include the page you came from{from !== "/" ? <> (<code>{from}</code>)</> : null}.
            </p>

            {state.error && (
              <p className="site-error" role="alert">
                {state.error}
              </p>
            )}

            <div className="site-actions">
              <button type="submit" className="site-button site-button--primary" disabled={state.status === "sending"}>
                {state.status === "sending" ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
