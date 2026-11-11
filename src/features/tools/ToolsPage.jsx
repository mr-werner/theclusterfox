import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, BookOpen, Calculator, ChevronRight, Clock, Network, Search, Star, Table2, Wrench } from "lucide-react";
import AppBar from "../../components/AppBar";
import { CATEGORIES, CALCS, TABLES, BUILDERS, CALC_ALIASES, calcById, tableById, builderById, categoryById, search } from "./registry";
import { usePrefs } from "./state/usePrefs";
import CalcView from "./components/CalcView";
import TableView from "./components/TableView";
import ConverterView from "./components/ConverterView";
import FrameView from "./components/FrameView";
import { GdtIndex, GdtRoute } from "./design/GdtView";
import { MakeRoute } from "./design/MakeView";
import { CALLOUTS as GDT_CALLOUTS } from "./design/gdtModel";
import "./tools.css";
import "./identity.css";

const POPULAR = ["pressure-drop", "beam", "psychrometrics", "voltage-drop", "tank-volume", "section-properties"];

export default function ToolsPage() {
  const prefsApi = usePrefs();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e) {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="tools-page tf">
      <AppBar appId="toolfox" backTo={toolsParent} />
      <div className="tf-shell">
        <aside className="tf-side" aria-label="Engineer ToolFox sections">
          <Link to="/tools" className="tf-brand">
            <span className="tf-brand-mark" aria-hidden="true">
              <Wrench size={18} />
            </span>
            <span>
              <span className="tf-brand-text">
                <small>Engineer</small>
                <span>Tool<strong>Fox</strong></span>
              </span>
            </span>
          </Link>
          <button type="button" className="tf-side-search" onClick={() => setPaletteOpen(true)}>
            <Search size={15} aria-hidden="true" />
            Search
            <kbd>/</kbd>
          </button>
          <nav className="tf-side-nav">
            <NavLink to="/tools/convert" className="tf-side-link">
              <ArrowLeftRight size={16} aria-hidden="true" /> Unit converter
            </NavLink>
            {CATEGORIES.map((c) => (
              <NavLink key={c.id} to={`/tools/c/${c.id}`} className="tf-side-link" style={{ "--tf-cat": c.hue }}>
                <c.icon size={16} aria-hidden="true" /> {c.name}
              </NavLink>
            ))}
            <NavLink to="/tools/data" className="tf-side-link">
              <Table2 size={16} aria-hidden="true" /> All reference data
            </NavLink>
          </nav>
          <div className="tf-system" role="radiogroup" aria-label="Default units">
            <span>Default units</span>
            <div className="tf-segmented is-small">
              {[
                ["si", "Metric"],
                ["us", "US"],
              ].map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={prefsApi.prefs.system === k} onClick={() => prefsApi.setSystem(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="tf-main">
          <Routes>
            <Route index element={<Home prefsApi={prefsApi} openSearch={() => setPaletteOpen(true)} />} />
            <Route path="c/:cat" element={<CategoryRoute prefsApi={prefsApi} />} />
            <Route path="calc/:id" element={<CalcRoute prefsApi={prefsApi} />} />
            <Route path="data" element={<AllData />} />
            <Route path="data/:id" element={<TableRoute prefsApi={prefsApi} />} />
            <Route path="frame" element={<FrameView prefsApi={prefsApi} />} />
            <Route path="gdt" element={<Touch prefsApi={prefsApi} id="builder:gdt"><GdtIndex /></Touch>} />
            <Route path="gdt/:id" element={<Touch prefsApi={prefsApi} id="builder:gdt"><GdtRoute prefsApi={prefsApi} /></Touch>} />
            <Route path="make" element={<Touch prefsApi={prefsApi} id="builder:make"><MakeRoute prefsApi={prefsApi} /></Touch>} />
            <Route path="make/methods" element={<Touch prefsApi={prefsApi} id="builder:methods"><MakeRoute prefsApi={prefsApi} library /></Touch>} />
            <Route path="convert" element={<ConverterRoute prefsApi={prefsApi} />} />
            <Route path="convert/:dim" element={<ConverterRoute prefsApi={prefsApi} />} />
            <Route path="*" element={<Home prefsApi={prefsApi} openSearch={() => setPaletteOpen(true)} />} />
          </Routes>
        </div>
      </div>
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
    </main>
  );
}

/**
 * The page above any Engineer ToolFox page, for the back button when the
 * page was opened directly: a calculator goes to its category, a table to
 * all reference data, a GD&T callout to the explorer, and so on up.
 */
function toolsParent({ pathname }) {
  const parts = pathname.replace(/^\/tools\/?/, "").split("/").filter(Boolean);
  const [kind, id] = parts;
  const builder = BUILDERS.find((b) => b.path === pathname.replace(/\/+$/, ""));
  if (builder) return `/tools/c/${builder.cat}`;
  if (kind === "calc" && id) return calcById[id] ? `/tools/c/${calcById[id].cat}` : "/tools";
  if (kind === "data" && id) return "/tools/data";
  if (kind === "gdt" && id) return "/tools/gdt";
  if (kind === "convert" && id) return "/tools/convert";
  return "/tools";
}

/** Remember a builder page in "Recently used". */
function Touch({ prefsApi, id, children }) {
  const { touch } = prefsApi;
  useEffect(() => {
    touch(id);
  }, [touch, id]);
  return children;
}

function CalcRoute({ prefsApi }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const alias = CALC_ALIASES[id];
  if (alias) {
    const next = new URLSearchParams({ ...alias.params, ...Object.fromEntries(params) });
    return <Navigate to={`/tools/calc/${alias.to}?${next}`} replace />;
  }
  return <CalcView key={id} id={id} prefsApi={prefsApi} />;
}
function TableRoute({ prefsApi }) {
  const { id } = useParams();
  return <TableView key={id} id={id} prefsApi={prefsApi} />;
}
function ConverterRoute({ prefsApi }) {
  const { dim } = useParams();
  return <ConverterView key={dim || "length"} dim={dim} prefsApi={prefsApi} />;
}

const itemFor = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "calc" && calcById[id]) return { key, kind, ...calcById[id], path: `/tools/calc/${id}` };
  if (kind === "builder" && builderById[id]) return { key, kind, ...builderById[id] };
  if (kind === "table" && tableById[id]) return { key, kind, ...tableById[id], path: `/tools/data/${id}` };
  if (kind === "convert") return { key, kind, id: "convert", name: "Unit converter", blurb: "Every unit at once.", cat: null, path: "/tools/convert" };
  return null;
};

