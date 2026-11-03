import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditSfnt } from '../../../prototype/src/sfnt-audit.js';
import { buildLowercaseACandidate, compileSemanticDesign } from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(here, 'artifacts');
const filename = 'LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf';
const fontPath = resolve(artifacts, filename);
const reportPath = resolve(here, 'lowercase-a-inspection.json');
mkdirSync(artifacts, { recursive: true });

const candidate = buildLowercaseACandidate();
const compiled = compileSemanticDesign(candidate.model);
const bytes = Buffer.from(compiled.bytes);
const audit = auditSfnt(bytes);
if (!audit.valid || audit.numGlyphs !== 6 || !compiled.parsed.glyphs.a || compiled.parsed.glyphs.a.unicodes[0] !== 0x0061) {
  throw new Error('Compiled lowercase-a TTF failed the expected internal structural checks.');
}
const baseOutput = compileSemanticDesign(candidate.acceptedModel);
const base = baseOutput.parsed.glyphs;
const parsed = compiled.parsed.glyphs;
const baseMetricMap = Object.fromEntries(Object.keys(base).map((name, index) => [name, baseOutput.audit.horizontalMetrics.metrics[index]]));
const candidateMetricMap = Object.fromEntries(Object.keys(parsed).map((name, index) => [name, audit.horizontalMetrics.metrics[index]]));
const preserved = Object.fromEntries(['o', 'n', 'H'].map(name => [name, {
  outlineIdentical: JSON.stringify(base[name].contours) === JSON.stringify(parsed[name].contours),
  unicodeIdentical: JSON.stringify(base[name].unicodes) === JSON.stringify(parsed[name].unicodes),
  horizontalMetricsIdentical: JSON.stringify(baseMetricMap[name]) === JSON.stringify(candidateMetricMap[name])
}]));
if (Object.values(preserved).some(result => !result.outlineIdentical || !result.unicodeIdentical || !result.horizontalMetricsIdentical)) {
  throw new Error('Adding lowercase a changed one of the existing glyphs in the compiled font.');
}
if (existsSync(fontPath)) {
  if (!readFileSync(fontPath).equals(bytes)) throw new Error('Existing lowercase-a font differs from the deterministic build; refusing to overwrite it.');
} else writeFileSync(fontPath, bytes, { flag: 'wx' });
const inspection = {
  artifact: filename,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  compilerParser: 'fontsketch (compiler implementation family)',
  internalAudit: { valid: audit.valid, missingTables: audit.missingTables, badTableChecksums: audit.badTableChecksums,
    wholeChecksumValid: audit.wholeChecksumValid, tables: audit.tables, horizontalMetrics: audit.horizontalMetrics },
  glyphOrder: Object.keys(parsed),
  lowercaseA: { id: candidate.glyph.id, unicode: parsed.a.unicodes, horizontalMetric: candidateMetricMap.a,
    contours: parsed.a.contours, bounds: candidate.glyph.bounds, metrics: candidate.glyph.metrics },
  existingGlyphsPreserved: preserved,
  independentValidation: 'not-run'
};
if (existsSync(reportPath)) {
  const previous = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (previous.sha256 !== inspection.sha256) throw new Error('Existing lowercase-a inspection report refers to different font bytes; refusing to overwrite it.');
} else writeFileSync(reportPath, `${JSON.stringify(inspection, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ fontPath, reportPath, sha256: inspection.sha256, bytes: inspection.bytes, audit: inspection.internalAudit.valid,
  preserved, existingFilesMatchedAndWereNotOverwritten: true }, null, 2));
