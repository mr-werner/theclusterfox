import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import FreeAppIcon from "./FreeAppIcon";
import { freeAppCount, freeCategories } from "./freeApps";
import { freeLimits } from "./freeAppDetails";

function matchesQuery(app, query) {
    return [app.name, app.alt, app.description]
        .join(" ")
        .toLowerCase()
        .includes(query);
}

// Each filter keeps only the apps that pass its test.
const filterOptions = [
    {
        id: "openSource",
        label: "Open source",
        test: (app) => app.openSource,
    },
    ...Object.entries(freeLimits).map(([id, limit]) => ({
        id,
        label: limit.filterLabel,
        test: (app) => !app.limits.includes(id),
    })),
    {
        id: "finished",
        label: "Finished apps",
        test: (app) => !app.status,
    },
];

export default function FreeAppsPage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeFilters, setActiveFilters] = useState([]);

    function toggleFilter(id) {
        setActiveFilters((current) =>
            current.includes(id)
                ? current.filter((filterId) => filterId !== id)
                : [...current, id]
        );
    }

    const visibleCategories = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        const filters = filterOptions.filter((option) =>
            activeFilters.includes(option.id)
        );

        return freeCategories
            .filter(
                (category) =>
                    activeCategory === "all" ||
                    category.id === activeCategory
            )
            .map((category) => ({
                ...category,
                apps: category.apps.filter(
                    (app) =>
                        (!normalizedQuery ||
                            matchesQuery(app, normalizedQuery)) &&
                        filters.every((filter) => filter.test(app))
                ),
            }))
            .filter((category) => category.apps.length > 0);
    }, [query, activeCategory, activeFilters]);

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

                <div
                    className="free-chips free-filter-chips"
                    role="group"
                    aria-label="Filter by limits"
                >
                    <span className="free-filter-label">Only show</span>

                    {filterOptions.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={`free-chip ${
                                activeFilters.includes(option.id)
                                    ? "active"
                                    : ""
                            }`}
                            aria-pressed={activeFilters.includes(
                                option.id
                            )}
                            onClick={() => toggleFilter(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}

                    {activeFilters.length > 0 && (
                        <button
                            type="button"
                            className="free-clear-filters"
                            onClick={() => setActiveFilters([])}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {visibleCategories.length === 0 && (
                <p className="free-empty">
                    Nothing matches. Try another search or turn off a
                    filter.
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
                                            {app.status && (
                                                <span className="free-card-status">
                                                    {app.status}
                                                </span>
                                            )}
                                            <ExternalLink
                                                size={14}
                                                aria-hidden="true"
                                            />
                                        </h3>

                                        <p className="free-card-alt">
                                            Replaces {app.alt}
                                        </p>

                                        <p>{app.description}</p>

                                        {(app.openSource ||
                                            app.limits.length > 0) && (
                                            <div className="free-card-tags">
                                                {app.openSource && (
                                                    <span className="free-tag free-tag--open">
                                                        Open source
                                                    </span>
                                                )}

                                                {app.limits.map((limit) => (
                                                    <span
                                                        key={limit}
                                                        className="free-tag"
                                                    >
                                                        {
                                                            freeLimits[limit]
                                                                .label
                                                        }
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {app.note && (
                                            <p className="free-card-note">
                                                {app.note}
                                            </p>
                                        )}
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
