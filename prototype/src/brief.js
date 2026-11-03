import nlp from 'compromise/two';
import { DOMAIN_RULES, PARAMETERS, USAGE_CONTEXTS, tokenizePhrase } from './ontology.js';
import { ENGINE_CAPABILITIES, SPEC_TYPE, SPEC_VERSION } from './spec.js';
import { interpretGlyphInstructions } from './glyph-instructions.js';

function languageTokens(brief) {
  const terms = nlp(brief).json().flatMap(sentence => sentence.terms || []);
  let cursor = 0;
  return terms.flatMap(term => {
    const raw = term.text || '';
    const index = brief.toLocaleLowerCase().indexOf(raw.toLocaleLowerCase(), cursor);
    const start = index < 0 ? cursor : index;
    const end = start + raw.length;
    cursor = Math.max(cursor, end);
    const normalized = tokenizePhrase(term.normal || raw);
    return normalized.map((normal, subIndex) => ({ raw: subIndex === 0 ? raw : normal, normal, start, end, tags: term.tags || [] }));
  }).filter(t => /[\p{L}\p{N}]/u.test(t.raw));
}

function lexicalTokens(brief) {
  const result = [];
  const words = /[\p{L}\p{N}]+(?:[-‐‑‒–—][\p{L}\p{N}]+)*/gu;
  for (const match of brief.matchAll(words)) {
    const parts = tokenizePhrase(match[0]);
    parts.forEach((normal, index) => result.push({ raw: index === 0 ? match[0] : normal, normal, start: match.index, end: match.index + match[0].length, tags: [] }));
  }
  return result;
}

