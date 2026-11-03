import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const records = [
  ['Original base', 'SemanticReviewBase', 'LFCFoundry-Semantic-Construction-Base.ttf', 'Original construction, base o counter'],
  ['Original open-counter candidate', 'SemanticReviewOpen', 'LFCFoundry-Semantic-Construction-Open-Counter.ttf', 'Original construction, larger o counter'],
  ['Corrected n; existing H', 'SemanticReviewSmoothCurrent', 'LFCFoundry-Semantic-Construction-Smooth-N-Current-H.ttf', 'C1 outer n shoulder; G1 counter joins'],
  ['Corrected n; H midpoint', 'SemanticReviewMidpoint', 'LFCFoundry-Semantic-Construction-Smooth-N-H-Midpoint.ttf', 'H crossbar center at 0.50 cap-height'],
  ['Corrected n; H below midpoint', 'SemanticReviewBelow', 'LFCFoundry-Semantic-Construction-Smooth-N-H-Low-0_48.ttf', 'H crossbar center at 0.48 cap-height']
].map(([label, family, file, note]) => {
  const bytes = readFileSync(resolve(here, 'artifacts', file));
  return { label, family, file, note, sha256: createHash('sha256').update(bytes).digest('hex'), data: bytes.toString('base64') };
});
const css = records.map(item => `@font-face{font-family:"${item.family}";src:url(data:font/ttf;base64,${item.data}) format("truetype");font-style:normal;font-weight:400;font-display:block}`).join('\n');
const cards = records.map((item, index) => `<section class="card"><h3>${item.label}</h3><p>${item.note}</p><p><code>${item.file}</code><br><small>SHA-256 ${item.sha256}</small></p><div id="status-${index}" class="status">Loading…</div><div class="glyphrows"></div><p class="sample">onH onH</p></section>`).join('\n');
const metadata = JSON.stringify(records.map(({ label, family }) => ({ label, family })));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Construction Geometry Quality Review</title><style>${css}
:root{color-scheme:light dark;font:15px/1.45 system-ui,sans-serif}body{margin:0 auto;max-width:1250px;padding:20px}h1{font-size:1.5rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:14px}.card{border:1px solid #888;border-radius:10px;padding:14px;min-width:0}.card h3{margin:.1rem 0}.status{border:1px solid #888;border-radius:6px;padding:6px}.status[data-state=ok]{border-color:#238636}.status[data-state=error]{border-color:#cf222e}.glyphrows{display:grid;gap:6px}.row{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}.glyph{font-family:var(--face);font-size:var(--size)}.sample{font-family:var(--face);font-size:clamp(32px,6vw,64px);overflow-wrap:anywhere;border-top:1px solid #888;padding-top:8px}small{overflow-wrap:anywhere}.note{max-width:85ch}@media(max-width:500px){body{padding:10px}}
</style><body><h1>Semantic construction geometry review</h1><p class="note">This standalone page embeds the exact bytes of the original and new TTF artifacts. It loads each through CSS <code>@font-face</code> and the browser Font Loading API. It does not reconstruct the outlines or make network requests. Compare the original and corrected <b>n</b> shoulder, the three <b>H</b> crossbar positions, and the base/open-counter <b>o</b>.</p><div class="grid">${cards}</div><script>
const entries=${metadata};
async function check(entry,index){const loaded=await document.fonts.load('48px "'+entry.family+'"');const face=Array.from(document.fonts).find(item=>item.family===entry.family);if(!loaded.length||!face||face.status!=='loaded'||!document.fonts.check('48px "'+entry.family+'"'))throw new Error('FontFace did not reach loaded status.');const status=document.querySelector('#status-'+index);status.textContent='FontFace loaded; document.fonts.check passed.';status.dataset.state='ok';const card=status.closest('.card');const rows=card.querySelector('.glyphrows');for(const size of [12,32,72]){const row=document.createElement('div');row.className='row';for(const char of ['o','n','H']){const span=document.createElement('span');span.className='glyph';span.style.setProperty('--face','"'+entry.family+'"');span.style.setProperty('--size',size+'px');span.textContent=char;span.title=char+' at '+size+' px';row.append(span)}rows.append(row)}}
Promise.all(entries.map((entry,index)=>check(entry,index).catch(error=>{const status=document.querySelector('#status-'+index);status.textContent='Font load failed: '+error.message;status.dataset.state='error'})));
</script></body></html>`;
const output = resolve(here, 'geometry-quality-review.html');
writeFileSync(output, html);
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), embeddedFonts: records.map(({ file, sha256 }) => ({ file, sha256 })) }, null, 2));
