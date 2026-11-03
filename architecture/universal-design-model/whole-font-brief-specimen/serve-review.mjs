import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const page = join(root, 'review.html');
const server = createServer(async (request, response) => {
  if (!['/', '/review.html'].includes(new URL(request.url, 'http://localhost').pathname)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  try {
    const bytes = await readFile(page);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(error.message);
  }
});
server.listen(8788, '127.0.0.1', () => process.stdout.write('Review server listening on http://127.0.0.1:8788/review.html\n'));
