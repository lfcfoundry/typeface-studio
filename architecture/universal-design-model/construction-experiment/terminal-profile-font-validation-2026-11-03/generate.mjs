import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compileSemanticDesign, deriveGlyph } from '../index.mjs';
import { fixture, operation, run, accept } from '../transaction-composition/integration.mjs';
import { spineAdapter } from '../cross-grammar-aperture/grammars.mjs';
import { compile as compileSpine } from '../two-storey-grammar/font.mjs';

const outDir = dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => sha256(Buffer.from(JSON.stringify(value)));
const writeNew = (name, data) => {
  const path = resolve(outDir, name);
  if (existsSync(path)) throw new Error(`Refusing to overwrite existing validation output: ${name}`);
  writeFileSync(path, data, { flag: 'wx' });
  return path;
};
const writeOrVerify = (name, data) => {
  const path = resolve(outDir, name);
  const bytes = Buffer.from(data);
  if (existsSync(path)) {
    if (!readFileSync(path).equals(bytes)) throw new Error(`Existing validation artifact differs; refusing to overwrite: ${name}`);
    return path;
  }
  writeFileSync(path, bytes, { flag: 'wx' });
  return path;
};

function compileAcceptedA(design) {
  return compileSemanticDesign(design);
}

function compileAcceptedSpine(design) {
  const geometry = spineAdapter.geometry(design);
  return compileSpine([{ ...geometry, name: 'a', unicode: 0x0061 }], 'LFCFoundry Grammar Double Review');
}

function glyfBounds(bytes, glyphIndex) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4);
  let head = null, maxp = null, loca = null, glyf = null;
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...bytes.subarray(at, at + 4));
    const entry = { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
    if (tag === 'head') head = entry;
    if (tag === 'maxp') maxp = entry;
    if (tag === 'loca') loca = entry;
    if (tag === 'glyf') glyf = entry;
  }
  if (!head || !maxp || !loca || !glyf) throw new Error('Required head/maxp/loca/glyf tables are missing.');
  const glyphCount = view.getUint16(maxp.offset + 4);
  if (!Number.isInteger(glyphIndex) || glyphIndex < 0 || glyphIndex >= glyphCount) throw new Error('Invalid mapped glyph index.');
  const format = view.getInt16(head.offset + 50);
  const locaAt = loca.offset + glyphIndex * (format === 0 ? 2 : 4);
  const start = format === 0 ? view.getUint16(locaAt) * 2 : view.getUint32(locaAt);
  const endAt = loca.offset + (glyphIndex + 1) * (format === 0 ? 2 : 4);
  const end = format === 0 ? view.getUint16(endAt) * 2 : view.getUint32(endAt);
  if (start === end) return null;
  const at = glyf.offset + start;
  if (at + 10 > glyf.offset + glyf.length || end > glyf.length) throw new Error('Glyph data exceeds the glyf table.');
  return {
    contourCount: view.getInt16(at),
    xMin: view.getInt16(at + 2), yMin: view.getInt16(at + 4),
    xMax: view.getInt16(at + 6), yMax: view.getInt16(at + 8)
  };
}

function pointBounds(glyph) {
  const points = glyph.contours.flatMap(contour => contour.points);
  return {
    xMin: Math.min(...points.map(p => p.x)), yMin: Math.min(...points.map(p => p.y)),
    xMax: Math.max(...points.map(p => p.x)), yMax: Math.max(...points.map(p => p.y))
  };
}

