import { createServer } from 'node:http';
import { readFile, open } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const experiment = resolve(here, '..');
const artifacts = resolve(experiment, 'artifacts');
const review = resolve(experiment, 'review.html');
const allow = new Map([
  ['/artifacts/LFCFoundry-NL-Topology-Single-Storey-A.ttf', resolve(artifacts, 'LFCFoundry-NL-Topology-Single-Storey-A.ttf')],
  ['/artifacts/LFCFoundry-NL-Topology-Double-Storey-A.ttf', resolve(artifacts, 'LFCFoundry-NL-Topology-Double-Storey-A.ttf')]
]);
const evidenceNames = new Set(['source-canvas.png', 'candidate-canvas.png', 'results.json']);

function send(response, status, type, body) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1:8766');
    if (request.method === 'GET') {
      let path, type;
      if (url.pathname === '/' || url.pathname === '/probe.html') {
        path = resolve(here, 'probe.html'); type = 'text/html; charset=utf-8';
      } else if (url.pathname === '/review.html') {
        path = review; type = 'text/html; charset=utf-8';
      } else if (allow.has(url.pathname)) {
        path = allow.get(url.pathname); type = 'font/ttf';
      } else { send(response, 404, 'text/plain', 'Not found'); return; }
      const body = await readFile(path);
      console.log(JSON.stringify({ method: request.method, path: url.pathname, status: 200,
        bytes: body.length, userAgent: request.headers['user-agent'] || null }));
      send(response, 200, type, body);
      return;
    }
    if (request.method === 'POST' && url.pathname.startsWith('/capture/')) {
      const name = basename(url.pathname.slice('/capture/'.length));
      if (!evidenceNames.has(name)) { send(response, 400, 'text/plain', 'Unsupported evidence file'); return; }
      const chunks = []; let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 12 * 1024 * 1024) { send(response, 413, 'text/plain', 'Evidence too large'); return; }
        chunks.push(chunk);
      }
      const file = resolve(here, name);
      const handle = await open(file, 'wx');
      try { await handle.writeFile(Buffer.concat(chunks)); } finally { await handle.close(); }
      console.log(JSON.stringify({ method: request.method, path: url.pathname, status: 201, bytes }));
      send(response, 201, 'application/json', JSON.stringify({ saved: name, bytes }));
      return;
    }
    send(response, 405, 'text/plain', 'Method not allowed');
  } catch (error) {
    console.error(error.stack || error);
    send(response, error.code === 'EEXIST' ? 409 : 500, 'text/plain', error.message || 'Server error');
  }
});

server.listen(8766, '127.0.0.1', () => console.log('Verification server listening at http://127.0.0.1:8766/'));