function ToolCard({ item }) {
  const cat = item.cat ? categoryById[item.cat] : null;
  const Icon = item.icon || (item.kind === "table" ? Table2 : item.kind === "convert" ? ArrowLeftRight : item.kind === "builder" ? Network : item.kind === "guide" ? BookOpen : Calculator);
  return (
    <Link to={item.path} className="tf-tool-card" style={cat ? { "--tf-cat": cat.hue } : undefined}>
      <span className="tf-tool-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="tf-tool-text">
        <strong>{item.name}</strong>
        <span>{item.blurb}</span>
      </span>
      <ChevronRight size={16} className="tf-tool-go" aria-hidden="true" />
    </Link>
  );
}

function Home({ prefsApi, openSearch }) {
  const { prefs } = prefsApi;
  const favorites = prefs.favorites.map(itemFor).filter(Boolean);
  const recent = prefs.recent.map(itemFor).filter(Boolean).filter((r) => !prefs.favorites.includes(r.key)).slice(0, 4);

  useEffect(() => {
    document.title = "Engineer ToolFox · Engineering calculators and data";
    return () => {
      document.title = "The ClusterFOX";
    };
  }, []);

  return (
    <div className="tf-home">
      <section className="tf-hero">
        <p className="tf-eyebrow">Engineer ToolFox</p>
        <h1>Engineering answers, without the clutter.</h1>
        <p className="tf-lede">
          {CALCS.length} live calculators and {TABLES.length} reference tables for fluids, heat, air, structures and electrical work, plus interactive GD&amp;T and a manufacturing process finder. Every number works in any unit.
        </p>
        <button type="button" className="tf-hero-search" onClick={openSearch}>
          <Search size={20} aria-hidden="true" />
          <span>Try “pressure drop”, “dew point” or “wire size”</span>
          <kbd>/</kbd>
        </button>
      </section>

      {(favorites.length > 0 || recent.length > 0) && (
        <section className="tf-home-block">
          {favorites.length > 0 && (
            <>
              <h2 className="tf-block-title">
                <Star size={16} aria-hidden="true" /> Favorites
              </h2>
              <div className="tf-tool-list">
                {favorites.map((f) => (
                  <ToolCard key={f.key} item={f} />
                ))}
              </div>
            </>
          )}
          {recent.length > 0 && (
            <>
              <h2 className="tf-block-title">
                <Clock size={16} aria-hidden="true" /> Recently used
              </h2>
              <div className="tf-tool-list">
                {recent.map((f) => (
                  <ToolCard key={f.key} item={f} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="tf-home-block">
        <h2 className="tf-block-title">Browse</h2>
        <div className="tf-cat-grid">
          {CATEGORIES.map((c) => {
            const n = CALCS.filter((x) => x.cat === c.id).length;
            const t = TABLES.filter((x) => x.cat === c.id).length;
            return (
              <Link key={c.id} to={`/tools/c/${c.id}`} className="tf-cat-card" style={{ "--tf-cat": c.hue }}>
                <span className="tf-cat-icon" aria-hidden="true">
                  <c.icon size={22} />
                </span>
                <strong>{c.name}</strong>
                <span className="tf-cat-blurb">{c.blurb}</span>
                <span className="tf-cat-count">{c.count || `${n} calculators · ${t} tables`}</span>
              </Link>
            );
          })}
          <Link to="/tools/convert" className="tf-cat-card" style={{ "--tf-cat": "#9ad1ff" }}>
            <span className="tf-cat-icon" aria-hidden="true">
              <ArrowLeftRight size={22} />
            </span>
            <strong>Unit converter</strong>
            <span className="tf-cat-blurb">31 quantities, from pressure and flow to R-value and viscosity.</span>
            <span className="tf-cat-count">Every unit at once</span>
          </Link>
        </div>
      </section>

      <section className="tf-home-block">
        <h2 className="tf-block-title">Popular</h2>
        <div className="tf-tool-list">
          {POPULAR.map((id) => (
            <ToolCard key={id} item={itemFor(`calc:${id}`)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CategoryRoute() {
  const { cat: catId } = useParams();
  const cat = categoryById[catId];
  useEffect(() => {
    if (cat) document.title = `${cat.name} · Engineer ToolFox`;
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [cat]);
  if (!cat) return <Home prefsApi={{ prefs: { favorites: [], recent: [] } }} openSearch={() => {}} />;
  const calcs = CALCS.filter((c) => c.cat === cat.id);
  const builders = BUILDERS.filter((b) => b.cat === cat.id);
  const tables = TABLES.filter((t) => t.cat === cat.id);
  return (
    <div className="tf-category" style={{ "--tf-cat": cat.hue }}>
      <header className="tf-page-head">
        <Link to="/tools" className="tf-crumb">
          Engineer ToolFox
        </Link>
        <div className="tf-title-row">
          <span className="tf-cat-icon is-big" aria-hidden="true">
            <cat.icon size={26} />
          </span>
          <h1>{cat.name}</h1>
        </div>
        <p className="tf-lede">{cat.blurb}</p>
      </header>
      {builders.length > 0 && (
        <>
          <h2 className="tf-block-title">Builders</h2>
          <div className="tf-tool-list">
            {builders.map((b) => (
              <ToolCard key={b.id} item={itemFor(`builder:${b.id}`)} />
            ))}
          </div>
        </>
      )}
      {cat.id === "design" && (
        <>
          <h2 className="tf-block-title">GD&amp;T callouts</h2>
          <div className="tf-tool-list">
            {GDT_CALLOUTS.map((g) => (
              <ToolCard key={g.id} item={{ kind: "guide", name: g.name, blurb: g.summary, cat: "design", path: `/tools/gdt/${g.id}` }} />
            ))}
          </div>
        </>
      )}
      {calcs.length > 0 && (
        <>
          <h2 className="tf-block-title">Calculators</h2>
          <div className="tf-tool-list">
            {calcs.map((c) => (
              <ToolCard key={c.id} item={itemFor(`calc:${c.id}`)} />
            ))}
          </div>
        </>
      )}
      {tables.length > 0 && (
        <>
          <h2 className="tf-block-title">Reference data</h2>
          <div className="tf-tool-list">
            {tables.map((t) => (
              <ToolCard key={t.id} item={itemFor(`table:${t.id}`)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AllData() {
  return (
    <div className="tf-category">
      <header className="tf-page-head">
        <Link to="/tools" className="tf-crumb">
          Engineer ToolFox
        </Link>
        <h1>Reference data</h1>
        <p className="tf-lede">Sortable, filterable tables. Pick any unit in a column header; download what you see as CSV.</p>
      </header>
      {CATEGORIES.filter((c) => TABLES.some((t) => t.cat === c.id)).map((c) => (
        <div key={c.id}>
          <h2 className="tf-block-title">{c.name}</h2>
          <div className="tf-tool-list">
            {TABLES.filter((t) => t.cat === c.id).map((t) => (
              <ToolCard key={t.id} item={itemFor(`table:${t.id}`)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Palette({ onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const results = q.trim()
    ? search(q, 10)
    : POPULAR.map((id) => ({ kind: "calc", id, name: calcById[id].name, blurb: calcById[id].blurb, cat: calcById[id].cat, path: `/tools/calc/${id}` }));

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function go(item) {
    navigate(item.path);
    onClose();
  }

  return (
    <div className="tf-palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tf-palette" role="dialog" aria-modal="true" aria-label="Search Engineer ToolFox">
        <div className="tf-palette-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search calculators and tables"
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              if (e.key === "Enter" && results[active]) go(results[active]);
            }}
            aria-label="Search"
            aria-controls="tf-palette-list"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="tf-palette-list" id="tf-palette-list" role="listbox">
          {!q.trim() && <li className="tf-palette-heading">Popular</li>}
          {results.map((r, i) => {
            const cat = categoryById[r.cat];
            return (
              <li key={`${r.kind}${r.id}`} role="option" aria-selected={i === active}>
                <button type="button" className={i === active ? "is-active" : ""} onMouseEnter={() => setActive(i)} onClick={() => go(r)} style={{ "--tf-cat": cat?.hue }}>
                  {r.kind === "table" ? <Table2 size={16} aria-hidden="true" /> : r.kind === "builder" ? <Network size={16} aria-hidden="true" /> : r.kind === "guide" ? <BookOpen size={16} aria-hidden="true" /> : <Calculator size={16} aria-hidden="true" />}
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {cat?.short} · {r.kind === "table" ? "Table" : r.kind === "builder" ? "Builder" : r.kind === "guide" ? "GD&T" : "Calculator"}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
          {q.trim() && results.length === 0 && <li className="tf-palette-empty">Nothing matches “{q}”. Try a simpler word.</li>}
        </ul>
      </div>
    </div>
  );
}
