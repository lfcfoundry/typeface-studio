import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {operation,execute,derive,validate} from './operation.mjs';import {ringFixture,ringAdapter,spineFixture,spineAdapter} from './grammars.mjs';import {checkDescriptor} from './boundary.mjs';
import {operation as originalFactory,execute as originalExecute} from '../aperture-operation/aperture.mjs';import {continuity} from '../two-storey-grammar/grammar.mjs';import {compile} from '../two-storey-grammar/font.mjs';import {sampleContour} from '../../../../prototype/src/contours.js';
const cases=()=>[[ringFixture(),ringAdapter,'region:ring'],[spineFixture(),spineAdapter,'bowl:1']];const points=g=>g.contours.map(c=>c.points.map(({x,y,on})=>({x,y,on})));
const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
test('same imported operation factory and shared executor open both structural grammars',()=>{
 assert.strictEqual(operation,originalFactory);for(const [m,a,target]of cases()){const op=operation(m,target);assert.deepEqual(op,originalFactory(m,target));const r=execute(m,op,a);assert.equal(r.status,'candidate',r.error);assert.equal(r.model.apertureExtension.apertures[0].structureId,target);assert.equal(r.model.apertureExtension.ports.length,2);assert.doesNotThrow(()=>validate(r.model,a));}
 // Shared operation source has no grammar imports, bowl test, ellipse test or grammar dispatch.
 const source=readFileSync(new URL('./operation.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/spineAdapter|ringAdapter|component\s*[!=]==?\s*['"]bowl|switch\s*\(/);
});
test('ring is an independent concentric-boundary grammar with valid enclosure and no spine/bowl anatomy',()=>{
 const m=ringFixture(),g=derive(m,ringAdapter);assert.deepEqual(m.construction.nodes.map(n=>n.component),['ring','elliptical-boundary','counter']);assert.equal(g.contours.length,2);assert.deepEqual(g.bounds,{xMin:55,yMin:0,xMax:595,yMax:500});const outer=sampleContour(g.contours[0],64);assert.ok(sampleContour(g.contours[1],64).every(p=>inside(p,outer)));
 for(const mutate of [m=>m.decisions.strokeX=300,m=>m.construction.relations.pop(),m=>m.construction.nodes[2].id='other']){const bad=ringFixture();mutate(bad);assert.throws(()=>derive(bad,ringAdapter));}
});
test('adapter descriptors expose explicit orientation, parameterization, scope, revision and terminal capabilities',()=>{
 for(const [m,a,target]of cases()){const d=a.boundaries(m,target)[0];assert.equal(checkDescriptor(d),d);assert.equal(d.structureId,target);assert.equal(d.revisionId,m.revision.id);assert.equal(d.parameterization,'quadratic-local-t');assert.equal(d.orientation,'outer-clockwise-inner-counterclockwise');assert.deepEqual(d.portOrder,['lower','upper']);assert.deepEqual(d.terminalTreatments,['flat']);const op=operation(m,target);op.parameters.boundary='exposed-side';assert.equal(execute(m,op,a).status,'candidate');op.parameters.boundary=d.id;assert.equal(execute(m,op,a).status,'candidate');}
 const d=ringAdapter.boundaries(ringFixture(),'region:ring')[0];assert.throws(()=>checkDescriptor({...d,orientation:'unknown'}));assert.throws(()=>checkDescriptor({...d,portOrder:['upper','lower']}));
});
test('shared realizer preserves earlier spine aperture coordinates, lower counter and metrics',()=>{
 const m=spineFixture(),op=operation(m,'bowl:1'),legacy=originalExecute(m,op),now=execute(m,op,spineAdapter);assert.equal(now.status,'candidate',now.error);assert.deepEqual(points(now.geometry),points(legacy.geometry));assert.deepEqual(now.geometry.metrics,legacy.geometry.metrics);assert.deepEqual(now.geometry.contours[1],derive(m,spineAdapter).contours[1]);
});
test('operation preserves accepted state, semantic identities, unrelated nodes and decisions on both grammars',()=>{
 for(const [m,a,target]of cases()){const before=structuredClone(m),op=operation(m,target),r=execute(m,op,a);assert.deepEqual(m,before);assert.deepEqual(r.model.decisions,m.decisions);assert.deepEqual(r.model.characterIdentity,m.characterIdentity);assert.deepEqual(r.model.encoding,m.encoding);assert.equal(r.model.revision.status,'candidate');assert.equal(r.model.revision.parent,m.revision.id);for(const id of r.diff.preservedNodeIds)assert.deepEqual(r.model.construction.nodes.find(n=>n.id===id),m.construction.nodes.find(n=>n.id===id));assert.deepEqual(execute(m,op,a),r);const acceptedOpen=structuredClone(r.model);acceptedOpen.revision.status='accepted';assert.equal(execute(acceptedOpen,operation(acceptedOpen,target),a).status,'rejected');}
});
test('renamed ring structures and glyph identities do not select operation behavior',()=>{
 const m=ringFixture();m.id='synthetic:unencoded';m.name='test-shape';m.characterIdentity=[];m.encoding=[];const original=m.construction.nodes[0].id;m.construction.nodes[0].id='shape:enclosure';for(const r of m.construction.relations)if(r.target===original)r.target='shape:enclosure';const r=execute(m,operation(m,'shape:enclosure'),ringAdapter);assert.equal(r.status,'candidate',r.error);assert.equal(r.geometry.contours.length,1);
});
test('missing/ambiguous/stale boundaries, incompatible ports and malformed operations reject without partial mutation',()=>{
 const m=ringFixture(),before=structuredClone(m),op=operation(m,'region:ring');
 const invalidAdapters=[{...ringAdapter,boundaries:()=>[]},{...ringAdapter,boundaries:(m,t)=>{const d=ringAdapter.boundaries(m,t)[0];return [d,d];}},{...ringAdapter,boundaries:(m,t)=>ringAdapter.boundaries(m,t).map(d=>({...d,revisionId:'stale'}))},{...ringAdapter,boundaries:(m,t)=>ringAdapter.boundaries(m,t).map(d=>({...d,portOrder:['upper','lower']}))}];
 for(const a of invalidAdapters){const r=execute(m,op,a);assert.equal(r.status,'rejected');assert.strictEqual(r.model,m);assert.equal(r.diff,null);}
 for(const mutate of [o=>o.parameters.boundary='absent',o=>o.parameters.halfExtent=.8,o=>o.target.nodeIds=['region:ring','edge:outer'],o=>o.preconditions.revisionId='stale',o=>o.parameters.terminal='rounded']){const bad=structuredClone(op);mutate(bad);assert.equal(execute(m,bad,ringAdapter).status,'rejected');}assert.deepEqual(m,before);
 const c=execute(m,op,ringAdapter).model;c.apertureExtension.ports[0].boundaryId='wrong';assert.throws(()=>validate(c,ringAdapter));
});
test('open ring has real exterior channel, explicit terminal endpoints and reported metric consequences',()=>{
 const m=ringFixture(),r=execute(m,operation(m,'region:ring'),ringAdapter),g=r.geometry;assert.equal(g.contours.length,1);assert.ok(g.contours[0].closed);assert.deepEqual(g.bounds,{xMin:72,yMin:0,xMax:595,yMax:500});assert.deepEqual(g.metrics,{advanceWidth:650,leftSideBearing:72,rightSideBearing:55});const poly=sampleContour(g.contours[0],64);for(let x=20;x<320;x+=4)assert.equal(inside({x,y:250},poly),false);assert.equal(g.aperturePorts.length,2);for(const p of g.aperturePorts)assert.ok(Math.hypot(p.endpoints.outer.x-p.endpoints.inner.x,p.endpoints.outer.y-p.endpoints.inner.y)>1);assert.deepEqual(derive(r.model,ringAdapter),g);
 const c=continuity(g.contours[0]);assert.ok(c.every(x=>x.G0));assert.ok(c.some(x=>x.G1));assert.ok(c.some(x=>!x.G1));
});
test('fonts preserve ring Unicode identity, closed/open outline counts, deterministic checksums and unencoded alternate',()=>{
 const m=ringFixture(),closed=derive(m,ringAdapter),opened=execute(m,operation(m,'region:ring'),ringAdapter).geometry;
 const f=compile([{...closed,id:'closed',name:'o',unicode:111},{...opened,id:'opened',name:'o.open',unicode:null}],'LFCFoundry Cross Grammar Ring');assert.ok(f.audit.valid);assert.deepEqual(f.parsed.glyphs.o.unicodes,[111]);assert.deepEqual(f.parsed.glyphs['o.open'].unicodes,[]);assert.equal(f.parsed.glyphs.o.contours.length,2);assert.equal(f.parsed.glyphs['o.open'].contours.length,1);assert.deepEqual(f.bytes,compile([{...closed,id:'closed',name:'o',unicode:111},{...opened,id:'opened',name:'o.open',unicode:null}],'LFCFoundry Cross Grammar Ring').bytes);
});
test('all untouched protected files retain original hashes and promotions match their audit hashes',()=>{const baseline=JSON.parse(readFileSync(new URL('./baseline.json',import.meta.url))),promotions=baseline.authorizedPromotions||{};for(const [p,h]of Object.entries(baseline.files)){const actual=createHash('sha256').update(readFileSync(p)).digest('hex'),promotion=promotions[p];if(!promotion)assert.equal(actual,h,p);else{assert.equal(promotion.fromSha256,h,`${p}: original hash record`);assert.equal(actual,promotion.toSha256,`${p}: authorized promotion`);}}for(const p of Object.keys(promotions))assert.ok(Object.hasOwn(baseline.files,p),`Promotion ${p} must retain its original hash record.`);});
test('late realization failures roll back the entire transaction; legacy state migration is explicit',()=>{
 const m=spineFixture(),before=structuredClone(m),op=operation(m,'bowl:1'),adapter={...spineAdapter,geometry(model){if(model.apertureExtension.apertures.length)throw Error('Deliberate late geometry failure');return spineAdapter.geometry(model);}};
 const bad=execute(m,op,adapter);assert.equal(bad.status,'rejected');assert.match(bad.error,/late geometry failure/);assert.strictEqual(bad.model,m);assert.deepEqual(m,before);
 const good=execute(m,op,spineAdapter);assert.equal(good.model.apertureExtension.version,2);assert.equal(m.apertureExtension.version,1);const old=originalExecute(m,op);assert.throws(()=>validate(old.model,spineAdapter),/requires explicit migration/);
});
test('saved fonts and review HTML use current exact bytes; ring continuity distinguishes G1 and C1',()=>{
 const m=ringFixture(),closed=derive(m,ringAdapter),opened=execute(m,operation(m,'region:ring'),ringAdapter).geometry,html=readFileSync(new URL('./review.html',import.meta.url),'utf8');
 for(const [key,g,family]of [['closed',closed,'LFCFoundry Cross Grammar Closed Ring'],['open',opened,'LFCFoundry Cross Grammar Open Ring']]){const bytes=readFileSync(new URL(`./artifacts/LFCFoundry-Cross-Grammar-${key}.ttf`,import.meta.url));assert.deepEqual(bytes,Buffer.from(compile([g],family).bytes));assert.ok(html.includes(bytes.toString('base64')));}
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|fetch\(|import\(/i);const rows=continuity(opened.contours[0]);assert.equal(rows.length,10);assert.equal(rows.filter(r=>r.G0).length,10);assert.equal(rows.filter(r=>r.G1).length,6);assert.equal(rows.filter(r=>r.C1).length,2);
});