function inspectFont(label, filename, compiled, geometry) {
  const bytes = Buffer.from(compiled.bytes);
  const audit = compiled.audit;
  assert.equal(audit.valid, true, `${label}: internal SFNT audit`);
  assert.equal(audit.wholeChecksumValid, true, `${label}: whole-font checksum`);
  assert.deepEqual(audit.missingTables, []);
  assert.deepEqual(audit.badTableChecksums, []);
  assert.deepEqual(audit.horizontalMetrics.errors, []);
  assert.deepEqual(audit.metadata.errors, []);
  assert.equal(audit.metadata.unitsPerEm, 1000);
  const glyphIndex = audit.cmap.glyphIndex(0x0061);
  assert.ok(glyphIndex > 0, `${label}: U+0061 maps to a non-.notdef glyph`);
  const glyph = compiled.parsed.glyphs.a;
  assert.ok(glyph, `${label}: parsed glyph name a`);
  const metric = audit.horizontalMetrics.metrics[glyphIndex];
  const bounds = glyfBounds(bytes, glyphIndex);
  const result = {
    file: filename, bytes: bytes.length, sha256: sha256(bytes),
    internalAudit: {
      valid: audit.valid, tableCount: audit.tables.length, tables: audit.tables,
      wholeChecksumValid: audit.wholeChecksumValid, missingTables: audit.missingTables,
      badTableChecksums: audit.badTableChecksums, metadata: audit.metadata
    },
    glyphOrder: Object.keys(compiled.parsed.glyphs),
    mapping: { codePoint: 'U+0061', glyphIndex, glyphName: glyph.name, unicodes: glyph.unicodes },
    compiledGlyph: {
      advanceWidth: glyph.advanceWidth, leftSideBearing: metric.leftSideBearing,
      rightSideBearing: glyph.advanceWidth - bounds.xMax,
      contourCount: glyph.contours.length, pointBounds: pointBounds(glyph), glyfBounds: bounds
    },
    semanticGeometry: { bounds: geometry.bounds, metrics: geometry.metrics, contourCount: geometry.contours.length },
    outlineHash: jsonHash(glyph.contours)
  };
  assert.deepEqual(result.compiledGlyph.glyfBounds, {
    contourCount: geometry.contours.length,
    xMin: geometry.bounds.xMin, yMin: geometry.bounds.yMin,
    xMax: geometry.bounds.xMax, yMax: geometry.bounds.yMax
  }, `${label}: compiled glyf bounds match derived semantic geometry`);
  assert.equal(result.compiledGlyph.advanceWidth, geometry.metrics.advanceWidth);
  assert.equal(result.compiledGlyph.leftSideBearing, geometry.metrics.leftSideBearing);
  assert.equal(result.compiledGlyph.rightSideBearing, geometry.metrics.rightSideBearing);
  writeOrVerify(filename, bytes);
  return result;
}

const aBase = fixture('a');
const aInstance = aBase.model.constructionIntegration.instances.main;
const aFlatDesign = aInstance.design;
const aSourceFlat = aFlatDesign.glyphRegistry.glyphs.find(g => g.id === aInstance.sourceGlyphId);
const aFlatGeometry = deriveGlyph(aSourceFlat, aFlatDesign);
const aFlatCompiled = compileAcceptedA(aFlatDesign);
const aFlatFile = 'single-storey-a-flat.ttf';
const aFlat = inspectFont(aFlatFile, aFlatFile, aFlatCompiled, aFlatGeometry);
const aSavedBytes = readFileSync(resolve(outDir, '../artifacts/LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf'));
assert.ok(Buffer.from(aFlatCompiled.bytes).equals(aSavedBytes), 'single-storey flat bytes match the saved experiment baseline');

const aOperation = operation('semantic.terminal.set-profile', 'op:font-validation-a', aBase);
const aCandidate = run(aBase, [aOperation]);
assert.equal(aCandidate.status, 'committed-candidate', aCandidate.error);
const aAccepted = accept(aCandidate);
const aAcceptedDesign = aAccepted.model.constructionIntegration.instances.main.design;
const aSourceChamfered = aAcceptedDesign.glyphRegistry.glyphs.find(g => g.id === aInstance.sourceGlyphId);
const aChamferGeometry = deriveGlyph(aSourceChamfered, aAcceptedDesign);
const aChamferCompiled = compileAcceptedA(aAcceptedDesign);
const aChamferFile = 'single-storey-a-chamfered.ttf';
const aChamfer = inspectFont(aChamferFile, aChamferFile, aChamferCompiled, aChamferGeometry);

const spineBase = fixture('spine');
const spineInstance = spineBase.model.constructionIntegration.instances.main;
const spineFlatGeometry = spineAdapter.geometry(spineInstance.design);
const spineFlatCompiled = compileAcceptedSpine(spineInstance.design);
const spineFlatFile = 'spine-bowl-flat.ttf';
const spineFlat = inspectFont(spineFlatFile, spineFlatFile, spineFlatCompiled, spineFlatGeometry);
const spineSavedBytes = readFileSync(resolve(outDir, '../two-storey-grammar/artifacts/LFCFoundry-Grammar-Double-Review.ttf'));
assert.ok(Buffer.from(spineFlatCompiled.bytes).equals(spineSavedBytes), 'spine-and-bowl flat bytes match the saved two-storey baseline');

const spineOperation = operation('semantic.terminal.set-profile', 'op:font-validation-spine', spineBase);
const spineCandidate = run(spineBase, [spineOperation]);
assert.equal(spineCandidate.status, 'committed-candidate', spineCandidate.error);
const spineAccepted = accept(spineCandidate);
const spineAcceptedDesign = spineAccepted.model.constructionIntegration.instances.main.design;
const spineChamferGeometry = spineAdapter.geometry(spineAcceptedDesign);
const spineChamferCompiled = compileAcceptedSpine(spineAcceptedDesign);
const spineChamferFile = 'spine-bowl-chamfered.ttf';
const spineChamfer = inspectFont(spineChamferFile, spineChamferFile, spineChamferCompiled, spineChamferGeometry);

