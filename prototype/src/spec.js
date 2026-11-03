export const SPEC_TYPE = 'lfcfoundry.typeface-design-spec';
export const SPEC_VERSION = 1;

export const DEFAULT_DESIGN = Object.freeze({
  family: 'Studio Prototype', system: 'geometric', width: 1, stem: 94,
  weight: 400, contrast: 0.08, xHeight: 520, capHeight: 700,
  aperture: 0.15, counterScale: 1, terminal: 'square', spacing: 1, monospaced: false,
  serifBracket: 0.2
});

export const ENGINE_CAPABILITIES = Object.freeze({
  engine: 'contour-recipes-0.1',
  supported: [
    'construction.geometric', 'construction.humanist', 'construction.serif',
    'proportion.width', 'weight.static', 'stroke.contrast', 'stroke.weight', 'aperture.open', 'counter.open',
    'terminal.rounded', 'serif.bracketed', 'spacing.generous', 'spacing.monospaced'
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
  for (const item of spec?.instructions || []) {
    if (!item.concept || !item.sourceSpan || !['explicit', 'inferred'].includes(item.origin) || !['supported', 'approximate', 'unsupported'].includes(item.capability)) {
      errors.push(`Malformed instruction record: ${String(item.concept || item.id || 'unknown')}.`);
      break;
    }
  }
  return errors;
}
