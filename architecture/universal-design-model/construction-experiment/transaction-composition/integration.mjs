import {createHash} from 'node:crypto';
import {executeTransaction,reflectGlyph,resolveSelector,validateV2Model} from './extended-executor.mjs';
import {ringFixture,ringAdapter} from './baseline/architecture/universal-design-model/construction-experiment/cross-grammar-aperture/grammars.mjs';
import {spineFixture,spineAdapter} from '../cross-grammar-aperture/grammars.mjs';
import {derive,execute as apertureExecute,operation as apertureOperation} from './baseline/architecture/universal-design-model/construction-experiment/cross-grammar-aperture/operation.mjs';
import {contourBounds,validateGlyph} from './baseline/prototype/src/contours.js';
import {buildLowercaseACandidate,deriveGlyph,validateSemanticDesign} from '../index.mjs';
import {validateTerminalProfileRecord} from '../terminal-profile-record.mjs';
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
  let g;
  if(c.capability==='capability:a-single-storey'){
   const source=c.design.glyphRegistry.glyphs.find(item=>item.id===c.sourceGlyphId);
   if(!source)throw Error(`Missing semantic construction glyph ${c.sourceGlyphId}`);
   const errors=validateSemanticDesign(c.design);if(errors.length)throw Error(errors.join('; '));
   g=clone(deriveGlyph(source,c.design));
  }else{
   const adapter=adapters[c.capability];if(!adapter)throw Error(`Unregistered construction capability ${c.capability}`);
   g=clone(derive(c.design,adapter));
  }
  const ports=(g.aperturePorts||[]).map(p=>({...p,ownerInstanceId:id,boundaryFrame:'object',presentationHandedness:c.reflected?'reflected':'normal',endpoints:clone(p.endpoints)}));
  if(c.reflected){reflectGlyph(g);for(const p of ports){for(const endpoint of Object.values(p.endpoints))endpoint.x=g.metrics.advanceWidth-endpoint.x;p.presentationExposedSide='right';}}
  for(const p of ports){p.id=`${id}/${p.id}`;for(const endpoint of Object.values(p.endpoints))endpoint.x+=c.offsetX;}
  const source=c.capability==='capability:a-single-storey'?c.design.glyphRegistry.glyphs.find(item=>item.id===c.sourceGlyphId):c.design;
  g=moveGlyph(g,c.offsetX,`${id}/`);contours.push(...g.contours);
  components.push({id,sourceGlyphId:source.id,nodeIds:source.construction.nodes.map(n=>n.id),transform:{xx:c.reflected?-1:1,xy:0,yx:0,yy:1,dx:c.offsetX+(c.reflected?g.metrics.advanceWidth:0),dy:0},ports});
 }
 const bounds=contourBounds(contours),result={...glyph,contours,bounds,components,metrics:{advanceWidth:glyph.metrics.advanceWidth,leftSideBearing:bounds.xMin,rightSideBearing:glyph.metrics.advanceWidth-bounds.xMax}};
 const errors=validateGlyph({...result,advanceWidth:result.metrics.advanceWidth,rightSideBearing:result.metrics.rightSideBearing});if(errors.length)throw Error(errors.join('; '));return result;
}
export function fixture(kind='ring'){
 if(!['ring','spine','a'].includes(kind))throw Error('Unsupported fixture construction');
 let design,capability,sourceGlyphId=null;
 if(kind==='a'){
  design=buildLowercaseACandidate().model;
  design.revisions.items.at(-1).status='accepted';design.revisions.acceptedRevisionId=design.revisions.headRevisionId;
  capability='capability:a-single-storey';sourceGlyphId='glyph:u0061';
 }else{design=kind==='ring'?ringFixture():spineFixture();capability=kind==='ring'?'capability:ring-quadratic':'capability:spine-quadratic';}
 const base='rev:transaction-base';
 const glyph={id:'glyph:assembly',name:kind==='ring'?'o':'a',character:kind==='ring'?'o':'a',unicode:kind==='ring'?111:97,contours:[],components:[],metrics:{advanceWidth:1350,leftSideBearing:55,rightSideBearing:55}};
 const model={type:'lfcfoundry.universal-typeface-design',schemaVersion:2,designId:`design:transaction-${kind}`,family:{name:'LFCFoundry Universal Composition',unitsPerEm:1000},input:{brief:'Diagnostic construction composition',language:'en',messages:[]},intent:{statements:[]},state:{characteristics:[],decisions:[],constraints:[]},glyphRegistry:{revisionId:base,glyphs:[]},selectors:[],operations:[],revisions:{acceptedRevisionId:base,headRevisionId:base,items:[{id:base,parentRevisionIds:[],status:'accepted',decisionIds:[],operationIds:[],changedGlyphIds:[],preservedGlyphIds:[]}]},constructionIntegration:{version:1,operationHistory:[],instances:{main:{ownerGlyphId:glyph.id,capability,design:clone(design),...(sourceGlyphId?{sourceGlyphId}:{}),offsetX:0,reflected:false},support:{ownerGlyphId:glyph.id,capability,design:clone(design),...(sourceGlyphId?{sourceGlyphId}:{}),offsetX:700,reflected:false}},selectors:[{id:'component:main',registryRevisionId:base,instanceIds:['main']},{id:'component:support',registryRevisionId:base,instanceIds:['support']}],trace:[]}};
 const initial=renderGlyph(model,glyph),control=kind==='a'?clone(deriveGlyph(design.glyphRegistry.glyphs.find(item=>item.id===sourceGlyphId),design)):clone(derive(design,adapters[capability]));control.id='glyph:control';control.name='control';control.unicode=null;
 const family={metadata:{family:model.family.name,designer:'LFCFoundry',version:'0.100'},metrics:{unitsPerEm:1000,ascender:800,descender:-200},design:{weight:400,xHeight:500,capHeight:700},glyphOrder:[glyph.id,control.id],glyphs:{[glyph.id]:initial,[control.id]:control}};
 model.glyphRegistry.glyphs=family.glyphOrder.map(id=>{const g=family.glyphs[id];return {id:g.id,name:g.name,character:g.character??null,unicodes:g.unicode===null?[]:[g.unicode],classes:g.unicode===null?[]:['letter','lowercase'],metrics:clone(g.metrics)};});
 model.selectors=[{id:'glyph:selection',universe:'glyph-registry-at-revision',registryRevisionId:base,expression:{op:'glyph-id',value:glyph.id},exclude:[],resolution:{status:'resolved',includedGlyphIds:[glyph.id],excludedGlyphIds:[],reason:null}}];
 return {model,family,kind,targetNodeId:kind==='ring'?'region:ring':'bowl:1',terminalId:kind==='spine'?'top':'part:a-upper-terminal'};
}
export function operation(type,id,base,{dependsOn=[],componentSelectorId='component:main',halfExtent=.25,terminalId=base.terminalId,expectedProfile='flat',profile='chamfered',orientation='outer-right',cutRatio=.2,expectedConstructionRevisionId=null}={}){
 const componentSelector=base.model.constructionIntegration.selectors.find(item=>item.id===componentSelectorId),selectedInstance=componentSelector?.instanceIds?.length===1?base.model.constructionIntegration.instances[componentSelector.instanceIds[0]]:null;
 const terminalParameters=type==='semantic.terminal.set-profile'?{componentSelectorId,terminalId,expectedProfile,profile,orientation,cutRatio,expectedConstructionRevisionId:expectedConstructionRevisionId??selectedInstance?.design?.revisions?.headRevisionId??selectedInstance?.design?.revision?.id??null}:null;
 const parameters=terminalParameters||{componentSelectorId,...(type==='semantic.aperture.open'?{nodeId:base.targetNodeId,boundary:'exposed-side',halfExtent,terminal:'flat'}:{axis:'component-advance-midpoint',frame:'object'})};
 const source=type==='semantic.terminal.set-profile'?{text:`Set ${terminalId} to the ${profile} terminal profile.`}:null;
 return {id,type,selectorId:'glyph:selection',phase:type==='semantic.aperture.open'||type==='semantic.terminal.set-profile'?'construction':'geometry',parameters,dependsOn,preconditions:[{type:'revision',id:base.model.revisions.headRevisionId}],postconditions:[],metricPolicy:{advance:'preserve',bearings:type==='semantic.terminal.set-profile'?'recompute-from-derived-bounds':'recompute',kerning:'invalidate-for-review'},provenance:{intentIds:[`intent:${id}`],acceptedDecisionIds:[],...(source?{source}: {})},capability:'implemented',resolution:{status:'resolved',reason:null},conflicts:[],exceptions:[]};
}
function selection(model,glyph,op){const selector=model.constructionIntegration.selectors.find(s=>s.id===op.parameters.componentSelectorId);if(!selector||selector.registryRevisionId!==model.glyphRegistry.revisionId||!selector.instanceIds.length||new Set(selector.instanceIds).size!==selector.instanceIds.length)throw Error('Missing, stale or ambiguous component selector');const selected=selector.instanceIds.map(id=>{const c=model.constructionIntegration.instances[id];if(!c||c.ownerGlyphId!==glyph.id)throw Error('Component target absent from selected glyph');return [id,c];});return selected;}
const handler=({model,family,glyph,operation:op})=>{
 const selected=selection(model,glyph,op);
 for(const [id,c]of selected){if(op.type==='geometry.structure.reflect'){if(op.parameters.axis!=='component-advance-midpoint'||op.parameters.frame!=='object')throw Error('Unsupported reflection axis/frame');c.reflected=!c.reflected;}
 else if(op.type==='semantic.terminal.set-profile'){applyTerminalProfile(c,selected,op);}
 else {const adapter=adapters[c.capability];if(!adapter)throw Error(`Construction capability ${c.capability} does not support semantic aperture operations`);const a=apertureOperation(c.design,op.parameters.nodeId);a.id=op.id;a.parameters={...a.parameters,boundary:op.parameters.boundary,halfExtent:op.parameters.halfExtent,terminal:op.parameters.terminal};const r=apertureExecute(c.design,a,adapter);if(r.status!=='candidate')throw Error(r.error);c.design=r.model;}
 }
 const rendered=renderGlyph(model,glyph);Object.assign(glyph,rendered);model.constructionIntegration.trace.push({operationId:op.id,selectedInstanceIds:selected.map(([id])=>id),geometryHash:hash(glyph.contours),ports:clone(glyph.components.flatMap(c=>c.ports))});
};
function applyTerminalProfile(instance,selected,op){
 const p=op.parameters,keys=['componentSelectorId','terminalId','expectedProfile','profile','orientation','cutRatio','expectedConstructionRevisionId'];
 if(Object.keys(p).some(key=>!keys.includes(key))||keys.some(key=>!Object.hasOwn(p,key)))throw Error('Malformed terminal-profile parameter schema');
 if(selected.length!==1)throw Error('Terminal profile operation requires exactly one construction instance');
 const profileErrors=validateTerminalProfileRecord({profile:p.profile,orientation:p.orientation,cutRatio:p.cutRatio});
 if(profileErrors.length)throw Error(`Unsupported requested terminal profile or parameters: ${profileErrors.join('; ')}`);
 if(instance.capability==='capability:spine-quadratic')return applySpineTerminalProfile(instance,selected,op,p);
 if(instance.capability!=='capability:a-single-storey')throw Error(`Construction capability ${instance.capability} does not support terminal profiles`);
 const design=instance.design;
 if(design.revisions.headRevisionId!==design.revisions.acceptedRevisionId||p.expectedConstructionRevisionId!==design.revisions.acceptedRevisionId)throw Error('Stale semantic construction revision for terminal target');
 const source=design.glyphRegistry.glyphs.find(item=>item.id===instance.sourceGlyphId);
 if(!source)throw Error(`Missing construction glyph ${instance.sourceGlyphId}`);
 const matches=source.construction.nodes.filter(item=>item.id===p.terminalId);
 if(!matches.length)throw Error(`Missing terminal target ${p.terminalId}`);
 if(matches.length!==1)throw Error(`Ambiguous terminal target ${p.terminalId}`);
 const errors=validateSemanticDesign(design);if(errors.length)throw Error(`Invalid accepted semantic construction: ${errors.join('; ')}`);
 const terminal=matches[0];
 if(terminal.kind!=='anatomy.terminal'||terminal.role!=='upper-stem-terminal')throw Error(`Unsupported terminal target role ${terminal.role}`);
 if(terminal.parameters.profile!==p.expectedProfile)throw Error(`Terminal profile precondition failed: expected ${p.expectedProfile}, found ${terminal.parameters.profile}`);
 if(p.expectedProfile!=='flat'||p.profile!=='chamfered')throw Error('Unsupported terminal profile transition');
 const previous=clone(terminal.parameters);terminal.parameters={profile:p.profile,alignmentDecisionId:previous.alignmentDecisionId,orientation:p.orientation,cutRatio:p.cutRatio};
 const semanticErrors=validateSemanticDesign(design);if(semanticErrors.length)throw Error(semanticErrors.join('; '));
 const derived=deriveGlyph(source,design);
 const oldRevision=design.revisions.headRevisionId;
 const innerIntentId=`intent:${op.id}:semantic`;
 const innerOperation={...clone(op),selectorId:'sel:add-lowercase-a',parameters:{terminalId:p.terminalId,expectedProfile:p.expectedProfile,profile:p.profile,orientation:p.orientation,cutRatio:p.cutRatio},dependsOn:[],preconditions:[{type:'revision',id:oldRevision}],provenance:{...clone(op.provenance),intentIds:[innerIntentId]}};
 if(design.operations.some(item=>item.id===innerOperation.id))throw Error(`Operation identity ${innerOperation.id} already exists in semantic construction history`);
 design.intent.statements.push({id:innerIntentId,kind:'construction',subject:{scope:'glyph',selectorId:'sel:add-lowercase-a'},predicate:op.type,value:{target:{glyphId:source.id,terminalId:p.terminalId},parameters:clone(innerOperation.parameters)},source:clone(op.provenance.source),origin:'explicit',confidence:1,resolution:{status:'resolved',capability:'implemented',reason:null},supersedes:[],conflicts:[]});
 design.operations.push(innerOperation);
 const revisionId=`rev:${hash({designId:design.designId,baseRevisionId:oldRevision,operation:innerOperation,construction:source.construction}).slice(0,16)}`;
 for(const selector of design.selectors)selector.registryRevisionId=revisionId;
 design.glyphRegistry.revisionId=revisionId;
 design.revisions.items.push({id:revisionId,parentRevisionIds:[oldRevision],status:'candidate',decisionIds:[...design.state.decisions],operationIds:[op.id],deltaOperationIds:[op.id],changedGlyphIds:[source.id],preservedGlyphIds:design.glyphRegistry.glyphs.filter(item=>item.id!==source.id).map(item=>item.id),targetedGlyphIds:[source.id],preservedDecisionIds:[...design.state.decisions],diff:{semanticChanges:[{glyphId:source.id,terminalId:p.terminalId,from:previous,to:clone(terminal.parameters)}],geometryChanges:[source.id]}});
 design.revisions.headRevisionId=revisionId;
 design.derived.geometry={...design.derived.geometry,sourceRevisionId:revisionId,glyphs:{...design.derived.geometry.glyphs,[source.id]:derived}};
 design.derived.latestDiff=design.revisions.items.at(-1).diff;
}
function applySpineTerminalProfile(instance,selected,op,p){
 if(selected.length!==1)throw Error('Terminal profile operation requires exactly one construction instance');
 const design=instance.design,adapter=adapters[instance.capability];
 if(design.revision?.status!=='accepted'||p.expectedConstructionRevisionId!==design.revision.id)throw Error('Stale semantic construction revision for terminal target');
 const matches=design.construction.nodes.filter(item=>item.id===p.terminalId);
 if(!matches.length)throw Error(`Missing terminal target ${p.terminalId}`);
 if(matches.length!==1)throw Error(`Ambiguous terminal target ${p.terminalId}`);
 const terminal=matches[0];
 if(terminal.component!=='terminal'||terminal.role!=='upper-stem-terminal')throw Error(`Unsupported terminal target role ${terminal.role}`);
 if(terminal.parameters?.profile!==p.expectedProfile)throw Error(`Terminal profile precondition failed: expected ${p.expectedProfile}, found ${terminal.parameters?.profile}`);
 if(p.expectedProfile!=='flat'||p.profile!=='chamfered')throw Error('Unsupported terminal profile transition');
 const terminalRelation=design.construction.relations.filter(r=>r.type==='terminates'&&r.source===terminal.id);
 if(terminalRelation.length!==1||terminalRelation[0].target!=='spine'||terminalRelation[0].port!=='top')throw Error('Terminal is not uniquely owned by the selected spine');
 const before=derive(design,adapter),previous=clone(terminal.parameters);
 terminal.parameters={profile:p.profile,orientation:p.orientation,cutRatio:p.cutRatio};
 const geometry=derive(design,adapter);
 if(op.metricPolicy?.advance!=='preserve'||op.metricPolicy?.bearings!=='recompute-from-derived-bounds'||op.metricPolicy?.kerning!=='invalidate-for-review')throw Error('Unsupported terminal-profile metric policy');
 if(geometry.metrics.advanceWidth!==before.metrics.advanceWidth||geometry.metrics.leftSideBearing!==geometry.bounds.xMin||geometry.metrics.rightSideBearing!==geometry.metrics.advanceWidth-geometry.bounds.xMax)throw Error('Derived terminal geometry violates its metric policy');
 const oldRevision=design.revision.id,innerOperation=clone(op);
 const revisionId=`revision:${hash({parent:oldRevision,operation:innerOperation,construction:design.construction,apertureExtension:design.apertureExtension}).slice(0,16)}`;
 design.revision={id:revisionId,parent:oldRevision,status:'candidate',operation:innerOperation,diff:{semanticChanges:[{terminalId:terminal.id,from:previous,to:clone(terminal.parameters)}],geometryChanges:[design.id],metrics:{before:before.metrics,after:geometry.metrics}}};
}
export const operationHandlers=Object.freeze({'geometry.structure.reflect':handler,'semantic.aperture.open':handler,'semantic.terminal.set-profile':handler});
export function run(base,operations){
 try{
  if(base.model.revisions.acceptedRevisionId!==base.model.revisions.headRevisionId||base.model.revisions.items.at(-1).status!=='accepted')throw Error('Transactions must start from accepted state');
  const model=clone(base.model);const history=model.constructionIntegration.operationHistory;for(const previous of model.operations)if(!history.some(op=>op.id===previous.id))history.push(clone(previous));if(operations.some(op=>history.some(old=>old.id===op.id)))throw Error('Operation identity already accepted');model.operations=clone(operations);model.intent.statements.push(...operations.map(op=>({id:op.provenance.intentIds[0],origin:'explicit',predicate:op.type,source:clone(op.provenance.source||{text:'Explicit experimental operation'})})));
  for(const selector of model.selectors){if(selector.registryRevisionId!==model.glyphRegistry.revisionId)throw Error('Stale glyph selector');const fresh=resolveSelector(selector,model.glyphRegistry.glyphs,{registryRevisionId:model.glyphRegistry.revisionId});if(hash(fresh.includedGlyphIds)!==hash(selector.resolution.includedGlyphIds))throw Error('Selector snapshot differs from expression');}
  for(const op of operations)if(!Object.hasOwn(operationHandlers,op.type))throw Error('Unregistered integrated operation');
  for(const op of operations)if(op.preconditions?.length!==1||op.preconditions[0].id!==model.revisions.headRevisionId)throw Error('Stale operation precondition');
  const result=executeTransaction(model,base.family,{operationHandlers});
  if(result.status==='rejected')return {...result,model:base.model,family:base.family};
  return {...result,seal:hash({model:result.model,family:result.family})};
 }catch(error){return {status:'rejected',error:error.message,model:base.model,family:base.family,revision:null};}
}
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}
export function accept(result){if(result.status!=='committed-candidate'||result.seal!==hash({model:result.model,family:result.family}))throw Error('Only an unmodified validated candidate can be accepted');const accepted={model:clone(result.model),family:clone(result.family)};const errors=validateV2Model(accepted.model);if(errors.length)throw Error(errors.join(';'));accepted.model.revisions.items.at(-1).status='accepted';accepted.model.revisions.acceptedRevisionId=accepted.model.revisions.headRevisionId;for(const instance of Object.values(accepted.model.constructionIntegration.instances)){const design=instance.design;if(design?.revisions&&design.revisions.headRevisionId!==design.revisions.acceptedRevisionId){const revision=design.revisions.items.find(item=>item.id===design.revisions.headRevisionId);if(!revision||revision.status!=='candidate')throw Error('Cannot accept nested semantic construction revision');revision.status='accepted';design.revisions.acceptedRevisionId=design.revisions.headRevisionId;}else if(design?.revision?.status==='candidate'){design.revision.status='accepted';}}return freeze(accepted);}
export function extendCandidate(base,candidate,next){if(candidate.status!=='committed-candidate'||candidate.model.revisions.items.at(-1).parentRevisionIds[0]!==base.model.revisions.headRevisionId||candidate.seal!==hash({model:candidate.model,family:candidate.family}))throw Error('Invalid candidate continuation');return run(base,[...candidate.model.operations,next]);}
export function sequences(base){const reflect=operation('geometry.structure.reflect','op:reflect',base),aperture=operation('semantic.aperture.open','op:aperture',base);const reflection=run(base,[reflect]),apertureOnly=run(base,[aperture]);return {baseline:{model:base.model,family:base.family},reflection,aperture:apertureOnly,A:extendCandidate(base,reflection,{...aperture,dependsOn:[reflect.id]}),B:extendCandidate(base,apertureOnly,{...reflect,dependsOn:[aperture.id]})};}
