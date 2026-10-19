import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Radio, Search } from "lucide-react";

import ProviderLogo from "./ProviderLogo";
import { fetchProviders } from "../../../services/watch/watchApi";
import { LIVE_SERVICES, REGIONS } from "../../../services/watch/parse";
import { toggleIn, toggleService } from "../state/watchStore";

const TOP_COUNT = 30;

export default function ServicePicker({ data, update }) {
  const { region } = data;
  const [state, setState] = useState({ region: null, providers: [], error: "", code: "" });
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchProviders(region, { signal: controller.signal })
      .then(providers => setState({ region, providers, error: "", code: "" }))
      .catch(error => {
        if (error.name !== "AbortError") setState({ region, providers: [], error: error.message, code: error.code ?? "" });
      });
    return () => controller.abort();
  }, [region]);

  const loading = state.region !== region;
  const pickedIds = useMemo(() => new Set(data.services.map(s => s.id)), [data.services]);

  const shown = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (query) return state.providers.filter(p => p.name.toLowerCase().includes(query));
    // Picked services stay visible even when they're outside the top list.
    const top = state.providers.slice(0, showAll ? undefined : TOP_COUNT);
    const extra = data.services.filter(s => !top.some(p => p.id === s.id));
    return [...extra, ...top];
  }, [state.providers, filter, showAll, data.services]);

  return (
    <div className="wf-services">
      <section className="wf-panel">
        <div className="wf-panel-head">
          <div>
            <h2>Streaming services</h2>
            <p className="wf-muted">Pick the ones you pay for or use. Shows and games on them get highlighted.</p>
          </div>
          <label className="wf-region">
            <span>Region</span>
            <select value={region} onChange={event => update({ region: event.target.value })}>
              {REGIONS.map(r => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="wf-search wf-search--small">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder="Find a service"
            aria-label="Find a service"
          />
        </label>

        {loading && (
          <p className="wf-muted wf-loading">
            <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading services…
          </p>
        )}
        {!loading && state.error && (
          <p className="wf-alert">
            {state.code === "no-key"
              ? "The streaming service list isn't switched on yet. Live TV services below still work for sports."
              : state.error}
          </p>
        )}

        {!loading && !state.error && (
          <>
            <ul className="wf-provider-grid">
              {shown.map(provider => {
                const picked = pickedIds.has(provider.id);
                return (
                  <li key={provider.id}>
                    <button
                      type="button"
                      className="wf-provider"
                      aria-pressed={picked}
                      onClick={() => update(current => toggleService(current, provider))}
                    >
                      <ProviderLogo provider={provider} size={36} />
                      <span>{provider.name}</span>
                      {picked && <Check size={16} className="wf-provider-check" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!filter && state.providers.length > TOP_COUNT && (
              <button type="button" className="wf-link-btn" onClick={() => setShowAll(v => !v)}>
                {showAll ? "Show fewer" : `Show all ${state.providers.length} services`}
              </button>
            )}
            {filter && !shown.length && <p className="wf-muted">No services match “{filter}”.</p>}
          </>
        )}
      </section>

      <section className="wf-panel">
        <h2>
          <Radio size={18} aria-hidden="true" /> Live TV and sports
        </h2>
        <p className="wf-muted">These carry live channels, so they decide which games you can watch.</p>
        <ul className="wf-chip-row">
          {LIVE_SERVICES.map(service => (
            <li key={service.key}>
              <button
                type="button"
                className="wf-chip"
                aria-pressed={data.live.includes(service.label)}
                onClick={() => update(current => ({ ...current, live: toggleIn(current.live, service.label) }))}
              >
                {service.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="wf-note">Channel line-ups vary by plan and area, so sports matches are a close guide.</p>
      </section>
    </div>
  );
}
