import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {fixture,operation,execute,resolve,derive,continuity} from './aperture.mjs';
import {sampleContour} from '../../../../prototype/src/contours.js';
import {compile} from '../two-storey-grammar/font.mjs';
const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
function pair(){const base=fixture(),candidate=execute(base,operation(base));assert.equal(candidate.status,'candidate',candidate.error);return {base,candidate};}
test('semantic aperture replaces enclosure by explicit open space and two correctly attached ports',()=>{
 const {candidate:c}=pair();assert.equal(c.model.apertureExtension.apertures.length,1);assert.equal(c.model.apertureExtension.ports.length,2);assert.equal(c.model.construction.nodes.find(n=>n.id==='counter:1').component,'open-space');assert.equal(c.model.construction.nodes.find(n=>n.id==='counter:0').component,'counter');assert.doesNotThrow(()=>resolve(c.model));
});
test('operation rejects missing/ambiguous/incompatible targets, invalid boundaries/extents and stale revisions',()=>{
 const m=fixture();for(const mutate of [o=>o.target.nodeIds=['unknown'],o=>o.target.nodeIds=['bowl:0','bowl:1'],o=>o.target.nodeIds=['spine'],o=>o.parameters.boundary='spine-side',o=>o.parameters.halfExtent=0,o=>o.parameters.halfExtent=NaN,o=>o.parameters.terminal='round',o=>o.preconditions.revisionId='stale',o=>o.target.glyphId='other',o=>o.parameters.spaceId='counter:0']) {const op=operation(m);mutate(op);const result=execute(m,op);assert.equal(result.status,'rejected');assert.strictEqual(result.model,m);assert.equal(result.diff,null);}
});
test('semantic validator rejects absent ports, wrong attachments, duplicate scope and contradictory enclosure before geometry',()=>{
 const {candidate:c}=pair();for(const mutate of [m=>m.apertureExtension.ports.pop(),m=>m.apertureExtension.ports[0].bowlId='bowl:0',m=>m.apertureExtension.apertures[0].portIds.reverse(),m=>m.construction.relations.push({type:'contained-by',source:'counter:1',target:'bowl:1'}),m=>m.apertureExtension.apertures.push(structuredClone(m.apertureExtension.apertures[0]))]) {const model=structuredClone(c.model);mutate(model);assert.throws(()=>resolve(model));}
});
test('successful and rejected transactions preserve accepted definitions, decisions and identity; output is deterministic',()=>{
 const m=fixture(),snapshot=structuredClone(m),op=operation(m),first=execute(m,op),second=execute(m,op);assert.deepEqual(first,second);assert.deepEqual(m,snapshot);assert.deepEqual(first.model.decisions,m.decisions);assert.equal(first.model.id,m.id);assert.deepEqual(first.model.characterIdentity,m.characterIdentity);assert.deepEqual(first.model.encoding,m.encoding);assert.equal(first.model.revision.status,'candidate');assert.equal(first.model.revision.parent,m.revision.id);
 for(const n of m.construction.nodes.filter(n=>n.id!=='counter:1'))assert.deepEqual(first.model.construction.nodes.find(x=>x.id===n.id),n);
 const repeat=execute(first.model,operation(first.model));assert.equal(repeat.status,'rejected');const acceptedOpen=structuredClone(first.model);acceptedOpen.revision.status='accepted';assert.equal(execute(acceptedOpen,operation(acceptedOpen)).status,'rejected');assert.deepEqual(m,snapshot);
});
test('geometry exposes a real exterior channel, removes only upper hole and preserves lower counter/spine/bounds/metrics',()=>{
 const {base,candidate:c}=pair(),old=derive(base),g=c.geometry;assert.equal(g.contours.length,2);assert.deepEqual(g.contours[1],old.contours[1]);assert.deepEqual(g.bounds,old.bounds);assert.deepEqual(g.metrics,old.metrics);assert.deepEqual(derive(c.model),g);
 const outer=sampleContour(g.contours[0],64);for(const p of sampleContour(g.contours[1],64))assert.ok(inside(p,outer));
 // The former upper cavity connects to the exterior at midheight without ink crossing.
 const {scaffold}=resolve(c.model),upper=scaffold.bowls[1],mid=(upper.y0+upper.y1)/2;
 for(let x=upper.x0-20;x<scaffold.stemX-5;x+=4)assert.equal(inside({x,y:mid},outer),false);
 assert.deepEqual(g.contours[0].segments.find(s=>s.id==='spine.outer'),old.contours[0].segments.find(s=>s.id==='spine.outer'));
 assert.equal(g.aperturePorts.length,2);for(const port of g.aperturePorts)assert.ok(Math.hypot(port.endpoints.outer.x-port.endpoints.inner.x,port.endpoints.outer.y-port.endpoints.inner.y)>0);
});
test('continuity measures actual contours: G0 closure, sharp terminal caps and retained G1 waist',()=>{
 const {candidate:c}=pair(),rows=continuity(c.geometry.contours[0]);assert.ok(rows.every(r=>r.G0));const caps=rows.filter(r=>r.from.endsWith('.cap')||r.to.endsWith('.cap'));assert.equal(caps.length,4);assert.ok(caps.every(r=>!r.G1&&!r.C1));const joins=rows.filter(r=>r.from.includes('join:')||r.to.includes('join:'));assert.ok(joins.every(r=>r.G1));
});
test('same operation opens a renamed one-bowl synthetic structure without glyph or node-name assumptions',()=>{
 const m=fixture(1);m.id='shape:synthetic';m.name='synthetic';m.characterIdentity=[];m.encoding=[];for(const n of m.construction.nodes)n.id='synthetic/'+n.id;for(const r of m.construction.relations)for(const key of ['source','target','lower','upper'])if(r[key])r[key]='synthetic/'+r[key];
 const c=execute(m,operation(m,'synthetic/bowl:0'));assert.equal(c.status,'candidate',c.error);assert.equal(c.geometry.contours.length,1);assert.equal(c.geometry.metrics.advanceWidth,m.decisions.advance);assert.ok(c.geometry.metrics.leftSideBearing>m.decisions.bearing);assert.equal(c.diff.metrics.policy,'preserve-advance-recompute-bearings');assert.equal(c.model.construction.nodes.find(n=>n.id==='synthetic/counter:0').component,'open-space');
});
test('compiled enclosed/open forms keep Unicode identity, correct contours and exact preserved lower outline',()=>{
 const {base,candidate:c}=pair(),old=derive(base),g=c.geometry;
 const enclosed=compile([{...old,name:'a',unicode:97}],'LFCFoundry Aperture Enclosed'),opened=compile([{...g,name:'a',unicode:97}],'LFCFoundry Aperture Open');
 const inventory=compile([{...old,id:'reference',name:'a',unicode:97},{...g,id:'candidate',name:'a.open',unicode:null}],'LFCFoundry Aperture Inventory');assert.deepEqual(inventory.parsed.glyphs['a.open'].unicodes,[]);assert.deepEqual(inventory.parsed.glyphs['a.open'].contours,opened.parsed.glyphs.a.contours);assert.ok(enclosed.audit.valid&&opened.audit.valid&&inventory.audit.valid);assert.deepEqual(opened.parsed.glyphs.a.unicodes,[97]);assert.equal(opened.parsed.glyphs.a.contours.length,2);assert.deepEqual(opened.parsed.glyphs.a.contours[1],enclosed.parsed.glyphs.a.contours[1]);assert.equal(opened.parsed.glyphs.a.advanceWidth,enclosed.parsed.glyphs.a.advanceWidth);assert.deepEqual(opened.bytes,compile([{...g,name:'a',unicode:97}],'LFCFoundry Aperture Open').bytes);
});
test('all pre-existing source and artifact bytes still match initial baseline',()=>{
 const record=JSON.parse(readFileSync(new URL('./baseline.json',import.meta.url))),promotions=record.authorizedPromotions||{};
 for(const [path,expected]of Object.entries(record.files)){
  const actual=createHash('sha256').update(readFileSync(path)).digest('hex'),promotion=promotions[path];
  if(!promotion)assert.equal(actual,expected,path);
  else{assert.equal(promotion.fromSha256,expected,`${path}: original hash record`);assert.equal(actual,promotion.toSha256,`${path}: authorized promotion`);}
 }
 for(const path of Object.keys(promotions))assert.ok(Object.hasOwn(record.files,path),`Promotion ${path} must retain its original hash record.`);
});
test('aperture extent changes actual terminal coordinates while retaining lower geometry and advance',()=>{
 const m=fixture(),a=operation(m),b=operation(m);a.parameters.halfExtent=.2;b.parameters.halfExtent=.35;const x=execute(m,a),y=execute(m,b);assert.equal(x.status,'candidate',x.error);assert.equal(y.status,'candidate',y.error);assert.notDeepEqual(x.geometry.aperturePorts,y.geometry.aperturePorts);assert.deepEqual(x.geometry.contours[1],y.geometry.contours[1]);assert.deepEqual(x.geometry.metrics,y.geometry.metrics);
});
test('saved review fonts match current geometry and embedded bytes without external asset loading',()=>{
 const {base,candidate:c}=pair(),html=readFileSync(new URL('./review.html',import.meta.url),'utf8');for(const [key,g,family]of [['enclosed',derive(base),'LFCFoundry Aperture Enclosed'],['open',c.geometry,'LFCFoundry Aperture Open']]) {const bytes=readFileSync(new URL(`./artifacts/LFCFoundry-Aperture-${key}.ttf`,import.meta.url));assert.deepEqual(bytes,Buffer.from(compile([{...g,name:'a',unicode:97}],family).bytes));assert.ok(html.includes(bytes.toString('base64')));}assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|fetch\(|import\(/i);
});
