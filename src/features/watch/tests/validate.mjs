import assert from 'node:assert/strict';
import {
  canWatchNetwork, isBroadcastNetwork, mergeProviderLists, networksForServices, normalizeName,
  genresById, interleave, myOffers, rankRecommendations, onMyServices, parseDetails, parseScoreboard, parseSearchResult, parseWatchProviders, splitByServices,
} from '../../../services/watch/parse.js';
import { directLinkFor, networkLink, parseWatchmodeSources, providerLink, serviceKey } from '../../../services/watch/links.js';
import { isFavorite, normalizeData, toggleFavorite, toggleService, pickedNames } from '../state/watchStore.js';

// Provider lists merge by id and keep TMDB's display order.
const merged = mergeProviderLists(
  [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 2 }],
  [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 1 }, { provider_id: 15, provider_name: 'Hulu', display_priority: 3 }]
);
assert.deepEqual(merged.map(p => [p.id, p.priority]), [[8, 1], [15, 3]]);
assert.equal(merged[0].logo, 'https://image.tmdb.org/t/p/w92/n.jpg');
assert.equal(merged[1].logo, null);

// Watch providers for one region; free and ads become one list.
const watch = parseWatchProviders({
  US: {
    link: 'https://www.themoviedb.org/tv/1/watch',
    flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
    ads: [{ provider_id: 73, provider_name: 'Tubi TV' }],
    buy: [{ provider_id: 2, provider_name: 'Apple TV' }],
  },
}, 'US');
assert.equal(watch.stream[0].name, 'Netflix');
assert.equal(watch.free[0].name, 'Tubi TV');
assert.equal(watch.buy.length, 1);
assert.deepEqual(parseWatchProviders({}, 'GB'), { link: null, stream: [], free: [], rent: [], buy: [] });

// Search keeps movies and shows only.
assert.equal(parseSearchResult({ media_type: 'person', name: 'Someone' }), null);
const show = parseSearchResult({ media_type: 'tv', id: 1, name: 'The Bear', first_air_date: '2022-06-23', poster_path: '/b.jpg' });
assert.equal(show.title, 'The Bear');
assert.equal(show.year, '2022');

// Discover lists have no media_type, so the type comes from the caller.
assert.equal(parseSearchResult({ id: 5, title: 'Dune', release_date: '2021-09-15' }, 'movie').year, '2021');

// Title details: trailer, facts and where to watch.
const details = parseDetails({
  id: 7, name: 'Severance', first_air_date: '2022-02-18', overview: 'Work and life, split.',
  backdrop_path: '/s.jpg', genres: [{ name: 'Drama' }], number_of_seasons: 2, episode_run_time: [], vote_average: 8.37, vote_count: 900,
  videos: { results: [
    { site: 'YouTube', key: 'teaser', type: 'Teaser', official: true },
    { site: 'Vimeo', key: 'vim', type: 'Trailer', official: true },
    { site: 'YouTube', key: 'fan', type: 'Trailer', official: false },
    { site: 'YouTube', key: 'real', type: 'Trailer', official: true },
  ] },
  'watch/providers': { results: { US: { flatrate: [{ provider_id: 350, provider_name: 'Apple TV Plus' }] } } },
}, 'tv', 'US');
assert.equal(details.trailer.key, 'real');
assert.equal(details.seasons, 2);
assert.equal(details.runtime, null);
assert.equal(details.rating, 8.4);
assert.equal(details.backdrop, 'https://image.tmdb.org/t/p/w780/s.jpg');
assert.equal(details.providers.stream[0].name, 'Apple TV Plus');
assert.equal(parseDetails({ id: 1, title: 'x' }, 'movie').trailer, null);
assert.equal(myOffers(details.providers, [{ id: 350, name: 'Apple TV Plus' }]).length, 1);
assert.deepEqual(interleave([{ type: 'tv', id: 1 }, { type: 'tv', id: 2 }], [{ type: 'movie', id: 1 }, { type: 'tv', id: 1 }]).map(i => `${i.type}${i.id}`), ['tv1', 'movie1', 'tv2']);

