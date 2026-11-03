export const GLYPH_INSTRUCTION_VERSION = 1;

const GLYPH_SET = new Set(['A', 'B', 'E', 'H', 'O', 'a', 'e', 'n', 'o', 'g']);
const SUPPORTED_SHAPES = new Set(['heart']);

function spanOf(text, match) {
  return { start: match.index, end: match.index + match[0].length, text: text.slice(match.index, match.index + match[0].length) };
}

function targetFor(glyphs, caseScope, text = glyphs.join('')) {
  return {
    glyphs,
    codePoints: glyphs.map(glyph => glyph.codePointAt(0)),
    caseScope,
    text,
    candidates: caseScope === 'ambiguous' ? ['O', 'o'] : []
  };
}

function makeCandidate({ kind = 'substitution', glyphs, caseScope, targetText, operation, sourceSpan, confidence = 0.99, unresolvedReason = null }) {
  const supportedGlyphs = glyphs.length === 0
    ? caseScope === 'ambiguous' && targetFor(glyphs, caseScope, targetText).candidates.every(glyph => GLYPH_SET.has(glyph))
    : glyphs.every(glyph => GLYPH_SET.has(glyph));
  const supportedOperation = operation.type === 'preserve-outline' ||
    (operation.type === 'replace-outline' && SUPPORTED_SHAPES.has(operation.parameters.shape));
  const ambiguous = caseScope === 'ambiguous' || glyphs.length === 0;
  let capability = supportedGlyphs && supportedOperation ? 'supported' : 'unsupported';
  let status = supportedGlyphs && supportedOperation ? 'resolved' : 'unsupported';
  let reason = unresolvedReason;
  if (ambiguous) {
    status = 'ambiguous';
    reason ||= 'The brief describes a glyph change without an unambiguous glyph and case target.';
  } else if (!supportedGlyphs) reason ||= 'The target glyph is outside the prototype glyph inventory.';
  else if (!supportedOperation) reason ||= `The ${operation.parameters.shape} outline substitution is not implemented.`;

  return {
    kind,
    target: targetFor(glyphs, caseScope, targetText),
    operation,
    sourceSpan,
    origin: 'explicit',
    confidence,
    capability,
    resolution: { status, targetGlyphs: status === 'resolved' ? [...glyphs] : [], reason },
    conflicts: []
  };
}

function replacement(glyphs, caseScope, targetText, shape, sourceSpan) {
  return makeCandidate({
    glyphs, caseScope, targetText, sourceSpan,
    operation: { type: 'replace-outline', parameters: { shape: shape.toLowerCase().replace(/s$/, '') } }
  });
}

function preserve(glyph, caseScope, sourceSpan) {
  return makeCandidate({
    kind: 'exception', glyphs: [glyph], caseScope, targetText: glyph, sourceSpan,
    operation: { type: 'preserve-outline', parameters: {} }
  });
}

function overlaps(a, b) { return a.start < b.end && b.start < a.end; }

function sameOperation(a, b) { return JSON.stringify(a.operation) === JSON.stringify(b.operation); }

function resolveConflicts(instructions) {
  const conflicts = [];
  const participants = new Set();
  for (let i = 0; i < instructions.length; i++) {
    for (let j = i + 1; j < instructions.length; j++) {
      const a = instructions[i], b = instructions[j];
      const shared = a.target.codePoints.filter(cp => b.target.codePoints.includes(cp));
      if (!shared.length || sameOperation(a, b)) continue;
      const conflict = {
        id: `glyph-conflict-${conflicts.length + 1}`,
        instructionIds: [`glyph-instruction-${i + 1}`, `glyph-instruction-${j + 1}`],
        targetCodePoints: shared,
        sourceSpans: [a.sourceSpan, b.sourceSpan],
        resolution: 'requires-user-choice'
      };
      conflicts.push(conflict);
      participants.add(i); participants.add(j);
    }
  }
  for (const index of participants) {
    instructions[index].resolution = {
      status: 'conflict', targetGlyphs: [], reason: 'Conflicting instructions target the same glyph.'
    };
    instructions[index].conflicts = conflicts.filter(c => c.instructionIds.includes(`glyph-instruction-${index + 1}`)).map(c => c.id);
  }
  return conflicts;
}

export function makeGlyphInstructionModel(instructions = [], conflicts = []) {
  return {
    version: GLYPH_INSTRUCTION_VERSION,
    instructions,
    conflicts,
    unsupported: instructions.filter(item => item.capability === 'unsupported').map(item => item.id),
    unresolved: instructions.filter(item => ['ambiguous', 'conflict'].includes(item.resolution.status)).map(item => item.id)
  };
}

/**
 * Extracts explicit glyph-directed constructions from a deliberately small,
 * inspectable grammar. Compromise continues to handle the existing global
 * vocabulary; this layer preserves target, case, operation, and source span.
 */
