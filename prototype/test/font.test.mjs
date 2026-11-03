import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretBrief } from '../src/brief.js';
import { generateContourFamily } from '../src/recipes.js';
import { compileTypeface } from '../src/font.js';
import { auditSfnt, REQUIRED_SFNT_TABLES } from '../src/sfnt-audit.js';

test('all three contour systems compile to checksum-valid TrueType-outline fonts', () => {
  const spec = interpretBrief('A condensed humanist-inspired face with open apertures, high contrast, and bracketed serifs.');
  for (const system of ['geometric', 'humanist', 'serif']) for (const style of ['Regular', 'Bold']) {
    const family = generateContourFamily(spec, { system, style });
    const compiled = compileTypeface(family, style);
    assert.ok(compiled.bytes instanceof Uint8Array);
    assert.ok(compiled.bytes.length > 1000);
    assert.equal(compiled.checksumsVerified, true);
    const audit = auditSfnt(compiled.bytes);
    assert.equal(audit.valid, true, `${system} ${style}: ${JSON.stringify(audit)}`);
    assert.deepEqual([...REQUIRED_SFNT_TABLES].filter(x => !audit.tables.includes(x)), []);
    assert.equal(audit.numGlyphs, 12, `${system} ${style}`);
    assert.equal(audit.horizontalMetrics.errors.length, 0);
    assert.equal(audit.horizontalMetrics.metrics.length, 12);
    assert.deepEqual(audit.metadata.errors, []);
    assert.equal(audit.metadata.unitsPerEm, 1000);
    assert.equal(audit.metadata.ascender, 800);
    assert.equal(audit.metadata.descender, family.metrics.descender);
    assert.equal(audit.metadata.weightClass, style === 'Bold' ? 700 : spec.resolvedParameters.weight);
    assert.equal(audit.cmap.format, 4);
    assert.equal(audit.cmap.glyphIndex(32), 1, 'space cmap index');
    assert.equal(audit.cmap.glyphIndex(65), 2, 'A cmap index');
    assert.equal(audit.cmap.glyphIndex(66), 3, 'B cmap index');
    assert.equal(audit.cmap.glyphIndex(103), 11, 'g cmap index');
    assert.equal(audit.cmap.glyphIndex(0x00e9), 0, 'unmapped characters route to .notdef');
    assert.equal(compiled.parsed.meta.style, style);
    assert.equal(compiled.parsed.meta.weightClass, style === 'Bold' ? 700 : spec.resolvedParameters.weight);
    assert.ok(compiled.parsed.glyphs['.notdef']);
    assert.equal(Object.keys(compiled.parsed.glyphs)[0], '.notdef', '.notdef is glyph index zero');
    assert.ok(compiled.parsed.glyphs.space);
    assert.deepEqual(Object.keys(compiled.parsed.glyphs), ['.notdef', 'space', 'A', 'B', 'E', 'H', 'O', 'a', 'e', 'n', 'o', 'g']);
    assert.ok(compiled.parsed.glyphs.O.contours.length >= 2, 'O contains outer and counter contours');
    assert.ok(compiled.parsed.glyphs.O.contours.flatMap(c => c.points).length >= 8, 'quadratic TrueType points survive parsing');
    assert.equal(compiled.parsed.glyphs.A.advanceWidth, family.glyphs.u0041.metrics.advanceWidth);
    assert.deepEqual(audit.horizontalMetrics.metrics[2], {
      advanceWidth: family.glyphs.u0041.metrics.advanceWidth,
      leftSideBearing: family.glyphs.u0041.metrics.leftSideBearing
    });
  }
});

test('Bold export is not a metadata-only alias of Regular', () => {
  const spec = interpretBrief('A geometric sans-serif');
  const regular = compileTypeface(generateContourFamily(spec, { system: 'geometric', style: 'Regular' }), 'Regular');
  const bold = compileTypeface(generateContourFamily(spec, { system: 'geometric', style: 'Bold' }), 'Bold');
  assert.equal(regular.parsed.meta.weightClass, 400);
  assert.equal(bold.parsed.meta.weightClass, 700);
  assert.notDeepEqual(regular.parsed.glyphs.O.contours, bold.parsed.glyphs.O.contours);
  assert.equal(auditSfnt(regular.bytes).wholeChecksumValid, true);
  assert.equal(auditSfnt(bold.bytes).wholeChecksumValid, true);
});

test('compiled fonts retain distinct construction-system outlines', () => {
  const spec = interpretBrief('A geometric sans-serif with regular weight');
  const fonts = ['geometric', 'humanist', 'serif'].map(system => compileTypeface(generateContourFamily(spec, { system }), 'Regular'));
  const outlines = fonts.map(font => JSON.stringify(font.parsed.glyphs.a.contours));
  assert.equal(new Set(outlines).size, 3);
  assert.equal(new Set(fonts.map(font => Buffer.from(font.bytes).toString('hex'))).size, 3);
});

test('the independent SFNT audit rejects corrupted bytes and truncated table ranges', () => {
  const spec = interpretBrief('A geometric sans-serif');
  const result = compileTypeface(generateContourFamily(spec, { system: 'geometric' }));
  const corrupted = result.bytes.slice(); corrupted[corrupted.length - 1] ^= 0x01;
  assert.equal(auditSfnt(corrupted).valid, false);
  assert.throws(() => auditSfnt(new Uint8Array([0, 1, 0])), /not a TrueType/);
});
