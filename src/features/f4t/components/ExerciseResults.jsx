import { useMemo, useState } from 'react';
import { Activity, Search, Minus, Plus } from 'lucide-react';
import { activityCategories } from '../data/activities';
import { buildActivityGroups } from '../data/activityGroups';
import { formatDuration, minutesToBurnCalories } from '../../../domain/exercise/energy';

const PAGE_SIZE = 12;
const preferenceKey = 'f4t-activity-selections-v2';
function loadSelections() {
  try { return JSON.parse(localStorage.getItem(preferenceKey) || '{}'); }
  catch { return {}; }
}
function speedLabel(description) {
  const m = description.match(/([<>]?\s*\d+(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?)\s*mph/i);
  if (!m) return null;
  const raw = m[1].trim();
  const nums = raw.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const mph = nums.length === 1 ? nums[0] : (nums[0] + nums[1]) / 2;
  const pace = mph > 0 ? 60 / mph : null;
  const minutes = pace == null ? null : Math.floor(pace);
  const seconds = pace == null ? null : Math.round((pace - minutes) * 60);
  return { mph: `${raw} mph`, pace: pace == null ? null : `${minutes + (seconds === 60 ? 1 : 0)}:${String(seconds === 60 ? 0 : seconds).padStart(2,'0')} min/mile (approx.)` };
}
function GroupCard({ group, calories, weightLbs, mode, selections, setSelections }) {
  const storedId = selections[group.key];
  const selectedIndex = Math.max(0, group.options.findIndex(a => a.id === storedId));
  const selected = group.options[selectedIndex];
  const minutes = minutesToBurnCalories(calories, selected.met, weightLbs, mode);
  const speed = speedLabel(selected.description);
  function select(index) {
    if (index >= 0 && index < group.options.length)
      setSelections(s => ({ ...s, [group.key]: group.options[index].id }));
  }
  return <article className="exercise-card">
    <Activity size={24} aria-hidden="true" />
    <small>{group.category}</small>
    <h3>{group.title}</h3>
    {group.options.length > 1 && <div style={{margin:'12px 0'}}>
      <label htmlFor={`f4t-${group.key}`} style={{display:'block',marginBottom:6}}>
        Adjust {group.adjustmentLabel} ({group.options.length} documented levels)
      </label>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button type="button" aria-label={`Decrease ${group.adjustmentLabel}`} disabled={selectedIndex===0} onClick={()=>select(selectedIndex-1)}><Minus size={16}/></button>
        <select id={`f4t-${group.key}`} style={{flex:1,minWidth:0}} value={selected.id} onChange={e=>select(group.options.findIndex(a=>a.id===e.target.value))}>
          {group.options.map(a=><option key={a.id} value={a.id}>{a.adjustmentValue} · {a.met} MET</option>)}
        </select>
        <button type="button" aria-label={`Increase ${group.adjustmentLabel}`} disabled={selectedIndex===group.options.length-1} onClick={()=>select(selectedIndex+1)}><Plus size={16}/></button>
      </div>
    </div>}
    <strong style={{display:'block',fontSize:'1.35rem'}}>{Number.isFinite(minutes) ? formatDuration(minutes) : 'No additional calories burned'}</strong>
    {speed && <p>{speed.mph}{(group.category === 'Running' || group.category === 'Walking') && speed.pace ? ` · ${speed.pace}` : ''}</p>}
    <small>{selected.met} MET · Compendium code {selected.id} · {mode === 'net' ? 'Net' : 'Total'} calories</small>
    <p className="exercise-description">{selected.description}</p>
  </article>;
}
export default function ExerciseResults({ calories, weightLbs }) {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [mode, setMode] = useState('net');
  const [selections, setSelectionsState] = useState(loadSelections);
  function setSelections(update) {
    setSelectionsState(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      try { localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const groups = useMemo(() => buildActivityGroups(), []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => (category === 'All' || g.category === category) &&
      (!q || g.title.toLowerCase().includes(q) || g.options.some(a => a.description.toLowerCase().includes(q) || a.id.includes(q))));
  }, [groups, category, search]);
  if (!(calories > 0 && weightLbs > 0)) return null;
  return <section className="exercise-results">
    <h2>What does {Math.round(calories).toLocaleString()} calories look like?</h2>
    <p>Browse audited activity groups. Every adjustment uses a documented Compendium record; unmatched activities remain separate.</p>
    <fieldset style={{border:0,padding:0,margin:'16px 0'}}>
      <legend>Calorie calculation</legend>
      <label style={{marginRight:16}}><input type="radio" checked={mode==='net'} onChange={()=>setMode('net')} /> Net (above rest)</label>
      <label><input type="radio" checked={mode==='total'} onChange={()=>setMode('total')} /> Total</label>
    </fieldset>
    <div className="exercise-filters" style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}>
      <label className="exercise-search"><Search size={18}/><input type="search" placeholder="Search descriptions or codes" value={search} onChange={e=>{setSearch(e.target.value);setVisible(PAGE_SIZE);}} /></label>
      <select aria-label="Category" value={category} onChange={e=>{setCategory(e.target.value);setVisible(PAGE_SIZE);}}>
        <option value="All">All categories</option>
        {activityCategories.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </div>
    <p>Showing {Math.min(visible,filtered.length)} of {filtered.length} activity cards</p>
    <div className="exercise-grid">{filtered.slice(0,visible).map(g=><GroupCard key={g.key} group={g} calories={calories} weightLbs={weightLbs} mode={mode} selections={selections} setSelections={setSelections}/>)}</div>
    {visible<filtered.length && <button type="button" className="exercise-show-more" onClick={()=>setVisible(n=>n+PAGE_SIZE)}>Show more activities</button>}
    <div className="science-note"><strong>About these estimates</strong><p>Net calories subtract resting energy use (1 MET). Speed-range pace estimates use the midpoint of the documented range. Activity MET values are not interpolated.</p></div>
  </section>;
}
