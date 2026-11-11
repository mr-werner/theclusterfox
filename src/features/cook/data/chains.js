// Grocery chains CookFox knows how to link to. `search` builds a link to the
// chain's own product search for one item, which is where its current price
// is (and, for chains that sell online, where it goes in the cart). Chains
// without a dependable search link just get their website.
//
// None of this reads the chains' sites: the shopper follows the link. Live
// prices come only from the Kroger public API (see api/cook/_kroger.js).

const q = encodeURIComponent;
const krogerBanner = (key, name, domain, codes, match) => ({
  key,
  name,
  match,
  codes,
  site: `https://www.${domain}`,
  search: t => `https://www.${domain}/search?query=${q(t)}&searchType=default_search`,
  product: path => `https://www.${domain}${path}`,
  online: true,
  kroger: true,
});
const albertsonsBanner = (key, name, domain, match) => ({
  key,
  name,
  match,
  site: `https://www.${domain}`,
  search: t => `https://www.${domain}/shop/search-results.html?q=${q(t)}`,
  online: true,
});

export const chains = [
  { key: "walmart", name: "Walmart", match: /walmart/i, site: "https://www.walmart.com", search: t => `https://www.walmart.com/search?q=${q(t)}`, online: true },
  { key: "target", name: "Target", match: /\btarget\b/i, site: "https://www.target.com", search: t => `https://www.target.com/s?searchTerm=${q(t)}`, online: true },
  { key: "costco", name: "Costco", match: /costco/i, site: "https://www.costco.com", search: t => `https://www.costco.com/CatalogSearch?keyword=${q(t)}`, online: true },
  { key: "samsclub", name: "Sam's Club", match: /sam'?s club/i, site: "https://www.samsclub.com", search: t => `https://www.samsclub.com/s/${q(t)}`, online: true },
  { key: "aldi", name: "Aldi", match: /\baldi\b/i, site: "https://www.aldi.us", search: t => `https://www.aldi.us/results?q=${q(t)}`, online: true },
  { key: "lidl", name: "Lidl", match: /\blidl\b/i, site: "https://www.lidl.com", online: false },
  { key: "publix", name: "Publix", match: /publix/i, site: "https://www.publix.com", search: t => `https://www.publix.com/search?searchTerm=${q(t)}`, online: true },
  { key: "heb", name: "H-E-B", match: /\bh-?e-?b\b/i, site: "https://www.heb.com", search: t => `https://www.heb.com/search?q=${q(t)}`, online: true },
  { key: "meijer", name: "Meijer", match: /meijer/i, site: "https://www.meijer.com", search: t => `https://www.meijer.com/shopping/search.html?text=${q(t)}`, online: true },
  { key: "wholefoods", name: "Whole Foods Market", match: /whole foods/i, site: "https://www.wholefoodsmarket.com", search: t => `https://www.wholefoodsmarket.com/search?text=${q(t)}`, online: true },
  { key: "traderjoes", name: "Trader Joe's", match: /trader joe/i, site: "https://www.traderjoes.com", search: t => `https://www.traderjoes.com/home/search?q=${q(t)}&section=products`, online: false },
  { key: "wegmans", name: "Wegmans", match: /wegmans/i, site: "https://www.wegmans.com", search: t => `https://shop.wegmans.com/search?search_term=${q(t)}`, online: true },
  { key: "sprouts", name: "Sprouts Farmers Market", match: /sprouts/i, site: "https://www.sprouts.com", search: t => `https://shop.sprouts.com/search?search_term=${q(t)}`, online: true },
  { key: "hyvee", name: "Hy-Vee", match: /hy-?vee/i, site: "https://www.hy-vee.com", search: t => `https://www.hy-vee.com/aisles-online/search?search=${q(t)}`, online: true },
  { key: "foodlion", name: "Food Lion", match: /food lion/i, site: "https://www.foodlion.com", online: true },
  { key: "giant-eagle", name: "Giant Eagle", match: /giant eagle/i, site: "https://www.gianteagle.com", online: true },
  { key: "stop-shop", name: "Stop & Shop", match: /stop ?(&|and) ?shop/i, site: "https://stopandshop.com", online: true },
  { key: "shoprite", name: "ShopRite", match: /shoprite/i, site: "https://www.shoprite.com", online: true },
  { key: "winn-dixie", name: "Winn-Dixie", match: /winn-?dixie/i, site: "https://www.winndixie.com", online: true },
  { key: "winco", name: "WinCo Foods", match: /winco/i, site: "https://www.wincofoods.com", online: false },
  { key: "stater", name: "Stater Bros.", match: /stater bro/i, site: "https://www.staterbros.com", online: true },
  { key: "save-a-lot", name: "Save A Lot", match: /save[- ]?a[- ]?lot/i, site: "https://savealot.com", online: false },
  { key: "dollar-general", name: "Dollar General", match: /dollar general/i, site: "https://www.dollargeneral.com", online: true },

  albertsonsBanner("safeway", "Safeway", "safeway.com", /safeway/i),
  albertsonsBanner("albertsons", "Albertsons", "albertsons.com", /albertsons/i),
  albertsonsBanner("vons", "Vons", "vons.com", /\bvons\b/i),
  albertsonsBanner("jewel-osco", "Jewel-Osco", "jewelosco.com", /jewel/i),
  albertsonsBanner("acme", "ACME Markets", "acmemarkets.com", /\bacme\b/i),
  albertsonsBanner("shaws", "Shaw's", "shaws.com", /shaw'?s/i),
  albertsonsBanner("tom-thumb", "Tom Thumb", "tomthumb.com", /tom thumb/i),
  albertsonsBanner("randalls", "Randalls", "randalls.com", /randalls/i),
  albertsonsBanner("pavilions", "Pavilions", "pavilions.com", /pavilions/i),

  // Kroger's own store list names the banner with these chain codes.
  krogerBanner("kroger", "Kroger", "kroger.com", ["KROGER"], /\bkroger\b/i),
  krogerBanner("ralphs", "Ralphs", "ralphs.com", ["RALPHS"], /ralphs/i),
  krogerBanner("fred-meyer", "Fred Meyer", "fredmeyer.com", ["FRED", "FREDMEYER", "FRED MEYER"], /fred meyer/i),
  krogerBanner("king-soopers", "King Soopers", "kingsoopers.com", ["KINGSOOPERS", "KING SOOPERS"], /king soopers/i),
  krogerBanner("smiths", "Smith's", "smithsfoodanddrug.com", ["SMITHS"], /smith'?s food/i),
  krogerBanner("frys", "Fry's", "frysfood.com", ["FRYS"], /fry'?s food/i),
  krogerBanner("qfc", "QFC", "qfc.com", ["QFC"], /\bqfc\b/i),
  krogerBanner("harris-teeter", "Harris Teeter", "harristeeter.com", ["HART", "HARRISTEETER", "HARRIS TEETER"], /harris teeter/i),
  krogerBanner("dillons", "Dillons", "dillons.com", ["DILLONS"], /dillons/i),
  krogerBanner("marianos", "Mariano's", "marianos.com", ["MARIANOS"], /mariano'?s/i),
  krogerBanner("picknsave", "Pick 'n Save", "picknsave.com", ["PICKNSAVE"], /pick ?'?n ?save/i),
  krogerBanner("metro-market", "Metro Market", "metromarket.net", ["METROMARKET"], /metro market/i),
  krogerBanner("food4less", "Food 4 Less", "food4less.com", ["FOOD4LESS"], /food ?4 ?less/i),
  krogerBanner("foods-co", "Foods Co", "foodsco.net", ["FOODSCO"], /foods co\b/i),
  krogerBanner("city-market", "City Market", "citymarket.com", ["CITYMARKET"], /city market/i),
  krogerBanner("gerbes", "Gerbes", "gerbes.com", ["GERBES"], /gerbes/i),
  krogerBanner("bakers", "Baker's", "bakersplus.com", ["BAKERS"], /baker'?s/i),
  krogerBanner("jayc", "JayC", "jaycfoods.com", ["JAYC"], /jay ?c\b/i),
  krogerBanner("payless", "Pay Less", "pay-less.com", ["PAYLESS"], /pay ?less/i),
];

export const chainsByKey = new Map(chains.map(c => [c.key, c]));
