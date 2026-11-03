import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,run,prepare,runPrepared,plan,deriveGuarded,declarations,hash,accept,XHEIGHT } from './scenario.mjs';
import { canonicalizeInitialGeometry } from '../integration-experiment/engine.mjs';
const source=fixture(), before=hash(source),g=id=>source.model.glyphRegistry.glyphs.find(g=>g.id===`glyph:u00${id}`);
const ids=['glyph:u0061','glyph:u0068','glyph:u006e','glyph:u006f'];
test('500 to 520 propagates with bounds-derived bearings and unchanged H',()=>{
 const r=run(source);assert.equal(r.status,'committed-candidate',r.error);assert.deepEqual(r.plan.affected,ids);assert.deepEqual(r.plan.unaffected,['glyph:u0048']);
 const expected={o:[55,-8,565,528,620,55,55],n:[55,0,595,560,650,55,55],a:[37,0,595,520,650,37,55],h:[55,0,595,700,650,55,55]};
 for(const [name,values] of Object.entries(expected)){const x=Object.values(r.family.glyphs).find(g=>g.name===name);assert.deepEqual([...Object.values(x.bounds),x.metrics.advanceWidth,x.metrics.leftSideBearing,x.metrics.rightSideBearing],values);}
 assert.deepEqual(r.family.glyphs['glyph:u0048'],source.family.glyphs['glyph:u0048']);
 assert.deepEqual(r.model.glyphRegistry.glyphs,source.model.glyphRegistry.glyphs);
 assert.equal(r.model.state.characteristics.find(d=>d.id===XHEIGHT).value.value,520);
 assert.equal(r.model.constructionIntegration.familyPropagation.previousDecision.value.value,500);
 assert.equal(r.model.revisions.acceptedRevisionId,source.model.revisions.acceptedRevisionId);assert.equal(hash(source),before);
 assert.deepEqual(r.revision.invalidated,['kerning']);assert.equal(r.model.constructionIntegration.familyPropagation.review.spacing,'required');
 assert.equal(r.visualReview.approved,false);assert.throws(()=>accept(r,{}),/approval/);
});
test('plans, candidate identities, outlines and fonts are deterministic',()=>{assert.deepEqual(plan(source),plan(source));const a=run(source),b=run(source);assert.equal(a.revision.id,b.revision.id);assert.equal(hash(a.font.bytes),hash(b.font.bytes));assert.equal(hash(a.family),hash(b.family));});
test('all declared inputs are consumed and each changes actual outline or metrics',()=>{
 for(const glyph of source.model.glyphRegistry.glyphs){const original=deriveGuarded(glyph,source.model),edges=declarations(glyph);assert.deepEqual(original.consumed,[...new Set(edges.map(e=>e.decisionId))].sort());
 for(const id of original.consumed){const m=structuredClone(source.model);m.state.characteristics.find(d=>d.id===id).value.value+=id==='decision:baseline'?10:20;const changed=deriveGuarded(glyph,m).geometry;assert.notEqual(hash({c:changed.contours,m:changed.metrics}),hash({c:original.geometry.contours,m:original.geometry.metrics}),`${glyph.name}:${id}`);}
 }
});
test('undeclared reads and unused declarations fail closed',()=>{
 for(const glyph of source.model.glyphRegistry.glyphs){const edges=declarations(glyph),id=edges[0].decisionId;assert.throws(()=>deriveGuarded(glyph,source.model,edges.filter(e=>e.decisionId!==id)),/Undeclared/);assert.throws(()=>deriveGuarded(glyph,source.model,[...edges,{decisionId:'decision:a-single-storey-topology'}]),/not consumed/);}
});
test('500 outlines match existing adapters; semantic topology and IDs remain intact',()=>{for(const glyph of source.model.glyphRegistry.glyphs){const derived=deriveGuarded(glyph,source.model).geometry;const canonical=canonicalizeInitialGeometry({glyphOrder:[glyph.id],glyphs:{[glyph.id]:derived}}).glyphs[glyph.id];assert.deepEqual(canonical.contours,source.family.glyphs[glyph.id].contours);}assert.deepEqual(run(source).model.glyphRegistry,source.model.glyphRegistry);});
test('each adapter failure rolls back the whole candidate and retains input identity',()=>{
 for(const id of ids){const r=run(source,{}, {derive:(g,m,e)=>{if(g.id===id)throw Error(`failed ${id}`);return deriveGuarded(g,m,e);}});assert.equal(r.status,'rejected');assert.equal(r.model,source.model);assert.equal(r.family,source.family);assert.equal(r.revision,null);assert.equal(hash(source),before);}
});
test('downstream compilation and audit failures create no candidate',()=>{for(const compiler of [()=>{throw Error('Compiler failed');},()=>({audit:{valid:false}})]){const r=run(source,{}, {compiler});assert.equal(r.status,'rejected');assert.equal(r.model,source.model);assert.equal(r.revision,null);}});
test('geometry corruption is rejected inside executor',()=>{const r=run(source,{}, {derive:(g,m,e)=>{const r=deriveGuarded(g,m,e);r.geometry.metrics.advanceWidth=0;return r;}});assert.equal(r.status,'rejected');assert.equal(r.model,source.model);});
test('stale prior values, plans, revisions, selectors and missing dependencies rejected',()=>{
 assert.equal(run(source,{expected:490}).status,'rejected');const p=plan(source);p.sourceRevisionId='rev:stale';assert.equal(run(source,{dependencyPlan:p}).status,'rejected');
 const prepared=prepare(source);prepared.model.selectors.find(s=>s.id===prepared.model.operations[0].selectorId).registryRevisionId='rev:stale';assert.equal(runPrepared(prepared).status,'rejected');
 const q=prepare(source);q.model.operations[0].preconditions[0].id='rev:stale';assert.equal(runPrepared(q).status,'rejected');
 const missing=structuredClone(source);missing.model.state.characteristics=missing.model.state.characteristics.filter(d=>d.id!==XHEIGHT);assert.throws(()=>plan(missing),/Missing/);
 const cycle=prepare(source);cycle.model.operations[0].dependsOn=[cycle.model.operations[1].id];assert.equal(runPrepared(cycle).status,'rejected');
});
test('topology override retains x-height dependency; conflicting overrides rejected',()=>{
 const o={glyphId:'glyph:u0061',property:'glyph.construction.topology',value:'single-storey',origin:'explicit',provenance:{intentId:'intent:retain-a'}};
 assert.deepEqual(plan(source,[o]).affected,ids);assert.equal(run(source,{overrides:[o]}).status,'committed-candidate');assert.throws(()=>plan(source,[o,o]),/Conflicting/);
 assert.throws(()=>plan(source,[{...o,property:'proportion.x-height',value:500}]),/Unsupported/);
});
test('follow-up delta uses accepted candidate and does not replay previous operations',()=>{
 const first=run(source);const accepted=accept(first,{reviewer:'test-only simulated reviewer',decision:'approved',evidenceRefs:['test://no-real-visual-approval']});
 const second=run(accepted,{expected:520,value:500});assert.equal(second.status,'committed-candidate',second.error);assert.equal(second.revision.parentRevisionIds[0],first.revision.id);
 assert.equal(second.revision.operationIds.some(id=>first.revision.operationIds.includes(id)),false);assert.equal(accepted.model.state.characteristics.find(d=>d.id===XHEIGHT).value.value,520);assert.equal(second.visualReview.approved,false);
 assert.deepEqual(second.family.glyphs['glyph:u0048'],source.family.glyphs['glyph:u0048']);
});

test('same-revision selector membership tampering and omitted rebuild are rejected',()=>{const a=prepare(source);a.model.selectors.find(s=>s.id===a.model.operations[1].selectorId).resolution.includedGlyphIds=[];assert.equal(runPrepared(a).status,'rejected');const b=prepare(source);b.model.operations.pop();assert.equal(runPrepared(b).status,'rejected');});
