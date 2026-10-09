import fs from 'node:fs';
import assert from 'node:assert/strict';
const records=JSON.parse(fs.readFileSync(new URL('../data/compendiumActivities.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../data/activityGroupManifest.json',import.meta.url)));
const byId=new Map(records.map(a=>[a.id,a]));
const used=new Set();
for(const g of manifest){
 assert(g.ids.length>=2,g.title);
 assert(g.ids.length===g.optionLabels.length,g.title);
 assert(new Set(g.optionLabels).size>=2,g.title);
 for(const id of g.ids){
  assert(byId.has(id),`missing ${id}`);
  assert.equal(byId.get(id).category,g.category,`${g.title}: wrong category`);
  assert(!used.has(id),`duplicate ${id}`);used.add(id);
 }
}
assert.equal(new Set(records.map(a=>a.category)).size,22);
assert.equal(records.length,1111);
assert.equal(used.size+records.filter(a=>!used.has(a.id)).length,records.length);
for(const [id,group] of [['12508','Running — weighted backpack, speed'],['01019','Bicycling — leisure speed'],['11250','Forestry — axe chopping, blows per minute'],['17434','Walking — treadmill with load, temperature']]){
 assert(manifest.some(g=>g.title===group&&g.ids.includes(id)),id);
}
assert(!used.has('01200'),'Stationary cycling general must remain standalone');
assert(!used.has('15597'),'Ambiguous longboarding must remain standalone');
console.log(`PASS: ${records.length} records, 22 categories, ${manifest.length} audited groups, ${used.size} grouped records, ${records.length-used.size} standalone; no missing or duplicate records.`);
