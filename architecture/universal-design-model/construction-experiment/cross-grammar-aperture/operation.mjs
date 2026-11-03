import {createHash} from 'node:crypto';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
import {operation as legacyOperation} from '../aperture-operation/aperture.mjs';
import {checkDescriptor,openBoundary,validateGeometry} from './boundary.mjs';
export const operation=legacyOperation; // Exactly the existing operation factory and payload.
function adapterCheck(a){if(a?.version!==1||['validate','geometry','boundaries'].some(k=>typeof a[k]!=='function'))throw Error('Invalid boundary adapter');}
function selectBoundary(model,adapter,target,region){const list=adapter.boundaries(model,target).filter(d=>d.id===region||d.aliases.includes(region));if(list.length!==1)throw Error('Missing or ambiguous boundary');const d=checkDescriptor(list[0]);if(d.structureId!==target||d.revisionId!==model.revision.id)throw Error('Stale or mismatched boundary descriptor');return d;}
export function validate(model,adapter){
 adapterCheck(adapter);const e=model.apertureExtension;if(![1,2].includes(e?.version)||!Array.isArray(e.apertures)||!Array.isArray(e.ports)||e.apertures.length>1)throw Error('Unsupported aperture state');
 if(e.version===1&&(e.apertures.length||e.ports.length))throw Error('Nonempty legacy aperture state requires explicit migration');
 const nodes=model.construction.nodes,relations=model.construction.relations;
 if(new Set(e.ports.map(p=>p.id)).size!==e.ports.length)throw Error('Duplicate port identity');
 for(const a of e.apertures){
  const d=selectBoundary(model,adapter,a.structureId,a.boundary);
  if(a.boundaryId!==d.id||a.spaceId!==d.spaceId||a.parameterization!==d.parameterization||a.terminal!=='flat'||a.metricPolicy!=='preserve-advance-recompute-bearings'||!Number.isFinite(a.halfExtent)||a.halfExtent<d.range[0]||a.halfExtent>d.range[1])throw Error('Unsupported aperture parameters');
  if(nodes.find(n=>n.id===a.spaceId)?.component!=='open-space'||relations.filter(r=>r.type==='open-space-of'&&r.source===a.spaceId&&r.target===a.structureId).length!==1||relations.some(r=>r.type==='contained-by'&&r.source===a.spaceId))throw Error('Contradictory negative-space identity');
  if(!Array.isArray(a.portIds)||a.portIds.length!==2||new Set(a.portIds).size!==2)throw Error('Missing terminal ports');
  for(let i=0;i<2;i++){const p=e.ports.find(p=>p.id===a.portIds[i]);if(!p||p.apertureId!==a.id||p.boundaryId!==d.id||p.structureId!==d.structureId||p.side!==d.portOrder[i]||p.connects?.join('|')!=='outer|inner'||p.treatment!==a.terminal)throw Error('Incompatible terminal port');}
 }
 if(e.ports.length!==2*e.apertures.length||nodes.filter(n=>n.component==='open-space').length!==e.apertures.length||relations.filter(r=>r.type==='open-space-of').length!==e.apertures.length)throw Error('Orphan aperture structure');adapter.validate(model);return model;
}
export function derive(model,adapter){validate(model,adapter);let g=adapter.geometry(model);for(const a of model.apertureExtension.apertures)g=openBoundary(g,selectBoundary(model,adapter,a.structureId,a.boundary),a);return validateGeometry(g);}
// Shared transaction and semantic operation: no glyph-name, grammar-name or shape switch.
export function execute(accepted,op,adapter){try{
 validate(accepted,adapter);
 if(op?.type!=='semantic.aperture.open'||op.phase!=='construction'||!op.id||!op.provenance?.intentIds?.length||op.provenance.origin!=='explicit')throw Error('Incomplete semantic operation');
 if(accepted.revision.status!=='accepted'||op.preconditions?.revisionId!==accepted.revision.id||op.preconditions.topology!=='enclosed')throw Error('Revision or topology precondition failed');
 if(op.dependsOn?.length||accepted.apertureExtension.apertures.length)throw Error('Unsupported dependencies or repeated opening');
 if(op.target?.glyphId!==accepted.id||!Array.isArray(op.target.nodeIds)||op.target.nodeIds.length!==1)throw Error('Missing or ambiguous structural target');
 const p=op.parameters;if(!p||Object.keys(p).some(k=>!['boundary','halfExtent','terminal','metricPolicy'].includes(k)))throw Error('Unsupported operation parameter');
 const d=selectBoundary(accepted,adapter,op.target.nodeIds[0],p.boundary),enclosure=accepted.construction.relations.filter(r=>r.type==='contained-by'&&r.source===d.spaceId&&r.target===d.structureId);
 if(enclosure.length!==1||accepted.construction.nodes.find(n=>n.id===d.spaceId)?.component!=='counter')throw Error('Target is not a unique enclosed space');
 const model=structuredClone(accepted),id=`aperture:${op.id}`,portIds=[`${id}:lower`,`${id}:upper`];
 model.apertureExtension.version=2;
 model.construction.nodes.find(n=>n.id===d.spaceId).component='open-space';model.construction.relations.find(r=>r.type==='contained-by'&&r.source===d.spaceId).type='open-space-of';
 model.apertureExtension.apertures.push({id,structureId:d.structureId,spaceId:d.spaceId,boundaryId:d.id,parameterization:d.parameterization,...structuredClone(p),portIds});
 model.apertureExtension.ports.push(...portIds.map((pid,i)=>({id:pid,apertureId:id,boundaryId:d.id,structureId:d.structureId,side:d.portOrder[i],connects:['outer','inner'],treatment:p.terminal})));
 const before=derive(accepted,adapter),geometry=derive(model,adapter);
 const diff={changedNodeIds:[d.spaceId],preservedNodeIds:accepted.construction.nodes.filter(n=>n.id!==d.spaceId).map(n=>n.id),addedPortIds:portIds,metrics:{policy:p.metricPolicy,before:before.metrics,after:geometry.metrics},preservedDecisionIds:Object.keys(accepted.decisions)};
 model.revision={id:`revision:${digest({parent:accepted.revision.id,op,boundaryId:d.id}).slice(0,16)}`,parent:accepted.revision.id,status:'candidate',operation:structuredClone(op)};
 return {status:'candidate',model,geometry,diff};
}catch(error){return {status:'rejected',model:accepted,error:error.message,diff:null};}}
