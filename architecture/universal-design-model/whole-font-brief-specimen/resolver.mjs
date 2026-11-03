import { WHOLE_FONT_SPEC_TYPE, WHOLE_FONT_SPEC_VERSION, validateWholeFontSpec } from './contract.mjs';

export const SUPPORTED_BRIEF = 'Create a humanist sans-serif typeface with moderately condensed proportions, consistent stroke weight, a relatively tall x-height, generous counters, slightly rounded terminals, and a conventional double-storey lowercase a. Prioritize readability at small sizes.';
export const SUPPORTED_BRIEF_VARIANT = SUPPORTED_BRIEF.replace(/^Create/u, 'Design');
export const BRIEF_MESSAGE_ID = 'msg:whole-font-brief-1';

const diag = (code, message) => ({ code, message });
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

function sourceSpan(text, phrase) {
  const pattern = phrase.split(/\s+/u).map(escapeRegExp).join('\\s+');
  const match = new RegExp(pattern, 'iu').exec(text);
  if (!match) throw new Error(`Could not locate source phrase: ${phrase}`);
  return { messageId: BRIEF_MESSAGE_ID, start: match.index, end: match.index + match[0].length, text: match[0] };
}

function normalize(text) {
  return text.trim().toLocaleLowerCase('en').replace(/[’]/gu, "'").replace(/\s+/gu, ' ').replace(/[.!?]+$/u, '');
}

function explicitDecision(id, property, scope, value, phrase, capability, explanation, extra = {}) {
  return { id, property, scope, value, origin: 'explicit', source: sourceSpan(extra.text, phrase), capability, explanation, ...extra.fields };
}

function intentFor(decision) {
  return { id: decision.id.replace(/^decision:/u, 'intent:'), kind: decision.scope.kind === 'glyph' ? 'construction' : 'characteristic',
    subject: decision.scope.kind === 'family' ? { scope: 'family' } : { scope: 'glyph', glyphId: decision.scope.glyphId },
    predicate: decision.property, value: structuredClone(decision.value), source: structuredClone(decision.source), origin: 'explicit', confidence: 1,
    resolution: { status: decision.capability === 'unsupported' ? 'unsupported' : decision.capability === 'unresolved' ? 'unresolved' : 'resolved',
      capability: decision.capability, reason: decision.explanation }, supersedes: [], conflicts: [] };
}