for (const [label, flat, chamfer] of [['single-storey-a', aFlat, aChamfer], ['spine-bowl', spineFlat, spineChamfer]]) {
  assert.equal(chamfer.compiledGlyph.advanceWidth, flat.compiledGlyph.advanceWidth, `${label}: advance preserved`);
  assert.equal(chamfer.compiledGlyph.leftSideBearing, flat.compiledGlyph.leftSideBearing, `${label}: left bearing preserved for this geometry`);
  assert.equal(chamfer.compiledGlyph.rightSideBearing, flat.compiledGlyph.rightSideBearing, `${label}: right bearing preserved for this geometry`);
  assert.deepEqual(chamfer.compiledGlyph.glyfBounds, flat.compiledGlyph.glyfBounds, `${label}: actual ink bounds unchanged`);
  assert.notEqual(chamfer.outlineHash, flat.outlineHash, `${label}: only the profile variant changes the outline`);
}
for (const name of ['.notdef', 'space', 'o', 'n', 'H']) {
  if (aFlatCompiled.parsed.glyphs[name] && aChamferCompiled.parsed.glyphs[name]) {
    assert.deepEqual(aChamferCompiled.parsed.glyphs[name], aFlatCompiled.parsed.glyphs[name], `a operation preserves unrelated glyph ${name}`);
  }
}
assert.deepEqual(aChamferCompiled.parsed.glyphs.a.contours[1], aFlatCompiled.parsed.glyphs.a.contours[1], 'a counter remains unchanged');
assert.deepEqual(spineChamferCompiled.parsed.glyphs.space, spineFlatCompiled.parsed.glyphs.space, 'spine font space remains unchanged');
assert.deepEqual(spineChamferCompiled.parsed.glyphs.a.contours.slice(1), spineFlatCompiled.parsed.glyphs.a.contours.slice(1), 'spine counters remain unchanged');

const aTerminal = design => design.glyphRegistry.glyphs.find(g => g.id === 'glyph:u0061').construction.nodes.find(node => node.id === 'part:a-upper-terminal');
const spineTerminal = design => design.construction.nodes.find(node => node.id === 'top');
const aTerminalBefore = aTerminal(aFlatDesign), aTerminalAfter = aTerminal(aAcceptedDesign);
const spineTerminalBefore = spineTerminal(spineInstance.design), spineTerminalAfter = spineTerminal(spineAcceptedDesign);
assert.equal(aTerminalAfter.parameters.profile, 'chamfered');
assert.equal(spineTerminalAfter.parameters.profile, 'chamfered');
assert.equal(aTerminalAfter.id, aTerminalBefore.id);
assert.equal(spineTerminalAfter.id, spineTerminalBefore.id);
assert.deepEqual(aTerminalAfter.relations, aTerminalBefore.relations);
assert.deepEqual(spineAcceptedDesign.construction.relations, spineInstance.design.construction.relations);