export function interpretGlyphInstructions(brief) {
  const text = String(brief || '');
  const candidates = [];
  const consumed = [];
  const add = candidate => { candidates.push(candidate); consumed.push(candidate.sourceSpan); };
  const available = match => !consumed.some(span => overlaps(span, spanOf(text, match)));

  // Explicit preservation is a glyph-level exception. It is separate from a
  // following substitution, so "keep O normal but change o" stays case-safe.
  const keepPattern = /\bkeep\s+(?:the\s+)?(uppercase|lowercase)\s+([Oo])\s+(normal|unchanged|as\s+is)\b/giu;
  for (const match of text.matchAll(keepPattern)) {
    const declared = match[1].toLowerCase();
    const glyph = match[2];
    const correctCase = declared === 'uppercase' ? glyph === 'O' : glyph === 'o';
    add(correctCase
      ? preserve(glyph, declared, spanOf(text, match))
      : makeCandidate({ kind: 'exception', glyphs: [], caseScope: 'ambiguous', targetText: glyph,
        operation: { type: 'preserve-outline', parameters: {} }, sourceSpan: spanOf(text, match),
        unresolvedReason: 'The written glyph conflicts with the stated uppercase/lowercase scope.' }));
  }

  // A coordinated request explicitly covers both cases and is one atomic
  // substitution instruction with two Unicode targets.
  const bothPatterns = [
    /\b(?:replace|make)\s+(?:the\s+)?uppercase\s+O\s+and\s+(?:the\s+)?lowercase\s+o\s+(?:with|as)\s+(?:a\s+)?(hearts?)(?:\s+shape)?\b/giu,
    /\b(?:replace|make)\s+(?:the\s+)?lowercase\s+o\s+and\s+(?:the\s+)?uppercase\s+O\s+(?:with|as)\s+(?:a\s+)?(hearts?)(?:\s+shape)?\b/giu
  ];
  for (const pattern of bothPatterns) for (const match of text.matchAll(pattern)) if (available(match)) {
    add(replacement(['O', 'o'], 'both', 'O and o', match[1], spanOf(text, match)));
  }

  // The original "instead of letter o ... heart shape" wording is handled
  // without changing the existing global typography parser.
  const insteadPattern = /\binstead\s+of\s+(?:the\s+)?letter\s+["'“‘]?([Oo])["'”’]?\s*,?\s*(?:(?:it|the\s+glyph)\s+)?(?:has|use|make|draws?|should\s+be|becomes?)\s+(?:a\s+)?(heart)(?:-shaped|\s+shaped|\s+shape)?\b/giu;
  for (const match of text.matchAll(insteadPattern)) if (available(match)) {
    const glyph = match[1];
    add(replacement([glyph], glyph === 'o' ? 'lowercase' : 'uppercase', glyph, match[2], spanOf(text, match)));
  }

  // Case-qualified generic outline requests are recognized even when their
  // requested shape is not yet supported, so they can be reported honestly.
  const qualifiedShape = /\b(?:make|turn|change|draw|replace)\s+(?:the\s+)?(lowercase|uppercase)\s+([A-Za-z])\s+(?:(?:into|as)\s+)?(?:a\s+)?((?:heart|star|diamond|circle|square|flower|crescent)(?:-shaped|\s+shaped|\s+shape)?|[a-z]+(?:-[a-z]+)*-shaped)\b/giu;
  for (const match of text.matchAll(qualifiedShape)) if (available(match)) {
    const scope = match[1].toLowerCase(), glyph = match[2];
    const shape = match[3].toLowerCase().replace(/(?:-shaped|\s+shaped|\s+shape)$/u, '');
    const correctCase = scope === 'uppercase' ? glyph === glyph.toUpperCase() : glyph === glyph.toLowerCase();
    add(correctCase
      ? replacement([glyph], scope, glyph, shape, spanOf(text, match))
      : makeCandidate({ glyphs: [], caseScope: 'ambiguous', targetText: glyph,
        operation: { type: 'replace-outline', parameters: { shape } }, sourceSpan: spanOf(text, match),
        unresolvedReason: 'The written glyph conflicts with the stated uppercase/lowercase scope.' }));
  }

  // An unqualified letter name has explicit character identity but ambiguous
  // case intent: plain "o" is not silently expanded to both glyphs.
  const unqualifiedShape = /\b(?:make|turn|change)\s+(?:the\s+)?(?:letter|glyph)\s+([Oo])\s+(?:(?:into|as)\s+)?(?:a\s+)?([a-z]+(?:-[a-z]+)*)-shaped\b/giu;
  for (const match of text.matchAll(unqualifiedShape)) if (available(match)) {
    add(makeCandidate({ glyphs: [], caseScope: 'ambiguous', targetText: match[1],
      operation: { type: 'replace-outline', parameters: { shape: match[2].toLowerCase() } }, sourceSpan: spanOf(text, match) }));
  }

  // Detect a construction request with no target. Keep it visible as
  // unresolved rather than guessing that it applies to all glyphs.
  const targetlessShape = /\b(?:make|use|replace|turn)\b[^.!?;\n]{0,40}?\b(heart|star|diamond)(?:-shaped|\s+shaped|\s+shape)?\b/giu;
  for (const match of text.matchAll(targetlessShape)) if (available(match)) {
    add(makeCandidate({ glyphs: [], caseScope: 'ambiguous', targetText: '',
      operation: { type: 'replace-outline', parameters: { shape: match[1].toLowerCase() } }, sourceSpan: spanOf(text, match) }));
  }

  candidates.sort((a, b) => a.sourceSpan.start - b.sourceSpan.start || a.sourceSpan.end - b.sourceSpan.end);
  candidates.forEach((item, index) => { item.id = `glyph-instruction-${index + 1}`; });
  const conflicts = resolveConflicts(candidates);
  return makeGlyphInstructionModel(candidates, conflicts);
}
