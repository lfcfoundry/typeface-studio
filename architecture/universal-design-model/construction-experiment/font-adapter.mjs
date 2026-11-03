import { compileTypeface } from '../../../prototype/src/font.js';
import { auditSfnt } from '../../../prototype/src/sfnt-audit.js';

export function compilerProject(model) {
  const glyphOrder = model.glyphRegistry.glyphs.map(glyph => glyph.id);
  return {
    metadata: { family: model.family.name, designer: 'LFCFoundry', version: '0.100', copyright: '' },
    metrics: { unitsPerEm: model.family.unitsPerEm, ascender: 800, descender: -200 },
    design: { weight: 400, xHeight: 500, capHeight: 700 }, glyphOrder,
    glyphs: Object.fromEntries(glyphOrder.map(id => [id, model.derived.geometry.glyphs[id]]))
  };
}

export function compileSemanticDesign(model) {
  const result = compileTypeface(compilerProject(model), 'Regular');
  const audit = auditSfnt(result.bytes);
  if (!audit.valid) throw new Error(`Internal SFNT audit rejected semantic font: ${JSON.stringify(audit)}`);
  return { ...result, audit };
}
