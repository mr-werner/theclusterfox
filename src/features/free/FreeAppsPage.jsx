import { useEffect, useMemo, useState } from "react";
import {
    Check,
    ChevronDown,
    ExternalLink,
    Search,
    Star,
} from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import FreeAppIcon from "./FreeAppIcon";
import { freeAppCount, freeCategories } from "./freeApps";
import { freeLimits } from "./freeAppDetails";

const FAVORITES_KEY = "clusterfox:free-favorites";
const HIDDEN_KEY = "clusterfox:free-hidden";

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

// Things a visitor can choose to hide. Checked means "hide apps with this".
const hideOptions = [
    ...Object.entries(freeLimits).map(([id, limit]) => ({
        id,
        label: limit.label,
        test: (app) => app.limits.includes(id),
    })),
    {
        id: "unfinished",
        label: "Unfinished apps",
        test: (app) => Boolean(app.status),
    },
];

function listFormat(items) {
    if (items.length <= 2) return items.join(" or ");
    return `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}`;
}

function loadSavedList(key) {
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

export default function FreeAppsPage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [hidden, setHidden] = useState(() =>
        loadSavedList(HIDDEN_KEY)
    );
    const [openSourceOnly, setOpenSourceOnly] = useState(false);
    const [country, setCountry] = useState("");
    const [favorites, setFavorites] = useState(() =>
        loadSavedList(FAVORITES_KEY)
    );
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    // Storage can be unavailable (private mode); choices then last
    // for this visit only.
    useEffect(() => {
        try {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
            localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
        } catch {
            // Ignore.
        }
    }, [favorites, hidden]);

    function toggleHidden(id) {
        setHidden((current) =>
            current.includes(id)
                ? current.filter((hiddenId) => hiddenId !== id)
                : [...current, id]
        );
    }

    const allHidden = hidden.length === hideOptions.length;

    function toggleHideAll() {
        setHidden(allHidden ? [] : hideOptions.map((option) => option.id));
    }

    function toggleFavorite(name) {
        setFavorites((current) =>
            current.includes(name)
                ? current.filter((favorite) => favorite !== name)
                : [...current, name]
        );
    }

    function clearFilters() {
        setHidden([]);
        setOpenSourceOnly(false);
        setCountry("");
        setFavoritesOnly(false);
    }

    const activeFilterCount =
        hidden.length +
        (openSourceOnly ? 1 : 0) +
        (country ? 1 : 0) +
        (favoritesOnly ? 1 : 0);

    const visibleCategories = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        const hiddenTests = hideOptions.filter((option) =>
            hidden.includes(option.id)
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
                        !hiddenTests.some((option) => option.test(app)) &&
                        (!openSourceOnly || app.openSource) &&
                        (!country || companyOrigin(app) === country) &&
                        (!favoritesOnly || favorites.includes(app.name))
                ),
            }))
            .filter((category) => category.apps.length > 0);
    }, [
        query,
        activeCategory,
        hidden,
        openSourceOnly,
        country,
        favoritesOnly,
        favorites,
    ]);

    const visibleCount = visibleCategories.reduce(
        (total, category) => total + category.apps.length,
        0
    );

    const summary = [];

    if (hidden.length > 0) {
        summary.push(
            `hiding apps with ${listFormat(
                hideOptions
                    .filter((option) => hidden.includes(option.id))
                    .map((option) => option.label.toLowerCase())
            )}`
        );
    }

    if (openSourceOnly) summary.push("open source only");
    if (country) summary.push(`based in ${country}`);
    if (favoritesOnly) summary.push("favorites only");

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

                <div className="free-filter-group">
                    <span className="free-filter-label">Category</span>

                    <select
                        className="free-select free-mobile-only"
                        value={activeCategory}
                        onChange={(event) =>
                            setActiveCategory(event.target.value)
                        }
                        aria-label="Category"
                    >
                        <option value="all">All categories</option>

                        {freeCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>

                    <div
                        className="free-chips free-desktop-only"
                        role="group"
                        aria-label="Category"
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

                <button
                    type="button"
                    className="free-select free-panel-toggle free-mobile-only"
                    aria-expanded={isFilterPanelOpen}
                    onClick={() =>
                        setIsFilterPanelOpen((current) => !current)
                    }
                >
                    Preferences
                    {activeFilterCount > 0 && ` (${activeFilterCount} on)`}
                    <ChevronDown
                        size={16}
                        className={isFilterPanelOpen ? "open" : ""}
                        aria-hidden="true"
                    />
                </button>

                <div
                    className={`free-filter-panel ${
                        isFilterPanelOpen ? "open" : ""
                    }`}
                >
                    <div className="free-filter-group">
                        <span className="free-filter-label">
                            Hide apps with
                        </span>

                        <div
                            className="free-chips"
                            role="group"
                            aria-label="Hide apps with"
                        >
                            {hideOptions.map((option) => {
                                const isOn = hidden.includes(option.id);

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`free-chip free-check ${
                                            isOn ? "active" : ""
                                        }`}
                                        aria-pressed={isOn}
                                        onClick={() =>
                                            toggleHidden(option.id)
                                        }
                                    >
                                        <span
                                            className="free-checkbox"
                                            aria-hidden="true"
                                        >
                                            {isOn && <Check size={12} />}
                                        </span>
                                        {option.label}
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                className="free-text-button"
                                onClick={toggleHideAll}
                            >
                                {allHidden ? "Show all" : "Hide all"}
                            </button>
                        </div>
                    </div>

                    <div className="free-filter-group">
                        <span className="free-filter-label">Only show</span>

                        <div
                            className="free-chips"
                            role="group"
                            aria-label="Only show"
                        >
                            <button
                                type="button"
                                className={`free-chip free-check ${
                                    favoritesOnly ? "active" : ""
                                }`}
                                aria-pressed={favoritesOnly}
                                onClick={() =>
                                    setFavoritesOnly((current) => !current)
                                }
                            >
                                <Star
                                    size={13}
                                    fill={
                                        favoritesOnly
                                            ? "currentColor"
                                            : "none"
                                    }
                                    aria-hidden="true"
                                />
                                Favorites
                                {favorites.length > 0 &&
                                    ` (${favorites.length})`}
                            </button>

                            <button
                                type="button"
                                className={`free-chip free-check ${
                                    openSourceOnly ? "active" : ""
                                }`}
                                aria-pressed={openSourceOnly}
                                onClick={() =>
                                    setOpenSourceOnly((current) => !current)
                                }
                            >
                                <span
                                    className="free-checkbox"
                                    aria-hidden="true"
                                >
                                    {openSourceOnly && <Check size={12} />}
                                </span>
                                Open source
                            </button>

                            <select
                                className={`free-chip free-select ${
                                    country ? "active" : ""
                                }`}
                                value={country}
                                onChange={(event) =>
                                    setCountry(event.target.value)
                                }
                                aria-label="Where the company is based"
                            >
                                <option value="">Based anywhere</option>

                                {countryOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <p className="free-summary" aria-live="polite">
                    Showing {visibleCount} of {freeAppCount} apps
                    {summary.length > 0 && `, ${summary.join(", ")}`}.
                    {activeFilterCount > 0 && (
                        <button
                            type="button"
                            className="free-text-button"
                            onClick={clearFilters}
                        >
                            Reset
                        </button>
                    )}
                </p>
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
