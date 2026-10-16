import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import FreeAppIcon from "./FreeAppIcon";
import { freeAppCount, freeCategories } from "./freeApps";

function matchesQuery(app, query) {
    return [app.name, app.alt, app.description]
        .join(" ")
        .toLowerCase()
        .includes(query);
}

export default function FreeAppsPage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");

    const visibleCategories = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return freeCategories
            .filter(
                (category) =>
                    activeCategory === "all" ||
                    category.id === activeCategory
            )
            .map((category) => ({
                ...category,
                apps: normalizedQuery
                    ? category.apps.filter((app) =>
                          matchesQuery(app, normalizedQuery)
                      )
                    : category.apps,
            }))
            .filter((category) => category.apps.length > 0);
    }, [query, activeCategory]);

    return (
        <main className="home-page free-page">
            <SiteHeader />

            <section className="free-hero">
                <p className="eyebrow">FREE APPS</p>

                <h1>
                    Free tools that <span>rival paid ones</span>
                </h1>

                <p className="hero-description">
                    A hand-picked cluster of free software, apps, and
                    websites. Every icon links straight to the official
                    source.
                </p>
            </section>

            <div className="free-controls">
                <label className="free-search">
                    <Search size={18} aria-hidden="true" />

                    <input
                        type="search"
                        value={query}
                        onChange={(event) =>
                            setQuery(event.target.value)
                        }
                        placeholder={`Search ${freeAppCount} apps, or try "Photoshop"`}
                        aria-label="Search free apps"
                    />
                </label>

                <div
                    className="free-chips"
                    role="group"
                    aria-label="Filter by category"
                >
                    <button
                        type="button"
                        className={`free-chip ${
                            activeCategory === "all" ? "active" : ""
                        }`}
                        onClick={() => setActiveCategory("all")}
                    >
                        All
                    </button>

                    {freeCategories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            className={`free-chip ${
                                activeCategory === category.id
                                    ? "active"
                                    : ""
                            }`}
                            onClick={() =>
                                setActiveCategory(category.id)
                            }
                        >
                            {category.name}
                        </button>
                    ))}
                </div>
            </div>

            {visibleCategories.length === 0 && (
                <p className="free-empty">
                    Nothing matches “{query}”. Try another app or the
                    paid product you want to replace.
                </p>
            )}

            {visibleCategories.map((category) => {
                const CategoryIcon = category.icon;

                return (
                    <section
                        key={category.id}
                        id={category.id}
                        className="free-category"
                    >
                        <div className="section-heading">
                            <div className="free-category-title">
                                <span className="free-category-icon">
                                    <CategoryIcon
                                        size={22}
                                        strokeWidth={1.8}
                                    />
                                </span>

                                <div>
                                    <h2>{category.name}</h2>
                                    <p>{category.description}</p>
                                </div>
                            </div>

                            <span className="app-count">
                                {category.apps.length}{" "}
                                {category.apps.length === 1
                                    ? "app"
                                    : "apps"}
                            </span>
                        </div>

                        <div className="free-grid">
                            {category.apps.map((app) => (
                                <a
                                    key={app.name}
                                    href={app.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="free-card"
                                    aria-label={`${app.name}, replaces ${app.alt}. Opens the official site.`}
                                >
                                    <FreeAppIcon app={app} />

                                    <div className="free-card-body">
                                        <h3>
                                            {app.name}
                                            <ExternalLink
                                                size={14}
                                                aria-hidden="true"
                                            />
                                        </h3>

                                        <p className="free-card-alt">
                                            Replaces {app.alt}
                                        </p>

                                        <p>{app.description}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </section>
                );
            })}

            <p className="free-attribution">
                Brand icons from{" "}
                <a
                    href="https://simpleicons.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Simple Icons
                </a>
                . Trademarks belong to their owners.
            </p>

            <footer className="site-footer">
                <span>The Cluster Fox</span>
                <span className="footer-dot">•</span>
                <span>Build. Learn. Tinker.</span>
            </footer>
        </main>
    );
}
