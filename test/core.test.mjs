import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject,serializeProject,deserializeProject,validateProject } from '../src/core/model.js';
import { interpretPrompt } from '../src/core/prompt.js';
import { interpretBrief } from '../src/core/brief.js';
import { generateFamily,PRINTABLE_ASCII,validateGlyph } from '../src/core/generator.js';
import { editGlyphPoint,editMetrics,restoreGenerated } from '../src/core/editor.js';
import { buildFont } from '../src/core/font-export.js';
import { saveProject,loadLatestProject } from '../src/core/persistence.js';
import { parseFont } from 'fontsketch/core';
import { DEFAULT_PARAMS } from '../src/core/model.js';
import { initMood } from '../src/core/mood.js';
await initMood();

function generated(prompt='A rounded geometric sans with wide proportions'){const p=createProject({family:'Test Foundry',prompt});p.design={...p.design,...interpretPrompt(prompt).settings};return generateFamily(p);}

test('project schema round-trips and rejects malformed imports',()=>{const p=generated();const text=serializeProject(p);assert.deepEqual(validateProject(deserializeProject(text)),[]);assert.throws(()=>deserializeProject('{broken'),/valid project JSON/);assert.match(validateProject({...p,schemaVersion:99})[0],/Unsupported project version/);});
test('prompt interpretation is deterministic and does not classify incidental words as unknown',()=>{const text='A geometric sans-serif for screen use that can scale well in headers.';const a=interpretPrompt(text);const b=interpretPrompt(text);assert.deepEqual(a,b);assert.deepEqual(a.unknown,[]);assert.equal(a.notice,'');assert.ok(a.recognizedTerms.some(x=>x.includes('geometric')));assert.ok(a.recognizedTerms.includes('sans-serif'));assert.ok(!a.recognizedTerms.some(x=>['screen','can','scale','well','headers'].includes(x)));});
test('short natural-language briefs map to real shared parameters',()=>{const p=interpretPrompt('A friendly rounded, condensed sans for small screens.');assert.equal(p.settings.classification,'Geometric sans');assert.equal(p.settings.width,.72);assert.equal(p.settings.roundness,.78);assert.equal(p.settings.terminals,'Rounded');assert.ok(p.changes.some(x=>x.parameter==='width'));assert.ok(p.changes.some(x=>x.parameter==='corner softness'));});
test('detailed editorial description reports implemented and unsupported instructions separately',()=>{const p=interpretPrompt('An elegant editorial serif with high contrast, generous proportions, open counters, refined bracketed serifs, and relaxed spacing.');assert.equal(p.settings.serifs,true);assert.equal(p.settings.contrast,.62);assert.equal(p.settings.width,1.24);assert.equal(p.settings.spacing,1.22);assert.ok(p.approximations.some(x=>x.concept==='Serif'));assert.ok(p.approximations.some(x=>x.concept==='Counter / aperture shape'));assert.ok(p.unsupported.some(x=>x.concept==='Specialized terminals / bracketed serifs'));assert.ok(p.unsupported.some(x=>x.concept==='Stylistic tone'));});
test('geometric sans description resolves proportions, construction and stroke vocabulary',()=>{const p=interpretPrompt('A geometric sans with circular forms, wide proportions, low-contrast strokes, and generous spacing.');assert.equal(p.settings.classification,'Geometric sans');assert.equal(p.settings.character,'Geometric');assert.equal(p.settings.width,1.24);assert.equal(p.settings.contrast,.04);assert.equal(p.settings.spacing,1.22);assert.equal(p.settings.roundness,.78);});
test('humanist brief is recognized but explicitly not represented as humanist glyph construction',()=>{const p=interpretPrompt('A warm humanist sans with open apertures, calligraphic stress, and angled terminals.');assert.ok(p.unsupported.some(x=>x.concept==='Humanist / organic construction'));assert.ok(p.unsupported.some(x=>x.concept==='Specialized terminals / bracketed serifs'));assert.equal(p.settings.classification,'Geometric sans');assert.equal(p.settings.character,'Geometric');assert.equal(p.settings.serifs,false);});
test('condensed display brief changes width and clearly labels display as an approximation',()=>{const p=interpretPrompt('A condensed display typeface with heavy stems for headlines.');assert.equal(p.settings.width,.72);assert.equal(p.settings.stem,.68);assert.ok(p.approximations.some(x=>x.concept==='Display / heading use'));assert.ok(p.changes.some(x=>x.parameter==='width'));});
test('high-contrast serif brief selects real outline construction settings',()=>{const p=interpretPrompt('A high-contrast serif typeface with refined bracketed serifs.');assert.equal(p.settings.serifs,true);assert.equal(p.settings.serifStyle,'Simple');assert.equal(p.settings.contrast,.62);assert.ok(p.unsupported.some(x=>x.concept==='Specialized terminals / bracketed serifs'));});
test('vague briefs leave unsupported dimensions at defaults without spurious word warnings',()=>{const p=interpretPrompt('A thoughtful typeface that feels calm and balanced for all kinds of writing.');assert.deepEqual(p.unknown,[]);assert.equal(p.notice,'');assert.ok(p.defaults.length>=9);assert.deepEqual(p.unknown,[]);});
test('ordinary words such as screen, can, scale, well, and header are not design errors',()=>{const p=interpretPrompt('A typeface for the screen that can scale well and fit a header.');assert.deepEqual(p.unknown,[]);assert.equal(p.notice,'');assert.equal(p.decisions.length,0);assert.ok(p.defaults.length>0);});
test('contradictory directions are reported and the last explicit direction wins',()=>{const p=interpretPrompt('A wide but condensed sans with rounded, then angular terminals.');assert.equal(p.settings.width,.72);assert.equal(p.settings.terminals,'Square');assert.equal(p.settings.roundness,.04);assert.ok(p.conflicts.some(x=>x.key==='width'));assert.ok(p.conflicts.some(x=>x.key==='roundness'));});
test('negated descriptors are not applied as positive instructions',()=>{const p=interpretPrompt('Not too wide, not rounded, and without humanist construction.');assert.equal(p.settings.width,1);assert.equal(p.settings.roundness,.16);assert.equal(p.settings.terminals,'Square');assert.equal(p.unsupported.length,0);});
test('weight vocabulary controls stroke thickness and character mappings stay explicit',()=>{const thin=interpretPrompt('A thin monoline sans');const semibold=interpretPrompt('A semibold geometric sans');const black=interpretPrompt('A black weight typeface');assert.equal(thin.settings.stem,.24);assert.equal(thin.settings.contrast,.04);assert.equal(semibold.settings.stem,.57);assert.equal(black.settings.stem,.8);const modern=interpretPrompt('A modern typeface');assert.ok(modern.unsupported.some(x=>x.concept==='Stylistic tone'));});
test('generator changes actual width, weight, contrast, corners, spacing, serifs, and fixed-pitch metrics',()=>{const base=generated('A geometric sans'),narrow=generated('A condensed sans'),thin=generated('A thin sans'),heavy=generated('A heavy sans'),contrast=generated('A high-contrast sans'),rounded=generated('A rounded sans'),open=generated('A sans with open spacing'),serif=generated('A slab serif'),mono=generated('A monospaced sans');const bounds=g=>{const pts=g.contours.flat();return[Math.min(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.y))];};assert.ok(bounds(narrow.glyphs.u0041)[1]-bounds(narrow.glyphs.u0041)[0]<bounds(base.glyphs.u0041)[1]-bounds(base.glyphs.u0041)[0]);assert.ok(narrow.glyphs.u0041.advanceWidth<base.glyphs.u0041.advanceWidth);assert.notDeepEqual(heavy.glyphs.u0048.contours,thin.glyphs.u0048.contours);assert.ok(heavy.glyphs.u0048.advanceWidth<thin.glyphs.u0048.advanceWidth,'bold letters are spaced tighter, as in real fonts');assert.notDeepEqual(contrast.glyphs.u004f.contours,base.glyphs.u004f.contours);assert.notDeepEqual(rounded.glyphs.u004f.contours,base.glyphs.u004f.contours);assert.ok(open.glyphs.u0041.advanceWidth>base.glyphs.u0041.advanceWidth);assert.notDeepEqual(serif.glyphs.u0048.contours,base.glyphs.u0048.contours);const advances=mono.glyphOrder.filter(id=>mono.glyphs[id].unicode!==null&&mono.glyphs[id].unicode<=126).map(id=>mono.glyphs[id].advanceWidth);assert.equal(new Set(advances).size,1);for(const id of serif.glyphOrder)assert.deepEqual(validateGlyph(serif.glyphs[id]),[]);});
test('exported TTF bytes preserve interpreted width, weight, contrast, serif contours, and monospaced advances',()=>{const base=buildFont(generated('A geometric sans')),narrow=buildFont(generated('A condensed sans')),thin=buildFont(generated('A thin sans')),heavy=buildFont(generated('A heavy sans')),contrast=buildFont(generated('A high-contrast sans')),serif=buildFont(generated('A high-contrast serif')),mono=buildFont(generated('A monospaced sans'));const parsedBase=parseFont(base.bytes),parsedNarrow=parseFont(narrow.bytes),parsedThin=parseFont(thin.bytes),parsedHeavy=parseFont(heavy.bytes),parsedContrast=parseFont(contrast.bytes),parsedSerif=parseFont(serif.bytes),parsedMono=parseFont(mono.bytes);assert.ok(parsedNarrow.glyphs.A.advanceWidth<parsedBase.glyphs.A.advanceWidth);assert.notDeepEqual(parsedNarrow.glyphs.A.contours,parsedBase.glyphs.A.contours);assert.ok(heavy.bytes.length>thin.bytes.length||parsedHeavy.glyphs.A.advanceWidth>parsedThin.glyphs.A.advanceWidth);assert.notDeepEqual(parsedContrast.glyphs.O.contours,parsedBase.glyphs.O.contours);assert.notDeepEqual(parsedSerif.glyphs.H.contours,parsedBase.glyphs.H.contours);assert.notDeepEqual(parsedSerif.glyphs.O.contours,parsedBase.glyphs.O.contours);const advances=Object.values(parsedMono.glyphs).filter(g=>g.unicodes.some(cp=>cp>=32&&cp<=126)).map(g=>g.advanceWidth);assert.equal(new Set(advances).size,1);});
test('generator covers printable ASCII and gives deterministic geometry',()=>{const a=generated(),b=generated();assert.equal(a.glyphOrder.length,98);assert.equal(a.glyphOrder[0],'notdef');assert.equal(a.glyphOrder.filter(id=>a.glyphs[id].unicode>=32&&a.glyphs[id].unicode<=126).length,95);assert.deepEqual(a.glyphs.u0041.contours,b.glyphs.u0041.contours);assert.equal(PRINTABLE_ASCII.length,95);for(const id of a.glyphOrder)assert.deepEqual(validateGlyph(a.glyphs[id]),[]);});
test('manual outline and metric edits survive generation and can be restored',()=>{const p=generated(),old=p.glyphs.u0041;const point=old.contours[0][0];let edited=editGlyphPoint(old,0,0,point.x+5,point.y);edited=editMetrics(edited,{advanceWidth:edited.advanceWidth+10});p.glyphs.u0041=edited;generateFamily(p);assert.equal(p.glyphs.u0041.manualEdited,true);assert.equal(p.glyphs.u0041.advanceWidth,edited.advanceWidth);assert.equal(restoreGenerated(p.glyphs.u0041).manualEdited,false);});
test('side-bearing controls change actual outline bounds and advance metrics',()=>{const p=generated(),g=p.glyphs.u0041,xs=g.contours.flat().map(p=>p.x),min=Math.min(...xs),max=Math.max(...xs);const moved=editMetrics(g,{leftSideBearing:min+12});assert.equal(Math.min(...moved.contours.flat().map(p=>p.x)),min+12);const spaced=editMetrics(g,{rightSideBearing:g.rightSideBearing+18});assert.equal(spaced.advanceWidth,g.advanceWidth+18);assert.equal(spaced.rightSideBearing,g.rightSideBearing+18);assert.equal(restoreGenerated(spaced).advanceWidth,g.generatedAdvanceWidth);});
test('IndexedDB persistence adapter saves and restores the latest project',async()=>{const original=globalThis.indexedDB,rows=new Map();globalThis.indexedDB={open(){const req={};queueMicrotask(()=>{const db={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},transaction(){const tx={objectStore(){return{put(v){rows.set(v.id,structuredClone(v));queueMicrotask(()=>tx.oncomplete?.());},getAll(){const r={};queueMicrotask(()=>{r.result=[...rows.values()];r.onsuccess?.();});return r;}};}};return tx;}};req.result=db;req.onupgradeneeded?.();req.onsuccess?.();});return req;}};try{const first=generated();await saveProject(first);const restored=await loadLatestProject();assert.equal(restored.metadata.family,'Test Foundry');assert.equal(restored.glyphs.u0041.unicode,65);}finally{globalThis.indexedDB=original;}});
test('Regular and Bold compile to distinct self-parsing TrueType fonts',()=>{const p=generated();for(const style of ['Regular','Bold']){const out=buildFont(p,style);assert.equal(out.bytes[0],0);assert.equal(out.bytes[1],1);assert.equal(out.checksumsVerified,true);const parsed=parseFont(out.bytes);assert.equal(parsed.meta.family,'Test Foundry');assert.equal(parsed.meta.style,style);assert.equal(Object.keys(parsed.glyphs).length,98);assert.deepEqual(parsed.glyphs.A.unicodes,[65]);assert.ok(parsed.glyphs.A.contours.length>0);assert.equal(parsed.glyphs.space.contours.length,0);}});
test('mood layer fills only settings the explicit words left alone and marks each guess inferred',()=>{
  const p=interpretPrompt('An elegant wedding invitation typeface');
  assert.ok(p.changes.some(c=>c.inferred),'mood words should change something');
  assert.ok(p.changes.filter(c=>c.inferred).every(c=>/Guessed/.test(c.because)));
  const e=interpretPrompt('A condensed elegant wedding invitation typeface');
  assert.equal(e.settings.width,.72,'explicit condensed beats the mood layer');
  assert.ok(!e.changes.some(c=>c.inferred&&c.parameter==='Width'));
});

