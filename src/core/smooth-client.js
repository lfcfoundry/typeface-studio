// Main-thread side: asks the worker for Regular and Bold glyphs and caches them, so the sync build code finds them ready.
import { cacheSmooth } from './smooth.js';
import { buildFont } from './font-export.js';
let worker = null, nextId = 1; const waiting = new Map();
function start() {
  if (worker || typeof Worker === 'undefined' || typeof __WORKER_SOURCE__ === 'undefined') return worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([__WORKER_SOURCE__], { type: 'text/javascript' })));
    worker.onmessage = e => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); e.data.error ? w.reject(new Error(e.data.error)) : w.resolve(e.data.result); };
    worker.onerror = () => { for (const w of waiting.values()) w.reject(new Error('Worker failed')); waiting.clear(); worker = null; };
  } catch (e) { worker = null; }
  return worker;
}
const ask = (design, style) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); worker.postMessage({ id, design, style }); });
const askBuild = (project, style) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); worker.postMessage({ id, op: 'build', project, style }); });
// Builds the TTF bytes off the main thread when a worker exists; otherwise on the main thread (same result).
export async function buildFontAsync(project, style) {
  if (!start()) return buildFont(project, style);
  try { return await askBuild(project, style); } catch (e) { if (/Worker failed/.test(e.message)) return buildFont(project, style); throw e; }
}
// Resolves once both styles are cached; resolves quietly (nothing cached) when workers are unavailable, so callers fall back to the main thread.
export async function prefetchSmooth(design) {
  if (design.engine === 'pixel' || !start()) return false;
  try {
    const [reg, bold] = await Promise.all([ask(design, 'Regular'), ask(design, 'Bold')]);
    cacheSmooth(design, 'Regular', reg); cacheSmooth(design, 'Bold', bold); return true;
  } catch (e) { return false; }
}
