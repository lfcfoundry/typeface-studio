// Runs the pen engine off the main thread. Receives { id, design, style }, answers { id, result } or { id, error }.
import { generateSmooth, cacheSmooth } from '../core/smooth.js';
import { buildFont } from '../core/font-export.js';
self.onmessage = e => {
  const { id, op, design, style, project } = e.data;
  try {
    if (op === 'build') { const b = buildFont(project, style); self.postMessage({ id, result: { bytes: b.bytes, style: b.style, weightClass: b.weightClass, glyphCount: b.glyphCount, checksumsVerified: b.checksumsVerified, checksumProblems: b.checksumProblems } }, [b.bytes.buffer]); return; }
    const result = generateSmooth(design, style); cacheSmooth(design, style, result); // keep it: the build step asks for the same glyphs next
    self.postMessage({ id, result });
  }
  catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