test('brief reader: negation, degree words, but-clauses and font references decide settings with reasons',()=>{
  const heavy=interpretBrief('A heavy poster font');const limited=interpretBrief('Not too heavy, with serifs');
  assert.ok(limited.settings.stem<heavy.settings.stem);assert.equal(limited.settings.serifs,true);
  assert.ok(limited.changes.some(c=>/Read from your words/.test(c.because)));
  const cond=interpretBrief('Condensed but not too tight');assert.ok(cond.settings.width<1);
  const ref=interpretBrief('Like Futura but a bit bolder');assert.equal(ref.reference,'jost');assert.equal(ref.settings.serifs,false);
  const plain=interpretBrief('A thoughtful typeface for all kinds of writing');assert.deepEqual(plain.composer??[],[]);
});
test('brief reader maps openness, squareness and stress words to the new sliders',()=>{
  const sq=interpretBrief('A squarish techno font');assert.ok(sq.settings.squareness>2);
  const op=interpretBrief('Open letterforms');assert.ok(op.settings.openness>0.3);
  const st=interpretBrief('Calligraphic with tilted stress');assert.ok(st.settings.stress>0);
});

test('Try another picks a different set of reference fonts', async () => {
  const { setVariant } = await import('../src/core/mood.js');
  await initMood();
  setVariant(0); const a = interpretPrompt('a warm friendly storybook font', DEFAULT_PARAMS, {});
  setVariant(2); const b = interpretPrompt('a warm friendly storybook font', DEFAULT_PARAMS, {});
  setVariant(0);
  assert.notDeepEqual(a.settings, b.settings);
});