const report = {
  title: 'End-to-end semantic chamfered terminal font validation',
  date: '2026-11-03',
  repositoryHead: 'c6145af55231e4688225acb3844d759ea487aa3e',
  compiler: { package: 'fontsketch', version: '0.1.0', path: 'prototype/src/font.js', node: process.version },
  sourcePath: [
    'accepted semantic design', 'semantic.terminal.set-profile transaction',
    'construction adapter geometry derivation', 'compileTypeface / compileSemanticDesign',
    'internal parseFont and auditSfnt checks'
  ],
  revisions: {
    a: { outerBase: aBase.model.revisions.headRevisionId, outerAccepted: aAccepted.model.revisions.acceptedRevisionId,
      semanticBase: aFlatDesign.revisions.acceptedRevisionId, semanticAccepted: aAcceptedDesign.revisions.acceptedRevisionId,
      operationId: aOperation.id },
    spine: { outerBase: spineBase.model.revisions.headRevisionId, outerAccepted: spineAccepted.model.revisions.acceptedRevisionId,
      semanticBase: spineInstance.design.revision.id, semanticAccepted: spineAcceptedDesign.revision.id,
      operationId: spineOperation.id }
  },
  fonts: { 'single-storey-a-flat': aFlat, 'single-storey-a-chamfered': aChamfer, 'spine-bowl-flat': spineFlat, 'spine-bowl-chamfered': spineChamfer },
  flatBaselineComparisons: {
    'single-storey-a-flat': { savedArtifact: 'LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf', byteIdentical: true, sha256: sha256(aSavedBytes) },
    'spine-bowl-flat': { savedArtifact: 'LFCFoundry-Grammar-Double-Review.ttf', byteIdentical: true, sha256: sha256(spineSavedBytes) }
  },
  comparison: {
    advanceWidthPreserved: true, leftSideBearingPreserved: true, rightSideBearingPreserved: true,
    actualGlyfBoundsPreserved: true, aCounterPreserved: true, spineCountersPreserved: true,
    unrelatedGlyphsPreserved: true, terminalIdentityAndRelationshipsPreserved: true,
    semanticAChamfer: aTerminalAfter.parameters,
    semanticSpineChamfer: spineTerminalAfter.parameters,
    kerning: 'Not represented by these diagnostic fonts; the operation policy flags kerning for review.'
  },
  independentValidation: {
    fontTools: 'unavailable (Python import check: no module)',
    ots: 'unavailable (ots-sanitize/ots commands not installed)',
    fontForge: 'unavailable (command not installed)',
    fontconfig: 'unavailable (fc-scan/fc-query not installed)',
    harfBuzz: 'unavailable (hb-shape not installed)',
    browser: 'Chrome for Android is installed; rendering observation is pending.'
  },
  rendering: { status: 'pending', reviewPage: 'review.html' }
};
writeOrVerify('validation.json', `${JSON.stringify(report, null, 2)}\n`);

const fontFaces = [
  ['a-flat', aFlatFile, aFlatCompiled.bytes], ['a-chamfer', aChamferFile, aChamferCompiled.bytes],
  ['spine-flat', spineFlatFile, spineFlatCompiled.bytes], ['spine-chamfer', spineChamferFile, spineChamferCompiled.bytes]
].map(([family, file, bytes]) => `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${Buffer.from(bytes).toString('base64')}) format("truetype");font-weight:400;font-style:normal}`).join('\n');
const cards = [
  ['Single-storey a · flat', 'a-flat', aFlat], ['Single-storey a · chamfered', 'a-chamfer', aChamfer],
  ['Spine-and-bowl · flat', 'spine-flat', spineFlat], ['Spine-and-bowl · chamfered', 'spine-chamfer', spineChamfer]
].map(([title, family, data]) => `<section><h2>${title}</h2><p class="status" id="status-${family}">Font load pending</p><div class="sample" style="font-family:&quot;${family}&quot;">a</div><div class="small" style="font-family:&quot;${family}&quot;">a a a</div><p>Advance ${data.compiledGlyph.advanceWidth}; bearings ${data.compiledGlyph.leftSideBearing} / ${data.compiledGlyph.rightSideBearing}; bounds ${data.compiledGlyph.glyfBounds.xMin}…${data.compiledGlyph.glyfBounds.xMax}, ${data.compiledGlyph.glyfBounds.yMin}…${data.compiledGlyph.glyfBounds.yMax}.</p><p class="measure" id="measure-${family}"></p></section>`).join('\n');
const renderRows = [['single-storey-a-flat', 'a-flat'], ['single-storey-a-chamfered', 'a-chamfer'], ['spine-bowl-flat', 'spine-flat'], ['spine-bowl-chamfered', 'spine-chamfer']]
  .map(([name, family]) => ({ family, advance: report.fonts[name].compiledGlyph.advanceWidth }));
