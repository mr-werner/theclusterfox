import assert from 'node:assert/strict';
import { FREE_PICKS, cleanTitle, dedupeMovies, freeQuery, parseArchiveDocs, plainText, runtimeMinutes } from '../../../services/watch/freeMovies.js';

// Only public domain feature films from before 1978.
const base = freeQuery();
assert.match(base, /collection:feature_films/);
assert.match(base, /licenseurl:\*publicdomain\*/);
assert.match(base, /year:\[1890 TO 1977\]/);
assert.match(freeQuery({ text: 'his girl" OR x:(' }), /title:\(his AND girl AND OR AND x\)/);
assert.match(freeQuery({ genre: 'noir' }), /subject:\(noir\)/);
assert.equal(freeQuery({ genre: 'nope' }), base);

assert.equal(runtimeMinutes('1:31:44'), 91);
assert.equal(runtimeMinutes('20:33'), 20);
assert.equal(runtimeMinutes('68 min'), 68);
assert.equal(runtimeMinutes(''), null);

assert.equal(plainText('A <b>great</b> film &amp; more<br/>now'), 'A great film & more now');
assert.equal(cleanTitle('Charade ( 1963) Cary Grant & Audrey Hepburn', 1963), 'Charade');
assert.equal(cleanTitle('Nosferatu_DVD_quality', 1922), 'Nosferatu');
assert.equal(cleanTitle('His Girl Friday iPod', 1940), 'His Girl Friday');
assert.match(freeQuery(), /NOT subject:\(exploitation\)/);
assert.deepEqual(
  dedupeMovies([{ id: 'a', title: 'His Girl Friday', year: 1940 }, { id: 'b', title: 'His Girl Friday!', year: 1940 }, { id: 'c', title: 'His Girl Friday', year: 1939 }]).map(m => m.id),
  ['a', 'c']
);

const [movie] = parseArchiveDocs([{ identifier: 'his_girl_friday', title: 'His Girl Friday', year: '1940', runtime: '1:31:44', subject: 'comedy', description: '<p>Fast talk.</p>' }, { title: 'no id' }]);
assert.deepEqual(
  { id: movie.id, title: movie.title, year: movie.year, runtime: movie.runtime, overview: movie.overview, subjects: movie.subjects },
  { id: 'his_girl_friday', title: 'His Girl Friday', year: 1940, runtime: 91, overview: 'Fast talk.', subjects: ['comedy'] }
);
assert.equal(movie.poster, 'https://archive.org/services/img/his_girl_friday');

assert.ok(FREE_PICKS.length >= 12);
assert.equal(new Set(FREE_PICKS.map(p => p.id)).size, FREE_PICKS.length);
assert.ok(FREE_PICKS.every(p => p.year < 1978));

console.log('WatchFox free movies: queries and parsing check out.');
