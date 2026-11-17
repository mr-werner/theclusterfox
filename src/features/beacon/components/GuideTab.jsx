// What the signals mean and how to use light well. Plain, short, and
// readable in a hurry.

const GROUND = [
  { mark: "V", means: "Need help" },
  { mark: "X", means: "Need medical help" },
  { mark: "→", means: "Went this way" },
  { mark: "Y", means: "Yes" },
  { mark: "N", means: "No" },
];

export default function GuideTab() {
  return (
    <div className="bx-guide">
      <section className="bx-card bx-first">
        <h2>First, try to call</h2>
        <ul>
          <li>Call 911 (112 in much of the world). Emergency calls can go through any carrier's network, even when yours shows no service.</li>
          <li>If a call won't connect, try texting 911. Many areas accept it, and a text can get out on a single bar.</li>
          <li>Some newer phones can reach emergency services by satellite when there is no signal at all. Check your phone's Emergency SOS settings.</li>
          <li>Then use light to be found, and stay where you are if you can.</li>
        </ul>
      </section>

      <section className="bx-card">
        <h2>Signals rescuers know</h2>
        <dl className="bx-defs">
          <dt>SOS</dt>
          <dd>··· ─── ··· Three short, three long, three short. The best-known distress signal, by light or sound.</dd>
          <dt>Groups of three</dt>
          <dd>Three flashes, three whistle blasts, three fires in a triangle. Three of anything means help.</dd>
          <dt>A strobe</dt>
          <dd>A bright flash about once a second stands out from anything else at night and can be seen from aircraft.</dd>
        </dl>
      </section>

      <section className="bx-card">
        <h2>Signs to make on the ground</h2>
        <p className="bx-muted">For searchers in the air. Make them big (about 3 m, 10 ft long) from rocks, branches or gear that stands out against the ground.</p>
        <div className="bx-ground">
          {GROUND.map(g => (
            <div key={g.mark}>
              <b aria-hidden="true">{g.mark}</b>
              <span>{g.means}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bx-card">
        <h2>Using light well</h2>
        <ul>
          <li>Signal from open, high ground, toward where help could come from: a road, a ridge, a helicopter.</li>
          <li>When you hear or see searchers, switch to SOS or the strobe and point the light at them.</li>
          <li>Waiting a long time? Use Battery saver. It still marks your spot but lasts for hours.</li>
          <li>Red keeps your eyes used to the dark. White is brightest and carries farthest.</li>
          <li>Turn the screen brightness all the way up. Keep the phone warm in a pocket between signals; cold drains batteries fast.</li>
          <li>Low Power Mode helps. Airplane mode saves even more, but then no one can call or text you back.</li>
        </ul>
      </section>

      <p className="bx-muted bx-small">Flashing light can trigger seizures for some people. BeaconFox flashes no faster than a few times a second.</p>
    </div>
  );
}
