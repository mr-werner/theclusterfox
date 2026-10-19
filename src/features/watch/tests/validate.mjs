import assert from 'node:assert/strict';
import {
  canWatchNetwork, isBroadcastNetwork, mergeProviderLists, networksForServices, normalizeName,
  onMyServices, parseScoreboard, parseSearchResult, parseWatchProviders, splitByServices,
} from '../../../services/watch/parse.js';
import { networkLink, providerLink } from '../../../services/watch/links.js';
import { normalizeData, toggleService, pickedNames } from '../state/watchStore.js';

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

console.log('WatchFox checks passed');