test('letter-spacing words change spacing, not letter width', async () => {
  await initMood();
  const a = interpretBrief('wide letter spacing, light weight', DEFAULT_PARAMS, {});
  assert.ok(a.settings.spacing > 1.05);
  assert.equal(a.settings.width, 1);
  const b = interpretBrief('tight letter spacing', DEFAULT_PARAMS, {});
  assert.ok(b.settings.spacing < 0.95);
  assert.equal(b.settings.width, 1);
});

test('round 9: slant words, theme recipes and a slanted font build', async () => {
  await initMood();
  const w = interpretBrief('wedding invitation', DEFAULT_PARAMS, {});
  assert.ok(w.settings.slant > 0 && w.settings.italic && w.settings.serifs);
  const up = interpretBrief('upright bold wedding invitation', DEFAULT_PARAMS, {});
  assert.equal(up.settings.slant, 0);
  const p = createProject({ family: 'Slanted', prompt: 'wedding invitation' });
  p.design = { ...p.design, ...w.settings };
  const fam = generateFamily(p);
  Object.assign(p, fam);
  const font = buildFont(p, 'Regular');
  assert.ok(font.bytes.length > 5000);
});

test('blackletter and stencil requests are reported as not generated', async () => {
  await initMood();
  for (const w of ['a gothic blackletter', 'army stencil font', 'graffiti tag style']) {
    const r = interpretBrief(w, DEFAULT_PARAMS, {});
    assert.ok(r.unsupported.length > 0, w);
  }
});

