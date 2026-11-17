// Checks the developer catalogs and page matching: node src/features/dev/tests/validate.mjs
import assert from "node:assert/strict";

import * as loaders from "../catalog/loaders.js";
import { appForPath } from "../../site/pages.js";

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

await test("pages map to the app they belong to", () => {
  assert.equal(appForPath("/lift")?.id, "liftfox");
  assert.equal(appForPath("/tools/calc/reynolds")?.id, "toolfox");
  assert.equal(appForPath("/liftoff"), null);
  assert.equal(appForPath("/"), null);
  assert.equal(appForPath("/feedback"), null);
});

for (const [name, load] of Object.entries(loaders)) {
  await test(`${name} catalog lists its contents with unique ids`, async () => {
    const { groups } = await load();
    const items = groups.flatMap(g => g.items);
    assert.ok(items.length > 0, `${name} has items`);
    for (const item of items) {
      assert.ok(item.title, `${name}/${item.id} has a title`);
      for (const line of item.list ?? []) assert.equal(typeof line, "string", `${name}/${item.id} list is text`);
    }
    for (const g of groups) {
      const ids = g.items.map(i => i.id);
      assert.equal(new Set(ids).size, ids.length, `${name}: ids are unique in ${g.title}`);
    }
    console.log(`      ${items.length} items in ${groups.length} groups`);
  });
}

console.log(`Developer area: ${passed} checks passed.`);
