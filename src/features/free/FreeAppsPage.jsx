import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search, Star } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import FreeAppIcon from "./FreeAppIcon";
import { freeAppCount, freeCategories } from "./freeApps";
import { freeLimits } from "./freeAppDetails";

const FAVORITES_KEY = "clusterfox:free-favorites";

const COMMUNITY = "Open-source community";

function matchesQuery(app, query) {
    return [app.name, app.alt, app.description, app.note, app.country]
        .join(" ")
        .toLowerCase()
        .includes(query);
}

function companyOrigin(app) {
    if (app.country) return app.country;
    return app.openSource ? COMMUNITY : "";
}

// Countries that appear in the list, most common first.
const countryOptions = (() => {
    const counts = {};

    freeCategories.forEach((category) =>
        category.apps.forEach((app) => {
            const origin = companyOrigin(app);
            if (origin) counts[origin] = (counts[origin] || 0) + 1;
        })
    );

    return Object.keys(counts).sort(
        (a, b) => counts[b] - counts[a] || a.localeCompare(b)
    );
})();

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

function loadFavorites() {
    try {
        const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

export default function FreeAppsPage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeFilters, setActiveFilters] = useState([]);
    const [country, setCountry] = useState("");
    const [favorites, setFavorites] = useState(loadFavorites);
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [isStuck, setIsStuck] = useState(false);

    const stickySentinelRef = useRef(null);

    // The filter bar only gets a solid background once it is pinned,
    // so it blends with the page gradient at rest.
    useEffect(() => {
        const sentinel = stickySentinelRef.current;
        if (!sentinel) return undefined;

        const observer = new IntersectionObserver(([entry]) =>
            setIsStuck(!entry.isIntersecting)
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        } catch {
            // Storage can be unavailable (private mode); favorites
            // then last for this visit only.
        }
    }, [favorites]);

    function toggleFilter(id) {
        setActiveFilters((current) =>
            current.includes(id)
                ? current.filter((filterId) => filterId !== id)
                : [...current, id]
        );
    }

    function toggleFavorite(name) {
        setFavorites((current) =>
            current.includes(name)
                ? current.filter((favorite) => favorite !== name)
                : [...current, name]
        );
    }

    function clearFilters() {
        setActiveFilters([]);
        setCountry("");
        setFavoritesOnly(false);
    }

    const hasFilters =
        activeFilters.length > 0 || country !== "" || favoritesOnly;

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
                        filters.every((filter) => filter.test(app)) &&
                        (!country || companyOrigin(app) === country) &&
                        (!favoritesOnly || favorites.includes(app.name))
                ),
            }))
            .filter((category) => category.apps.length > 0);
    }, [
        query,
        activeCategory,
        activeFilters,
        country,
        favoritesOnly,
        favorites,
    ]);

    return (
        <main className="home-page free-page">
            <SiteHeader />

            <section className="free-hero">
                <p className="eyebrow">FREE APPS</p>

                <h1>
                    Free tools that <span>rival paid ones</span>
                </h1>

                <p className="hero-description">
                    A cluster of free software, apps, and websites, with
                    the catches spelled out. Filter to what matters to
                    you and star your favorites.
                </p>
            </section>

            <div ref={stickySentinelRef} aria-hidden="true" />

            <div className={`free-controls ${isStuck ? "is-stuck" : ""}`}>
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

                    <button
                        type="button"
                        className={`free-chip free-chip--favorites ${
                            favoritesOnly ? "active" : ""
                        }`}
                        aria-pressed={favoritesOnly}
                        onClick={() =>
                            setFavoritesOnly((current) => !current)
                        }
                    >
                        <Star size={13} aria-hidden="true" />
                        Favorites
                        {favorites.length > 0 && ` (${favorites.length})`}
                    </button>

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

                    <select
                        className={`free-chip free-select ${
                            country ? "active" : ""
                        }`}
                        value={country}
                        onChange={(event) =>
                            setCountry(event.target.value)
                        }
                        aria-label="Filter by where the company is based"
                    >
                        <option value="">Based anywhere</option>

                        {countryOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>

                    {hasFilters && (
                        <button
                            type="button"
                            className="free-clear-filters"
                            onClick={clearFilters}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {visibleCategories.length === 0 && (
                <p className="free-empty">
                    {favoritesOnly && favorites.length === 0
                        ? "No favorites yet. Tap the star on any app to save it here."
                        : "Nothing matches. Try another search or turn off a filter."}
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
                            {category.apps.map((app) => {
                                const isFavorite = favorites.includes(
                                    app.name
                                );

                                return (
                                    <div
                                        key={app.name}
                                        className="free-card-wrap"
                                    >
                                        <a
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

                                                <div className="free-card-tags">
                                                    {app.openSource && (
                                                        <span className="free-tag free-tag--open">
                                                            Open source
                                                        </span>
                                                    )}

                                                    {app.limits.map(
                                                        (limit) => (
                                                            <span
                                                                key={limit}
                                                                className="free-tag"
                                                            >
                                                                {
                                                                    freeLimits[
                                                                        limit
                                                                    ].label
                                                                }
                                                            </span>
                                                        )
                                                    )}

                                                    {app.country && (
                                                        <span className="free-tag free-tag--country">
                                                            {app.country}
                                                        </span>
                                                    )}
                                                </div>

                                                {app.note && (
                                                    <p className="free-card-note">
                                                        {app.note}
                                                    </p>
                                                )}
                                            </div>
                                        </a>

                                        <button
                                            type="button"
                                            className={`free-favorite ${
                                                isFavorite ? "active" : ""
                                            }`}
                                            aria-pressed={isFavorite}
                                            aria-label={
                                                isFavorite
                                                    ? `Remove ${app.name} from favorites`
                                                    : `Add ${app.name} to favorites`
                                            }
                                            onClick={() =>
                                                toggleFavorite(app.name)
                                            }
                                        >
                                            <Star
                                                size={17}
                                                fill={
                                                    isFavorite
                                                        ? "currentColor"
                                                        : "none"
                                                }
                                            />
                                        </button>
                                    </div>
                                );
                            })}
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
                . Trademarks belong to their owners. Favorites are saved
                in this browser.
            </p>

            <footer className="site-footer">
                <span>The Cluster Fox</span>
                <span className="footer-dot">•</span>
                <span>Build. Learn. Tinker.</span>
            </footer>
        </main>
    );
}
