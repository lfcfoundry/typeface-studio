import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('..', import.meta.url)));
const evidenceDir = resolve(here, 'browser-evidence');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { '.html': 'text/html; charset=utf-8', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8' };

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  if (request.method === 'GET' && pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ status: 'ready' })); return;
  }
  if (request.method === 'POST' && pathname === '/capture') {
    const chunks = []; let size = 0;
    request.on('data', chunk => { size += chunk.length; if (size > 12_000_000) request.destroy(); else chunks.push(chunk); });
    request.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!payload.pngBase64 || !payload.measurement?.fonts?.candidate?.loaded || !payload.measurement?.fonts?.parent?.loaded) throw new Error('Browser font-load evidence is incomplete.');
        const png = Buffer.from(payload.pngBase64, 'base64');
        if (png.length < 100 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Browser canvas payload is not a PNG.');
        const pngPath = resolve(evidenceDir, 'android-chrome-canvas-v2.png');
        const resultsPath = resolve(evidenceDir, 'android-chrome-results-v2.json');
        const results = { ...payload.measurement, evidence: { screenshotType: 'Canvas PNG captured by Android Chrome after drawing loaded font glyphs',
          file: 'android-chrome-canvas-v2.png', bytes: png.length, sha256: sha256(png),
          note: 'Corrected raster mask excludes opaque white canvas pixels using RGB ink threshold.' } };
        writeFileSync(pngPath, png, { flag: 'wx' });
        writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`, { flag: 'wx' });
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'saved', png: 'browser-evidence/android-chrome-canvas-v2.png', results: 'browser-evidence/android-chrome-results-v2.json', sha256: results.evidence.sha256 }));
      } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }
  if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
  const path = resolve(here, `.${pathname}`);
  if (path !== here && !path.startsWith(`${here}${sep}`)) { response.writeHead(403); response.end(); return; }
  try {
    const body = readFileSync(path);
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});

server.listen(8765, '0.0.0.0', () => process.stdout.write('lowercase-h evidence server listening on http://127.0.0.1:8765\n'));
