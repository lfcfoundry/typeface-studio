// Non-gating reading score: runs the app's own reader (word rules + mood layer) on the research request sets
// and prints how many labeled axes come out the labeled way. Not part of `npm test`; run `npm run score`.
// Labels: weight/contrast/width/spacing +1 more, -1 less (vs the app defaults); serif/rounded/mono true/false.
import { interpretBrief } from '../src/core/brief.js';
import { warmMood } from '../src/core/mood.js';
import { DEFAULT_PARAMS as D } from '../src/core/model.js';
import { HARD100 } from '../test/data/hard118.mjs';
import { FRESH20 } from '../test/data/fresh20.mjs';
import { REAL12 } from '../test/data/real12.mjs';
await warmMood();
const sg = (v, d, t) => Math.abs(v - d) > t ? Math.sign(v - d) : 0;
const axes = s => ({ weight: sg(s.stem, D.stem, 0.02), width: sg(s.width, D.width, 0.01), contrast: sg(s.contrast, D.contrast, 0.01), spacing: sg(s.spacing, D.spacing, 0.01),
  serif: !!s.serifs, rounded: s.terminals === 'Rounded', mono: !!s.monospaced });
const settingsOf = b => { const r = interpretBrief(b); return (r.result || r).settings || {}; };
function score(name, set, list) {
  let ok = 0, t = 0, wrong = 0; const bad = [];
  for (const c of set) {
    if (!Object.keys(c.y).length) continue;
    const a = axes({ ...D, ...settingsOf(c.b) }); const miss = [];
    for (const [k, v] of Object.entries(c.y)) { t++; if (a[k] === v) ok++; else { miss.push(`${k}:${v} got ${a[k]}`); if (a[k] !== 0 && a[k] !== false) wrong++; } }
    if (miss.length) bad.push(`${c.k} | ${c.b.slice(0, 55).padEnd(55)} | ${miss.join('; ')}`);
  }
  console.log(`${name}: score ${(ok / t).toFixed(3)} (${ok}/${t} labels), wrong-way ${wrong}`);
  if (list) console.log(bad.join('\n'));
}
const list = process.argv.includes('list');
score('hard118', HARD100, list); score('fresh20', FRESH20, list);
console.log(`real12: ${REAL12.length} owner requests (no labels); first-chip and settings:`);
for (const b of REAL12) { const r = interpretBrief(b), R = r.result || r; console.log(' -', b.slice(0, 60), '=>', (R.chips || []).slice(0, 7).join(' | ')); }
