import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(here, 'artifacts');
const sources = [
  { label: 'Base', family: 'SemanticBase', file: 'LFCFoundry-Semantic-Construction-Base.ttf' },
  { label: 'Open-counter candidate', family: 'SemanticCandidate', file: 'LFCFoundry-Semantic-Construction-Open-Counter.ttf' }
].map(item => {
  const bytes = readFileSync(resolve(artifacts, item.file));
  return { ...item, sha256: createHash('sha256').update(bytes).digest('hex'), data: bytes.toString('base64') };
});

const fonts = sources.map(item => `@font-face{font-family:"${item.family}";src:url(data:font/ttf;base64,${item.data}) format("truetype");font-style:normal;font-weight:400;font-display:block}`).join('\n');
const sourceRows = sources.map(item => `<li><b>${item.label}</b> — <code>${item.file}</code><br>SHA-256: <code>${item.sha256}</code></li>`).join('\n');
const encoded = JSON.stringify(sources.map(({ label, family }) => ({ label, family })));

const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Typeface Studio — Semantic TTF Review</title>
<style>
${fonts}
:root{color-scheme:light dark;font:16px/1.45 system-ui,sans-serif}body{max-width:1100px;margin:0 auto;padding:20px}h1{font-size:1.55rem}p{max-width:75ch}.status{padding:.7rem;border:1px solid #888;border-radius:8px;margin:.5rem 0}.status[data-state="ok"]{border-color:#238636}.status[data-state="error"]{border-color:#cf222e}.sources{overflow-wrap:anywhere}.compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pane{border:1px solid #888;border-radius:10px;padding:12px;min-width:0}.specimen{font-family:system-ui,sans-serif;border-top:1px solid #888;margin-top:10px;padding-top:8px}.glyphs{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.glyph{font-family:var(--review-font);font-size:var(--size);line-height:1.25;min-width:1.1em;text-align:center}.sample{font-family:var(--review-font);font-size:clamp(32px,7vw,76px);overflow-wrap:anywhere}.small{font-size:.83rem;color:CanvasText;opacity:.8}code{font-size:.85em}@media(max-width:650px){body{padding:12px}.compare{grid-template-columns:1fr}}
</style>
<body>
<h1>Semantic construction TTF review</h1>
<p>This page embeds the exact bytes of the two existing experimental TTF files and loads them through the browser's native <code>FontFace</code> API. It does not reconstruct the outlines or contact a network service.</p>
<div id="status" aria-live="polite">Loading font faces…</div>
<h2>Source artifacts</h2><ul class="sources">${sourceRows}</ul>
<h2>Glyph comparison</h2><p class="small">Inspect lowercase <b>o</b> closely at 32 px and 72 px. Check whether the candidate counter is visibly larger. Compare <b>n</b> and <b>H</b> for unchanged shape and spacing.</p>
<div id="comparison" class="compare"></div>
<script>
const fonts=${encoded};
const status=document.querySelector('#status');
const comparison=document.querySelector('#comparison');
async function load(item){
  const loaded=await document.fonts.load('48px "'+item.family+'"');
  const face=Array.from(document.fonts).find(candidate=>candidate.family===item.family);
  if(!loaded.length||!face||face.status!=='loaded'||!document.fonts.check('48px "'+item.family+'"')) throw new Error('The browser did not report a loaded usable FontFace.');
  return face;
}
function pane(item){
  const section=document.createElement('section');section.className='pane';
  const title=document.createElement('h3');title.textContent=item.label;section.append(title);
  for(const size of [12,32,72]){
    const row=document.createElement('div');row.className='glyphs';
    for(const char of ['o','n','H']){const span=document.createElement('span');span.className='glyph';span.style.setProperty('--review-font','"'+item.family+'"');span.style.setProperty('--size',size+'px');span.textContent=char;span.title=char+' at '+size+'px';row.append(span)}
    section.append(row);
  }
  const specimen=document.createElement('div');specimen.className='specimen';
  const label=document.createElement('div');label.className='small';label.textContent='Specimen: onH onH';
  const sample=document.createElement('div');sample.className='sample';sample.style.fontFamily='"'+item.family+'"';sample.textContent='onH onH';
  specimen.append(label,sample);section.append(specimen);return section;
}
Promise.all(fonts.map(load)).then(()=>{
  status.textContent='Both FontFace loads succeeded; document.fonts.check passed for each face.';status.className='status';status.dataset.state='ok';
  for(const item of fonts)comparison.append(pane(item));
}).catch(error=>{status.textContent='Font loading failed: '+error.message;status.className='status';status.dataset.state='error';});
</script>
</body></html>`;

const output = resolve(here, 'font-review.html');
writeFileSync(output, html);
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), embeddedFonts: sources.map(({ file, sha256 }) => ({ file, sha256 })) }, null, 2));
