import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fontPath = resolve(here, 'artifacts/LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf');
const output = resolve(here, 'lowercase-a-review.html');
if (!existsSync(fontPath)) throw new Error('Build the lowercase-a font artifact before creating its review page.');
if (existsSync(output)) throw new Error(`Refusing to overwrite existing review page ${output}.`);
const bytes = readFileSync(fontPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const base64 = bytes.toString('base64');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lowercase a construction review</title><style>
@font-face{font-family:SemanticA;src:url(data:font/ttf;base64,${base64}) format("truetype");font-style:normal;font-weight:400;font-display:block}
:root{font:16px/1.5 system-ui,sans-serif;color-scheme:light dark}body{max-width:850px;margin:auto;padding:20px}h1{font-size:1.5rem}.status{padding:8px;border:1px solid #888;border-radius:6px}.status[data-state=ok]{border-color:#238636}.status[data-state=error]{border-color:#cf222e}.glyphs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.glyph{border:1px solid #888;border-radius:8px;padding:10px;text-align:center;font-family:SemanticA;font-size:clamp(48px,15vw,120px)}.sample{font-family:SemanticA;font-size:clamp(36px,9vw,72px);overflow-wrap:anywhere;border-block:1px solid #888;padding:10px 0}code,small{overflow-wrap:anywhere}.note{max-width:75ch}@media(max-width:500px){body{padding:12px}.glyphs{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style><body><h1>Semantic lowercase a construction review</h1><p class="note">This page loads the exact four-glyph experiment TTF using the browser font-loading API. The lowercase <b>a</b> is explicitly the experimental single-storey bowl-and-stem construction. Compare its bowl/counter joins and flat stem terminals with <b>o</b>, <b>n</b>, and <b>H</b>. This is a construction experiment, not a finished typeface.</p><p><code>LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf</code><br><small>SHA-256 ${sha256}</small></p><div id="status" class="status">Checking embedded font…</div><section class="glyphs" aria-label="Glyphs"><div class="glyph">a</div><div class="glyph">o</div><div class="glyph">n</div><div class="glyph">H</div></section><p class="sample">aonH · aaa · onHa</p><p class="note">Inspect at different zoom levels. Look for the selected single-storey topology, the flat ends of the right stem, the enclosed counter, and any sharp or awkward joins. Browser rendering is not asserted until this page is opened and observed.</p><script>
document.fonts.load('72px SemanticA').then(loaded=>{const ok=loaded.length>0&&document.fonts.check('72px SemanticA');const s=document.querySelector('#status');s.textContent=ok?'FontFace loaded; document.fonts.check passed.':'FontFace did not load the embedded TTF.';s.dataset.state=ok?'ok':'error'}).catch(error=>{const s=document.querySelector('#status');s.textContent='Font loading failed: '+error.message;s.dataset.state='error'});
</script></body></html>`;
writeFileSync(output, html, { flag: 'wx' });
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), embeddedFontSha256: sha256 }, null, 2));
