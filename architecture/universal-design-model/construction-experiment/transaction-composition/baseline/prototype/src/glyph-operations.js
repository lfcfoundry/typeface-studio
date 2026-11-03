import { PathBuilder, orientContour } from './contours.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/**
 * Construct a solid, typographic heart inside the target glyph's advance box.
 * Its two cusps remain sharp while the lobes and shoulders use quadratic
 * curves. Coordinates are local to the glyph; normal family side bearings are
 * applied by the recipe engine after this operation.
 */
export function heartOutline(glyph, { width, height, weight = 400 } = {}) {
  if (!(width > 0 && height > 0)) throw new Error('Heart substitution requires positive glyph dimensions.');
  const boldness = clamp((weight - 400) / 300, 0, 1);
  const inset = clamp(Math.round(width * (0.12 - boldness * 0.04)), Math.round(width * 0.04), Math.round(width * 0.14));
  const left = inset, right = width - inset, center = Math.round(width / 2);
  const top = Math.round(height * (0.94 + boldness * 0.015)), notch = Math.round(height * 0.76);
  const tip = Math.round(height * 0.025);
  const b = new PathBuilder(`${glyph.id}.substitution.heart`, 'outer', center, notch);
  b.quad('right-cleft-to-lobe', center + (right - center) * 0.19, Math.round(height * 0.80), Math.round(center + (right - center) * 0.43), top)
    .quad('right-lobe-crown', Math.round(center + (right - center) * 0.86), Math.round(height * 1.02), right, Math.round(height * 0.78))
    .quad('right-shoulder', right, Math.round(height * 0.52), center, tip)
    .quad('left-shoulder', left, Math.round(height * 0.52), left, Math.round(height * 0.78))
    .quad('left-lobe-crown', Math.round(center - (center - left) * 0.86), Math.round(height * 1.02), Math.round(center - (center - left) * 0.43), top)
    .quad('left-lobe-to-cleft', center - (center - left) * 0.19, Math.round(height * 0.80), center, notch);
  const contour = orientContour(b.close(), 'outer');
  contour.operation = 'replace-outline:heart';
  return contour;
}

const REPLACEMENTS = Object.freeze({
  heart: heartOutline
});

/** Apply resolved glyph instructions without mutating the shared design spec. */
export function applyGlyphInstructions(glyph, model, dimensions) {
  const applied = [];
  const results = [];
  for (const instruction of model?.instructions || []) {
    const target = instruction.target.codePoints.includes(glyph.unicode);
    if (!target) continue;
    if (instruction.resolution.status !== 'resolved') {
      const status = instruction.resolution.status === 'unsupported' ? 'unsupported' : 'unresolved';
      results.push({ instructionId: instruction.id, status, reason: instruction.resolution.reason });
      continue;
    }
    if (instruction.operation.type === 'preserve-outline') {
      glyph.appliedInstructions ||= [];
      glyph.appliedInstructions.push(instruction.id);
      results.push({ instructionId: instruction.id, status: 'implemented', reason: 'The requested glyph outline is explicitly preserved.' });
      continue;
    }
    if (instruction.operation.type !== 'replace-outline') {
      results.push({ instructionId: instruction.id, status: 'unsupported', reason: `Operation ${instruction.operation.type} is not implemented.` });
      continue;
    }
    const shape = instruction.operation.parameters.shape;
    const construct = REPLACEMENTS[shape];
    if (!construct) {
      results.push({ instructionId: instruction.id, status: 'unsupported', reason: `The ${shape} outline substitution is not implemented.` });
      continue;
    }
    const contour = construct(glyph, dimensions);
    glyph.contours = [contour];
    glyph.components = [{
      id: `${glyph.id}.glyph-substitution-${shape}`,
      componentId: `shape.${shape}`,
      kind: 'glyph-substitution',
      contourId: contour.id
    }];
    glyph.substitution = { instructionId: instruction.id, shape, sourceSpan: instruction.sourceSpan };
    glyph.appliedInstructions ||= [];
    glyph.appliedInstructions.push(instruction.id);
    applied.push(instruction.id);
    results.push({ instructionId: instruction.id, status: instruction.capability === 'approximate' ? 'approximate' : 'implemented', reason: `Replaced the ${glyph.character} recipe outline with a ${shape} contour.` });
  }
  return { applied, results };
}
