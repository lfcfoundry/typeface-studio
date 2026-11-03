import {createHash} from 'node:crypto';
import {executeTransaction,reflectGlyph,resolveSelector,validateV2Model} from './extended-executor.mjs';
import {ringFixture,spineFixture,ringAdapter,spineAdapter} from './baseline/architecture/universal-design-model/construction-experiment/cross-grammar-aperture/grammars.mjs';
import {derive,execute as apertureExecute,operation as apertureOperation} from './baseline/architecture/universal-design-model/construction-experiment/cross-grammar-aperture/operation.mjs';
import {contourBounds,validateGlyph} from './baseline/prototype/src/contours.js';
export const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const adapters=Object.freeze({'capability:ring-quadratic':ringAdapter,'capability:spine-quadratic':spineAdapter});
const clone=structuredClone;
function moveGlyph(g,dx,prefix){
 const move=p=>({...p,x:p.x+dx,...(p.id?{id:prefix+p.id}:{})});
 g.contours=g.contours.map(c=>({...c,id:prefix+c.id,start:move(c.start),points:c.points.map(move),segments:c.segments.map(s=>({...s,id:prefix+s.id,from:move(s.from),to:move(s.to),...(s.control?{control:move(s.control)}:{})}))}));return g;
}
export function renderGlyph(model,glyph){
 const instances=Object.entries(model.constructionIntegration.instances).filter(([,c])=>c.ownerGlyphId===glyph.id),contours=[],components=[];
 for(const [id,c]of instances){
  const adapter=adapters[c.capability];if(!adapter)throw Error(`Unregistered construction capability ${c.capability}`);
  let g=clone(derive(c.design,adapter));
  const ports=(g.aperturePorts||[]).map(p=>({...p,ownerInstanceId:id,boundaryFrame:'object',presentationHandedness:c.reflected?'reflected':'normal',endpoints:clone(p.endpoints)}));
  if(c.reflected){reflectGlyph(g);for(const p of ports){for(const endpoint of Object.values(p.endpoints))endpoint.x=g.metrics.advanceWidth-endpoint.x;p.presentationExposedSide='right';}}
  for(const p of ports){p.id=`${id}/${p.id}`;for(const endpoint of Object.values(p.endpoints))endpoint.x+=c.offsetX;}
  g=moveGlyph(g,c.offsetX,`${id}/`);contours.push(...g.contours);
  components.push({id,sourceGlyphId:c.design.id,nodeIds:c.design.construction.nodes.map(n=>n.id),transform:{xx:c.reflected?-1:1,xy:0,yx:0,yy:1,dx:c.offsetX+(c.reflected?c.design.decisions.advance:0),dy:0},ports});
 }
 const bounds=contourBounds(contours),result={...glyph,contours,bounds,components,metrics:{advanceWidth:glyph.metrics.advanceWidth,leftSideBearing:bounds.xMin,rightSideBearing:glyph.metrics.advanceWidth-bounds.xMax}};
 const errors=validateGlyph({...result,advanceWidth:result.metrics.advanceWidth,rightSideBearing:result.metrics.rightSideBearing});if(errors.length)throw Error(errors.join('; '));return result;
}
export function fixture(kind='ring'){
 if(!['ring','spine'].includes(kind))throw Error('Unsupported fixture construction');
 const design=kind==='ring'?ringFixture():spineFixture(),capability=kind==='ring'?'capability:ring-quadratic':'capability:spine-quadratic',base='rev:transaction-base';
 const glyph={id:'glyph:assembly',name:kind==='ring'?'o':'a',character:kind==='ring'?'o':'a',unicode:kind==='ring'?111:97,contours:[],components:[],metrics:{advanceWidth:1350,leftSideBearing:55,rightSideBearing:55}};
 const model={type:'lfcfoundry.universal-typeface-design',schemaVersion:2,designId:`design:transaction-${kind}`,family:{name:'LFCFoundry Universal Composition',unitsPerEm:1000},input:{brief:'Diagnostic construction composition',language:'en',messages:[]},intent:{statements:[]},state:{characteristics:[],decisions:[],constraints:[]},glyphRegistry:{revisionId:base,glyphs:[]},selectors:[],operations:[],revisions:{acceptedRevisionId:base,headRevisionId:base,items:[{id:base,parentRevisionIds:[],status:'accepted',decisionIds:[],operationIds:[],changedGlyphIds:[],preservedGlyphIds:[]}]},constructionIntegration:{version:1,operationHistory:[],instances:{main:{ownerGlyphId:glyph.id,capability,design:clone(design),offsetX:0,reflected:false},support:{ownerGlyphId:glyph.id,capability,design:clone(design),offsetX:700,reflected:false}},selectors:[{id:'component:main',registryRevisionId:base,instanceIds:['main']},{id:'component:support',registryRevisionId:base,instanceIds:['support']}],trace:[]}};
 const initial=renderGlyph(model,glyph),control=clone(derive(design,adapters[capability]));control.id='glyph:control';control.name='control';control.unicode=null;
 const family={metadata:{family:model.family.name,designer:'LFCFoundry',version:'0.100'},metrics:{unitsPerEm:1000,ascender:800,descender:-200},design:{weight:400,xHeight:500,capHeight:700},glyphOrder:[glyph.id,control.id],glyphs:{[glyph.id]:initial,[control.id]:control}};
 model.glyphRegistry.glyphs=family.glyphOrder.map(id=>{const g=family.glyphs[id];return {id:g.id,name:g.name,character:g.character??null,unicodes:g.unicode===null?[]:[g.unicode],classes:g.unicode===null?[]:['letter','lowercase'],metrics:clone(g.metrics)};});
 model.selectors=[{id:'glyph:selection',universe:'glyph-registry-at-revision',registryRevisionId:base,expression:{op:'glyph-id',value:glyph.id},exclude:[],resolution:{status:'resolved',includedGlyphIds:[glyph.id],excludedGlyphIds:[],reason:null}}];
 return {model,family,kind,targetNodeId:kind==='ring'?'region:ring':'bowl:1'};
}
export function operation(type,id,base,{dependsOn=[],componentSelectorId='component:main',halfExtent=.25}={}){
 return {id,type,selectorId:'glyph:selection',phase:type==='semantic.aperture.open'?'construction':'geometry',parameters:{componentSelectorId,...(type==='semantic.aperture.open'?{nodeId:base.targetNodeId,boundary:'exposed-side',halfExtent,terminal:'flat'}:{axis:'component-advance-midpoint',frame:'object'})},dependsOn,preconditions:[{type:'revision',id:base.model.revisions.headRevisionId}],postconditions:[],metricPolicy:{advance:'preserve',bearings:'recompute',kerning:'invalidate-for-review'},provenance:{intentIds:[`intent:${id}`],acceptedDecisionIds:[]},capability:'implemented',resolution:{status:'resolved',reason:null},conflicts:[],exceptions:[]};
}
function selection(model,glyph,op){const selector=model.constructionIntegration.selectors.find(s=>s.id===op.parameters.componentSelectorId);if(!selector||selector.registryRevisionId!==model.glyphRegistry.revisionId||!selector.instanceIds.length||new Set(selector.instanceIds).size!==selector.instanceIds.length)throw Error('Missing, stale or ambiguous component selector');const selected=selector.instanceIds.map(id=>{const c=model.constructionIntegration.instances[id];if(!c||c.ownerGlyphId!==glyph.id)throw Error('Component target absent from selected glyph');return [id,c];});return selected;}
const handler=({model,family,glyph,operation:op})=>{
 const selected=selection(model,glyph,op);
 for(const [id,c]of selected){if(op.type==='geometry.structure.reflect'){if(op.parameters.axis!=='component-advance-midpoint'||op.parameters.frame!=='object')throw Error('Unsupported reflection axis/frame');c.reflected=!c.reflected;}
 else {const a=apertureOperation(c.design,op.parameters.nodeId);a.id=op.id;a.parameters={...a.parameters,boundary:op.parameters.boundary,halfExtent:op.parameters.halfExtent,terminal:op.parameters.terminal};const r=apertureExecute(c.design,a,adapters[c.capability]);if(r.status!=='candidate')throw Error(r.error);c.design=r.model;}
 }
 const rendered=renderGlyph(model,glyph);Object.assign(glyph,rendered);model.constructionIntegration.trace.push({operationId:op.id,selectedInstanceIds:selected.map(([id])=>id),geometryHash:hash(glyph.contours),ports:clone(glyph.components.flatMap(c=>c.ports))});
};
export const operationHandlers=Object.freeze({'geometry.structure.reflect':handler,'semantic.aperture.open':handler});
export function run(base,operations){
 try{
  if(base.model.revisions.acceptedRevisionId!==base.model.revisions.headRevisionId||base.model.revisions.items.at(-1).status!=='accepted')throw Error('Transactions must start from accepted state');
  const model=clone(base.model);const history=model.constructionIntegration.operationHistory;for(const previous of model.operations)if(!history.some(op=>op.id===previous.id))history.push(clone(previous));if(operations.some(op=>history.some(old=>old.id===op.id)))throw Error('Operation identity already accepted');model.operations=clone(operations);model.intent.statements.push(...operations.map(op=>({id:op.provenance.intentIds[0],origin:'explicit',predicate:op.type,source:{text:'Explicit experimental operation'}})));
  for(const selector of model.selectors){if(selector.registryRevisionId!==model.glyphRegistry.revisionId)throw Error('Stale glyph selector');const fresh=resolveSelector(selector,model.glyphRegistry.glyphs,{registryRevisionId:model.glyphRegistry.revisionId});if(hash(fresh.includedGlyphIds)!==hash(selector.resolution.includedGlyphIds))throw Error('Selector snapshot differs from expression');}
  for(const op of operations)if(!Object.hasOwn(operationHandlers,op.type))throw Error('Unregistered integrated operation');
  for(const op of operations)if(op.preconditions?.length!==1||op.preconditions[0].id!==model.revisions.headRevisionId)throw Error('Stale operation precondition');
  const result=executeTransaction(model,base.family,{operationHandlers});
  if(result.status==='rejected')return {...result,model:base.model,family:base.family};
  return {...result,seal:hash({model:result.model,family:result.family})};
 }catch(error){return {status:'rejected',error:error.message,model:base.model,family:base.family,revision:null};}
}
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}
export function accept(result){if(result.status!=='committed-candidate'||result.seal!==hash({model:result.model,family:result.family}))throw Error('Only an unmodified validated candidate can be accepted');const accepted={model:clone(result.model),family:clone(result.family)};const errors=validateV2Model(accepted.model);if(errors.length)throw Error(errors.join(';'));accepted.model.revisions.items.at(-1).status='accepted';accepted.model.revisions.acceptedRevisionId=accepted.model.revisions.headRevisionId;return freeze(accepted);}
export function extendCandidate(base,candidate,next){if(candidate.status!=='committed-candidate'||candidate.model.revisions.items.at(-1).parentRevisionIds[0]!==base.model.revisions.headRevisionId||candidate.seal!==hash({model:candidate.model,family:candidate.family}))throw Error('Invalid candidate continuation');return run(base,[...candidate.model.operations,next]);}
export function sequences(base){const reflect=operation('geometry.structure.reflect','op:reflect',base),aperture=operation('semantic.aperture.open','op:aperture',base);const reflection=run(base,[reflect]),apertureOnly=run(base,[aperture]);return {baseline:{model:base.model,family:base.family},reflection,aperture:apertureOnly,A:extendCandidate(base,reflection,{...aperture,dependsOn:[reflect.id]}),B:extendCandidate(base,apertureOnly,{...reflect,dependsOn:[aperture.id]})};}
