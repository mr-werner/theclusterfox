import { FlaskConical } from "lucide-react";

import { formatHour, formatTemp, formatWind } from "../units";

export default function WhyPanel({ plan, units, profileUsed }) {
  const { need, temp, localHour } = plan.coldest;

  return (
    <details className="cc-panel cc-why">
      <summary>
        <FlaskConical size={17} aria-hidden="true" />
        <strong>How this was worked out</strong>
      </summary>

      <div className="cc-why-body">
        <p>
          CloCast balances the heat your body makes against the heat the weather pulls away, then finds how much
          clothing insulation keeps you comfortable. Insulation is measured in <em>clo</em>: 1 clo is roughly a
          business suit, enough for someone sitting still at 21 °C (70 °F).
        </p>

        <h3 className="cc-subhead">
          At your chilliest hour ({formatHour(localHour)}, {formatTemp(temp, units)})
        </h3>
        <dl className="cc-why-grid">
          <div>
            <dt>Heat you make</dt>
            <dd>
              {need.met.toFixed(1)} met · {Math.round(need.wattsPerM2)} W/m²
            </dd>
          </div>
          <div>
            <dt>Air moving past you</dt>
            <dd>{formatWind(need.airSpeed, units)}</dd>
          </div>
          <div>
            <dt>Sunshine adds</dt>
            <dd>
              {need.sunBoost >= 0.5
                ? `${units === "metric" ? need.sunBoost.toFixed(0) : (need.sunBoost * 1.8).toFixed(0)}° of radiant warmth`
                : "nothing right now"}
            </dd>
          </div>
          <div>
            <dt>Insulation needed</dt>
            <dd>
              {need.clo.toFixed(2)} clo ({need.model})
            </dd>
          </div>
        </dl>

        <ul className="cc-why-list">
          <li>
            <strong>Heat you make.</strong> Each activity's intensity comes from the Compendium of Physical
            Activities in METs. That multiplies your resting metabolic rate (Mifflin–St Jeor) and is spread over your
            skin area (Du Bois).{" "}
            {profileUsed
              ? "Your details are being used."
              : "With no details entered, it assumes a typical adult (173 cm, 70 kg, 35 years)."}
          </li>
          <li>
            <strong>Mild weather</strong> uses the Predicted Mean Vote from ISO 7730 and ASHRAE Standard 55, solving
            for the clothing that puts you in the comfortable band.
          </li>
          <li>
            <strong>Cold weather and hard exercise</strong> use IREQ from ISO 11079, the standard for required clothing
            insulation in the cold. Between 5 and 15 °C (41–59 °F) the two are blended.
          </li>
          <li>
            <strong>Wind and movement</strong> are slowed from the 10 m weather-station height to body height, combined
            with how fast you travel, and push air through clothing, which costs insulation (ISO 9920).
          </li>
          <li>
            <strong>Sunshine</strong> raises the radiant temperature around you, worked out from the sun's height and
            the forecast's direct and diffuse sunlight (ASHRAE 55 SolarCal).
          </li>
          <li>
            <strong>Outfits</strong> are totalled from garment values in ISO 9920 and ASHRAE 55 with McCullough's
            equation. Hats and gloves follow wind chill, since hands and ears get cold long before your core does.
          </li>
        </ul>
        <p className="cc-note">
          These are population averages. Use “I usually run cold / warm” if the picks feel off for you.
        </p>
      </div>
    </details>
  );
}
