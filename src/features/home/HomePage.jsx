import { apps } from "../../app/apps";
import AppTile from "../../components/AppTile";
import SiteHeader from "../../components/SiteHeader";

export default function HomePage() {
    return (
        <main className="home-page">
            <SiteHeader />

            <section className="hero">
                <div className="fox-mark">
                    <img
                        src="/clusterfox-logo.png"
                        alt="The Cluster Fox"
                    />
                </div>

                <p className="eyebrow">
                    WELCOME TO
                </p>

                <h1>
                    THE CLUSTER <span>FOX</span>
                </h1>

                <p className="tagline">
                    A cluster of useful & not so useful things.
                </p>

                <p className="hero-description">
                    Tools, experiments, and ideas built to make everyday things
                    a little more useful.
                </p>
            </section>

            <section className="apps-section">
                <div className="section-heading">
                    <div>
                        <p className="section-label">
                            EXPLORE
                        </p>

                        <h2>Apps</h2>
                    </div>

                    <span className="app-count">
                        {apps.length}{" "}
                        {apps.length === 1 ? "app" : "apps"}
                    </span>
                </div>

                <div className="app-grid">
                    {apps.map((app) => (
                        <AppTile
                            key={app.id}
                            app={app}
                        />
                    ))}
                </div>
            </section>

            <footer className="site-footer">
                <span>The Cluster Fox</span>
                <span className="footer-dot">•</span>
                <span>Build. Learn. Tinker.</span>
            </footer>
        </main>
    );
}