// Every app's PlanFox link: right shape, right days, safe links.
import assert from 'node:assert/strict';
import { isSitePath, PLAN_LINKS, planAddHref } from '../planLinks.js';
import { apps } from '../apps.js';
import { buildProgram } from '../../features/lift/model/program.js';
import { cleanAppItems } from '../../features/plan/state/useAppLinks.js';
import { buildEntries } from '../../features/plan/model/entries.js';
import { emptyData, normalizeData } from '../../features/plan/state/planStore.js';

// The registry points at real apps and real modules.
const appIds = new Set(apps.map(a => a.id));
for (const link of PLAN_LINKS) {
  assert(appIds.has(link.app), `${link.app} is in apps.js`);
  assert.equal(typeof link.storageKey, 'string');
  const mod = await link.load();
  assert.equal(typeof mod.planItems, 'function', `${link.app} has planItems`);
  // Never used, or junk in storage: no items, no crash.
  for (const raw of [null, {}, 'x', 42, []]) assert.deepEqual(cleanAppItems(link.app, mod.planItems(raw, '2026-11-01', '2026-11-30')).length >= 0, true);
  if (mod.launchTargets) {
    const targets = await mod.launchTargets(null);
    assert(Array.isArray(targets) && targets.length > 0, `${link.app} offers something to open`);
    for (const t of targets) assert(isSitePath(t.href) && t.title, `${link.app} target ${t.id} is a site link`);
  }
}
assert.equal(new Set(PLAN_LINKS.map(l => l.app)).size, PLAN_LINKS.length, 'one entry per app');

assert(isSitePath('/lift?plan=a'));
assert(!isSitePath('//evil.example'));
assert(!isSitePath('https://evil.example'));
assert(!isSitePath('javascript:alert(1)'));
assert.equal(planAddHref({ app: 'calmfox', href: '/calm?s=sleep', title: 'Wind down' }), '/plan?add=calmfox&open=%2Fcalm%3Fs%3Dsleep&title=Wind+down');

const load = id => PLAN_LINKS.find(l => l.app === id).load();

// LiftFox: plan sessions on their days, done ones marked, a catch-up today.
{
  const { planItems, sessionHref } = await load('liftfox');
  const program = buildProgram({ goal: 'size', daysPerWeek: 3, minutes: 40, weeks: 4, startDate: '2026-11-02', seed: 3 });
  const raw = {
    plans: [{ id: 'p1', createdAt: '2026-11-01T00:00:00Z', program, completed: { w1d1: '2026-11-02' } }],
    activePlanId: 'p1',
    history: [{ id: 'h1', date: '2026-11-03', title: 'Arms day', minutes: 30, setsDone: 9, setsTotal: 10 }],
  };
  const items = planItems(raw, '2026-11-02', '2026-11-08', '2026-11-06');
  const sessions = items.filter(i => i.id.startsWith('s:'));
  assert.deepEqual(sessions.map(i => i.day), ['2026-11-02', '2026-11-04', '2026-11-06'], 'Mon, Wed, Fri');
  assert.equal(sessions[0].done, true);
  assert.equal(sessions[1].done, false);
  assert.equal(sessions[0].href, sessionHref('p1', 'w1d1'));
  const catchUp = items.find(i => i.id.startsWith('catchup:'));
  assert.equal(catchUp.day, '2026-11-06', 'the missed Wednesday session waits on today');
  assert(catchUp.href.includes('session=w1d2'));
  const done = items.find(i => i.id === 'h:h1');
  assert.equal(done.day, '2026-11-03');
  assert.equal(done.done, true);
  // A workout in progress shows on today.
  const withCurrent = planItems({ ...raw, current: { id: 'c', title: 'Legs', items: [] } }, '2026-11-01', '2026-11-30', '2026-11-10');
  assert(withCurrent.some(i => i.id === 'current:c' && i.day === '2026-11-10' && i.href === '/lift'));
  assert.equal(planItems(raw, '2026-12-01', '2026-12-31', '2026-12-05').filter(i => i.id.startsWith('s:')).length, 0, 'nothing past the plan');
}

