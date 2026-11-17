import { useMemo, useState } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";

import { BACKCOUNTRY } from "../data/backcountry";
import { CANADA } from "../data/roads";
import { fetchAvalanche, fetchAvalancheZones, fetchSummaries } from "../api";
import { useLoad } from "../model/useLoad";
import { danger, fmtElev, fmtSnow, inGeometry } from "../model/snow";
import SnowMap from "./SnowMap";
import { Card, DangerChip, FavButton, Loading, Problem, SnowBars } from "./ui";

// Backcountry: today's avalanche danger across the US on a map, and the
// popular touring spots with their danger, recent and coming snow.
export default function BackcountryTab({ s, open }) {
  const { data, patch } = s;
  const units = data.units;
  const zones = useLoad("zones", signal => fetchAvalancheZones({ signal }));
  const sums = useLoad(`bc-${units}`, signal => fetchSummaries(BACKCOUNTRY, { signal }));
  const canada = useLoad("bc-canada", signal => Promise.all(BACKCOUNTRY.filter(b => CANADA.has(b.state)).map(b => fetchAvalanche({ ...b, country: "CA" }, { signal }).then(a => [b.id, a]).catch(() => [b.id, null]))).then(Object.fromEntries));
  const [picked, setPicked] = useState(null);

  const levelOf = useMemo(() => {
    const out = {};
    for (const b of BACKCOUNTRY) {
      if (CANADA.has(b.state)) out[b.id] = canada.data?.[b.id] ?? null;
      else {
        const z = zones.data?.find(f => inGeometry(b.lat, b.lon, f.geometry));
        out[b.id] = z ? { level: z.properties.danger_level, center: z.properties.center, link: z.properties.link } : null;
      }
    }
    return out;
  }, [zones.data, canada.data]);

  const pickedZone = picked ? zones.data?.find(f => f.id === picked) : null;
  const toggleFav = id => patch(d => ({ favorites: d.favorites.includes(id) ? d.favorites.filter(f => f !== id) : [...d.favorites, id] }));

  return (
    <div className="sf-bc">
      <Card title="Avalanche danger today" icon={ShieldAlert}>
        {zones.loading && <Loading text="Loading every US avalanche center's forecast…" />}
        {zones.error && <Problem text={zones.error} />}
        {zones.data && (
          <SnowMap
            base="street"
            fit={[
              { lat: 49, lon: -124 },
              { lat: 31.5, lon: -104 },
            ]}
            fitKey="us"
            maxFitZoom={6}
            height={400}
            label="Avalanche forecast zones"
            draw={at => (
              <>
                {zones.data.map(f => {
                  const polys = f.geometry?.type === "Polygon" ? [f.geometry.coordinates] : f.geometry?.coordinates ?? [];
                  const d = danger(f.properties.danger_level);
                  return (
                    <g key={f.id} className={`sf-zone${picked === f.id ? " is-picked" : ""}`} onClick={() => setPicked(f.id)}>
                      {polys.map((poly, i) => (
                        <path
                          key={i}
                          d={poly.map(ring => ring.map(([lon, lat], k) => { const p = at(lat, lon); return `${k ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join("") + "Z").join("")}
                          fill={d.color}
                          fillOpacity={f.properties.danger_level > 0 ? 0.55 : 0.25}
                          fillRule="evenodd"
                        />
                      ))}
                      <title>{`${f.properties.center}${f.properties.name && !/zone$/i.test(f.properties.name) ? ` · ${f.properties.name}` : ""}: ${d.name}`}</title>
                    </g>
                  );
                })}
                {BACKCOUNTRY.map(b => {
                  const p = at(b.lat, b.lon);
                  return (
                    <circle key={b.id} cx={p.x} cy={p.y} r="4.5" className="sf-bc-dot" onClick={() => open(b.id)}>
                      <title>{b.name}</title>
                    </circle>
                  );
                })}
              </>
            )}
          >
            {pickedZone && (
              <div className="sf-zone-pop">
                <DangerChip level={pickedZone.properties.danger_level} small />
                <strong>{pickedZone.properties.center}</strong>
                {pickedZone.properties.name && !/zone$/i.test(pickedZone.properties.name) && <span>{pickedZone.properties.name}</span>}
                <a href={pickedZone.properties.link} target="_blank" rel="noreferrer">
                  Forecast <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            )}
          </SnowMap>
        )}
        <ul className="sf-legend">
          {[1, 2, 3, 4, 5, -1].map(l => (
            <li key={l}>
              <i style={{ background: danger(l).color }} aria-hidden="true" />
              {l > 0 ? `${l} ${danger(l).name}` : "No rating"}
            </li>
          ))}
        </ul>
        <p className="sf-credit">
          From{" "}
          <a href="https://avalanche.org" target="_blank" rel="noreferrer">
            avalanche.org
          </a>{" "}
          and each US avalanche center; Canada from Avalanche Canada. Tap a zone for its forecast.
        </p>
      </Card>

      <h2 className="sf-h2">Popular backcountry spots</h2>
      {sums.error && <Problem text={sums.error} />}
      <div className="sf-rows">
        {BACKCOUNTRY.map((b, i) => {
          const sum = sums.data?.[i];
          const a = levelOf[b.id];
          return (
            <article key={b.id} className="sf-row">
              <button type="button" className="sf-row-main" onClick={() => open(b.id)}>
                <span className="sf-row-name">
                  <strong>{b.name}</strong>
                  <small>
                    {b.state} · {fmtElev(b.elev, units)}
                  </small>
                </span>
                <span className="sf-row-danger">{a ? <DangerChip level={a.level} small /> : <small className="sf-muted">{zones.loading || canada.loading ? "…" : "No forecast"}</small>}</span>
                {sum && (
                  <>
                    <span className="sf-row-num">
                      <b>{fmtSnow(sum.past48, units)}</b>
                      <small>last 48h</small>
                    </span>
                    <span className="sf-row-num">
                      <b>{fmtSnow(sum.next7, units)}</b>
                      <small>next 7 days</small>
                    </span>
                    <SnowBars days={sum.days} units={units} />
                  </>
                )}
              </button>
              <FavButton on={data.favorites.includes(b.id)} onToggle={() => toggleFav(b.id)} name={b.name} />
            </article>
          );
        })}
      </div>
      <p className="sf-note">
        Backcountry travel means avalanche terrain. Read the full forecast, carry a beacon, shovel and probe, go with a partner, and take an avalanche course (AIARE or AST in Canada) before you head out.
      </p>
    </div>
  );
}
