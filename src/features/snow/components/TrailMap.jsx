import { useState } from "react";
import { Map as MapIcon } from "lucide-react";

import { fetchTrailMap } from "../api";
import { useLoad } from "../model/useLoad";
import SnowMap from "./SnowMap";
import { Card, Loading, Problem } from "./ui";

// Runs by difficulty and lifts, drawn from OpenStreetMap. US colors: green
// circle, blue square, black diamond, double black; Europe-style "novice" is
// shown green too.
const DIFF = [
  { id: "novice", name: "Beginner", color: "#2f9e44" },
  { id: "easy", name: "Easier", color: "#2f9e44" },
  { id: "intermediate", name: "More difficult", color: "#1c7ed6" },
  { id: "advanced", name: "Most difficult", color: "#111" },
  { id: "expert", name: "Experts only", color: "#111", dash: "6 4" },
  { id: "freeride", name: "Off-piste / freeride", color: "#e8590c", dash: "2 4" },
  { id: "unknown", name: "Not rated", color: "#868e96" },
];
const diffOf = id => DIFF.find(d => d.id === id) ?? DIFF[DIFF.length - 1];

export default function TrailMap({ spot }) {
  const [show, setShow] = useState(false);
  const [picked, setPicked] = useState(null);
  const map = useLoad(show ? `osm-${spot.id}` : null, signal => fetchTrailMap(spot, { signal }));
  const runs = map.data?.runs ?? [];
  const lifts = map.data?.lifts ?? [];
  const counts = DIFF.map(d => ({ ...d, n: new Set(runs.filter(r => r.diff === d.id && r.name).map(r => r.name)).size })).filter(d => d.n);
  const fit = [...runs, ...lifts].flatMap(x => [x.coords[0], x.coords[x.coords.length - 1]]).map(([lon, lat]) => ({ lat, lon }));

  return (
    <Card title="Trail map" icon={MapIcon}>
      {!show ? (
        <button type="button" className="sf-btn" onClick={() => setShow(true)}>
          Show runs and lifts on a map
        </button>
      ) : (
        <>
          {map.loading && <Loading text="Drawing runs and lifts from OpenStreetMap…" />}
          {map.error && <Problem text={map.error} />}
          {map.data && !runs.length && !lifts.length && <p className="sf-muted">OpenStreetMap doesn't have this area's runs mapped yet.</p>}
          {map.data && (runs.length > 0 || lifts.length > 0) && (
            <>
              <SnowMap
                fit={fit.length ? fit : [{ lat: spot.lat, lon: spot.lon }]}
                fitKey={spot.id}
                height={420}
                label={`${spot.name} runs and lifts`}
                draw={(at, zoom) => (
                  <>
                    {runs.map(r => {
                      const d = diffOf(r.diff);
                      const pts = r.coords.map(([lon, lat]) => at(lat, lon)).map(p => `${p.x},${p.y}`).join(" ");
                      return r.area ? (
                        <polygon key={r.id} points={pts} fill={d.color} fillOpacity="0.14" stroke="none" />
                      ) : (
                        <polyline key={r.id} points={pts} className={`sf-run${picked === r.id ? " is-picked" : ""}`} stroke={d.color} strokeDasharray={d.dash} strokeWidth={zoom >= 15 ? 3.5 : 2.5} onClick={() => setPicked(r.id)}>
                          <title>{`${r.name ?? "Unnamed run"} · ${d.name}${r.groomed ? ` · groomed: ${r.groomed}` : ""}`}</title>
                        </polyline>
                      );
                    })}
                    {lifts.map(l => {
                      const pts = l.coords.map(([lon, lat]) => at(lat, lon));
                      const mid = pts[Math.floor(pts.length / 2)];
                      return (
                        <g key={l.id}>
                          <polyline points={pts.map(p => `${p.x},${p.y}`).join(" ")} className="sf-lift-line">
                            <title>{`${l.name ?? "Lift"} · ${l.type.replace(/_/g, " ")}${l.seats ? `, ${l.seats} seats` : ""}`}</title>
                          </polyline>
                          {zoom >= 14 && l.name && (
                            <text x={mid.x} y={mid.y - 6} className="sf-lift-label" textAnchor="middle">
                              {l.name}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </>
                )}
              />
              {picked && <p className="sf-muted">{(() => { const r = runs.find(x => x.id === picked); return r ? `${r.name ?? "Unnamed run"} · ${diffOf(r.diff).name}` : null; })()}</p>}
              <ul className="sf-legend">
                {counts.map(d => (
                  <li key={d.id}>
                    <i style={{ background: d.color }} aria-hidden="true" />
                    {d.name} <small>{d.n}</small>
                  </li>
                ))}
                <li>
                  <i className="is-lift" aria-hidden="true" />
                  Lifts <small>{lifts.length}</small>
                </li>
              </ul>
              <p className="sf-credit">Runs and lifts © OpenStreetMap contributors. Mapped by volunteers, so it can miss runs or differ from the resort's own map. It's not today's open or closed terrain.</p>
            </>
          )}
        </>
      )}
    </Card>
  );
}