// SkyFox: planned time outside at its hour.
{
  const { planItems } = await load('clocast');
  const items = planItems({ plans: [{ id: 'a', activityId: 'run-easy', title: '', day: '2026-11-05', startHour: 7, hours: 1 }, { id: 'b', activityId: 'hike', title: 'Ridge hike', day: '2026-12-05', startHour: 9, hours: 3 }] }, '2026-11-01', '2026-11-30');
  assert.equal(items.length, 1);
  assert.equal(items[0].time, '07:00');
  assert(items[0].title.length > 0);
}

// CalmFox: finished sessions on their days; sessions to open.
{
  const { planItems, launchTargets } = await load('calmfox');
  const items = planItems({ history: [{ id: 'x', date: '2026-11-04', sessionId: 'arrive', title: 'Arriving', minutes: 5 }] }, '2026-11-01', '2026-11-30');
  assert.equal(items.length, 1);
  assert.equal(items[0].done, true);
  const targets = launchTargets({ favorites: ['arrive'] });
  assert(targets.some(t => t.title.startsWith('★')), 'favorites first, starred');
}

// CookFox: something you started cooking, food to use up, the list.
{
  const { planItems, launchTargets } = await load('cookfox');
  const cook = await import('../../features/cook/data/recipes.js');
  const recipe = cook.recipes[0];
  const raw = {
    sessions: { [recipe.id]: { recipeId: recipe.id, servings: 2, startedAt: '2026-11-06T17:00:00Z', updatedAt: 1, phase: 'cooking', step: 1, doneSteps: [], have: {}, prepped: {}, used: {}, tasks: {}, timers: [] } },
    pantry: [{ id: 'p', name: 'spinach', expires: '2026-11-08' }],
    shopping: [{ id: 's', name: 'milk', checked: false }],
  };
  const items = planItems(raw, '2026-11-01', '2026-11-30', '2026-11-06');
  assert(items.some(i => i.id === `cooking:${recipe.id}` && i.day === '2026-11-06'), 'keep cooking today');
  assert(items.some(i => i.id === 'use:p' && i.day === '2026-11-08'), 'use up on its last good day');
  assert(items.some(i => i.id === 'shopping'), 'shopping list today');
  assert(launchTargets(null).some(t => t.href === `/cook?r=${encodeURIComponent(recipe.id)}`));
}

// Malformed answers are dropped before they reach the calendar.
assert.equal(cleanAppItems('x', [{ id: 1, day: 'soon', title: 'a', href: '/x' }, { id: 2, day: '2026-11-01', title: 'b', href: 'https://evil.example' }, { id: 3, day: '2026-11-01', title: 'ok', href: '/ok', time: 'noon' }]).length, 1);

// PlanFox: app items become entries with a launch link, behind the apps layer.
{
  const layers = { ...emptyData().layers };
  assert.equal(layers.apps, true, 'on for new calendars');
  const appItems = cleanAppItems('liftfox', [{ id: 'a', day: '2026-11-06', title: 'Week 1: Full body', href: '/lift?next=1' }]);
  const byDay = buildEntries({ layers, from: '2026-11-01', to: '2026-11-30', appItems });
  const entry = byDay.get('2026-11-06')[0];
  assert.equal(entry.layer, 'apps');
  assert.deepEqual(entry.launch, { app: 'liftfox', href: '/lift?next=1', label: 'Week 1: Full body' });
  assert.equal(buildEntries({ layers: { ...layers, apps: false }, from: '2026-11-01', to: '2026-11-30', appItems }).size, 0);
}

// Planner items keep a safe app link, and drop anything else.
{
  const base = { id: 'i', kind: 'event', title: 'Wind down', day: '2026-11-06' };
  assert.deepEqual(normalizeData({ items: [{ ...base, link: { app: 'calmfox', href: '/calm?s=sleep', label: 'Sleep' } }] }).items[0].link, { app: 'calmfox', href: '/calm?s=sleep', label: 'Sleep' });
  assert.equal(normalizeData({ items: [{ ...base, link: { app: 'calmfox', href: 'https://evil.example' } }] }).items[0].link, null);
  assert.equal(normalizeData({ items: [base] }).items[0].link, null);
  assert.deepEqual(normalizeData({ hiddenApps: ['cookfox', 3] }).hiddenApps, ['cookfox']);
  // Saved calendars from before this change get the apps layer switched on.
  assert.equal(normalizeData({ layers: { weather: true } }).layers.apps, true);
}

console.log('plan links: all good');
