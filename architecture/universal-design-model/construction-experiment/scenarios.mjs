import { createSemanticDesign } from './model.mjs';
import { initializeConstruction, buildOpenCounterCandidate, buildCrossbarCandidate } from './index.mjs';

export function createBaseScenario() {
  const accepted = initializeConstruction(createSemanticDesign());
  const candidate = buildOpenCounterCandidate(accepted);
  if (candidate.status !== 'candidate') throw new Error(candidate.error);
  return { accepted, candidate };
}

export function createCrossbarComparison() {
  const accepted = initializeConstruction(createSemanticDesign());
  const current = { label: 'Existing placement', centerRatio: 367 / 700, status: 'reference', model: accepted };
  const midpointResult = buildCrossbarCandidate(accepted, { centerRatio: 0.5, suffix: 'midpoint', label: 'Exact midpoint' });
  if (midpointResult.status !== 'candidate') throw new Error(midpointResult.error);
  const belowResult = buildCrossbarCandidate(accepted, { centerRatio: 0.48, suffix: 'below-midpoint', label: 'Modestly below midpoint' });
  if (belowResult.status !== 'candidate') throw new Error(belowResult.error);
  return {
    accepted,
    variants: [current,
      { label: 'Exact midpoint', centerRatio: 0.5, status: 'candidate', model: midpointResult.model, revision: midpointResult.revision },
      { label: 'Modestly below midpoint', centerRatio: 0.48, status: 'candidate', model: belowResult.model, revision: belowResult.revision }
    ]
  };
}

export function presentationReference(model, glyphId, writingMode) {
  if (!['horizontal', 'vertical'].includes(writingMode)) throw new Error(`Unsupported presentation context ${writingMode}.`);
  const glyph = model.glyphRegistry.glyphs.find(item => item.id === glyphId);
  if (!glyph) throw new Error(`Unknown glyph ${glyphId}.`);
  return {
    writingMode, glyphId, semanticConstructionId: `construction:${glyphId}`,
    geometryHash: JSON.stringify(model.derived.geometry.glyphs[glyphId]),
    verticalAlternate: null,
    capability: writingMode === 'horizontal' ? 'horizontal-outline-available' : 'shared-construction-reference-only'
  };
}
