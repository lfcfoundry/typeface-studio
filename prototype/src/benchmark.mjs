import { performance } from 'node:perf_hooks';
import { interpretPrompt } from '../../src/core/prompt.js';
import { interpretBrief, interpretBriefLexical } from './brief.js';
import { BENCHMARK } from './benchmark-cases.js';
import { GOLD, FORBIDDEN, EXPECT_CONFLICT } from './benchmark-gold.js';

function legacyConcepts(result) {
  const out = new Set();
  for (const d of result.decisions) {
    const label = d.concept.toLowerCase();
    if (label === 'sans serif') out.add('classification.sans-serif');
    else if (label === 'serif') out.add('classification.serif');
    else if (label === 'slab serif') out.add('classification.slab-serif');
    else if (label === 'geometric') out.add('construction.geometric');
    else if (label.includes('humanist')) out.add('construction.humanist');
    else if (label === 'grotesque') out.add('construction.grotesque');
    else if (/proportions|width/.test(d.category.toLowerCase())) out.add('proportion.width');
    else if (/weight/.test(d.category.toLowerCase())) out.add('weight.static');
    else if (/stroke/.test(d.category.toLowerCase())) {
      out.add('stroke.contrast');
      if (/thin strokes|thick strokes/.test(label)) out.add('weight.static');
    } else if (/x-height/.test(label)) out.add('proportion.x-height');
    else if (/capitals/.test(label)) out.add('proportion.cap-height');
    else if (/monospaced/.test(label)) out.add('spacing.monospaced');
    else if (/spacing/.test(d.category.toLowerCase())) out.add('spacing.generous');
    else if (/aperture/.test(label)) out.add('aperture.open');
    else if (/bracketed/.test(label)) out.add('serif.bracketed');
    else if (/specialized terminals/.test(label)) out.add('anatomy.unsupported');
    else if (/specific glyph anatomy/.test(label)) out.add('anatomy.unsupported');
    else if (/friendly|playful/.test(label)) out.add('character.friendly');
    else if (/rounded|circular/.test(label)) out.add('terminal.rounded');
    else if (/stylistic tone|display/.test(label)) out.add('character.unsupported');
  }
  return out;
}

function score(name, fn) {
  let tp = 0, fp = 0, fnCount = 0, forbiddenChanges = 0, conflictCases = 0;
  const rows = [];
  for (const test of BENCHMARK) {
    fn(test.brief);
    const samples = [];
    let result;
    for (let i = 0; i < 5; i++) {
      const started = performance.now();
      result = fn(test.brief);
      samples.push(performance.now() - started);
    }
    const elapsedMs = samples.sort((a,b)=>a-b)[2];
    const found = name === 'existing' ? legacyConcepts(result) : new Set(result.instructions.map(x => x.concept));
    const expected = new Set(GOLD[test.id] || []);
    const truePositive = [...found].filter(x => expected.has(x));
    const falsePositive = [...found].filter(x => !expected.has(x));
    const falseNegative = [...expected].filter(x => !found.has(x));
    tp += truePositive.length; fp += falsePositive.length; fnCount += falseNegative.length;
    const settings = name === 'existing' ? result.settings : result.resolvedParameters;
    const forbidden = (FORBIDDEN[test.id] || []).filter(param => {
      if (param === 'proportion.width') return settings.width !== 1;
      if (param === 'weight.static') return settings.weight !== 400;
      if (param === 'construction.geometric') return settings.system !== 'geometric' && settings.classification !== 'Geometric sans';
      return false;
    });
    forbiddenChanges += forbidden.length;
    const conflicts = result.conflicts || [];
    if (test.id in EXPECT_CONFLICT && conflicts.length >= EXPECT_CONFLICT[test.id].length) conflictCases++;
    rows.push({ id: test.id, tp: truePositive, fp: falsePositive, fn: falseNegative, forbidden, conflictCount: conflicts.length, elapsedMs: +elapsedMs.toFixed(3), parameters: settings });
  }
  return { summary: { cases: BENCHMARK.length, tp, fp, fn: fnCount, precision: +(tp / (tp + fp || 1)).toFixed(3), recall: +(tp / (tp + fnCount || 1)).toFixed(3), forbiddenParameterChanges: forbiddenChanges, conflictCasesDetected: conflictCases, medianParseMs: +rows.map(x => x.elapsedMs).sort((a,b)=>a-b)[Math.floor(rows.length / 2)].toFixed(3) }, rows };
}

const old = score('existing', interpretPrompt);
const lexical = score('lexical', interpretBriefLexical);
const current = score('prototype', interpretBrief);
const misses = (x) => x.rows.filter(r => r.fp.length || r.fn.length || r.forbidden.length).map(r => ({ id: r.id, fp: r.fp, fn: r.fn, forbidden: r.forbidden }));
console.log(JSON.stringify({
  benchmarkCases: BENCHMARK.length,
  goldAnnotation: 'Hand-authored concept labels in benchmark-gold.js; direction and geometry are separately asserted in tests.',
  existingInterpreter: old.summary,
  lexicalTokenizerPlusSameOntology: lexical.summary,
  compromisePlusOntology: current.summary,
  existingMismatches: misses(old),
  lexicalMismatches: misses(lexical),
  prototypeMismatches: misses(current),
  keyCaseParameters: current.rows.filter(x => [7,8,10,13,16,19].includes(x.id)).map(x => ({ id: x.id, parameters: x.parameters, conflicts: x.conflictCount, forbidden: x.forbidden }))
}, null, 2));
