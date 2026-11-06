import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve('.');
const template=await readFile(resolve(root,'src/index.html'),'utf8');
const css=await readFile(resolve(root,'src/studio.css'),'utf8');
const dependencyLicense=await readFile(resolve(root,'node_modules/fontsketch/LICENSE'),'utf8');
const worker=await build({entryPoints:[resolve(root,'src/worker/smooth-worker.js')],bundle:true,format:'iife',target:['es2020'],write:false,minify:true,define:{'process.env.NODE_ENV':'"production"'}});
const workerSource=worker.outputFiles[0].text.replaceAll('</script','<\\/script');
const bundled=await build({entryPoints:[resolve(root,'src/app.js')],bundle:true,format:'iife',target:['es2020'],write:false,legalComments:'inline',minify:true,loader:{'.wasm':'dataurl'},define:{'process.env.NODE_ENV':'"production"','__WORKER_SOURCE__':JSON.stringify(workerSource)}});
const licenseHtml=dependencyLicense.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const notice=`<details class="software-notice"><summary>Bundled software notice · fontsketch 0.1.0 (MIT)</summary><pre>${licenseHtml}</pre></details>`;
const html=template.replace(/\s*<link rel="stylesheet" href="\.\/studio\.css">/,()=>'\n  <style>\n'+css+'\n  </style>').replace(/\s*<script type="module" src="\.\/app\.js"><\/script>/,()=>'\n  <script>\n'+bundled.outputFiles[0].text+'\n  </script>').replace('</body>',()=>notice+'\n</body>');
if(/(?:src|href)=["'](?:https?:|\/\/)|from\s*["']https?:/i.test(html)||/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/i.test(bundled.outputFiles[0].text)||/\bimport\s*\(/.test(bundled.outputFiles[0].text))throw new Error('External runtime dependency or network API detected in release HTML.');
await mkdir(resolve(root,'dist'),{recursive:true});
await writeFile(resolve(root,'dist/typeface-studio.html'),html,'utf8');
console.log(`Built dist/typeface-studio.html (${Buffer.byteLength(html).toLocaleString()} bytes).`);
