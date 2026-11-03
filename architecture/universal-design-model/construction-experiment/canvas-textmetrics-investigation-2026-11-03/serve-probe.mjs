import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const resultPath = resolve(here, 'chrome-results.json');
const errorPath = resolve(here, 'chrome-runtime-errors.json');
const fastResultPath = resolve(here, 'chrome-fast-results.json');
const fastErrorPath = resolve(here, 'chrome-fast-errors.json');
if ([resultPath, errorPath, fastResultPath, fastErrorPath].some(existsSync)) throw new Error('Refusing to overwrite existing browser results.');
const server = createServer((request, response) => {
  if (request.method === 'GET' && ['/probe-execution.html', '/probe-fast.html'].includes(request.url?.split('?')[0])) {
    const pageName = request.url.split('?')[0].slice(1);
    const page = readFileSync(resolve(here, pageName));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': page.length });
    response.end(page);
    process.stdout.write(`Chrome requested ${pageName}\n`);
    return;
  }
  if (request.method === 'POST' && ['/results', '/error', '/fast-results', '/fast-error'].includes(request.url)) {
    const chunks = [];
    let length = 0;
    request.on('data', chunk => {
      length += chunk.length;
      if (length > 2_000_000) request.destroy(new Error('Browser result exceeds 2 MB limit.'));
      else chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(body);
        const target = request.url === '/results' ? resultPath : request.url === '/error' ? errorPath : request.url === '/fast-results' ? fastResultPath : fastErrorPath;
        writeFileSync(target, JSON.stringify(parsed, null, 2) + '\n', { flag: 'wx' });
        response.writeHead(201, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ saved: target.split('/').at(-1) }));
        process.stdout.write(`Saved ${target.split('/').at(-1)} (${length} bytes)\n`);
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain' });
        response.end(String(error));
        process.stderr.write(`${error}\n`);
      }
    });
    return;
  }
  response.writeHead(404);
  response.end('Not found');
});
server.listen(18765, '0.0.0.0', () => process.stdout.write('Listening on port 18765\n'));
