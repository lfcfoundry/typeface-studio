// Brief reader: the round 6 composer (negation, degrees, "but" clauses, comparatives, "like <font>") sits in front of
// the word rules and the mood layer. Where the composer made a decision, its choice wins; everywhere else the rules
// and mood layer stand. Every decision is listed with the words that caused it.
import { read } from '../engine/reader.js';
import { interpretPrompt } from './prompt.js';
import { DEFAULT_PARAMS } from './model.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LABEL = { weight: 'stroke thickness', width: 'width', contrast: 'stroke contrast', xh: 'x-height', spacing: 'spacing', serif: 'serif structures', rounded: 'terminals', mono: 'fixed-width metrics', reference: 'starting shape' };
const KEYS = { weight: ['stem'], width: ['width'], contrast: ['contrast'], xh: ['xHeight'], spacing: ['spacing'], serif: ['serifs'], rounded: ['terminals'], mono: ['monospaced'] };

// app settings that differ from the defaults, as pen settings (used for the words the composer leaves over)
function penFromApp(s) {
  const o = {};
  if (s.stem !== DEFAULT_PARAMS.stem) o.stem = Math.round(40 + (clamp(s.stem, 0.18, 0.86) - 0.18) / 0.68 * 120);
  if (s.width !== DEFAULT_PARAMS.width) o.width = s.width;
  if (s.contrast !== DEFAULT_PARAMS.contrast) o.contrast = clamp(s.contrast, 0, 0.8);
  if (s.xHeight !== DEFAULT_PARAMS.xHeight) o.xHeight = Math.round(700 * s.xHeight);
  if (s.spacing !== DEFAULT_PARAMS.spacing) o.spacing = s.spacing;
  if (s.serifs !== DEFAULT_PARAMS.serifs) { o.slab = !!s.serifs; o.serifModels = !!s.serifs; }
  if (s.terminals !== DEFAULT_PARAMS.terminals) o.caps = s.terminals === 'Rounded' ? 'round' : 'butt';
  if (s.monospaced !== DEFAULT_PARAMS.monospaced) o.mono = !!s.monospaced;
  return o;
}
const appFromPen = p => ({
  stem: +clamp(0.18 + (p.stem - 40) / 120 * 0.68, 0.18, 0.86).toFixed(2), width: +clamp(p.width, 0.65, 1.4).toFixed(2), contrast: +clamp(p.contrast, 0.04, 0.68).toFixed(2),
  xHeight: +clamp(p.xHeight / 700, 0.62, 0.82).toFixed(2), spacing: +clamp(p.spacing, 0.82, 1.22).toFixed(2), serifs: !!p.slab, terminals: p.caps === 'round' ? 'Rounded' : 'Square', monospaced: !!p.mono,
});

export function interpretBrief(prompt, base = DEFAULT_PARAMS, opts = {}) {
  const app = interpretPrompt(prompt, base, opts);
  const rd = read(prompt, { rest: text => penFromApp(interpretPrompt(text, base, opts).settings) });
  const decided = new Set(rd.why.map(w => w.axis));
  if (!decided.size) return app;
  const fromPen = appFromPen(rd.settings), settings = { ...app.settings }, changes = app.changes.slice();
  const keys = rd.ref ? Object.keys(fromPen) : [...decided].flatMap(a => KEYS[a] || []); // a referenced font sets every axis; a clause sets only its own
  for (const k of keys) settings[k] = fromPen[k];
  if (keys.includes('serifs')) { settings.classification = settings.serifs ? (settings.monospaced ? 'Monospace serif' : 'Serif') : (settings.monospaced ? 'Monospace sans' : 'Geometric sans'); settings.serifStyle = settings.serifs ? 'Simple' : 'None'; }
  const NAMES = { stem: ['stroke thickness', 'weight'], width: ['width'], contrast: ['stroke contrast'], xHeight: ['x-height'], spacing: ['spacing'], serifs: ['serif structures', 'serif construction', 'classification'], terminals: ['terminals', 'corner softness'], monospaced: ['fixed-width metrics'] };
  const drop = new Set(keys.flatMap(k => NAMES[k] || [])); // the composer's choice replaces the rules' note for the same setting
  const kept = changes.filter(c => !drop.has(String(c.parameter).toLowerCase()));
  for (const w of rd.why) kept.push({ parameter: LABEL[w.axis] || w.axis, value: w.axis === 'reference' ? `like ${w.value}` : '', because: `Read from your words: ${w.because}.` });
  const chips = app.chips.slice();
  return { ...app, settings, changes: kept, chips, composer: rd.why, reference: rd.ref || null };
}
