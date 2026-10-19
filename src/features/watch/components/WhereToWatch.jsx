import { ExternalLink } from "lucide-react";

import ProviderLogo from "./ProviderLogo";
import { providerLink } from "../../../services/watch/links";
import { splitByServices } from "../../../services/watch/parse";

function ProviderList({ label, providers, mine, title, fallback }) {
  if (!providers.length) return null;
  return (
    <div className="wf-offer">
      <p className="wf-offer-label">{label}</p>
      <ul className="wf-offer-list">
        {providers.map(provider => (
          <li key={provider.id} className={mine ? "is-mine" : undefined}>
            <a href={providerLink(provider, title, fallback)} target="_blank" rel="noreferrer">
              <ProviderLogo provider={provider} size={24} />
              {provider.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WhereToWatch({ title, providers, myServices }) {
  if (providers === null) return <p className="wf-muted">Couldn’t check where this streams.</p>;
  if (!providers) return null;

  const stream = splitByServices(providers.stream, myServices);
  const free = splitByServices(providers.free, myServices);
  const mine = [...stream.mine, ...free.mine];
  const rentBuy = [...providers.rent, ...providers.buy.filter(b => !providers.rent.some(r => r.id === b.id))];
  const nowhere = !providers.stream.length && !providers.free.length && !rentBuy.length;
  const common = { title, fallback: providers.link };

  return (
    <>
      {mine.length > 0 && <p className="wf-verdict">Watch it on {mine.map(p => p.name).join(", ")}</p>}
      {nowhere && <p className="wf-muted">Not streaming anywhere in your region right now.</p>}
      <ProviderList label="On your services" providers={stream.mine} mine {...common} />
      <ProviderList label="Free on your services" providers={free.mine} mine {...common} />
      <ProviderList label="Also streaming on" providers={stream.other} {...common} />
      <ProviderList label="Free with ads" providers={free.other} {...common} />
      <ProviderList label="Rent or buy" providers={rentBuy} {...common} />
      {providers.link && (
        <a className="wf-more" href={providers.link} target="_blank" rel="noreferrer">
          Full listing <ExternalLink size={13} aria-hidden="true" />
        </a>
      )}
    </>
  );
}