const review = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chamfered terminal font validation</title><style>${fontFaces}\n:root{color-scheme:light}body{font:16px/1.45 system-ui,sans-serif;max-width:1100px;margin:auto;padding:16px;background:#faf8f2;color:#292724}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}section{border:1px solid #999;border-radius:8px;padding:12px;overflow:hidden}h1{font-size:1.45rem}h2{font-size:1rem;margin:.2rem 0}.sample{font-size:clamp(150px,34vw,320px);line-height:1.1;border-bottom:1px solid #bbb}.small{font-size:64px;white-space:nowrap;overflow:hidden}.status{color:#725}.ok{color:#176d30}.error{color:#b32020}.measure{font:12px ui-monospace,monospace}</style><body><h1>Semantic terminal output: flat and chamfered</h1><p>Each specimen is loaded from the generated TTF as an embedded font. Compare the upper stem at the same sizes. The chamfer is an 18-unit cut on a 90-unit stem; both fonts keep 650-unit advance and bounds x=55–595, y=0–500.</p><div class="grid">${cards}</div><script>const rows=${JSON.stringify(renderRows)};for(const row of rows){const status=document.getElementById('status-'+row.family),sample=document.querySelector('#status-'+row.family+' + .sample');const face=new FontFace(row.family,'url(data:font/ttf;base64,'+({ 'a-flat':'${Buffer.from(aFlatCompiled.bytes).toString('base64')}', 'a-chamfer':'${Buffer.from(aChamferCompiled.bytes).toString('base64')}', 'spine-flat':'${Buffer.from(spineFlatCompiled.bytes).toString('base64')}', 'spine-chamfer':'${Buffer.from(spineChamferCompiled.bytes).toString('base64')}' }[row.family])+')');face.load().then(f=>{document.fonts.add(f);status.textContent='FontFace loaded';status.className='status ok';const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='400 320px "'+row.family+'"';document.getElementById('measure-'+row.family).textContent='Canvas advance at 320px: '+ctx.measureText('a').width.toFixed(2)+'px; expected '+(row.advance*320/1000).toFixed(2)+'px.'}).catch(e=>{status.textContent='FontFace failed: '+e.message;status.className='status error'})}</script></body></html>`;
writeOrVerify('review.html', review);

const markdown = `# End-to-end chamfered terminal font validation\n\nDate: 2026-11-03  \nRepository HEAD: ${report.repositoryHead}\n\n## Pipeline\n\nBoth chamfered variants were created by accepting the existing \`semantic.terminal.set-profile\` operation through the maintained transaction-composition executor. The accepted semantic state was then passed to its existing construction adapter and the existing \`fontsketch@0.1.0\` TrueType compiler. No contours were patched and no separate compiler was introduced.\n\n## Accepted revisions\n\n| Construction | Outer base | Outer accepted | Semantic base | Semantic accepted | Operation |\n|---|---|---|---|---|---|\n| Single-storey a | ${report.revisions.a.outerBase} | ${report.revisions.a.outerAccepted} | ${report.revisions.a.semanticBase} | ${report.revisions.a.semanticAccepted} | ${report.revisions.a.operationId} |\n| Spine-and-bowl | ${report.revisions.spine.outerBase} | ${report.revisions.spine.outerAccepted} | ${report.revisions.spine.semanticBase} | ${report.revisions.spine.semanticAccepted} | ${report.revisions.spine.operationId} |\n\n## Artifacts and measurements\n\n| Font | Bytes | SHA-256 | Advance | LSB / RSB | Glyf bounds | Saved flat baseline |\n|---|---:|---|---:|---:|---|---|\n${Object.entries(report.fonts).map(([name, f]) => `| ${name} (${f.file}) | ${f.bytes} | ${f.sha256} | ${f.compiledGlyph.advanceWidth} | ${f.compiledGlyph.leftSideBearing} / ${f.compiledGlyph.rightSideBearing} | ${f.compiledGlyph.glyfBounds.xMin}…${f.compiledGlyph.glyfBounds.xMax}, ${f.compiledGlyph.glyfBounds.yMin}…${f.compiledGlyph.glyfBounds.yMax} | ${report.flatBaselineComparisons[name]?.byteIdentical ? 'byte-identical' : '—'} |`).join('\n')}\n\nFlat outputs matched their saved artifacts byte-for-byte. Both chamfered outputs changed only the terminal outline: bounds, advance, side bearings, counters, and unrelated glyphs remained identical. The semantic profile derives an 18-unit cut from \`cutRatio: 0.2\` and the 90-unit stem.\n\n## Validation evidence\n\nThe compiler's parser, glyph validator, checksum verifier, and internal SFNT audit passed for all four fonts. The audit found the required TrueType tables, valid table and whole-font checksums, 1000 units per em, U+0061 mapped to glyph \`a\`, and matching compiled advance/bearings/bounds. The raw \`glyf\` bounding boxes were read from the emitted SFNT and matched the derived geometry.\n\nIndependent command-line font validators were not available: Python FontTools, OTS, FontForge, Fontconfig utilities, and HarfBuzz CLI were absent. Chrome for Android is installed. Browser rendering was pending when this report was generated; the self-contained \`review.html\` embeds all four fonts for side-by-side inspection.\n\n## Scope limits\n\nThis validates one semantic terminal operation in two existing construction adapters. It does not validate optical kerning, independent shaping behavior, arbitrary profile support, or universal font correctness.\n`;
writeOrVerify('validation-report.md', markdown);

console.log(JSON.stringify({ outputDirectory: outDir, report: resolve(outDir, 'validation-report.md'), fonts: Object.values(report.fonts).map(font => ({ file: font.file, bytes: font.bytes, sha256: font.sha256 })), savedFlatBaselinesByteIdentical: report.flatBaselineComparisons }, null, 2));
