import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const here = resolve(import.meta.dirname);
const entry = resolve(here, 'src/app.js');
const result = await build({
  entryPoints: [entry], bundle: true, write: false, minify: true,
  platform: 'browser', format: 'iife', target: ['es2020'],
  legalComments: 'none', treeShaking: true
});
const js = result.outputFiles[0].text;
const css = readFileSync(resolve(here, 'prototype.css'), 'utf8');
const source = readFileSync(resolve(here, 'index.html'), 'utf8');
const runtimeLicenses = [
  ['Compromise 14.19.0', resolve(here, 'node_modules/compromise/LICENSE')],
  ['efrt 2.9.0', resolve(here, 'node_modules/efrt/LICENSE')],
  ['suffix-thumb 6.0.0', resolve(here, 'node_modules/suffix-thumb/LICENSE')],
  ['fontsketch 0.1.0', resolve(root, 'node_modules/fontsketch/LICENSE')]
].map(([name, file]) => `<h3>${name}</h3><pre>${escapeHtml(readFileSync(file, 'utf8'))}</pre>`).join('');
const html = source
  .replace('<link rel="stylesheet" href="./prototype.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="./src/app.js"></script>', () => `<script>${js}</script>`)
  .replace('</body>', `<details class="card"><summary>Bundled third-party licenses</summary>${runtimeLicenses}</details></body>`);
const external = html.match(/<script[^>]+src=|<link[^>]+href=|@import\s|https?:\/\//i);
if (external) throw new Error(`External runtime reference ${external[0]} near ${html.slice(Math.max(0, external.index - 50), external.index + 100)}`);
if (/\bfetch\s*\(|XMLHttpRequest|import\s*\(/.test(js)) throw new Error('The bundled application contains a runtime network or dynamic-import code path.');
const outDir = resolve(here, 'dist');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, 'typeface-studio-contour-prototype.html');
writeFileSync(out, html);
console.log(JSON.stringify({
  artifact: out,
  bytes: Buffer.byteLength(html),
  gzipBytes: gzipSync(Buffer.from(html)).length,
  jsBytes: Buffer.byteLength(js),
  cssBytes: Buffer.byteLength(css),
  bundledRuntime: ['Compromise 14.19.0', 'efrt 2.9.0', 'suffix-thumb 6.0.0', 'fontsketch 0.1.0'],
  externalAssetReferences: 0
}, null, 2));

function escapeHtml(text) {
  return text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
}
