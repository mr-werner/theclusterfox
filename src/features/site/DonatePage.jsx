import { Link } from "react-router-dom";
import { Coffee, ExternalLink, Heart, Server, Sparkles } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import { donateLabel, donateUrl } from "./donate";
import "./site.css";

const WHERE = [
  { icon: Server, title: "Keeping it running", text: "Hosting, the database that saves your settings, and the data feeds behind weather, scores and prices." },
  { icon: Sparkles, title: "New apps", text: "Time to build the next ClusterFox originals, free for everyone." },
  { icon: Coffee, title: "No ads, no paywalls", text: "Donations keep The ClusterFox free without selling your attention." },
];

/** Donate: what support pays for, and the button to give. */
export default function DonatePage() {
  return (
    <main className="site-page">
      <SiteHeader />

      <div className="site-container">
        <header className="site-heading">
          <p className="eyebrow">SUPPORT THE CLUSTER</p>
          <h1>Donate</h1>
          <p>
            Every ClusterFox app is free. If one of them saves you time or money, a donation of any size helps keep it
            that way.
          </p>
        </header>

        <section className="site-card site-donate">
          {donateUrl ? (
            <a className="site-button site-button--primary site-button--big" href={donateUrl} target="_blank" rel="noopener noreferrer">
              <Heart size={18} aria-hidden="true" /> Donate{donateLabel ? ` with ${donateLabel}` : ""}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          ) : (
            <div className="site-soon">
              <Heart size={22} aria-hidden="true" />
              <div>
                <strong>Donations open soon.</strong>
                <p>Thanks for wanting to help. In the meantime, telling us what to fix or build helps too.</p>
              </div>
              <Link className="site-button" to="/feedback?from=%2Fdonate">
                Send feedback
              </Link>
            </div>
          )}

          <ul className="site-where">
            {WHERE.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
