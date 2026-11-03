import { addGlyph, createFont, exportFont, glyphNameFor, parseFont, validateFont, verifyChecksums } from 'fontsketch/core';
import { rectContour, fontPoints, validateGlyph } from './contours.js';

function notdef() {
  const outer = rectContour('notdef.outer', 35, 0, 565, 700, 'outer');
  const counter = rectContour('notdef.counter', 95, 70, 505, 630, 'counter');
  return { id: 'notdef', name: '.notdef', unicode: null, contours: [outer, counter], metrics: { advanceWidth: 620, leftSideBearing: 35, rightSideBearing: 55 }, components: [] };
}

export function compileTypeface(project, style = 'Regular') {
  if (!project?.glyphOrder?.length) throw new Error('Generate the contour family before compiling a font.');
  if (!['Regular', 'Bold'].includes(style)) throw new Error(`Unsupported static style: ${style}`);
  const weightClass = style === 'Bold' ? 700 : Math.max(100, Math.min(900, project.design.weight || 400));
  const font = createFont({
    family: project.metadata.family,
    style,
    version: project.metadata.version || '0.100',
    designer: project.metadata.designer || '',
    copyright: project.metadata.copyright || '',
    unitsPerEm: project.metrics.unitsPerEm,
    ascender: project.metrics.ascender,
    descender: project.metrics.descender,
    xHeight: project.design.xHeight,
    capHeight: project.design.capHeight,
    weightClass,
    vendorID: 'LFCF'
  });
  const glyphs = [notdef(), ...project.glyphOrder.map(id => project.glyphs[id])];
  for (const glyph of glyphs) {
    const errors = validateGlyph({ ...glyph, advanceWidth: glyph.metrics.advanceWidth, rightSideBearing: glyph.metrics.rightSideBearing });
    if (errors.length) throw new Error(`${glyph.name}: ${errors.join(' ')}`);
    addGlyph(font, {
      name: glyph.name,
      unicodes: glyph.unicode === null ? [] : [glyph.unicode],
      advanceWidth: glyph.metrics.advanceWidth,
      leftSideBearing: glyph.metrics.leftSideBearing,
      contours: glyph.contours.map(contour => ({ closed: true, points: fontPoints(contour) }))
    });
  }
  const problems = validateFont(font);
  if (Array.isArray(problems) && problems.length) throw new Error(`Font model validation failed: ${problems.map(x => typeof x === 'string' ? x : x.message || JSON.stringify(x)).join('; ')}`);
  const bytes = exportFont(font, { format: 'ttf', hinting: 'none', legacyKern: true, timestamp: new Date('2024-01-01T00:00:00Z'), onWarning: () => {} });
  const checksums = verifyChecksums(bytes);
  if (checksums.length) throw new Error(`TTF checksum validation failed: ${checksums.join('; ')}`);
  const parsed = parseFont(bytes);
  return { bytes, font, parsed, style, weightClass, checksumsVerified: true };
}

export function compareCompiledGeometry(a, b) {
  const results = {};
  for (const glyph of Object.keys(a.parsed.glyphs || {})) {
    const left = a.parsed.glyphs[glyph], right = b.parsed.glyphs[glyph];
    if (!right) continue;
    results[glyph] = {
      advanceChanged: left.advanceWidth !== right.advanceWidth,
      outlineChanged: JSON.stringify(left.contours) !== JSON.stringify(right.contours)
    };
  }
  return results;
}