function domainMatches(tokens, brief) {
  const all = [];
  for (let i = 0; i < tokens.length; i++) {
    const candidates = [];
    for (const rule of DOMAIN_RULES) {
      for (const phrase of rule.phrases) {
        const expected = tokenizePhrase(phrase);
        if (!expected.length || i + expected.length > tokens.length) continue;
        if (!expected.every((word, j) => tokens[i + j].normal === word)) continue;
        if (rule.concept === 'classification.serif' && (tokens[i - 1]?.normal === 'sans' || tokens[i - 1]?.normal === 'slab')) continue;
        if (rule.concept === 'character.friendly' && tokens.slice(i + 1, i + 4).some(t => t.normal === 'restrained')) continue;
        if (rule.concept === 'weight.static' && phrase === 'black' && !['weight', 'font', 'typeface', 'style'].includes(tokens[i + 1]?.normal) && !tokens.slice(Math.max(0, i - 2), i + 2).some(t => ['font', 'typeface'].includes(t.normal))) continue;
        candidates.push({ rule, phrase, length: expected.length });
      }
    }
    candidates.sort((a, b) => b.length - a.length || b.phrase.length - a.phrase.length);
    if (!candidates.length) continue;
    const { rule, length } = candidates[0];
    const previous = tokens.slice(Math.max(0, i - 3), i);
    const negator = [...previous].reverse().find(t => ['not', 'never', 'avoid', 'without', 'no'].includes(t.normal));
    const between = negator ? tokens.slice(tokens.indexOf(negator) + 1, i) : [];
    const clauseBreak = between.some(t => ['but', 'however', 'instead', 'although'].includes(t.normal));
    const negated = Boolean(negator && !clauseBreak && between.length <= 2);
    const start = tokens[i].start;
    const end = tokens[i + length - 1].end;
    all.push({ rule, start, end, sourceText: brief.slice(start, end), negated, tokenStart: i, tokenEnd: i + length });
    i += length - 1;
  }
  // Permit short function-word gaps in ordinary instructions while retaining
  // the exact source span. This is intentionally a tiny deterministic grammar,
  // not an unrestricted residual-word or semantic guessing mechanism.
  for (let i = 0; i < tokens.length; i++) {
    const open = ['open', 'widen', 'increase'];
    if (!open.includes(tokens[i].normal)) continue;
    let target = -1;
    for (let j = i + 1; j < Math.min(tokens.length, i + 5); j++) {
      if (['aperture', 'apertures'].includes(tokens[j].normal)) { target = j; break; }
      if (['counter', 'counters'].includes(tokens[j].normal)) { target = j; break; }
      if (['but', 'however', 'instead'].includes(tokens[j].normal)) break;
    }
    if (target < 0 || all.some(x => x.tokenStart === i && x.tokenEnd > target)) continue;
    const isCounter = tokens[target].normal.startsWith('counter');
    const rule = {
      concept: isCounter ? 'counter.open' : 'aperture.open',
      parameter: isCounter ? 'counterScale' : 'aperture',
      value: isCounter ? 1.18 : 0.27,
      capability: 'supported', origin: 'explicit',
      explanation: isCounter ? 'Enlarges the actual inner counter contours.' : 'Widens the generated open-form aperture geometry.'
    };
    all.push({ rule, start: tokens[i].start, end: tokens[target].end, sourceText: brief.slice(tokens[i].start, tokens[target].end), negated: false, tokenStart: i, tokenEnd: target + 1 });
  }
  for (let i = 0; i < tokens.length; i++) {
    if (!['counter', 'counters'].includes(tokens[i].normal)) continue;
    const adjective = ['generous', 'large', 'open'].includes(tokens[i + 1]?.normal) ? i + 1
      : ['generous', 'large', 'open'].includes(tokens[i - 1]?.normal) ? i - 1 : -1;
    if (adjective < 0 || all.some(x => x.tokenStart <= i && x.tokenEnd > i)) continue;
    const startToken = Math.min(i, adjective), endToken = Math.max(i, adjective);
    const rule = { concept: 'counter.open', parameter: 'counterScale', value: 1.18, capability: 'supported', origin: 'explicit', explanation: 'Enlarges the actual inner counter contours.' };
    all.push({ rule, start: tokens[startToken].start, end: tokens[endToken].end, sourceText: brief.slice(tokens[startToken].start, tokens[endToken].end), negated: false, tokenStart: startToken, tokenEnd: endToken + 1 });
  }
  const sourceSpecific = [
    { pattern: /\bapertures?\s+of\s+e\s+and\s+a\b/i, concept: 'aperture.glyph-specific', explanation: 'The geometric recipe can widen e, but it has no independently tunable aperture on its double-storey a. The humanist a is a different single-storey construction.' },
    { pattern: /\bshorten(?:ing)?\s+(?:the\s+)?descenders?\b/i, concept: 'anatomy.unsupported', explanation: 'Descender length is not an exposed design parameter in these ten-glyph recipes.' }
  ];
  for (const item of sourceSpecific) {
    const match = item.pattern.exec(brief);
    if (!match) continue;
    const start = match.index, end = start + match[0].length;
    const rule = { concept: item.concept, capability: 'unsupported', origin: 'explicit', explanation: item.explanation };
    all.push({ rule, start, end, sourceText: brief.slice(start, end), negated: false, tokenStart: tokens.findIndex(t => t.start >= start), tokenEnd: tokens.findIndex(t => t.end >= end) + 1 });
  }
  all.sort((a, b) => a.tokenStart - b.tokenStart || b.tokenEnd - a.tokenEnd);
  return all;
}

function valueEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function negativeValue(item, settings) {
  const { rule } = item;
  if (rule.parameter === 'terminal' && rule.value === 'rounded') return 'square';
  if (rule.parameter === 'terminal' && rule.value === 'square') return 'rounded';
  if (rule.parameter === 'family' && rule.value === 'serif') return 'sans';
  if (rule.parameter === 'monospaced') return false;
  if (rule.parameter === 'aperture') return rule.value > 0.2 ? 0.1 : 0.26;
  if (rule.parameter === 'spacing' || rule.parameter === 'width' || rule.parameter === 'contrast' || rule.parameter === 'weight' || rule.parameter === 'counterScale') return settings[rule.parameter];
  return undefined;
}

