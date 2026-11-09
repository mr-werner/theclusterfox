import { Canvas, At, Num, Pick, Badge } from "./kit";
import { show } from "./helpers";

// A bolted joint in section: head, two clamped plates, nut and the wrench that
// tightens it. Clamp arrows show the preload squeezing the plates.

const W = 860, H = 440;
const CX = 300, PT = 150, PB = 290;

export default function BoltDiagram({ calc, values: v, set, output, unit, setUnit, pick, presetValue }) {
  const opt = (id) => calc.inputs.find((i) => i.id === id).options;
  const res = (id) => output.results.find((r) => r.id === id);
  const T = res("T"), F = res("F"), Fp = res("Fp");
  const sq = Math.min(1, v.pct || 0);
  const s = 26, head = 56;

  const svg = (
    <>
      {/* Plates, cut away around the bolt */}
      <g className="dg-plate">
        <rect x={CX - 210} y={PT} width={210 - s / 2 - 4} height={(PB - PT) / 2 - 2} />
        <rect x={CX + s / 2 + 4} y={PT} width="210" height={(PB - PT) / 2 - 2} />
        <rect x={CX - 210} y={(PT + PB) / 2 + 2} width={210 - s / 2 - 4} height={(PB - PT) / 2 - 2} />
        <rect x={CX + s / 2 + 4} y={(PT + PB) / 2 + 2} width="210" height={(PB - PT) / 2 - 2} />
      </g>
      {/* Bolt: head, shank with threads, washer and nut */}
      <rect x={CX - head / 2} y={PT - 36} width={head} height="36" rx="4" className="dg-bolt" />
      <rect x={CX - s / 2} y={PT} width={s} height={PB - PT + 50} className="dg-bolt" />
      {Array.from({ length: 9 }, (_, k) => (
        <line key={k} x1={CX - s / 2} x2={CX + s / 2} y1={PB - 30 + k * 9} y2={PB - 24 + k * 9} className="dg-thread" />
      ))}
      <rect x={CX - 40} y={PB} width="80" height="8" className="dg-bolt is-washer" />
      <rect x={CX - head / 2} y={PB + 8} width={head} height="30" rx="3" className="dg-bolt is-nut" />
      {/* Clamp force arrows, longer for more preload */}
      {[-170, -80].map((dx) => (
        <g key={dx} className="dg-clamp">
          <line x1={CX + dx} x2={CX + dx} y1={PT - 20 - 40 * sq} y2={PT - 6} />
          <path d={`M${CX + dx - 7},${PT - 14} l7,10 l7,-10 Z`} />
          <line x1={CX + dx} x2={CX + dx} y1={PB + 20 + 40 * sq} y2={PB + 6} />
          <path d={`M${CX + dx - 7},${PB + 14} l7,-10 l7,10 Z`} />
        </g>
      ))}
      {/* Wrench on the nut, with the turning arrow */}
      <path d={`M${CX + head / 2},${PB + 12} h300 a11,11 0 0,1 0,22 h-300 Z`} className="dg-wrench" />
      <path d={`M${CX + 330},${PB + 80} A60,26 0 0,0 ${CX + 330},${PB - 34}`} className="dg-turn" />
      <path d={`M${CX + 322},${PB - 40} l10,6 l-9,6`} className="dg-turn" />
    </>
  );

  return (
    <Canvas w={W} h={H} svg={svg} label="Bolted joint with a wrench on the nut" minWidth={660}>
      <At x={14} y={14} anchor="tl">
        <div className="dg-stack is-row">
          <Pick label="Bolt size" options={opt("size")} value={v.size} onPick={(l) => set("size", l)} />
          <Pick label="Grade" options={opt("grade")} value={v.grade} onPick={(l) => set("grade", l)} />
        </div>
      </At>
      <At x={CX + 330} y={PB - 70} anchor="b">
        {T ? (
          <Badge strong label="Tightening torque">
            {show(T.value, "torque", unit("torque"))}
          </Badge>
        ) : (
          <Badge label="Tightening torque">—</Badge>
        )}
      </At>
      <At x={CX - 125} y={(PT + PB) / 2} anchor="c">
        {F && <Badge label="Clamp force">{show(F.value, "force", unit("force"))}</Badge>}
      </At>
      <At x={CX + 230} y={PT - 50} anchor="l">
        <Num label="Preload, % of proof" dim="percent" value={v.pct} unit={unit("percent")} onValue={(x) => set("pct", x)} onUnit={(u) => setUnit("percent", u)} />
      </At>
      <At x={CX} y={H - 14} anchor="b">
        <div className="dg-stack is-row">
          <Pick label="Threads" options={opt("cond")} value={presetValue("cond")} onPick={(l) => pick("cond", l)} />
          <Num label="Nut factor K" dim="none" value={v.K} unit={unit("none")} onValue={(x) => set("K", x)} onUnit={() => {}} />
        </div>
      </At>
      <At x={W - 14} y={H - 14} anchor="br">
        {Fp && <Badge label="Proof load">{show(Fp.value, "force", unit("force"))}</Badge>}
      </At>
    </Canvas>
  );
}
