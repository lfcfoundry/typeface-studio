import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretBrief, interpretBriefLexical } from '../src/brief.js';
import { BENCHMARK } from '../src/benchmark-cases.js';

test('20 realistic benchmark briefs produce deterministic, source-grounded specifications', () => {
  for (const { brief } of BENCHMARK) {
    const a = interpretBrief(brief), b = interpretBrief(brief);
    assert.deepEqual(a, b, brief);
    assert.equal(a.source.brief, brief);
    for (const instruction of a.instructions) {
      const span = instruction.sourceSpan;
      assert.equal(brief.slice(span.start, span.end), span.text, `${brief} :: ${span.text}`);
      assert.ok(['supported', 'approximate', 'unsupported'].includes(instruction.capability));
    }
  }
});

test('usage context is separated from design parameters and incidental words stay silent', () => {
  const spec = interpretBrief('A font for screen headers that can scale well.');
  assert.deepEqual(spec.usageContext.map(x => x.value), ['screen', 'headers']);
  assert.equal(spec.instructions.length, 0);
  assert.equal(spec.resolvedParameters.system, 'geometric');
  assert.equal(spec.resolvedParameters.width, 1);
  assert.equal(spec.resolvedParameters.weight, 400);
});

test('a compound natural-language brief resolves to actual design parameters', () => {
  const spec = interpretBrief('A friendly humanist sans-serif with generous proportions, open apertures, slightly rounded terminals, and medium weight.');
  assert.equal(spec.resolvedParameters.system, 'humanist');
  assert.equal(spec.resolvedParameters.width, 1.24);
  assert.equal(spec.resolvedParameters.aperture, 0.27);
  assert.equal(spec.resolvedParameters.terminal, 'rounded');
  assert.equal(spec.resolvedParameters.weight, 500);
  assert.ok(spec.instructions.some(x => x.concept === 'character.friendly' && x.origin === 'inferred' && x.capability === 'approximate'));
  assert.ok(spec.instructions.every(x => x.sourceSpan.text));
});

test('negation and conflicting directions resolve deterministically', () => {
  const negated = interpretBrief('A geometric sans that is not too rounded and not especially wide.');
  assert.equal(negated.resolvedParameters.terminal, 'square');
  assert.equal(negated.resolvedParameters.width, 1);
  assert.equal(negated.conflicts.length, 0);

  const conflict = interpretBrief('Use both wide proportions and a condensed construction, with light strokes but a bold overall weight.');
  assert.equal(conflict.resolvedParameters.width, 0.76);
  assert.equal(conflict.resolvedParameters.weight, 700);
  assert.deepEqual(conflict.conflicts.map(x => x.parameter).sort(), ['weight', 'width']);

  const laterNegation = interpretBrief('wide, not wide');
  assert.equal(laterNegation.resolvedParameters.width, 1);
  assert.ok(laterNegation.conflicts.some(x => x.resolution === 'later-explicit-negation'));
});

test('unsupported and approximate requests remain visible without false parameter changes', () => {
  const spec = interpretBrief('A modern editorial serif with a severe, elegant, sharply cut feeling for screens.');
  assert.ok(spec.unsupported.some(x => x.concept === 'character.unsupported'));
  assert.ok(spec.usageContext.some(x => x.value === 'screens'));
  assert.equal(spec.resolvedParameters.width, 1);
  assert.equal(spec.resolvedParameters.weight, 400);

  const slab = interpretBrief('A slab serif for a technical manual.');
  assert.ok(slab.instructions.some(x => x.concept === 'classification.slab-serif' && x.capability === 'approximate'));
});

test('the lexical and Compromise front ends use the same first-party ontology rules', () => {
  for (const { brief } of BENCHMARK) {
    const nlp = interpretBrief(brief), lexical = interpretBriefLexical(brief);
    assert.deepEqual(nlp.instructions, lexical.instructions, brief);
    assert.deepEqual(nlp.resolvedParameters, lexical.resolvedParameters, brief);
    assert.deepEqual(nlp.conflicts, lexical.conflicts, brief);
  }
});

test('specific phrase grammar recognizes real aperture and anatomy requests', () => {
  const spec = interpretBrief('Open the apertures of e and a; keep counters generous and shorten the descenders.');
  assert.equal(spec.resolvedParameters.aperture, 0.27);
  assert.equal(spec.resolvedParameters.counterScale, 1.18);
  assert.ok(spec.unsupported.some(x => x.concept === 'aperture.glyph-specific'));
  assert.ok(spec.unsupported.some(x => x.concept === 'anatomy.unsupported'));
});
