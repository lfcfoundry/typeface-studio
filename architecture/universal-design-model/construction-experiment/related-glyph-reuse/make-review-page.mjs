import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fontPath = resolve(here, 'artifacts/LFCFoundry-Related-Glyph-Reuse-abdpq.ttf');
const output = resolve(here, 'related-glyph-review.html');
if (!existsSync(fontPath)) throw new Error('Build the related-glyph font before generating the review page.');
if (existsSync(output)) throw new Error(`Refusing to overwrite existing review page ${output}.`);
const bytes = readFileSync(fontPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const labels = [['a','Reference single-storey a'],['b','Left stem, ascender'],['d','Right stem, ascender'],['p','Left stem, descender'],['q','Right stem, descender']];
const cards = labels.map(([glyph,label]) => `<section><h2>${label}</h2><div class="specimen">${glyph}</div><p><code>U+${glyph.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}</code></p></section>`).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Related glyph construction review</title><style>
@font-face{font-family:RelatedGlyphs;src:url(data:font/ttf;base64,${bytes.toString('base64')}) format("truetype");font-style:normal;font-weight:400;font-display:block}
:root{font:16px/1.5 system-ui,sans-serif;color-scheme:light dark}body{max-width:1000px;margin:auto;padding:20px}h1{font-size:1.55rem}.status{padding:8px;border:1px solid #888;border-radius:6px}.status[data-state=ok]{border-color:#238636}.status[data-state=error]{border-color:#cf222e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}section{border:1px solid #888;border-radius:8px;padding:10px}.specimen{font-family:RelatedGlyphs;font-size:clamp(48px,12vw,96px);text-align:center;border-block:1px solid #888;padding:8px}.sizes{font-family:RelatedGlyphs;display:flex;justify-content:space-around;align-items:baseline;gap:8px}.sizes span:nth-child(1){font-size:16px}.sizes span:nth-child(2){font-size:32px}.sizes span:nth-child(3){font-size:72px}.paragraph{font-family:RelatedGlyphs;font-size:clamp(32px,7vw,64px);overflow-wrap:anywhere}code,small{overflow-wrap:anywhere}.note{max-width:80ch}@media(max-width:500px){body{padding:10px}}
</style><body><h1>Related-glyph component reuse experiment</h1><p class="note">The specimen uses one compiled font built from a shared bowl, counter, stem, join, and terminal component library. Glyph arrangements explicitly set stem side and vertical extent. It is an experimental construction family, not a finished typeface.</p><p><code>LFCFoundry-Related-Glyph-Reuse-abdpq.ttf</code><br><small>SHA-256 ${sha256}</small></p><div id="status" class="status">Checking embedded font…</div><p><b>Construction status:</b> a, b, d, p, and q generated; no glyph failed construction. <b>Independent validation:</b> not performed.</p><div class="grid">${cards}</div><h2>Size comparison</h2><div class="sizes"><span>abdpq</span><span>abdpq</span><span>abdpq</span></div><h2>Specimen</h2><p class="paragraph">a b d p q — abdpq — badge</p><p class="note">Inspect the bowl and counter orientation, stem side, ascender/descender reach, terminal joins, and consistency of stroke width. Browser rendering and optical quality are unverified until this page is opened and observed.</p><script>
document.fonts.load('72px RelatedGlyphs').then(loaded=>{const ok=loaded.length>0&&document.fonts.check('72px RelatedGlyphs');const s=document.querySelector('#status');s.textContent=ok?'FontFace loaded; document.fonts.check passed.':'FontFace did not load the embedded TTF.';s.dataset.state=ok?'ok':'error'}).catch(error=>{const s=document.querySelector('#status');s.textContent='Font loading failed: '+error.message;s.dataset.state='error'});
</script></body></html>`;
writeFileSync(output, html, { flag: 'wx' });
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), embeddedFontSha256: sha256 }, null, 2));
