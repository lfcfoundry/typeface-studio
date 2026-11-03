import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildAllRelatedGlyphs, compileRelatedGlyphFont } from './experiment.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(here, 'artifacts');
const fontPath = resolve(artifacts, 'LFCFoundry-Related-Glyph-Reuse-abdpq.ttf');
const reportPath = resolve(here, 'related-glyph-inspection.json');
mkdirSync(artifacts, { recursive: true });

const candidate = buildAllRelatedGlyphs();
const compiled = compileRelatedGlyphFont(candidate.model);
const bytes = Buffer.from(compiled.bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (existsSync(fontPath)) {
  if (!readFileSync(fontPath).equals(bytes)) throw new Error('Existing related-glyph font differs from the deterministic build; refusing to overwrite it.');
} else writeFileSync(fontPath, bytes, { flag: 'wx' });

const glyphs = Object.fromEntries(candidate.model.glyphs.map(source => {
  const geometry = candidate.model.derived.geometry.glyphs[source.id];
  const parsed = compiled.parsed.glyphs[source.name];
  return [source.name, { id: source.id, unicode: parsed.unicodes, bounds: geometry.bounds, metrics: geometry.metrics,
    outline: parsed.contours, sharedWidth: candidate.model.sharedParameters['decision:shared-stem-width'].value }];
}));
const report = {
  artifact: fontPath.split('/').at(-1), bytes: bytes.length, sha256,
  internalAudit: { valid: compiled.audit.valid, tables: compiled.audit.tables, missingTables: compiled.audit.missingTables,
    badTableChecksums: compiled.audit.badTableChecksums, wholeChecksumValid: compiled.audit.wholeChecksumValid,
    horizontalMetrics: compiled.audit.horizontalMetrics },
  glyphOrder: Object.keys(compiled.parsed.glyphs),
  candidateRevision: candidate.revision,
  existingReferenceGeometryPreserved: Object.fromEntries(Object.keys(candidate.model.referenceModel.derived.geometry.glyphs)
    .map(id => [id, JSON.stringify(candidate.model.referenceModel.derived.geometry.glyphs[id]) === JSON.stringify(candidate.acceptedModel.referenceModel.derived.geometry.glyphs[id])])),
  glyphs,
  independentValidation: 'not-run'
};
if (existsSync(reportPath)) {
  const prior = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (prior.sha256 !== sha256) throw new Error('Existing inspection report describes different font bytes; refusing to overwrite it.');
} else writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ fontPath, reportPath, sha256, bytes: bytes.length, audit: compiled.audit.valid,
  glyphs: Object.keys(glyphs), candidateRevisionId: candidate.revision.id }, null, 2));