function collectUsageContexts(tokens, brief) {
  const contexts = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const term of USAGE_CONTEXTS) {
      const words = tokenizePhrase(term);
      if (words.every((word, j) => tokens[i + j]?.normal === word)) {
        const start = tokens[i].start, end = tokens[i + words.length - 1].end;
        contexts.push({ kind: 'usage', value: term, sourceSpan: { start, end, text: brief.slice(start, end) } });
      }
    }
  }
  return contexts;
}

function capability(rule) {
  if (rule.capability) return rule.capability;
  const key = rule.concept;
  if (ENGINE_CAPABILITIES.supported.includes(key)) return 'supported';
  if (ENGINE_CAPABILITIES.approximate.includes(key)) return 'approximate';
  if (ENGINE_CAPABILITIES.unsupported.includes(key)) return 'unsupported';
  return 'unsupported';
}

export function interpretBrief(brief, base = PARAMETERS) {
  return interpret(brief, base, languageTokens, { name: 'compromise/two', version: '14.19.0' });
}

export function interpretBriefLexical(brief, base = PARAMETERS) {
  return interpret(brief, base, lexicalTokens, { name: 'first-party-tokenizer', version: '1' });
}

// Adapter seam used to qualify NLP tokenizers against the exact same first-party
// typography ontology and resolver. Production continues to use Compromise.
export function interpretBriefWithTokenizer(brief, tokenize, parser = {}, base = PARAMETERS) {
  if (typeof tokenize !== 'function') throw new TypeError('A tokenizer function is required.');
  return interpret(brief, base, tokenize, { name: parser.name || 'custom-tokenizer', version: parser.version || '1' });
}

