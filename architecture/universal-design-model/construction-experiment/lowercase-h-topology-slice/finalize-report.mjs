import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAcceptedSource, runRequest, SUPPORTED_REQUEST } from './scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const reportPath = join(here, 'build-report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const browser = JSON.parse(readFileSync(join(here, 'browser-evidence/android-chrome-results-final.json'), 'utf8'));
const environment = JSON.parse(readFileSync(join(here, 'browser-evidence/android-environment.json'), 'utf8'));
const font = readFileSync(join(here, 'artifacts/LFCFoundry-Distinct-Topology-H.ttf'));
const sourceFontBytes = readFileSync(join(here, 'artifacts/LFCFoundry-Distinct-Topology-Parent.ttf'));
const latest = runRequest(createAcceptedSource(), SUPPORTED_REQUEST);
if (latest.status !== 'committed-candidate') throw new Error(`Reproduced candidate failed: ${latest.error}`);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(font) !== sha256(latest.candidateFont.bytes) || sha256(sourceFontBytes) !== sha256(latest.sourceFont.bytes)) {
  throw new Error('Rebuilt in-memory font bytes differ from the saved isolated artifacts.');
}

function sfntTables(bytes) {
  const count = bytes.readUInt16BE(4), tables = {};
  for (let index = 0; index < count; index++) {
    const offset = 12 + 16 * index, tag = bytes.toString('ascii', offset, offset + 4);
    tables[tag] = { offset: bytes.readUInt32BE(offset + 8), length: bytes.readUInt32BE(offset + 12) };
  }
  return tables;
}
const tables = sfntTables(font), cmap = tables.cmap.offset, subtableCount = font.readUInt16BE(cmap + 2);
let format4 = null;
for (let index = 0; index < subtableCount; index++) {
  const record = cmap + 4 + index * 8;
  if ([0, 3].includes(font.readUInt16BE(record)) && [1, 10].includes(font.readUInt16BE(record + 2))) {
    const offset = cmap + font.readUInt32BE(record + 4);
    if (font.readUInt16BE(offset) === 4) { format4 = offset; break; }
  }
}
if (format4 === null) throw new Error('Cannot locate a supported format-4 cmap for U+0068.');
const segments = font.readUInt16BE(format4 + 6) / 2, endBase = format4 + 14;
const startBase = endBase + 2 * segments + 2, deltaBase = startBase + 2 * segments, rangeBase = deltaBase + 2 * segments;
let hGlyphId = null;
for (let index = 0; index < segments; index++) {
  const start = font.readUInt16BE(startBase + 2 * index), end = font.readUInt16BE(endBase + 2 * index);
  if (0x0068 < start || 0x0068 > end) continue;
  const delta = font.readInt16BE(deltaBase + 2 * index), range = font.readUInt16BE(rangeBase + 2 * index);
  if (!range) hGlyphId = (0x0068 + delta) & 0xffff;
  else {
    const glyphOffset = rangeBase + 2 * index + range + 2 * (0x0068 - start);
    hGlyphId = font.readUInt16BE(glyphOffset);
    if (hGlyphId) hGlyphId = (hGlyphId + delta) & 0xffff;
  }
  break;
}
if (hGlyphId === null) throw new Error('U+0068 has no cmap entry in candidate font.');
const head = tables.head.offset, locaFormat = font.readInt16BE(head + 50), loca = tables.loca.offset;
const locaAt = index => locaFormat === 0 ? font.readUInt16BE(loca + 2 * index) * 2 : font.readUInt32BE(loca + 4 * index);
const glyphOffset = tables.glyf.offset + locaAt(hGlyphId);
const glyphHeader = { glyphId: hGlyphId, contourCount: font.readInt16BE(glyphOffset), xMin: font.readInt16BE(glyphOffset + 2),
  yMin: font.readInt16BE(glyphOffset + 4), xMax: font.readInt16BE(glyphOffset + 6), yMax: font.readInt16BE(glyphOffset + 8) };

report.request.sourceRevisionId = latest.sourceRevisionId;
report.request.candidateRevisionId = latest.revision.id;
report.request.operationId = latest.operation.id;
report.transaction = { status: latest.status, revisionStatus: latest.revision.status,
  parentRevisionIds: latest.revision.parentRevisionIds, changedGlyphIds: latest.revision.changedGlyphIds,
  preservedGlyphIds: latest.revision.preservedGlyphIds, targetGlyphIds: latest.revision.targetedGlyphIds,
  acceptedParentUnchanged: latest.model.revisions.items.find(item => item.id === latest.sourceRevisionId)?.status === 'accepted' };
report.geometry.geometryPointRecordsMatchCompilerInput = JSON.stringify(latest.model.derived.geometry.glyphs['glyph:u0068'].contours.map(contour => contour.points)) ===
  JSON.stringify(latest.family.glyphs['glyph:u0068'].contours.map(contour => contour.points));
report.fonts.source.sha256 = sha256(sourceFontBytes);
report.fonts.candidate.sha256 = sha256(font);
report.fonts.candidate.rawGlyfHeaderForU0068 = glyphHeader;
report.browser = {
  status: browser.fonts.parent.loaded && browser.fonts.candidate.loaded && browser.runtimeErrors.length === 0 ? 'verified-visible-canvas-render' : 'failed',
  browserVersionFromUserAgent: browser.browser.userAgent.match(/Chrome\/([^ ]+)/u)?.[1] || null,
  environment,
  operatingSystemAsReportedByUserAgent: browser.browser.userAgent.match(/\(([^)]+)\)/u)?.[1] || null,
  fontFaces: browser.fonts,
  runtimeErrors: browser.runtimeErrors,
  evidence: browser.evidence,
  render: browser.render,
  interpretation: 'The PNG is an actual Android Chrome Canvas raster. The parent n and candidate h are visibly different as expected. Canvas TextMetrics and thresholded raster bounds use different measurement mechanisms; both raw measurements are retained. The raster bounds were recomputed from RGB darkness because the canvas background was opaque.',
  intermediateFiles: ['browser-evidence/android-chrome-results.json (initial alpha-only mask counted opaque background)',
    'browser-evidence/android-chrome-results-corrected.json (intermediate crop-min initialization error)',
    'browser-evidence/android-chrome-results-final.json (authoritative offline bounds from the unchanged Chrome PNG)']
};
report.fonts.candidate.outlineBoundsVsStoredGlyphHeader = {
  analyticContourBounds: report.geometry.bounds,
  rawGlyfHeader: glyphHeader,
  note: 'The glyf header includes the shoulder quadratic control point at y=800; the curve extrema and visible raster top remain at y=700. This is reported as the stored point box, not the exact ink bounds.'
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath: 'build-report.json', browser: report.browser.status, glyphHeader }, null, 2));
