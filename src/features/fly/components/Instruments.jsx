// The "six pack": the six basic flight instruments of a light airplane,
// drawn in SVG. Used by the flight simulator and the instrument diagrams.
// Markings follow a Cessna 172.

const R = 92; // dial radius in a 200 x 200 viewBox
const rad = d => (d * Math.PI) / 180;
const polar = (deg, r) => [100 + r * Math.sin(rad(deg)), 100 - r * Math.cos(rad(deg))];

function Face({ label, children, title }) {
  return (
    <figure className="fy-inst">
      <svg viewBox="0 0 200 200" role="img" aria-label={title}>
        <circle cx="100" cy="100" r="99" fill="#1b1f27" />
        <circle cx="100" cy="100" r={R} fill="#0b0d12" stroke="#2c323d" strokeWidth="2" />
        {children}
        <circle cx="100" cy="100" r="99" fill="none" stroke="#3a414d" strokeWidth="2" />
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function Ticks({ from, to, step, major, angleOf, inner = 78, majorInner = 70 }) {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) {
    const a = angleOf(v);
    const isMajor = major && Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const [x1, y1] = polar(a, isMajor ? majorInner : inner);
    const [x2, y2] = polar(a, 88);
    out.push(<line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8e8e8" strokeWidth={isMajor ? 2.6 : 1.4} />);
  }
  return out;
}

function Arc({ from, to, r, color, width = 6 }) {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return <path d={`M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={width} />;
}

function Needle({ angle, length = 80, width = 5, color = "#f4f4f4", tail = 14 }) {
  return (
    <g transform={`rotate(${angle} 100 100)`}>
      <path d={`M${100 - width / 2} ${100 + tail} L${100 - width / 2} ${100 - length + 10} L100 ${100 - length} L${100 + width / 2} ${100 - length + 10} L${100 + width / 2} ${100 + tail} Z`} fill={color} />
    </g>
  );
}

const Hub = () => <circle cx="100" cy="100" r="7" fill="#2b2f37" stroke="#555" />;

/* Airspeed: 0 to 200 knots around 330 degrees. */
const ASI_MARKS = { vs0: 33, vs1: 44, vfe: 85, vno: 129, vne: 163 };
const asiAngle = kt => (Math.max(0, Math.min(200, kt)) / 200) * 330;

export function AirspeedIndicator({ kt }) {
  const m = ASI_MARKS;
  return (
    <Face label="Airspeed" title={`Airspeed ${Math.round(kt)} knots`}>
      <Arc from={asiAngle(m.vs0)} to={asiAngle(m.vfe)} r={64} color="#f2f2f2" width={5} />
      <Arc from={asiAngle(m.vs1)} to={asiAngle(m.vno)} r={72} color="#2fbf5b" />
      <Arc from={asiAngle(m.vno)} to={asiAngle(m.vne)} r={72} color="#f2c230" />
      <Ticks from={0} to={200} step={10} major={20} angleOf={asiAngle} />
      {(() => {
        const [x1, y1] = polar(asiAngle(m.vne), 66);
        const [x2, y2] = polar(asiAngle(m.vne), 88);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e23b3b" strokeWidth="4" />;
      })()}
      {[40, 60, 80, 100, 120, 140, 160, 180].map(v => {
        const [x, y] = polar(asiAngle(v), 52);
        return <text key={v} x={x} y={y + 5} className="fy-inst-num">{v}</text>;
      })}
      <text x="100" y="138" className="fy-inst-unit">KNOTS</text>
      <Needle angle={asiAngle(kt)} />
      <Hub />
    </Face>
  );
}

/* Attitude: sky and ground move behind a fixed little airplane. */
export function AttitudeIndicator({ pitch, bank }) {
  const px = 2.4; // pixels per degree of pitch
  const p = Math.max(-40, Math.min(40, pitch));
  const ladder = [-20, -15, -10, -5, 5, 10, 15, 20];
  return (
    <Face label="Attitude" title={`Pitch ${Math.round(pitch)} degrees, bank ${Math.round(Math.abs(bank))} degrees ${bank < 0 ? "left" : "right"}`}>
      <defs>
        <clipPath id="fy-ai-clip"><circle cx="100" cy="100" r={R - 2} /></clipPath>
      </defs>
      <g clipPath="url(#fy-ai-clip)">
        <g transform={`rotate(${-bank} 100 100)`}>
          <g transform={`translate(0 ${p * px})`}>
            <rect x="-100" y="-300" width="400" height="400" fill="#2f7fd6" />
            <rect x="-100" y="100" width="400" height="400" fill="#8a5a2b" />
            <line x1="-100" y1="100" x2="300" y2="100" stroke="#fff" strokeWidth="2" />
            {ladder.map(d => (
              <g key={d}>
                <line x1={100 - (d % 10 === 0 ? 22 : 11)} x2={100 + (d % 10 === 0 ? 22 : 11)} y1={100 - d * px} y2={100 - d * px} stroke="#fff" strokeWidth="1.6" />
                {d % 10 === 0 && <text x={128} y={104 - d * px} className="fy-inst-tiny">{Math.abs(d)}</text>}
              </g>
            ))}
          </g>
          {[-60, -45, -30, -20, -10, 10, 20, 30, 45, 60].map(a => {
            const [x1, y1] = polar(a, 78);
            const [x2, y2] = polar(a, Math.abs(a) % 30 === 0 ? 92 : 86);
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={Math.abs(a) % 30 === 0 ? 3 : 2} />;
          })}
          <path d="M100 10 L94 0 L106 0 Z" fill="#fff" transform="translate(0 12)" />
        </g>
      </g>
      <path d="M100 24 L94 34 L106 34 Z" fill="#ffb547" />
      <path d="M52 102 L84 102 L92 110 L100 102 L108 110 L116 102 L148 102" fill="none" stroke="#ffb547" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="100" cy="102" r="3" fill="#ffb547" />
    </Face>
  );
}

/* Altimeter: long hand hundreds, short hand thousands, plus a readout. */
export function Altimeter({ ft }) {
  const a = Math.max(-999, ft);
  return (
    <Face label="Altimeter" title={`Altitude ${Math.round(ft)} feet`}>
      <Ticks from={0} to={980} step={20} major={100} angleOf={v => (v / 1000) * 360} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => {
        const [x, y] = polar(v * 36, 58);
        return <text key={v} x={x} y={y + 6} className="fy-inst-num is-big">{v}</text>;
      })}
      <rect x="72" y="118" width="56" height="20" rx="3" fill="#000" stroke="#444" />
      <text x="100" y="133" className="fy-inst-digits">{Math.round(a).toLocaleString("en-US")}</text>
      <Needle angle={((a / 10000) % 1) * 360} length={50} width={9} />
      <Needle angle={((a / 1000) % 1) * 360} length={82} width={5} />
      <Hub />
    </Face>
  );
}

/* Turn coordinator: the little airplane tilts with rate of turn (the
   L and R marks are a standard-rate turn, 3 degrees a second) and the
   ball shows slip or skid. */
export function TurnCoordinator({ turnRate, slip }) {
  const tilt = Math.max(-35, Math.min(35, (turnRate / 3) * 20));
  const ball = Math.max(-1, Math.min(1, slip)) * 30;
  return (
    <Face label="Turn coordinator" title={`Turning ${Math.abs(turnRate).toFixed(1)} degrees a second ${turnRate < 0 ? "left" : "right"}`}>
      <line x1="10" y1="100" x2="34" y2="100" stroke="#fff" strokeWidth="3" />
      <line x1="166" y1="100" x2="190" y2="100" stroke="#fff" strokeWidth="3" />
      <line x1="10" y1="100" x2="34" y2="100" stroke="#fff" strokeWidth="3" transform="rotate(-20 100 100)" />
      <line x1="166" y1="100" x2="190" y2="100" stroke="#fff" strokeWidth="3" transform="rotate(20 100 100)" />
      <text x="34" y="138" className="fy-inst-num">L</text>
      <text x="166" y="138" className="fy-inst-num">R</text>
      <text x="100" y="56" className="fy-inst-unit">2 MIN</text>
      <g transform={`rotate(${tilt} 100 100)`}>
        <path d="M28 100 L172 100" stroke="#f4f4f4" strokeWidth="6" strokeLinecap="round" />
        <circle cx="100" cy="100" r="10" fill="#f4f4f4" />
        <path d="M100 90 L100 74" stroke="#f4f4f4" strokeWidth="5" strokeLinecap="round" />
      </g>
      <path d="M58 146 Q100 166 142 146" fill="none" stroke="#666" strokeWidth="18" strokeLinecap="round" />
      <line x1="90" y1="146" x2="90" y2="166" stroke="#ddd" strokeWidth="1.5" />
      <line x1="110" y1="146" x2="110" y2="166" stroke="#ddd" strokeWidth="1.5" />
      <circle cx={100 + ball} cy={156 - Math.abs(ball) * 0.3} r="7.5" fill="#111" stroke="#ddd" strokeWidth="1" />
    </Face>
  );
}

/* Heading indicator: the card turns so your heading is under the lubber line. */
export function HeadingIndicator({ heading }) {
  const marks = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const [x1, y1] = polar(d, major ? 72 : d % 10 === 0 ? 78 : 82);
    const [x2, y2] = polar(d, 88);
    marks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8e8e8" strokeWidth={major ? 2.4 : 1.2} />);
  }
  const labels = { 0: "N", 90: "E", 180: "S", 270: "W" };
  return (
    <Face label="Heading" title={`Heading ${String(Math.round(((heading % 360) + 360) % 360) || 360).padStart(3, "0")}`}>
      <g transform={`rotate(${-heading} 100 100)`}>
        {marks}
        {Array.from({ length: 12 }, (_, i) => i * 30).map(d => {
          const [x, y] = polar(d, 58);
          return (
            <text key={d} x={x} y={y + 6} className={`fy-inst-num${labels[d] ? " is-big" : ""}`} transform={`rotate(${d} ${x} ${y})`}>
              {labels[d] ?? d / 10}
            </text>
          );
        })}
      </g>
      <path d="M100 12 L94 26 L106 26 Z" fill="#ffb547" />
      <path d="M100 74 L100 128 M80 92 L120 92 M90 120 L110 120" stroke="#ffb547" strokeWidth="5" strokeLinecap="round" />
    </Face>
  );
}

/* Vertical speed: feet per minute, zero at nine o'clock. */
const vsiAngle = fpm => -90 + (Math.max(-2000, Math.min(2000, fpm)) / 2000) * 170;
export function VerticalSpeedIndicator({ fpm }) {
  return (
    <Face label="Vertical speed" title={`${fpm >= 0 ? "Climbing" : "Descending"} ${Math.abs(Math.round(fpm / 10) * 10)} feet a minute`}>
      <Ticks from={-2000} to={2000} step={100} major={500} angleOf={vsiAngle} />
      {[0, 5, 10, 15, 20].map(v => {
        const up = polar(vsiAngle(v * 100), 56);
        const dn = polar(vsiAngle(-v * 100), 56);
        return (
          <g key={v}>
            <text x={up[0]} y={up[1] + 5} className="fy-inst-num">{v}</text>
            {v > 0 && v < 20 && <text x={dn[0]} y={dn[1] + 5} className="fy-inst-num">{v}</text>}
          </g>
        );
      })}
      <text x="128" y="74" className="fy-inst-unit">UP</text>
      <text x="128" y="134" className="fy-inst-unit">DOWN</text>
      <text x="100" y="104" className="fy-inst-unit is-small">100 FT/MIN</text>
      <Needle angle={vsiAngle(fpm)} />
      <Hub />
    </Face>
  );
}

/** All six in the standard T arrangement. */
export function SixPack({ s, compact }) {
  return (
    <div className={`fy-sixpack${compact ? " is-compact" : ""}`}>
      <AirspeedIndicator kt={s.kt} />
      <AttitudeIndicator pitch={s.pitch} bank={s.bank} />
      <Altimeter ft={s.alt} />
      <TurnCoordinator turnRate={s.turnRate} slip={s.slip} />
      <HeadingIndicator heading={s.heading} />
      <VerticalSpeedIndicator fpm={s.fpm} />
    </div>
  );
}