function interpret(brief, base, tokenize, parser) {
  const original = String(brief || '').trim();
  const tokens = tokenize(original);
  const matches = domainMatches(tokens, original);
  const settings = { ...PARAMETERS, ...base };
  const instructions = matches.map((item, index) => {
    const rule = item.rule;
    const origin = rule.origin || 'explicit';
    const val = item.negated ? negativeValue(item, settings) : rule.value;
    return {
      id: `instruction-${index + 1}`, concept: rule.concept, value: rule.value ?? true,
      resolvedValue: val, polarity: item.negated ? 'negative' : 'positive',
      sourceSpan: { start: item.start, end: item.end, text: item.sourceText },
      origin, certainty: rule.confidence ?? (origin === 'explicit' ? 0.97 : 0.72),
      capability: capability(rule), explanation: rule.explanation,
      parameters: rule.parameter ? [rule.parameter] : [],
      negatedBy: item.negated ? negatorText(tokens, item.tokenStart) : null
    };
  });

  const positiveGroups = new Map();
  for (let i = 0; i < matches.length; i++) {
    const { rule } = matches[i];
    if (!rule.parameter || matches[i].negated) continue;
    const group = positiveGroups.get(rule.parameter) || [];
    group.push({ match: matches[i], instruction: instructions[i], value: rule.value });
    positiveGroups.set(rule.parameter, group);
  }
  const conflicts = [];
  const selected = new Map();
  for (const [parameter, group] of positiveGroups) {
    const distinct = [...new Set(group.map(x => JSON.stringify(x.value)))];
    const explicit = group.filter(x => x.instruction.origin === 'explicit');
    const choices = explicit.length ? explicit : group;
    const winner = choices[choices.length - 1];
    selected.set(parameter, winner);
    if (distinct.length > 1) {
      conflicts.push({ parameter, instructions: group.map(x => x.instruction.id), sourceTexts: group.map(x => x.match.sourceText), resolution: 'last-explicit-direction', selected: winner.value });
    }
  }
  for (const [parameter, winner] of selected) settings[parameter] = winner.value;
  // A later explicit negation supersedes an earlier positive request. A later
  // positive request still wins over an earlier negation.
  for (const [parameter, group] of positiveGroups) {
    const latest = [...matches].reverse().find(item => item.rule.parameter === parameter);
    if (latest?.negated && latest.tokenStart > group.at(-1).match.tokenStart) {
      const value = negativeValue(latest, PARAMETERS);
      if (value !== undefined) settings[parameter] = value;
      selected.delete(parameter);
      conflicts.push({ parameter, instructions: group.map(x => x.instruction.id), sourceTexts: [...group.map(x => x.match.sourceText), latest.sourceText], resolution: 'later-explicit-negation', selected: value });
    }
  }
  const negativeSelections = new Map();
  for (let i = 0; i < matches.length; i++) {
    if (!matches[i].negated || !matches[i].rule.parameter || selected.has(matches[i].rule.parameter)) continue;
    negativeSelections.set(matches[i].rule.parameter, negativeValue(matches[i], settings));
  }
  for (const [parameter, value] of negativeSelections) if (value !== undefined) settings[parameter] = value;

  const setFamily = selected.get('family');
  if (setFamily?.value === 'serif') settings.system = 'serif';
  if (settings.system === 'serif') settings.family = 'serif';
  if (settings.system !== 'serif' && !setFamily) settings.family = 'sans';
  for (const item of matches) {
    const secondary = item.rule.secondary;
    if (secondary && !item.negated) Object.assign(settings, secondary);
  }
  if (selected.has('serifBracket')) { settings.family = 'serif'; settings.system = 'serif'; }
  if (settings.width < 1) settings.widthClass = 'condensed';
  else if (settings.width > 1) settings.widthClass = 'wide';
  else settings.widthClass = 'normal';

  const unsupported = instructions.filter(x => x.capability === 'unsupported');
  const approximations = instructions.filter(x => x.capability === 'approximate');
  const used = new Set(matches.flatMap(x => [x.rule.parameter, ...Object.keys(x.rule.secondary || {})].filter(Boolean)));
  const defaults = Object.keys(PARAMETERS).filter(k => !used.has(k)).map(parameter => ({ parameter, value: settings[parameter], reason: 'The brief did not specify this design dimension.' }));
  const explicitParameters = Object.fromEntries([...selected].map(([key, item]) => [key, item.value]));
  for (const [key, value] of negativeSelections) if (value !== undefined) explicitParameters[key] = value;
  for (const item of matches) if (!item.negated && item.rule.secondary) Object.assign(explicitParameters, item.rule.secondary);
  if (settings.system === 'serif') explicitParameters.system = 'serif';
  if (settings.family === 'serif') explicitParameters.family = 'serif';
  if (matches.some(x => x.rule.concept === 'construction.humanist') && matches.some(x => x.rule.concept === 'classification.serif')) {
    const humanist = instructions.find(x => x.concept === 'construction.humanist');
    if (humanist) { humanist.capability = 'unsupported'; humanist.explanation = 'The prototype has humanist-inspired sans recipes, but not a humanist serif construction system.'; }
  }
  const explicitUnsupported = instructions.filter(x => x.capability === 'unsupported');
  const glyphInstructions = interpretGlyphInstructions(original);
  const spec = {
    type: SPEC_TYPE, version: SPEC_VERSION,
    source: { brief: original, language: 'en' },
    parser: { ...parser, mode: 'deterministic-ontology-v1' },
    ontologyVersion: 'typeface-ontology-1',
    instructions, inferred: instructions.filter(x => x.origin === 'inferred'),
    conflicts, unsupported: explicitUnsupported, approximations: instructions.filter(x => x.capability === 'approximate'), defaults,
    glyphInstructions,
    usageContext: collectUsageContexts(tokens, original),
    capabilitySnapshot: ENGINE_CAPABILITIES,
    resolvedParameters: settings, explicitParameters
  };
  return spec;
}

function negatorText(tokens, index) {
  const prior = tokens.slice(Math.max(0, index - 3), index).reverse();
  const item = prior.find(t => ['not', 'never', 'avoid', 'without', 'no'].includes(t.normal));
  return item?.raw || null;
}
