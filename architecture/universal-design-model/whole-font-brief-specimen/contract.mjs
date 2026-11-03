export const WHOLE_FONT_SPEC_TYPE = 'lfcfoundry.whole-font-brief-resolution';
export const WHOLE_FONT_SPEC_VERSION = 1;

export const CANDIDATE_STATUSES = Object.freeze([
  'construction-geometry-invalid',
  'compilation-failed',
  'technically-valid-not-visually-reviewed',
  'visually-reviewed-not-approved',
  'visually-approved'
]);

const allowedOrigins = new Set(['explicit', 'inferred', 'defaulted']);
const allowedScopes = new Set(['family', 'glyph']);
const allowedCapabilities = new Set(['implemented', 'approximate', 'unresolved', 'unsupported', 'review-required']);

export function validateWholeFontSpec(spec) {
  const errors = [];
  if (spec?.type !== WHOLE_FONT_SPEC_TYPE || spec.schemaVersion !== WHOLE_FONT_SPEC_VERSION) {
    errors.push(`Expected ${WHOLE_FONT_SPEC_TYPE} schema version ${WHOLE_FONT_SPEC_VERSION}.`);
  }
  if (typeof spec?.brief?.text !== 'string' || !spec.brief.text.length || typeof spec.brief.messageId !== 'string') {
    errors.push('The exact original brief and its message ID are required.');
  }
  const decisions = spec?.decisions;
  if (!Array.isArray(decisions) || !decisions.length) errors.push('At least one typed design decision is required.');
  const ids = new Set();
  for (const item of decisions || []) {
    if (!item.id || ids.has(item.id)) errors.push(`Decision IDs must be present and unique: ${item.id || '(missing)'}.`);
    ids.add(item.id);
    if (!allowedScopes.has(item.scope?.kind) || (item.scope.kind === 'glyph' && !item.scope.glyphId)) {
      errors.push(`${item.id || '(decision)'} has an invalid family/glyph scope.`);
    }
    if (!allowedOrigins.has(item.origin)) errors.push(`${item.id || '(decision)'} has an invalid provenance origin.`);
    if (!allowedCapabilities.has(item.capability)) errors.push(`${item.id || '(decision)'} has an invalid capability status.`);
    if (item.origin === 'explicit') {
      const span = item.source;
      if (!span || span.messageId !== spec.brief.messageId || !Number.isInteger(span.start) ||
          !Number.isInteger(span.end) || span.start < 0 || span.end < span.start ||
          spec.brief.text.slice(span.start, span.end) !== span.text || !span.text) {
        errors.push(`${item.id || '(decision)'} has an invalid source span.`);
      }
    } else if (item.source && (item.source.start !== null || item.source.end !== null)) {
      errors.push(`${item.id} must not fabricate a source span for ${item.origin} information.`);
    }
    if (!item.property || !item.value || typeof item.value.kind !== 'string') errors.push(`${item.id || '(decision)'} needs a typed property and value.`);
  }
  for (const collection of ['constraints', 'dependencies', 'unsupported', 'unresolved', 'conflicts', 'defaults']) {
    if (!Array.isArray(spec?.[collection])) errors.push(`${collection} must be an array.`);
  }
  if (!['resolved-with-limitations', 'conflict', 'unsupported', 'invalid'].includes(spec?.resolutionStatus)) {
    errors.push('Unknown whole-brief resolution status.');
  }
  if (spec?.specimenPlan && (!Array.isArray(spec.specimenPlan.glyphs) || !Array.isArray(spec.specimenPlan.excludedGlyphs))) {
    errors.push('The specimen plan must declare included and excluded glyphs.');
  }
  return errors;
}

export function validateVisualReview(candidate) {
  if (!candidate || !CANDIDATE_STATUSES.includes(candidate.candidateStatus)) return ['Candidate status is missing or invalid.'];
  if (candidate.candidateStatus === 'visually-approved' &&
      (!candidate.visualReview?.reviewer || candidate.visualReview?.method !== 'human-visual-inspection' ||
       !candidate.visualReview?.evidenceRefs?.length || candidate.visualReview?.decision !== 'approved')) {
    return ['Visual approval requires an explicit human reviewer decision and evidence reference.'];
  }
  if (candidate.candidateStatus === 'visually-reviewed-not-approved' &&
      (!candidate.visualReview?.reviewer || candidate.visualReview?.method !== 'human-visual-inspection' ||
       candidate.visualReview?.decision !== 'not-approved')) {
    return ['A reviewed-but-not-approved status requires a recorded human review.'];
  }
  if (candidate.candidateStatus === 'technically-valid-not-visually-reviewed' && candidate.visualReview?.decision) {
    return ['An unreviewed candidate cannot carry a review decision.'];
  }
  return [];
}

export function recordVisualReview(candidate, { reviewer, decision, notes = '', evidenceRefs = [] } = {}) {
  if (candidate?.technicalStatus !== 'passed') throw new Error('Only a technically valid candidate can enter visual review.');
  if (typeof reviewer !== 'string' || !reviewer.trim() || !['approved', 'not-approved'].includes(decision) ||
      !Array.isArray(evidenceRefs) || !evidenceRefs.length || evidenceRefs.some(ref => typeof ref !== 'string' || !ref.trim())) {
    throw new Error('Visual review requires a named reviewer, a decision, and at least one evidence reference.');
  }
  const reviewed = { ...candidate, visualReview: { reviewer: reviewer.trim(), method: 'human-visual-inspection', decision,
    notes: String(notes), evidenceRefs: [...evidenceRefs] },
    candidateStatus: decision === 'approved' ? 'visually-approved' : 'visually-reviewed-not-approved' };
  const errors = validateVisualReview(reviewed);
  if (errors.length) throw new Error(errors.join(' '));
  return reviewed;
}
