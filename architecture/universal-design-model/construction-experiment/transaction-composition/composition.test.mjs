import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {fixture,sequences,operation,run,accept,hash,operationHandlers} from './integration.mjs';
import {executeTransaction as originalExecutor} from './baseline/architecture/universal-design-model/integration-experiment/engine.mjs';
import {executeTransaction as extendedExecutor,validateV2Model} from './extended-executor.mjs';
const numeric=g=>g.contours.map(c=>c.points.map(({x,y,on})=>({x,y,on})));
test('extension remains compatible with original executor on existing reflection; universal model validates',()=>{
 const base=fixture(),model=structuredClone(base.model);model.operations=[{...operation('geometry.structure.reflect','legacy',base),type:'geometry.reflect',parameters:{}}];assert.deepEqual(validateV2Model(model),[]);const old=originalExecutor(model,base.family),next=extendedExecutor(model,base.family);assert.equal(old.status,'committed-candidate');assert.equal(next.status,old.status);assert.deepEqual(next.family,old.family);assert.deepEqual(next.model.selectors,old.model.selectors);assert.deepEqual(next.order,old.order);
});
test('registered operations compose through universal dependency execution and preserve accepted input for both grammars',()=>{
 assert.deepEqual(Object.keys(operationHandlers).sort(),['geometry.structure.reflect','semantic.aperture.open','semantic.terminal.set-profile']);
 for(const kind of ['ring','spine']){const base=fixture(kind),snapshot=structuredClone(base),s=sequences(base);for(const k of ['reflection','aperture','A','B'])assert.equal(s[k].status,'committed-candidate',s[k].error);assert.deepEqual(base,snapshot);assert.deepEqual(s.A.order,['op:reflect','op:aperture']);assert.deepEqual(s.B.order,['op:aperture','op:reflect']);assert.deepEqual(s.A.family,s.B.family);assert.notEqual(s.A.revision.id,s.B.revision.id);assert.equal(s.A.model.revisions.acceptedRevisionId,base.model.revisions.acceptedRevisionId);assert.deepEqual(s.A.model.constructionIntegration.trace.map(t=>t.operationId),s.A.order);}
});
test('reflection selects a construction instance, preserving the other half of the glyph and unrelated glyphs',()=>{
 for(const kind of ['ring','spine']){const base=fixture(kind),r=sequences(base).reflection;const old=base.family.glyphs['glyph:assembly'],g=r.family.glyphs['glyph:assembly'];assert.deepEqual(g.contours.filter(c=>c.id.startsWith('support/')),old.contours.filter(c=>c.id.startsWith('support/')));assert.deepEqual(r.family.glyphs['glyph:control'],base.family.glyphs['glyph:control']);assert.equal(g.components[0].transform.xx,-1);assert.equal(g.components[1].transform.xx,1);assert.equal(r.model.constructionIntegration.instances.main.design.id,base.model.constructionIntegration.instances.main.design.id);assert.equal(g.metrics.advanceWidth,1350);}
});
test('ports, semantic boundaries, owners and parameterization survive both orders in object-attached space',()=>{
 for(const kind of ['ring','spine']){const base=fixture(kind),s=sequences(base),a=s.A.family.glyphs['glyph:assembly'],b=s.B.family.glyphs['glyph:assembly'],unreflected=s.aperture.family.glyphs['glyph:assembly'];assert.deepEqual(a.components[0].ports,b.components[0].ports);const ports=a.components[0].ports;assert.equal(ports.length,2);for(let i=0;i<2;i++){assert.equal(ports[i].id,unreflected.components[0].ports[i].id);const cap=a.contours.flatMap(c=>c.segments).find(segment=>segment.id===ports[i].id+'.cap');assert.ok(cap);assert.deepEqual([cap.from,cap.to].map(p=>[p.x,p.y]).sort(),Object.values(ports[i].endpoints).map(p=>[p.x,p.y]).sort());assert.equal(ports[i].ownerInstanceId,'main');assert.equal(ports[i].presentationHandedness,'reflected');for(const role of ['outer','inner'])assert.equal(ports[i].endpoints[role].x,650-unreflected.components[0].ports[i].endpoints[role].x);}
 const m=s.A.model.constructionIntegration.instances.main.design;assert.equal(m.apertureExtension.apertures[0].parameterization,'quadratic-local-t');assert.deepEqual(m.construction.relations,s.B.model.constructionIntegration.instances.main.design.construction.relations);assert.deepEqual(m.decisions,base.model.constructionIntegration.instances.main.design.decisions);}
});
test('failed second operation rolls back semantic state, reflection geometry and candidate revisions',()=>{
 const base=fixture('spine'),before=structuredClone(base),r=operation('geometry.structure.reflect','first',base),bad=operation('semantic.aperture.open','second',base,{dependsOn:['first']});bad.parameters.terminal='unsupported';const out=run(base,[r,bad]);assert.equal(out.status,'rejected');assert.strictEqual(out.model,base.model);assert.strictEqual(out.family,base.family);assert.equal(out.revision,null);assert.deepEqual(base,before);
});
test('dependencies reject missing IDs, cycles and unordered overlapping operations',()=>{
 const base=fixture(),r=operation('geometry.structure.reflect','r',base),a=operation('semantic.aperture.open','a',base);assert.match(run(base,[r,a]).error,/dependency|non-commuting/);assert.equal(run(base,[{...r,dependsOn:['missing']}]).status,'rejected');assert.equal(run(base,[{...r,dependsOn:['a']},{...a,dependsOn:['r']}]).status,'rejected');assert.equal(run(base,[r,{...r}]).status,'rejected');
});
test('revision-bound glyph and component selectors reject stale, forged, missing and foreign targets',()=>{
 for(const modify of [b=>b.model.selectors[0].registryRevisionId='stale',b=>b.model.selectors[0].expression.value='absent',b=>b.model.constructionIntegration.selectors[0].registryRevisionId='stale',b=>b.model.constructionIntegration.selectors[0].instanceIds=['unknown']]){const b=fixture();modify(b);assert.equal(run(b,[operation('geometry.structure.reflect','r',b)]).status,'rejected');}
 const b=fixture(),op=operation('geometry.structure.reflect','r',b);op.preconditions[0].id='stale';assert.equal(run(b,[op]).status,'rejected');
});
test('acceptance creates separate immutable accepted revisions and rejects tampered candidates',()=>{
 const b=fixture(),s=sequences(b),snapshot=structuredClone(s.A),a=accept(s.A),c=accept(s.B);assert.equal(a.model.revisions.acceptedRevisionId,s.A.revision.id);assert.equal(c.model.revisions.acceptedRevisionId,s.B.revision.id);assert.notEqual(a.model.revisions.acceptedRevisionId,c.model.revisions.acceptedRevisionId);assert.deepEqual(s.A,snapshot);assert.ok(Object.isFrozen(a.model));assert.throws(()=>a.model.constructionIntegration.instances.main.reflected=false,TypeError);const tamper=structuredClone(s.A);tamper.family.glyphs['glyph:assembly'].metrics.advanceWidth=1;assert.throws(()=>accept(tamper),/unmodified/);
});
test('revision identity includes parameter content; repeated executions deterministic and repeated aperture rejected',()=>{
 const b=fixture(),one=operation('semantic.aperture.open','a',b,{halfExtent:.2}),two=operation('semantic.aperture.open','a',b,{halfExtent:.3}),x=run(b,[one]),y=run(b,[two]);assert.equal(x.status,'committed-candidate');assert.notEqual(x.revision.id,y.revision.id);assert.deepEqual(run(b,[one]),x);assert.equal(run(b,[one,{...two,id:'a2',dependsOn:['a']}]).status,'rejected');
});
test('all untouched working-tree files remain byte-identical and promoted files match their audit hashes',{skip:process.env.TYPEFACE_ISOLATED_PUBLICATION==='1'},()=>{
 const baseline=JSON.parse(readFileSync(new URL('./preservation.json',import.meta.url))),promotions=baseline.authorizedPromotions||{};
 for(const [p,h]of Object.entries(baseline.files)){
  const actual=createHash('sha256').update(readFileSync(p)).digest('hex'),promotion=promotions[p];
  if(!promotion)assert.equal(actual,h,p);
  else{assert.equal(promotion.fromSha256,h,`${p}: original hash record`);assert.equal(actual,promotion.toSha256,`${p}: authorized promotion`);}
 }
 for(const p of Object.keys(promotions))assert.ok(Object.hasOwn(baseline.files,p),`Promotion ${p} must retain its original hash record.`);
});
test('follow-up transactions execute only new deltas and retain accepted operation provenance',()=>{
 const initial=fixture('spine'),candidate=sequences(initial).A,accepted=accept(candidate),base={...accepted,targetNodeId:initial.targetNodeId,kind:initial.kind};const before=hash(accepted);const reflect=operation('geometry.structure.reflect','op:followup-reflect',base);const next=run(base,[reflect]);assert.equal(next.status,'committed-candidate',next.error);assert.equal(next.model.constructionIntegration.instances.main.reflected,false);assert.equal(next.model.constructionIntegration.instances.main.design.apertureExtension.apertures.length,1);assert.deepEqual(next.model.constructionIntegration.operationHistory.map(o=>o.id),['op:reflect','op:aperture']);assert.equal(next.model.operations.length,1);assert.equal(hash(accepted),before);assert.equal(run(base,[{...reflect,id:'op:reflect'}]).status,'rejected');
});
test('frozen prerequisite sources match reviewed source hashes',()=>{
 const sources=JSON.parse(readFileSync(new URL('./baseline-sources.json',import.meta.url)));for(const [path,expected]of Object.entries(sources))assert.equal(createHash('sha256').update(readFileSync(new URL(`./baseline/${path}`,import.meta.url))).digest('hex'),expected,path);
});
test('saved TTFs and embedded review bytes match current transactions; compiled operation orders have equal outlines',async()=>{
 const {compile}=await import('./baseline/architecture/universal-design-model/construction-experiment/two-storey-grammar/font.mjs');const html=readFileSync(new URL('./review.html',import.meta.url),'utf8');
 for(const kind of ['ring','spine']){const s=sequences(fixture(kind)),compiled={};for(const [stage,result]of Object.entries(s)){const font=compile(result.family.glyphOrder.map(id=>result.family.glyphs[id]),`LFCFoundry Composition ${kind} ${stage}`);compiled[stage]=font;const bytes=readFileSync(new URL(`./artifacts/LFCFoundry-Composition-${kind}-${stage}.ttf`,import.meta.url));assert.deepEqual(bytes,Buffer.from(font.bytes));assert.ok(html.includes(bytes.toString('base64')));assert.deepEqual(font.parsed.glyphs.control,compiled.baseline.parsed.glyphs.control);}const ch=kind==='ring'?'o':'a';assert.deepEqual(compiled.A.parsed.glyphs[ch],compiled.B.parsed.glyphs[ch]);}
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|fetch\(|import\(/i);
});
