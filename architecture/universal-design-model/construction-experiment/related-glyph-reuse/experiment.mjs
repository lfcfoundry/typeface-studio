import { compileTypeface } from '../../../../prototype/src/font.js';
import { auditSfnt } from '../../../../prototype/src/sfnt-audit.js';
import { buildRelatedGlyphCandidate, createRelatedGlyphExperiment, validateRelatedDesign } from './model.mjs';
import { deriveRelatedGlyphs } from './geometry.mjs';

export { buildRelatedGlyphCandidate, createRelatedGlyphExperiment, validateRelatedDesign };
export { deriveRelatedGlyph, deriveRelatedGlyphs } from './geometry.mjs';

export function initializeRelatedExperiment() {
  const model = createRelatedGlyphExperiment();
  const errors = validateRelatedDesign(model);
  if (errors.length) throw new Error(`Invalid related-glyph base model: ${errors.join(' ')}`);
  model.derived.geometry.glyphs = deriveRelatedGlyphs(model);
  return model;
}

export function compileRelatedGlyphFont(model) {
  const glyphOrder = model.glyphs.map(glyph => glyph.id);
  const project = {
    metadata: { family: model.family.name, designer: 'LFCFoundry', version: '0.101', copyright: '' },
    metrics: { unitsPerEm: model.family.unitsPerEm, ascender: 800, descender: -200 },
    design: { weight: 400, xHeight: model.sharedParameters['decision:x-height'].value, capHeight: 700 },
    glyphOrder, glyphs: Object.fromEntries(glyphOrder.map(id => [id, model.derived.geometry.glyphs[id]]))
  };
  const font = compileTypeface(project, 'Regular');
  const audit = auditSfnt(font.bytes);
  if (!audit.valid) throw new Error(`Internal related-glyph SFNT audit failed: ${JSON.stringify(audit)}`);
  for (const glyph of model.glyphs) {
    const compiled = font.parsed.glyphs[glyph.name];
    if (!compiled || compiled.unicodes.length !== 1 || compiled.unicodes[0] !== glyph.unicodes[0]) {
      throw new Error(`Compiled ${glyph.name} mapping is absent or incorrect.`);
    }
  }
  return { ...font, audit };
}

export function buildAllRelatedGlyphs() {
  const accepted = initializeRelatedExperiment();
  return buildRelatedGlyphCandidate(accepted);
}