// A picked service also covers its ad plans and channels.
const mine = [{ id: 8, name: 'Netflix' }, { id: 531, name: 'Paramount Plus' }];
assert(onMyServices({ id: 1796, name: 'Netflix Standard with Ads' }, mine));
assert(onMyServices({ id: 582, name: 'Paramount+ Amazon Channel' }, mine));
assert(!onMyServices({ id: 15, name: 'Hulu' }, mine));
assert.equal(splitByServices([{ id: 8, name: 'Netflix' }, { id: 15, name: 'Hulu' }], mine).other[0].name, 'Hulu');
assert.equal(normalizeName('Paramount Plus'), normalizeName('Paramount+'));

// Services map to the networks games air on.
const keys = networksForServices(['Peacock Premium', 'YouTube TV']);
assert(canWatchNetwork('NBC', keys), 'Peacock carries NBC');
assert(canWatchNetwork('ESPN', keys), 'YouTube TV carries ESPN');
assert(canWatchNetwork('NFL Net', keys), 'YouTube TV carries NFL Network');
assert(!canWatchNetwork('ESPN+', keys), 'ESPN+ needs its own plan');
assert(!canWatchNetwork('Prime Video', keys));
assert(canWatchNetwork('Prime Video', networksForServices(['Amazon Prime Video'])));
assert(canWatchNetwork('TNT', networksForServices(['HBO Max'])));
assert(canWatchNetwork('CBS', networksForServices(['TV antenna (free)'])));
assert(!canWatchNetwork('ESPN', networksForServices(['Hulu'])), 'plain Hulu has no live sports');
assert(isBroadcastNetwork('FOX') && !isBroadcastNetwork('FS1'));

// ESPN scoreboard: national listings first, radio dropped.
const games = parseScoreboard({
  events: [{
    id: 401, name: 'Bills at Chiefs', date: '2026-10-19T00:20Z',
    status: { type: { state: 'pre', shortDetail: '10/18 - 8:20 PM EDT' } },
    competitions: [{
      venue: { fullName: 'Arrowhead Stadium' },
      competitors: [
        { homeAway: 'home', score: '0', team: { displayName: 'Kansas City Chiefs', abbreviation: 'KC' } },
        { homeAway: 'away', score: '0', team: { displayName: 'Buffalo Bills', abbreviation: 'BUF' } },
      ],
      geoBroadcasts: [
        { type: { shortName: 'TV' }, market: { type: 'Home' }, media: { shortName: 'KSHB' } },
        { type: { shortName: 'TV' }, market: { type: 'National' }, media: { shortName: 'NBC' } },
        { type: { shortName: 'Streaming' }, market: { type: 'National' }, media: { shortName: 'Peacock' } },
        { type: { shortName: 'Radio' }, market: { type: 'National' }, media: { shortName: 'Westwood One' } },
      ],
    }],
  }, {
    id: 402, competitions: [{ competitors: [], broadcasts: [{ market: 'national', names: ['ESPN', 'ABC'] }] }],
  }],
}, 'nfl');
assert.equal(games[0].home.name, 'Kansas City Chiefs');
assert.equal(games[0].away.abbreviation, 'BUF');
assert.deepEqual(games[0].networks.map(n => n.name), ['NBC', 'Peacock', 'KSHB']);
assert.equal(games[0].networks[1].kind, 'streaming');
assert.deepEqual(games[1].networks.map(n => n.name), ['ESPN', 'ABC']);
assert.equal(games[1].home.name, 'TBD');

// Saved data is cleaned up on load.
const data = normalizeData({ region: 'XX', services: [{ id: 8, name: 'Netflix' }, { id: 'bad' }], live: ['YouTube TV', 'Nope'], leagues: ['nfl', 'curling'] });
assert.equal(data.region, 'US');
assert.deepEqual(data.services.map(s => s.id), [8]);
assert.deepEqual(data.live, ['YouTube TV']);
assert.deepEqual(data.leagues, ['nfl']);
assert.equal(toggleService(data, { id: 8, name: 'Netflix' }).services.length, 0);
assert.deepEqual(pickedNames(toggleService(data, { id: 15, name: 'Hulu' })), ['Netflix', 'Hulu', 'YouTube TV']);

