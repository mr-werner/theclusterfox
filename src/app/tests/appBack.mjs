// The apps' back button: when it shows, and where it goes with no step back.
import assert from 'node:assert/strict';
import { defaultParent, isAppStart, isInside } from '../../lib/appBack.js';
import { apps } from '../apps.js';

const at = (href) => {
  const u = new URL(href, 'https://x.test');
  return { pathname: u.pathname, search: u.search };
};

// Start screens hide it; anything deeper shows it.
for (const app of apps) assert.equal(isAppStart(app.path, at(app.path)), true, `${app.id} start`);
assert.equal(isAppStart('/tools', at('/tools/')), true);
assert.equal(isAppStart('/tools', at('/tools/calc/beam')), false);
assert.equal(isAppStart('/watch', at('/watch?tab=services')), false);
assert.equal(isAppStart('/math', at('/math?q=2x%3D4')), false);

// Inside means the same app, never a neighbour that shares a prefix.
assert.equal(isInside('/tools/c/fluids', '/tools'), true);
assert.equal(isInside('/tools?x=1', '/tools'), true);
assert.equal(isInside('/toolsy', '/tools'), false);
assert.equal(isInside('/', '/tools'), false);
assert.equal(isInside(null, '/tools'), false);

// No step back: a detail opened from a tab returns to that tab, else the start.
assert.equal(defaultParent('/cook', at('/cook?tab=saved&r=abc')), '/cook?tab=saved');
assert.equal(defaultParent('/cook', at('/cook?r=abc')), '/cook');
assert.equal(defaultParent('/watch', at('/watch?tab=services')), '/watch');
assert.equal(defaultParent('/grow', at('/grow?tab=plants&plant=tomato')), '/grow?tab=plants');

console.log('appBack ok');
