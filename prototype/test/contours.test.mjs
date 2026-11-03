import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretBrief } from '../src/brief.js';
import { generateContourFamily, RECIPE_LIBRARY } from '../src/recipes.js';
import { contourBounds, validateGlyph } from '../src/contours.js';

const getGlyph = (family, character) => Object.values(family.glyphs).find(g => g.character === character);
const geometry = glyph => JSON.stringify(glyph.contours.map(c => c.points.map(({ x, y, on }) => [x, y, on])));
const make = (brief, system = 'geometric', style = 'Regular') => generateContourFamily(interpretBrief(brief), { system, style });
const errors = family => family.glyphOrder.flatMap(id => {
  const g = family.glyphs[id];
  return validateGlyph({ ...g, advanceWidth: g.metrics.advanceWidth, rightSideBearing: g.metrics.rightSideBearing });
});

test('each construction system has ten stable recipe glyphs and valid closed contours', () => {
  const expected = ['A', 'B', 'E', 'H', 'O', 'a', 'e', 'n', 'o', 'g'];
  for (const system of ['geometric', 'humanist', 'serif']) {
    const family = make('A medium-weight face with open counters', system);
    assert.equal(family.glyphOrder.length, 10);
    assert.deepEqual(family.glyphOrder.map(id => family.glyphs[id].character), expected);
    assert.deepEqual(errors(family), [], system);
    assert.deepEqual(Object.keys(RECIPE_LIBRARY[system]), expected);
    const pointIds = new Set();
    for (const id of family.glyphOrder) for (const contour of family.glyphs[id].contours) {
      assert.ok(contour.closed);
      assert.ok(contour.points.length >= 4);
      assert.deepEqual(contour.segments[0].from, contour.start, `${contour.id} starts consistently`);
      for (let i = 0; i + 1 < contour.segments.length; i++) {
        assert.deepEqual(contour.segments[i].to, contour.segments[i + 1].from, `${contour.id} segment continuity`);
      }
      for (const point of contour.points) {
        assert.ok(point.id && !pointIds.has(point.id), `stable point id collision: ${point.id}`);
        pointIds.add(point.id);
        assert.ok(Number.isInteger(point.x) && Number.isInteger(point.y));
      }
    }
  }
});

test('the three construction systems have distinct recipes and anatomy', () => {
  const spec = interpretBrief('A typeface');
  assert.deepEqual(generateContourFamily(spec, { system: 'geometric' }), generateContourFamily(spec, { system: 'geometric' }));
  const geo = generateContourFamily(spec, { system: 'geometric' });
  const hum = generateContourFamily(spec, { system: 'humanist' });
  const serif = generateContourFamily(spec, { system: 'serif' });
  for (const ch of ['A', 'B', 'E', 'H', 'O', 'a', 'e', 'n', 'o', 'g']) {
    assert.notEqual(getGlyph(geo, ch).recipeId, getGlyph(hum, ch).recipeId, `humanist ${ch} recipe`);
    assert.notEqual(getGlyph(geo, ch).recipeId, getGlyph(serif, ch).recipeId, `serif ${ch} recipe`);
  }
  assert.notEqual(geometry(getGlyph(geo, 'a')), geometry(getGlyph(hum, 'a')));
  assert.notEqual(geometry(getGlyph(hum, 'g')), geometry(getGlyph(serif, 'g')));
  assert.ok(serif.glyphs.u0041.components.some(x => x.componentId === 'serif.bracket-transition'));
  assert.ok(getGlyph(serif, 'A').contours.some(c => c.segments.some(s => s.type === 'quadratic')));
  assert.ok(getGlyph(geo, 'O').contours.some(c => c.role === 'counter'));
  assert.ok(getGlyph(geo, 'o').contours.some(c => c.role === 'counter'));
});

test('condensed and wide instructions change recipe geometry and advance metrics', () => {
  const normal = make('A geometric sans-serif'), condensed = make('A condensed geometric sans-serif'), wide = make('A wide geometric sans-serif');
  const n = getGlyph(normal, 'A'), c = getGlyph(condensed, 'A'), w = getGlyph(wide, 'A');
  assert.ok(c.bounds.xMax - c.bounds.xMin < n.bounds.xMax - n.bounds.xMin);
  assert.ok(c.metrics.advanceWidth < n.metrics.advanceWidth);
  assert.ok(w.bounds.xMax - w.bounds.xMin > n.bounds.xMax - n.bounds.xMin);
  assert.ok(w.metrics.advanceWidth > n.metrics.advanceWidth);
});

test('stroke contrast and rounded terminals change actual contours', () => {
  const base = make('A geometric sans-serif'), contrasted = make('A high-contrast geometric sans-serif'), rounded = make('A rounded geometric sans-serif');
  const bar = family => getGlyph(family, 'H').contours.find(c => c.id.endsWith('crossbar'));
  const barHeight = c => { const b = contourBounds([c]); return b.yMax - b.yMin; };
  assert.ok(barHeight(bar(contrasted)) < barHeight(bar(base)));
  assert.notEqual(geometry(getGlyph(rounded, 'H')), geometry(getGlyph(base, 'H')));
  assert.ok(getGlyph(rounded, 'H').contours.some(c => c.segments.some(s => s.type === 'quadratic')));
});

test('open apertures and generous counters alter different outline geometry', () => {
  const base = make('A geometric sans-serif'), open = make('A geometric sans-serif with open apertures'), counters = make('A geometric sans-serif with generous counters');
  assert.notEqual(geometry(getGlyph(open, 'e')), geometry(getGlyph(base, 'e')));
  const counter = family => getGlyph(family, 'O').contours.find(c => c.role === 'counter');
  const width = c => { const b = contourBounds([c]); return b.xMax - b.xMin; };
  assert.ok(width(counter(counters)) > width(counter(base)));
});

test('spacing, monospacing, weight and serif requests affect metrics or contours', () => {
  const base = make('A geometric sans-serif'), spaced = make('A geometric sans-serif with generous spacing'), mono = make('A monospaced geometric sans-serif');
  assert.ok(getGlyph(spaced, 'A').metrics.advanceWidth > getGlyph(base, 'A').metrics.advanceWidth);
  assert.equal(new Set(mono.glyphOrder.map(id => mono.glyphs[id].metrics.advanceWidth)).size, 1);
  const regular = make('A geometric sans-serif'), bold = make('A geometric sans-serif', 'geometric', 'Bold');
  assert.notEqual(geometry(getGlyph(regular, 'O')), geometry(getGlyph(bold, 'O')));
  const serif = make('An editorial serif with bracketed serifs', 'serif');
  assert.ok(serif.glyphs.u0042.components.some(x => x.componentId === 'serif.bracket-transition'));
  assert.notEqual(geometry(getGlyph(base, 'A')), geometry(getGlyph(serif, 'A')));
});

test('combined extreme-but-supported designs remain valid across systems and weights', () => {
  const spec = interpretBrief('A condensed, heavy, high-contrast face with open apertures and rounded terminals.');
  for (const system of ['geometric', 'humanist', 'serif']) for (const style of ['Regular', 'Bold']) {
    const family = generateContourFamily(spec, { system, style });
    assert.deepEqual(errors(family), [], `${system} ${style}`);
  }
});