// Chips link to the service: search pages where possible, else the TMDB listing.
assert.equal(providerLink({ name: 'Netflix Standard with Ads' }, 'The Bear'), 'https://www.netflix.com/search?q=The%20Bear');
assert.equal(providerLink({ name: 'YouTube TV' }, 'x'), 'https://tv.youtube.com/');
assert.equal(providerLink({ name: 'Zee5' }, 'x', 'https://tmdb.example/watch'), 'https://tmdb.example/watch');
assert.equal(networkLink('ESPN2'), 'https://www.espn.com/watch/');
assert.equal(networkLink('NFL Net'), 'https://www.nfl.com/plus/');
assert.equal(networkLink('KSHB'), null);

// Recommendations: suggested by more favorites ranks first; favorites themselves are skipped.
const rec = (id, popularity = 1) => ({ type: 'movie', id, popularity });
const ranked = rankRecommendations([[rec(10), rec(11), rec(12)], [rec(12), rec(13), rec(1)]], ['movie-1']);
assert.equal(ranked[0].id, 12, 'shared pick ranks first');
assert(!ranked.some(r => r.id === 1), 'favorite excluded');
assert.equal(ranked.length, 4);
assert.equal(parseSearchResult({ id: 3, title: 'x', vote_average: 7.26, vote_count: 10 }, 'movie').rating, 7.3);
assert.equal(parseSearchResult({ id: 3, title: 'x', vote_average: 0, vote_count: 0 }, 'movie').rating, null);
assert.equal(genresById.get('horror').tv, null);

// Favorites and the ratings switch persist cleanly.
let saved = normalizeData({});
assert.equal(saved.showRatings, true);
assert.equal(normalizeData({ showRatings: false }).showRatings, false);
saved = toggleFavorite(saved, { id: 603, type: 'movie', title: 'The Matrix', year: '1999', poster: null });
saved = toggleFavorite(saved, { id: 1396, type: 'tv', title: 'Breaking Bad', year: '2008' });
assert.deepEqual(saved.favorites.map(f => f.id), [1396, 603], 'newest first');
assert(isFavorite(saved, { id: 603, type: 'movie' }) && !isFavorite(saved, { id: 603, type: 'tv' }));
assert.equal(toggleFavorite(saved, { id: 603, type: 'movie' }).favorites.length, 1);
assert.equal(normalizeData({ favorites: [{ id: 'x' }, { id: 5, type: 'movie', title: 'Ok' }] }).favorites.length, 1);

// Direct links from Watchmode match TMDB names and win over search links.
const direct = parseWatchmodeSources([
  { name: 'Prime Video', type: 'buy', region: 'US', web_url: 'https://www.amazon.com/buy' },
  { name: 'Prime Video', type: 'sub', region: 'US', web_url: 'https://www.amazon.com/gp/video/detail/B0' },
  { name: 'Max', type: 'sub', region: 'US', web_url: 'https://play.max.com/movie/abc' },
  { name: 'Netflix', type: 'sub', region: 'CA', web_url: 'https://www.netflix.com/title/ca' },
  { name: 'Netflix', type: 'sub', region: 'US', web_url: 'https://www.netflix.com/title/80057281' },
  { name: 'Sketchy', type: 'sub', region: 'US', web_url: 'javascript:alert(1)' },
], 'US');
assert.deepEqual(direct.map(d => d.url), ['https://www.amazon.com/gp/video/detail/B0', 'https://play.max.com/movie/abc', 'https://www.netflix.com/title/80057281']);
assert.equal(serviceKey('Amazon Prime Video'), serviceKey('Prime Video'));
assert.equal(serviceKey('HBO Max'), serviceKey('Max'));
assert.notEqual(serviceKey('YouTube TV'), serviceKey('YouTube'));
assert.equal(directLinkFor({ name: 'HBO Max' }, direct), 'https://play.max.com/movie/abc');
assert.equal(providerLink({ name: 'Netflix Standard with Ads' }, 'Stranger Things', null, direct), 'https://www.netflix.com/title/80057281');
assert.equal(providerLink({ name: 'Hulu' }, 'x', null, direct), 'https://www.hulu.com/search?q=x', 'no direct link keeps the search link');
assert.deepEqual(parseWatchmodeSources({ error: 'quota' }, 'US'), []);

console.log('WatchFox checks passed');
