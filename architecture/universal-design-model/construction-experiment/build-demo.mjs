import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compileSemanticDesign } from './font-adapter.mjs';
import { createBaseScenario } from './scenarios.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, 'artifacts');
mkdirSync(output, { recursive: true });
const { accepted, candidate } = createBaseScenario();
const report = [];
for (const [label, model, file] of [
  ['base', accepted, 'LFCFoundry-Semantic-Construction-Base.ttf'],
  ['open-counter-candidate', candidate.model, 'LFCFoundry-Semantic-Construction-Open-Counter.ttf']
]) {
  const result = compileSemanticDesign(model);
  const path = resolve(output, file);
  writeFileSync(path, result.bytes);
  report.push({ label, path, bytes: result.bytes.length, glyphCount: result.audit.numGlyphs, tables: result.audit.tables, cmap: result.audit.cmap, wholeChecksumValid: result.audit.wholeChecksumValid });
}
console.log(JSON.stringify(report, null, 2));