test('round 10: follow-up words change the current font, friendly words round the ends', async () => {
  await initMood();
  const first = interpretBrief('a calm wide font for a spa', DEFAULT_PARAMS, {});
  const cur = { ...DEFAULT_PARAMS, ...first.settings };
  const bolder = interpretBrief('twice as bold', DEFAULT_PARAMS, { current: cur });
  assert.ok(bolder.refine && bolder.settings.stem > cur.stem);
  assert.equal(bolder.settings.width, cur.width);
  assert.equal(bolder.settings.spacing, cur.spacing);
  const fresh = interpretBrief('twice as bold', DEFAULT_PARAMS, {});
  assert.ok(!fresh.refine);
  const cute = interpretBrief('cute but not childish', DEFAULT_PARAMS, {});
  assert.equal(cute.settings.terminals, 'Rounded');
});

test('Try another changes the font even when the words pin every setting', async () => {
  const { setVariant } = await import('../src/core/mood.js');
  await initMood();
  setVariant(0); const a = interpretBrief('a thin light elegant font', DEFAULT_PARAMS, {});
  setVariant(1); const b = interpretBrief('a thin light elegant font', DEFAULT_PARAMS, {});
  setVariant(0);
  assert.notDeepEqual(a.settings, b.settings);
  assert.equal(a.settings.stem, b.settings.stem);
  assert.equal(a.settings.width, b.settings.width);
});
