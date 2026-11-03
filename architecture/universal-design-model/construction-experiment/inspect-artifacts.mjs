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
const entries = [
  ['base', 'LFCFoundry-Semantic-Construction-Base.ttf'],
  ['candidate', 'LFCFoundry-Semantic-Construction-Open-Counter.ttf']
];

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function tableDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4), result = {};
  for (let index = 0; index < count; index++) {
    const offset = 12 + index * 16;
    const tag = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    result[tag] = { checksum: view.getUint32(offset + 4).toString(16).padStart(8, '0'), offset: view.getUint32(offset + 8), length: view.getUint32(offset + 12) };
  }
  return result;
}
function glyphMetrics(font, table, name) {
  const index = Object.keys(font.glyphs).indexOf(name);
  return table.horizontalMetrics.metrics[index] || null;
}
function glyphOutlinesEqual(a, b, name) { return JSON.stringify(a.glyphs[name].contours) === JSON.stringify(b.glyphs[name].contours); }

const parsed = {};
const reports = {};
const sourceBytes = {};
const reviewPage = readFileSync(resolve(here, 'font-review.html'), 'utf8');
const embeddedFonts = {};
for (const [label, filename] of entries) {
  const bytes = new Uint8Array(readFileSync(resolve(here, 'artifacts', filename)));
  const font = parseFont(bytes);
  const audit = auditSfnt(bytes);
  const tables = tableDirectory(bytes);
  const checksumErrors = verifyChecksums(bytes);
  parsed[label] = font;
  sourceBytes[label] = bytes;
  embeddedFonts[label] = reviewPage.includes(Buffer.from(bytes).toString('base64'));
  reports[label] = {
    filename, bytes: bytes.byteLength, sha256: sha256(bytes),
    parser: { name: 'fontsketch parseFont (same implementation family as compiler)', glyphNames: Object.keys(font.glyphs),
      glyphs: Object.fromEntries(['o', 'n', 'H'].map(name => [name, {
        unicode: font.glyphs[name]?.unicodes, advanceWidth: font.glyphs[name]?.advanceWidth,
        contours: font.glyphs[name]?.contours?.length,
        metric: glyphMetrics(font, audit, name),
        contourBoundsByControlPoint: font.glyphs[name]?.contours?.map(contour => {
          const xs = contour.points.map(point => point.x), ys = contour.points.map(point => point.y);
          return { xMin: Math.min(...xs), yMin: Math.min(...ys), xMax: Math.max(...xs), yMax: Math.max(...ys), pointCount: contour.points.length };
        })
      }])) },
    internalCompilerChecksumErrors: checksumErrors,
    internalSfntAudit: { valid: audit.valid, missingTables: audit.missingTables, badTableChecksums: audit.badTableChecksums,
      wholeChecksumValid: audit.wholeChecksumValid, glyphCount: audit.numGlyphs, cmapSummary: audit.cmap,
      metricsErrors: audit.horizontalMetrics.errors, tables: Object.keys(tables) },
    sfntTableDirectory: tables
  };
}

const base = parsed.base, candidate = parsed.candidate;
const tableA = reports.base.sfntTableDirectory, tableB = reports.candidate.sfntTableDirectory;
const allTableTags = [...new Set([...Object.keys(tableA), ...Object.keys(tableB)])].sort();
const tableBytesIdentical = Object.fromEntries(allTableTags.map(tag => {
  const left = tableA[tag], right = tableB[tag];
  if (!left || !right || left.length !== right.length) return [tag, false];
  const a = sourceBytes.base.subarray(left.offset, left.offset + left.length);
  const b = sourceBytes.candidate.subarray(right.offset, right.offset + right.length);
  return [tag, a.length === b.length && a.every((byte, index) => byte === b[index])];
}));
const differingTableBytes = allTableTags.filter(tag => !tableBytesIdentical[tag]).map(tag => {
  const left = tableA[tag], right = tableB[tag];
  const a = left && sourceBytes.base.subarray(left.offset, left.offset + left.length);
  const b = right && sourceBytes.candidate.subarray(right.offset, right.offset + right.length);
  const differingOffsets = [];
  if (a && b && a.length === b.length) for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) differingOffsets.push(index);
  return { tag, baseLength: a?.length ?? null, candidateLength: b?.length ?? null, differingByteCount: differingOffsets.length,
    differingOffsetsWithinTable: differingOffsets.length <= 32 ? differingOffsets : undefined,
    headAdjustmentOnly: tag === 'head' && differingOffsets.length > 0 && differingOffsets.every(index => index >= 8 && index < 12) };
});
const comparison = {
  sameGlyphOrder: JSON.stringify(Object.keys(base.glyphs)) === JSON.stringify(Object.keys(candidate.glyphs)),
  perGlyph: Object.fromEntries(['.notdef', 'space', 'o', 'n', 'H'].map(name => [name, {
    outlineIdentical: glyphOutlinesEqual(base, candidate, name),
    advanceIdentical: base.glyphs[name]?.advanceWidth === candidate.glyphs[name]?.advanceWidth,
    unicodeIdentical: JSON.stringify(base.glyphs[name]?.unicodes) === JSON.stringify(candidate.glyphs[name]?.unicodes)
  }])),
  lowercaseO: {
    outerContourIdentical: JSON.stringify(base.glyphs.o.contours[0]) === JSON.stringify(candidate.glyphs.o.contours[0]),
    counterContourIdentical: JSON.stringify(base.glyphs.o.contours[1]) === JSON.stringify(candidate.glyphs.o.contours[1]),
    counterPointBoundsBase: reports.base.parser.glyphs.o.contourBoundsByControlPoint[1],
    counterPointBoundsCandidate: reports.candidate.parser.glyphs.o.contourBoundsByControlPoint[1]
  },
  lowercaseOCounterControlBounds: {
    base: reports.base.parser.glyphs.o.contourBoundsByControlPoint[1],
    candidate: reports.candidate.parser.glyphs.o.contourBoundsByControlPoint[1]
  },
  tableBytesIdentical,
  differingTableBytes,
  differingTableRecords: allTableTags.filter(tag => !tableBytesIdentical[tag]).map(tag => ({ tag, base: tableA[tag] || null, candidate: tableB[tag] || null }))
};

const result = {
  generatedAt: 'reproducible inspection; no timestamp recorded',
  tools: { parser: `fontsketch ${fontsketch.version}`, compilerRelated: true, externalValidator: null },
  fonts: reports,
  comparison,
  reviewPage: { exactEmbeddedArtifactBytes: embeddedFonts, allEmbeddedBytesMatch: Object.values(embeddedFonts).every(Boolean) },
  interpretation: {
    expectedChangedGlyph: comparison.perGlyph.o.outlineIdentical === false,
    unaffectedGlyphOutlinesExact: ['n', 'H', '.notdef', 'space'].every(name => comparison.perGlyph[name].outlineIdentical),
    allMetricsAndMappingsExact: Object.values(comparison.perGlyph).every(item => item.advanceIdentical && item.unicodeIdentical),
    independentValidationPerformed: false
  }
};
const output = resolve(here, 'artifact-inspection.json');
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, interpretation: result.interpretation, differingTableRecords: comparison.differingTableRecords.map(item => item.tag), fontHashes: Object.fromEntries(entries.map(([label]) => [label, reports[label].sha256])) }, null, 2));
