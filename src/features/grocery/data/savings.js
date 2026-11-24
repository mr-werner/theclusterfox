// Where each chain keeps its digital coupons and weekly ad. GroceryFox
// links to these pages; it never reads them. Most grocery chains' terms of
// use forbid collecting their prices or coupons with a program, and none of
// them offer a public coupon feed, so the shopper opens the page, clips what
// they want there (it goes on their loyalty card) and notes it here so the
// comparison counts it.
//
// Only pages we're sure of get a direct link; every other chain gets a web
// search that finds its current page.
import { chainFor } from "../../cook/model/stores.js";

const q = encodeURIComponent;

const KROGER = site => ({ coupons: `${site}/savings/cl/coupons/`, weeklyAd: `${site}/weeklyad`, card: "Plus Card" });
const ALBERTSONS = site => ({ coupons: `${site}/foru/coupons-deals.html`, weeklyAd: `${site}/weeklyad`, card: "for U" });

const DIRECT = {
  target: { coupons: "https://www.target.com/circle", weeklyAd: "https://www.target.com/weekly-ad", card: "Target Circle" },
  walmart: { coupons: null, weeklyAd: null, deals: "https://www.walmart.com/shop/deals", note: "Walmart doesn't do store coupons; its low prices are on the shelf, with Rollbacks on the deals page." },
  publix: { coupons: "https://www.publix.com/savings/digital-coupons", weeklyAd: "https://www.publix.com/savings/weekly-ad", card: "Club Publix" },
  costco: { coupons: null, weeklyAd: null, deals: "https://www.costco.com/online-offers.html", note: "Costco's member deals come off at the register on their own." },
};

// Where to find coupons and the weekly ad for a store.
export function savingsFor(store) {
  const chain = chainFor(store);
  const name = chain?.name ?? store?.brand ?? store?.name ?? "the store";
  let pages = null;
  if (chain?.kroger) pages = KROGER(chain.site);
  // The Albertsons banners (Safeway, Vons, Jewel-Osco...) share one site layout.
  else if (chain?.search?.("x").includes("/shop/search-results.html")) pages = ALBERTSONS(chain.site);
  else if (chain && DIRECT[chain.key]) pages = DIRECT[chain.key];
  const search = what => `https://duckduckgo.com/?q=${q(`${name} ${what}`)}`;
  return {
    name,
    known: Boolean(pages),
    coupons: pages ? pages.coupons : search("digital coupons"),
    weeklyAd: pages ? pages.weeklyAd : search("weekly ad"),
    deals: pages?.deals ?? null,
    card: pages?.card ?? null,
    note: pages?.note ?? null,
  };
}

// Free apps and sites that work at almost any store. Each needs its own
// sign-up, so GroceryFox only points the way.
export const EVERYWHERE = [
  { name: "Coupons.com", url: "https://www.coupons.com", what: "Printable manufacturer coupons, good at most stores." },
  { name: "Ibotta", url: "https://ibotta.com", what: "Cash back on groceries after you shop, at hundreds of chains." },
  { name: "Fetch", url: "https://fetch.com", what: "Scan any receipt for points you trade in for gift cards." },
];
