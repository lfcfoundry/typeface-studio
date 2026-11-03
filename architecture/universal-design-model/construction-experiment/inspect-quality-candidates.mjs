import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseFont, verifyChecksums } from 'fontsketch/core';
import { auditSfnt } from '../../../prototype/src/sfnt-audit.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const fontsketch = require('fontsketch/package.json');
const files = [
  { id: 'originalBase', label: 'Original base', file: 'LFCFoundry-Semantic-Construction-Base.ttf', group: 'original' },
  { id: 'originalOpen', label: 'Original open-counter candidate', file: 'LFCFoundry-Semantic-Construction-Open-Counter.ttf', group: 'original' },
  { id: 'smoothCurrent', label: 'Corrected n; existing H', file: 'LFCFoundry-Semantic-Construction-Smooth-N-Current-H.ttf', group: 'quality' },
  { id: 'midpoint', label: 'Corrected n; H midpoint', file: 'LFCFoundry-Semantic-Construction-Smooth-N-H-Midpoint.ttf', group: 'quality' },
  { id: 'below', label: 'Corrected n; H 0.48', file: 'LFCFoundry-Semantic-Construction-Smooth-N-H-Low-0_48.ttf', group: 'quality' }
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parsed = {}, fonts = {}, metricsByFont = new Map();
for (const item of files) {
  const bytes = new Uint8Array(readFileSync(resolve(here, 'artifacts', item.file)));
  const font = parseFont(bytes), audit = auditSfnt(bytes);
  const glyphOrder = Object.keys(font.glyphs);
  const horizontalMetrics = Object.fromEntries(glyphOrder.map((name, index) => [name, audit.horizontalMetrics.metrics[index]]));
  parsed[item.id] = font;
  metricsByFont.set(font, horizontalMetrics);
  fonts[item.id] = { ...item, bytes: bytes.length, sha256: sha(bytes), glyphOrder,
    internal: { fontsketchChecksums: verifyChecksums(bytes), sfntAuditValid: audit.valid, missingTables: audit.missingTables,
      badTableChecksums: audit.badTableChecksums, wholeChecksumValid: audit.wholeChecksumValid, tableTags: audit.tables,
      horizontalMetrics },
    glyphs: Object.fromEntries(['o', 'n', 'H'].map(name => [name, { unicodes: font.glyphs[name].unicodes, advanceWidth: font.glyphs[name].advanceWidth,
      horizontalMetric: horizontalMetrics[name], contours: font.glyphs[name].contours }])) };
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function compare(left, right) {
  return Object.fromEntries(['.notdef', 'space', 'o', 'n', 'H'].map(name => [name, {
    outlineIdentical: equal(left.glyphs[name]?.contours, right.glyphs[name]?.contours),
    unicodeIdentical: equal(left.glyphs[name]?.unicodes, right.glyphs[name]?.unicodes),
    advanceIdentical: left.glyphs[name]?.advanceWidth === right.glyphs[name]?.advanceWidth,
    horizontalMetricsIdentical: equal(metricsByFont.get(left)[name], metricsByFont.get(right)[name])
  }]));
}
const originalAgainstSmooth = compare(parsed.originalBase, parsed.smoothCurrent);
const hCandidateComparisons = {
  midpoint: compare(parsed.smoothCurrent, parsed.midpoint),
  below: compare(parsed.smoothCurrent, parsed.below)
};
const html = readFileSync(resolve(here, 'geometry-quality-review.html'), 'utf8');
const embeddedBytesMatch = Object.fromEntries(files.map(item => {
  const bytes = readFileSync(resolve(here, 'artifacts', item.file));
  return [item.id, html.includes(bytes.toString('base64'))];
}));
const report = {
  parser: `fontsketch ${fontsketch.version} (same implementation family as compiler)`,
  fonts,
  comparisons: { originalAgainstSmooth, hCandidateComparisons },
  reviewPage: { embeddedBytesMatch, allMatch: Object.values(embeddedBytesMatch).every(Boolean) },
  interpretation: {
    correctedNChangesOnlyNFromOriginalBase: !originalAgainstSmooth.n.outlineIdentical && originalAgainstSmooth.o.outlineIdentical && originalAgainstSmooth.H.outlineIdentical,
    midpointChangesOnlyH: !hCandidateComparisons.midpoint.H.outlineIdentical && hCandidateComparisons.midpoint.o.outlineIdentical && hCandidateComparisons.midpoint.n.outlineIdentical,
    lowerAlternativeChangesOnlyH: !hCandidateComparisons.below.H.outlineIdentical && hCandidateComparisons.below.o.outlineIdentical && hCandidateComparisons.below.n.outlineIdentical,
    independentValidation: false
  }
};
const output = resolve(here, 'quality-artifact-inspection.json');
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, interpretation: report.interpretation, fontHashes: Object.fromEntries(Object.entries(fonts).map(([key, item]) => [key, item.sha256])) }, null, 2));
