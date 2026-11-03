import { createHash } from 'node:crypto';
import { deriveGlyph } from './geometry-adapter.mjs';
import { deriveStemShoulderGeometry } from './h-adapter.mjs';
import { executeTransaction, canonicalizeInitialGeometry, resolveSelector } from '../integration-experiment/engine.mjs';
import { createAcceptedSource, runRequest, acceptCandidate } from '../construction-experiment/lowercase-h-topology-slice/scenario.mjs';
import { compilerProject } from '../construction-experiment/font-adapter.mjs';
import { compileTypeface } from '../../../prototype/src/font.js';
import { auditSfnt } from '../../../prototype/src/sfnt-audit.js';
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x==='object' ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])) : x;
export const hash = x => createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const copy = structuredClone;
const freeze = x => { if(x && typeof x==='object'){ Object.freeze(x);Object.values(x).forEach(v=>{if(v && typeof v==='object'&&!Object.isFrozen(v))freeze(v);});}return x; };
export const XHEIGHT = 'decision:x-height';
const rules = {
 'construction.ring-from-bowl-counter': ['xHeightDecisionId','uses-parameter'],
 'construction.connected-stems-and-shoulder': ['widthDecisionId','xHeightDecisionId'],
 'construction.parallel-stems-and-crossbar': ['widthDecisionId','capHeightDecisionId','thicknessDecisionId'],
 'construction.bowl-with-attached-stem': ['widthDecisionId','xHeightDecisionId'],
 'construction.ascender-stem-shoulder-return': ['widthDecisionId','xHeightDecisionId','ascenderDecisionId','alignmentDecisionId']
};
export function declarations(glyph) {
 const keys=rules[glyph.construction.method];if(!keys)throw Error('Unsupported construction dependency declaration');
 return glyph.construction.nodes.flatMap(node=>[
  ...Object.entries(node.parameters||{}).filter(([key])=>keys.includes(key)).map(([field,decisionId])=>({nodeId:node.id,field,decisionId})),
  ...(node.relations||[]).filter(r=>keys.includes(r.type)).map(r=>({nodeId:node.id,field:r.type,decisionId:r.targetId}))
 ]).map(edge=>({...edge,effects:['geometry','bounds','bearings','spacing-review','visual-review']}));
}
function overridesValid(source, overrides) {
 const seen=new Set();for(const o of overrides){
  const k=`${o.glyphId}:${o.property}`;if(seen.has(k))throw Error('Conflicting overrides');seen.add(k);
  const glyph=source.model.glyphRegistry.glyphs.find(g=>g.id===o.glyphId);
  if(!glyph || o.origin!=='explicit' || !o.provenance)throw Error('Missing override owner or provenance');
  // This bounded slice supports preserving an existing topology exception, not overriding x-height.
  if(o.property!=='glyph.construction.topology' || o.value!==glyph.construction.parameters?.topology)throw Error('Unsupported or conflicting override');
 }
}
export function plan(source, overrides=[]) {
 const m=source.model,rev=m.revisions.headRevisionId;
 if(m.revisions.acceptedRevisionId!==rev || !m.revisions.items.some(r=>r.id===rev&&r.status==='accepted'))throw Error('Stale or unaccepted source revision');
 overridesValid(source,overrides);
 const allIds=new Set(m.state.characteristics.map(d=>d.id));
 const dependencies=m.glyphRegistry.glyphs.map(g=>({glyphId:g.id,method:g.construction.method,constructionHash:hash(g.construction),reads:declarations(g)}));
 for(const d of dependencies)for(const edge of d.reads)if(!allIds.has(edge.decisionId))throw Error('Missing dependency decision');
 const affected=dependencies.filter(d=>d.reads.some(e=>e.decisionId===XHEIGHT)).map(d=>d.glyphId).sort();
 if(!affected.length)throw Error('No dependent constructions');
 const result={version:1,sourceRevisionId:rev,registryRevisionId:m.glyphRegistry.revisionId,sourceHash:hash(source),decisionId:XHEIGHT,dependencies,overrides:copy(overrides),affected,
 unaffected:dependencies.map(d=>d.glyphId).filter(id=>!affected.includes(id)).sort()};
 return {...result,hash:hash(result)};
}
export function deriveGuarded(glyph, model, edges=declarations(glyph)) {
 const allowed=new Set(edges.map(e=>e.decisionId)),consumed=new Set();
 const values=new Map(model.state.characteristics.map(d=>[d.id,d.value.value]));
 const readDecision=id=>{if(!allowed.has(id))throw Error(`Undeclared dependency read: ${id}`);if(!values.has(id))throw Error(`Missing dependency ${id}`);consumed.add(id);return values.get(id);};
 const guardedCharacteristics=model.state.characteristics.map(d=>({...d,value:{...d.value,get value(){return readDecision(d.id);}}}));
 const view={...model,state:{...model.state,characteristics:guardedCharacteristics},dependencySnapshot:[...allowed].sort().map(id=>[id,values.get(id)]),readDecision};
 const geometry=glyph.construction.method==='construction.ascender-stem-shoulder-return'?deriveStemShoulderGeometry(glyph,view):deriveGlyph(glyph,view);
 if([...allowed].some(id=>!consumed.has(id)))throw Error('Declared dependency not consumed');
 return {geometry,consumed:[...consumed].sort()};
}
export function fixture() {
 const base=createAcceptedSource();const built=runRequest(base,'Add a lowercase h with a vertical stem and shoulder, preserving every existing glyph.');
 if(built.status!=='committed-candidate')throw Error(built.error);const accepted=acceptCandidate(built);
 // Engineering fixture acceptance is not a human visual approval.
 return freeze({model:copy(accepted.model),family:copy(accepted.family),visualReview:{status:'not-reviewed'}});
}
function selector(model,id,ids){const s={id,universe:'glyph-registry-at-revision',registryRevisionId:model.glyphRegistry.revisionId,expression:{op:'any',args:ids.map(value=>({op:'glyph-id',value}))},exclude:[],resolution:null};s.resolution=resolveSelector(s,model.glyphRegistry.glyphs,{registryRevisionId:s.registryRevisionId});model.selectors.push(s);return s.id;}
export function prepare(source,{expected=500,value=520,overrides=[],dependencyPlan=plan(source,overrides)}={}) {
 if(![500,520].includes(value)||value===expected)throw Error('Unsupported x-height delta');
 if(JSON.stringify(dependencyPlan)!==JSON.stringify(plan(source,overrides)))throw Error('Stale or conflicting dependency plan');
 const current=source.model.state.characteristics.find(d=>d.id===XHEIGHT);if(current?.value?.value!==expected)throw Error('Stale expected prior value');
 const model=copy(source.model),family=copy(source.family),rev=model.revisions.headRevisionId;
 const intentId=`intent:xheight:${rev}:${value}`,setId=`op:xheight:${rev}:${value}`;
 const intent={id:intentId,kind:'characteristic',subject:{scope:'family'},predicate:'proportion.x-height',value:{kind:'font-units',value},source:{messageId:intentId,start:null,end:null,text:''},origin:'explicit',confidence:1,resolution:{status:'resolved',capability:'implemented-experiment',reason:'Structured input, not language interpretation'},supersedes:[],conflicts:[]};
 model.intent.statements.push(intent);model.operations=[];
 const makeOp=(id,type,ids,parameters,dependsOn=[])=>({id,type,selectorId:selector(model,`sel:${id}`,ids),parameters,phase:'construction',dependsOn,preconditions:[{type:'revision',id:rev}],postconditions:['geometry-valid','metrics-valid'],metricPolicy:{advance:'preserve',bearings:'recompute-from-bounds',kerning:'invalidate-for-review'},provenance:{intentIds:[intentId],acceptedDecisionIds:[XHEIGHT]},capability:'implemented-experiment',resolution:{status:'resolved',reason:null},conflicts:[],exceptions:[]});
 model.operations.push(makeOp(setId,'family.xheight.set',[dependencyPlan.affected[0]],{expected,value,planHash:dependencyPlan.hash}));
 for(const id of dependencyPlan.affected)model.operations.push(makeOp(`${setId}:${id}`,'construction.rederive',[id],{glyphId:id,planHash:dependencyPlan.hash},[setId]));
 return {source,model,family,plan:dependencyPlan,expected,value,setId,intentId};
}
export function compile(model) {
 const p=compilerProject(model);p.design.xHeight=model.state.characteristics.find(d=>d.id===XHEIGHT).value.value;
 const font=compileTypeface(p,'Regular');return {...font,audit:auditSfnt(font.bytes)};
}
export function runPrepared(p,{derive=deriveGuarded,compiler=compile}={}) {
 const reject=error=>({status:'rejected',error:String(error.message||error),model:p.source.model,family:p.source.family,revision:null});
 try {
  if(JSON.stringify(plan(p.source,p.plan.overrides))!==JSON.stringify(p.plan))throw Error('Stale dependency plan');
  for(const op of p.model.operations){
   const s=p.model.selectors.find(s=>s.id===op.selectorId),expected=op.type==='family.xheight.set'?[p.plan.affected[0]]:[op.parameters.glyphId];
   const resolved=resolveSelector({...s,resolution:null},p.model.glyphRegistry.glyphs,{registryRevisionId:p.model.glyphRegistry.revisionId});
   if(!s || JSON.stringify(s.resolution?.includedGlyphIds)!==JSON.stringify(expected) || JSON.stringify(resolved.includedGlyphIds)!==JSON.stringify(expected))throw Error('Conflicting selector membership');
  }
  const handlers={
   'family.xheight.set':({model,glyph,operation})=>{
    if(glyph.id!==p.plan.affected[0]||operation.parameters.expected!==p.expected||operation.parameters.value!==p.value||operation.parameters.planHash!==p.plan.hash)throw Error('Incorrect family operation scope');
    const d=model.state.characteristics.find(d=>d.id===XHEIGHT);if(d.value.value!==p.expected)throw Error('Stale canonical decision');
    model.constructionIntegration.familyPropagation={version:1,sourceRevisionId:p.plan.sourceRevisionId,previousDecision:copy(d),plan:copy(p.plan),intentId:p.intentId,review:{spacing:'required',kerning:'required',visual:'not-reviewed'}};
    d.value.value=p.value;d.origin='explicit';d.acceptance='candidate';d.sourceIntentIds=[p.intentId];
   },
   'construction.rederive':({model,family,glyph,operation})=>{
    const declaration=p.plan.dependencies.find(d=>d.glyphId===glyph.id),semantic=model.glyphRegistry.glyphs.find(g=>g.id===glyph.id);
    if(operation.parameters.glyphId!==glyph.id||operation.parameters.planHash!==p.plan.hash||hash(semantic.construction)!==declaration.constructionHash)throw Error('Stale construction target');
    const {geometry,consumed}=derive(semantic,model,declaration.reads);
    if(geometry.metrics.advanceWidth!==semantic.metrics.advanceWidth || geometry.metrics.leftSideBearing!==geometry.bounds.xMin || geometry.metrics.rightSideBearing!==geometry.metrics.advanceWidth-geometry.bounds.xMax)throw Error('Derived geometry violates metric policy');
    const canonical=canonicalizeInitialGeometry({glyphOrder:[glyph.id],glyphs:{[glyph.id]:geometry}}).glyphs[glyph.id];
    Object.assign(glyph,copy(canonical));model.derived.geometry.glyphs[glyph.id]=copy(canonical);
    model.constructionIntegration.familyPropagation.consumption||={};model.constructionIntegration.familyPropagation.consumption[glyph.id]=consumed;
   }
  };
  const tx=executeTransaction(p.model,p.family,{operationHandlers:handlers});if(tx.status!=='committed-candidate')throw Error(tx.error);
  if(JSON.stringify(Object.keys(tx.model.constructionIntegration.familyPropagation.consumption||{}).sort())!==JSON.stringify(p.plan.affected))throw Error('Required glyph rebuild missing');
  tx.model.derived.geometry.sourceRevisionId=tx.revision.id;
  const font=compiler(tx.model);if(!font.audit?.valid)throw Error('Downstream font audit failed');
  const project=compilerProject(tx.model);
  for(const id of tx.family.glyphOrder){
   if(JSON.stringify(project.glyphs[id].contours)!==JSON.stringify(tx.family.glyphs[id].contours))throw Error('Validated/compiler outline mismatch');
   const g=tx.family.glyphs[id],parsed=font.parsed.glyphs[g.name];if(!parsed||parsed.unicodes[0]!==g.unicode||parsed.advanceWidth!==g.metrics.advanceWidth)throw Error('Font mapping or advance mismatch');
  }
  for(const id of p.plan.unaffected)if(hash(tx.family.glyphs[id])!==hash(p.source.family.glyphs[id]))throw Error('Unaffected glyph mutated');
  return {...tx,font,plan:p.plan,technicalStatus:'passed',visualReview:{status:'not-reviewed',approved:false},diffs:Object.fromEntries(p.plan.dependencies.map(d=>[d.glyphId,{before:{bounds:p.source.family.glyphs[d.glyphId].bounds,metrics:p.source.family.glyphs[d.glyphId].metrics},after:{bounds:tx.family.glyphs[d.glyphId].bounds,metrics:tx.family.glyphs[d.glyphId].metrics}}]))};
 }catch(e){return reject(e);}
}
export function run(source,options={},hooks={}){try{return runPrepared(prepare(source,options),hooks);}catch(e){return {status:'rejected',error:e.message,model:source.model,family:source.family,revision:null};}}
export function accept(result,review){
 if(result.status!=='committed-candidate'||review?.decision!=='approved'||!review.reviewer||!review.evidenceRefs?.length)throw Error('Human visual approval required');
 const model=copy(result.model),family=copy(result.family);model.revisions.items.at(-1).status='accepted';model.revisions.acceptedRevisionId=model.revisions.headRevisionId;
 for(const d of model.state.characteristics)if(d.acceptance==='candidate')d.acceptance='accepted';
 return freeze({model,family,visualReview:copy(review)});
}