export function resolveWholeFontBrief(input) {
  if (typeof input !== 'string') return { status: 'invalid', diagnostics: [diag('malformed-input', 'The whole-font brief must be text.')], specification: null };
  const text = input;
  const normalized = normalize(text);
  if (!normalized) return { status: 'invalid', diagnostics: [diag('empty-input', 'Enter a complete typeface description.')], specification: null };
  if (/\bsans[- ]serif\b[\s\S]*\bwith (?:slab )?serifs?\b|\bserifs?\b[\s\S]*\bsans[- ]serif\b/iu.test(normalized) ||
      /\b(?:single|one)[- ]storey\b[\s\S]*\bdouble[- ]storey\b|\bdouble[- ]storey\b[\s\S]*\b(?:single|one)[- ]storey\b/iu.test(normalized)) {
    return { status: 'conflict', diagnostics: [diag('conflicting-requirements', 'The brief contains incompatible serif or lowercase-a topology requirements.')], specification: null };
  }
  if (/\b(?:lowercase|lower-case)\s+[b-z]\b|\b(?:uppercase|capital)\s+[a-z]\b/iu.test(normalized)) {
    return { status: 'unsupported', diagnostics: [diag('unsupported-glyph-request', 'This specimen resolver recognizes only the documented family brief and its lowercase-a exception.')], specification: null };
  }
  if (/\bdouble[- ]storey\s+a\b/iu.test(normalized) && !/\blowercase\s+a\b/iu.test(normalized)) {
    return { status: 'ambiguous', diagnostics: [diag('ambiguous-glyph-scope', 'Specify lowercase a; an unqualified “a” may be an article rather than a glyph.')], specification: null };
  }
  const expected = normalize(SUPPORTED_BRIEF);
  const variant = normalize(SUPPORTED_BRIEF_VARIANT);
  if (normalized !== expected && normalized !== variant) {
    return { status: 'unsupported', diagnostics: [diag('unsupported-brief', 'Only the documented humanist-sans brief and its “Design” wording variant are interpreted. No nearby request is substituted.')], specification: null };
  }

  const phrases = {
    style: 'humanist sans-serif', condensed: 'moderately condensed proportions', stroke: 'consistent stroke weight',
    xHeight: 'a relatively tall x-height', counters: 'generous counters', terminals: 'slightly rounded terminals',
    aTopology: 'conventional double-storey lowercase a', readability: 'Prioritize readability at small sizes'
  };
  const decisions = [
    explicitDecision('decision:humanist-direction', 'classification.humanist', { kind: 'family' }, { kind: 'qualitative', value: 'humanist' }, phrases.style,
      'unsupported', 'The available semantic constructors do not encode humanist-specific proportions, modulation, or joins.', { text }),
    explicitDecision('decision:sans-serif', 'classification.serif-treatment', { kind: 'family' }, { kind: 'qualitative', value: 'sans-serif' }, phrases.style,
      'approximate', 'The planned specimen has no serif components, but its existing constructors are not a validated family style.', { text }),
    explicitDecision('decision:condensed-proportions', 'proportion.width', { kind: 'family' }, { kind: 'qualitative', value: 'moderately condensed' }, phrases.condensed,
      'unsupported', 'No calibrated family-wide width policy currently regenerates the supported constructions.', { text }),
    explicitDecision('decision:stroke-consistency', 'stroke.consistency', { kind: 'family' }, { kind: 'qualitative', value: 'consistent' }, phrases.stroke,
      'approximate', 'The specimen reuses a 90-unit stem decision, but optical weight consistency across bowls, joins, and raster sizes is not established.',
      { text, fields: { currentEvidence: { decisionId: 'decision:shared-stem-width', value: 90, origin: 'inherited-from-accepted-source' } } }),
    explicitDecision('decision:tall-x-height', 'proportion.x-height', { kind: 'family' }, { kind: 'qualitative', value: 'relatively tall' }, phrases.xHeight,
      'unresolved', '“Relatively tall” has no calibrated family threshold. The source fixture measures x-height 500 and cap height 700; that measurement is not treated as proof that the request is satisfied.',
      { text, fields: { currentEvidence: { xHeight: 500, capHeight: 700, ratio: 500 / 700, origin: 'inherited-fixture-measurement' } } }),
    explicitDecision('decision:generous-counters', 'counter.character', { kind: 'family' }, { kind: 'qualitative', value: 'generous' }, phrases.counters,
      'unresolved', 'Only selected enclosed/open spaces exist; there is no cross-glyph counter policy or calibrated meaning for “generous”.', { text }),
    explicitDecision('decision:rounded-terminals', 'terminal.profile', { kind: 'family' }, { kind: 'qualitative', value: 'slightly rounded' }, phrases.terminals,
      'unsupported', 'The planned constructors support flat terminals and a bounded chamfer, not rounded terminals.', { text }),
    explicitDecision('decision:small-size-readability', 'legibility.small-size', { kind: 'family' }, { kind: 'goal', value: 'prioritize readability' }, phrases.readability,
      'review-required', 'This goal requires small-size raster review and cannot be resolved by a geometry parameter alone.', { text }),
    explicitDecision('decision:lowercase-a-topology', 'glyph.construction.topology', { kind: 'glyph', glyphId: 'glyph:u0061' },
      { kind: 'qualitative', value: 'conventional double-storey' }, phrases.aTopology, 'unsupported',
      'A double-storey construction experiment exists, but its saved Android Chrome raster reads as stacked loops rather than a conventional lowercase a. It is excluded from compliant construction planning.', { text })
  ];
  const defaults = [{ id: 'default:specimen-inventory', property: 'specimen.glyph-inventory', origin: 'defaulted',
    value: ['o', 'n', 'H', 'a', 'h'], source: null,
    justification: 'Use the available ring, shoulder, crossbar, single-storey-a, and ascender-shoulder constructions to evaluate shared traits. The a is included only as accepted-source context because its requested topology is unsupported.' }];
  const unsupported = decisions.filter(item => item.capability === 'unsupported').map(item => ({ decisionId: item.id, property: item.property, reason: item.explanation }));
  const unresolved = decisions.filter(item => ['unresolved', 'review-required'].includes(item.capability)).map(item => ({ decisionId: item.id,
    property: item.property, reason: item.explanation, status: item.capability }));
  const constraints = [
    { id: 'constraint:shared-stroke-reference', kind: 'shared-parameter', decisionIds: ['decision:stroke-consistency'], parameterId: 'decision:shared-stem-width', value: 90,
      status: 'inherited-and-checked-in-specimen', affectedGlyphs: ['o', 'n', 'H', 'a', 'h'] },
    { id: 'constraint:do-not-substitute-a-topology', kind: 'no-silent-substitution', decisionIds: ['decision:lowercase-a-topology'],
      status: 'blocks-compliance', reason: 'Preserve the accepted single-storey a only for comparison; do not claim it satisfies the requested double-storey form.' },
    { id: 'constraint:human-review-before-approval', kind: 'visual-acceptance', decisionIds: ['decision:small-size-readability'], status: 'required' }
  ];
  const specification = {
    type: WHOLE_FONT_SPEC_TYPE, schemaVersion: WHOLE_FONT_SPEC_VERSION, resolutionStatus: 'resolved-with-limitations',
    brief: { messageId: BRIEF_MESSAGE_ID, text, language: 'en', languageCapability: 'this resolver only' },
    intents: decisions.map(intentFor), decisions, defaults, constraints, dependencies: [], conflicts: [], unsupported, unresolved,
    glyphExceptions: decisions.filter(item => item.scope.kind === 'glyph'), specimenPlan: null,
    briefCompliance: { status: 'incomplete-blocked', reasons: [...unsupported, ...unresolved].map(item => item.decisionId) },
    diagnostics: [{ code: 'bounded-vocabulary', message: 'Exact phrase grammar only; no arbitrary-language interpretation is claimed.' }]
  };
  const errors = validateWholeFontSpec(specification);
  if (errors.length) return { status: 'invalid', diagnostics: errors.map(message => diag('invalid-specification', message)), specification: null };
  return { status: specification.resolutionStatus, diagnostics: specification.diagnostics, specification };
}
