import { GLYPH_INSTRUCTION_VERSION } from './glyph-instructions.js';

export const SPEC_TYPE = 'lfcfoundry.typeface-design-spec';
export const SPEC_VERSION = 1;

export const DEFAULT_DESIGN = Object.freeze({
  family: 'Studio Prototype', system: 'geometric', width: 1, stem: 94,
  weight: 400, contrast: 0.08, xHeight: 520, capHeight: 700,
  aperture: 0.15, counterScale: 1, terminal: 'square', terminalRadiusRatio: 0.35, spacing: 1, monospaced: false,
  serifBracket: 0.2
});

export const ENGINE_CAPABILITIES = Object.freeze({
  engine: 'contour-recipes-0.1',
  supported: [
    'construction.geometric', 'construction.humanist', 'construction.serif',
    'proportion.width', 'weight.static', 'stroke.contrast', 'stroke.weight', 'aperture.open', 'counter.open',
    'terminal.rounded', 'terminal.rounded-degree', 'serif.bracketed', 'spacing.generous', 'spacing.monospaced'
  ],
  approximate: ['character.friendly', 'construction.grotesque'],
  unsupported: ['character.editorial', 'character.elegant', 'usage.display', 'historical.traditional', 'aperture.glyph-specific', 'anatomy.unsupported']
});

export function stableSpec(spec) {
  return JSON.parse(JSON.stringify(spec));
}

export function validateSpec(spec) {
  const errors = [];
  if (!spec || spec.type !== SPEC_TYPE || spec.version !== SPEC_VERSION) errors.push('Unsupported or missing design-spec type/version.');
  if (typeof spec?.source?.brief !== 'string') errors.push('The original brief is missing.');
  if (!Array.isArray(spec?.instructions) || !Array.isArray(spec?.conflicts) || !Array.isArray(spec?.unsupported) || !Array.isArray(spec?.defaults)) errors.push('The specification is missing instruction, conflict, unsupported, or default records.');
  if (!spec?.resolvedParameters || !['geometric', 'humanist', 'serif'].includes(spec.resolvedParameters.system)) errors.push('The resolved construction system is invalid.');
  const glyphModel = spec?.glyphInstructions;
  if (!glyphModel || glyphModel.version !== GLYPH_INSTRUCTION_VERSION || !Array.isArray(glyphModel.instructions) || !Array.isArray(glyphModel.conflicts) || !Array.isArray(glyphModel.unsupported) || !Array.isArray(glyphModel.unresolved)) {
    errors.push('The glyph-instruction model is missing or uses an unsupported version.');
  }
  for (const item of spec?.instructions || []) {
    if (!item.concept || !item.sourceSpan || !['explicit', 'inferred'].includes(item.origin) || !['supported', 'approximate', 'unsupported'].includes(item.capability)) {
      errors.push(`Malformed instruction record: ${String(item.concept || item.id || 'unknown')}.`);
      break;
    }
  }
  for (const item of glyphModel?.instructions || []) {
    if (!item.id || !['substitution', 'exception', 'geometry'].includes(item.kind) || !item.target || !item.operation?.type ||
        !Array.isArray(item.target.glyphs) || !item.target.glyphs.every(glyph => typeof glyph === 'string') ||
        !Array.isArray(item.target.codePoints) || !item.target.codePoints.every(codePoint => Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) ||
        !['uppercase', 'lowercase', 'both', 'ambiguous'].includes(item.target.caseScope) ||
        typeof item.target.text !== 'string' || !Array.isArray(item.target.candidates) ||
        !item.sourceSpan || !Number.isInteger(item.sourceSpan.start) || !Number.isInteger(item.sourceSpan.end) ||
        item.sourceSpan.start < 0 || item.sourceSpan.end < item.sourceSpan.start || typeof item.sourceSpan.text !== 'string' ||
        !item.operation.parameters || typeof item.operation.parameters !== 'object' ||
        !['explicit', 'inferred'].includes(item.origin) || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1 ||
        !['supported', 'approximate', 'unsupported'].includes(item.capability) ||
        !['resolved', 'ambiguous', 'unsupported', 'conflict'].includes(item.resolution?.status) ||
        !Array.isArray(item.resolution?.targetGlyphs) || !Array.isArray(item.conflicts) ||
        !item.conflicts.every(conflictId => typeof conflictId === 'string')) {
      errors.push(`Malformed glyph instruction: ${String(item.id || item.kind || 'unknown')}.`);
      break;
    }
  }
  const glyphInstructionList = Array.isArray(glyphModel?.instructions) ? glyphModel.instructions : [];
  const glyphIds = new Set(glyphInstructionList.map(item => item?.id));
  const indexedGlyphIds = [
    ...(Array.isArray(glyphModel?.unsupported) ? glyphModel.unsupported : []),
    ...(Array.isArray(glyphModel?.unresolved) ? glyphModel.unresolved : [])
  ];
  if (glyphModel && (glyphIds.size !== glyphInstructionList.length || indexedGlyphIds.some(id => !glyphIds.has(id)))) {
    errors.push('Glyph instruction IDs are duplicated or an unsupported/unresolved index refers to a missing instruction.');
  }
  return errors;
}
