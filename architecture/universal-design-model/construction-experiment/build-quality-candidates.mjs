import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compileSemanticDesign, createCrossbarComparison } from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, 'artifacts');
mkdirSync(output, { recursive: true });
const { variants } = createCrossbarComparison();
const filenames = [
  'LFCFoundry-Semantic-Construction-Smooth-N-Current-H.ttf',
  'LFCFoundry-Semantic-Construction-Smooth-N-H-Midpoint.ttf',
  'LFCFoundry-Semantic-Construction-Smooth-N-H-Low-0_48.ttf'
];
const reports = [];
for (const [index, variant] of variants.entries()) {
  const path = resolve(output, filenames[index]);
  if (existsSync(path)) throw new Error(`Refusing to overwrite existing quality artifact ${path}.`);
  const compiled = compileSemanticDesign(variant.model);
  writeFileSync(path, compiled.bytes, { flag: 'wx' });
  reports.push({ label: variant.label, status: variant.status, centerRatio: variant.centerRatio, revisionId: variant.revision?.id || variant.model.revisions.headRevisionId,
    path, bytes: compiled.bytes.length, glyphCount: compiled.audit.numGlyphs, validInternalAudit: compiled.audit.valid,
    tables: compiled.audit.tables });
}
console.log(JSON.stringify(reports, null, 2));
