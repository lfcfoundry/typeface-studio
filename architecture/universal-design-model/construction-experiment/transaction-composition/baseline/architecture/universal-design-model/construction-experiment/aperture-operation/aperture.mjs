import {design,resolve as resolveClosed,derive as deriveClosed,digest,continuity} from '../two-storey-grammar/grammar.mjs';
import {PathBuilder,orientContour,contourBounds,validateGlyph} from '../../../../prototype/src/contours.js';
export {continuity};
export function fixture(count=2) {const m=design(count);m.apertureExtension={version:1,apertures:[],ports:[]};return m;}
export function operation(model,bowlId='bowl:1') {return {id:'op:open-boundary',type:'semantic.aperture.open',phase:'construction',target:{glyphId:model.id,nodeIds:[bowlId]},parameters:{boundary:'free-bowl-side',halfExtent:.25,terminal:'flat',metricPolicy:'preserve-advance-recompute-bearings'},preconditions:{revisionId:model.revision.id,topology:'enclosed'},provenance:{origin:'explicit',intentIds:['intent:open-selected-bowl']},dependsOn:[]};}
// Projection reconstructs only the closed support scaffold for the unchanged grammar resolver.
// The persistent candidate retains open-space identity and explicit opening/ports.
function closedProjection(model) {
 const base=structuredClone(model);
 for(const a of base.apertureExtension.apertures) {
  base.construction.nodes.find(n=>n.id===a.spaceId).component='counter';
  const r=base.construction.relations.find(r=>r.type==='open-space-of'&&r.source===a.spaceId);r.type='contained-by';
 }
 delete base.apertureExtension;return base;
}
export function resolve(model) {
 const ext=model.apertureExtension;
 if(ext?.version!==1||!Array.isArray(ext.apertures)||!Array.isArray(ext.ports))throw Error('Unsupported aperture extension');
 if(ext.apertures.length>1)throw Error('Multiple apertures are not yet supported by this realization');
 const nodes=model.construction.nodes,relations=model.construction.relations;
 if(new Set(ext.ports.map(p=>p.id)).size!==ext.ports.length)throw Error('Duplicate terminal port identity');
 for(const a of ext.apertures) {
  if(a.boundary!=='free-bowl-side'||a.terminal!=='flat'||a.metricPolicy!=='preserve-advance-recompute-bearings'||!Number.isFinite(a.halfExtent)||a.halfExtent<.1||a.halfExtent>.4)throw Error('Invalid aperture boundary, terminal, or extent');
  const target=nodes.find(n=>n.id===a.bowlId),space=nodes.find(n=>n.id===a.spaceId);
  if(target?.component!=='bowl'||space?.component!=='open-space')throw Error('Incompatible aperture anatomy');
  if(relations.filter(r=>r.type==='open-space-of'&&r.source===a.spaceId&&r.target===a.bowlId).length!==1||relations.some(r=>r.type==='contained-by'&&r.source===a.spaceId))throw Error('Contradictory open-space attachment');
  if(!Array.isArray(a.portIds)||a.portIds.length!==2||new Set(a.portIds).size!==2)throw Error('Aperture requires two terminal ports');
  for(const [i,id] of a.portIds.entries()) {
   const port=ext.ports.find(p=>p.id===id);
   if(!port||port.apertureId!==a.id||port.bowlId!==a.bowlId||port.side!==['lower','upper'][i]||port.connects?.join('|')!=='outer|inner'||port.treatment!=='flat')throw Error('Missing or contradictory terminal port');
  }
 }
 if(ext.ports.length!==2*ext.apertures.length||nodes.filter(n=>n.component==='open-space').length!==ext.apertures.length||relations.filter(r=>r.type==='open-space-of').length!==ext.apertures.length)throw Error('Orphan aperture structure');
 const projection=closedProjection(model),scaffold=resolveClosed(projection);
 return {projection,scaffold,apertures:ext.apertures};
}
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
// Exact quadratic subdivision before integer font-unit quantization.
export function split(s,t) {const a=mix(s.from,s.control,t),b=mix(s.control,s.to,t),p=mix(a,b,t);return [{...s,to:p,control:a},{...s,from:p,control:b}];}
function append(b,s) {if(s.type==='quadratic') b.quad(s.id,s.control.x,s.control.y,s.to.x,s.to.y);else b.line(s.id,s.to.x,s.to.y);}
export function derive(model) {
 const {projection,apertures}=resolve(model),g=deriveClosed(projection);
 if(!apertures.length)return g;
 const a=apertures[0],source=g.contours[0],counter=g.contours.find(c=>c.id===`${model.id}.${a.spaceId}`);
 const lowerIndex=source.segments.findIndex(s=>s.id===`${a.bowlId}.lower`),upperIndex=lowerIndex+1;
 if(lowerIndex<0||source.segments[upperIndex]?.id!==`${a.bowlId}.upper`)throw Error('Realizer does not support this boundary');
 const [outerLower]=split(source.segments[lowerIndex],1-a.halfExtent);
 const [,outerUpper]=split(source.segments[upperIndex],a.halfExtent);
 const innerLower=counter.segments.find(s=>s.id==='lower'),innerUpper=counter.segments.find(s=>s.id==='upper'),wall=counter.segments.find(s=>s.id==='wall');
 const [,innerLowerRemain]=split(innerLower,a.halfExtent),[innerUpperRemain]=split(innerUpper,1-a.halfExtent);
 const b=new PathBuilder(source.id,'outer',source.start.x,source.start.y);
 source.segments.slice(0,lowerIndex).forEach(s=>append(b,s));append(b,outerLower);
 b.line(`${a.portIds[0]}.cap`,innerLowerRemain.from.x,innerLowerRemain.from.y);
 append(b,{...innerLowerRemain,id:`${a.spaceId}.lower-open-boundary`});append(b,{...wall,id:`${a.spaceId}.spine-wall`});append(b,{...innerUpperRemain,id:`${a.spaceId}.upper-open-boundary`});
 b.line(`${a.portIds[1]}.cap`,outerUpper.from.x,outerUpper.from.y);append(b,outerUpper);source.segments.slice(upperIndex+1).forEach(s=>append(b,s));
 const contours=[orientContour(b.close(),'outer'),...g.contours.slice(1).filter(c=>c.id!==counter.id)];
 const bounds=contourBounds(contours),result={...g,contours,bounds,metrics:{...g.metrics,leftSideBearing:bounds.xMin,rightSideBearing:g.metrics.advanceWidth-bounds.xMax},components:g.components.map(n=>n.id===a.spaceId?{...n,kind:'anatomy.open-space'}:n),aperturePorts:a.portIds.map(id=>{const cap=contours[0].segments.find(s=>s.id===`${id}.cap`);return {id,capSegmentId:cap.id,endpoints:id===a.portIds[0]?{outer:cap.from,inner:cap.to}:{outer:cap.to,inner:cap.from}};})};
 const errors=validateGlyph({...result,advanceWidth:result.metrics.advanceWidth,rightSideBearing:result.metrics.rightSideBearing});if(errors.length)throw Error(errors.join('; '));
 return result;
}
export function execute(accepted,op) {
 try {
  resolve(accepted);
  if(op?.type!=='semantic.aperture.open'||op.phase!=='construction'||!op.id||!op.provenance?.intentIds?.length||op.provenance.origin!=='explicit')throw Error('Unsupported or incomplete operation contract');
  if(accepted.revision.status!=='accepted'||op.preconditions?.revisionId!==accepted.revision.id)throw Error('Accepted revision or revision precondition mismatch');
  if(op.dependsOn?.length)throw Error('Unavailable operation dependency');
  if(op.target?.glyphId!==accepted.id||!Array.isArray(op.target.nodeIds)||op.target.nodeIds.length!==1)throw Error('Missing or ambiguous structural target');
  const targetId=op.target.nodeIds[0],target=accepted.construction.nodes.find(n=>n.id===targetId);
  if(target?.component!=='bowl')throw Error('Missing or incompatible target');
  if(op.preconditions.topology!=='enclosed'||accepted.apertureExtension.apertures.length)throw Error('Opening is non-idempotent; target/realizer already has an aperture');
  const enclosure=accepted.construction.relations.filter(r=>r.type==='contained-by'&&r.target===targetId);
  if(enclosure.length!==1)throw Error('Target has no unique enclosed counter');
  if(!op.parameters||Object.keys(op.parameters).some(k=>!['boundary','halfExtent','terminal','metricPolicy'].includes(k)))throw Error('Unsupported aperture parameter');
  const model=structuredClone(accepted),spaceId=enclosure[0].source,apertureId=`aperture:${op.id}`;
  model.construction.nodes.find(n=>n.id===spaceId).component='open-space';
  model.construction.relations.find(r=>r.type==='contained-by'&&r.source===spaceId).type='open-space-of';
  const portIds=[`${apertureId}:lower`,`${apertureId}:upper`];
  model.apertureExtension.apertures.push({id:apertureId,bowlId:targetId,spaceId,...structuredClone(op.parameters),portIds});
  model.apertureExtension.ports.push(...portIds.map((id,i)=>({id,apertureId,bowlId:targetId,side:['lower','upper'][i],connects:['outer','inner'],treatment:'flat'})));
  const beforeGeometry=derive(accepted),geometry=derive(model); // Entire transaction is staged and validated before revision creation.
  model.revision={id:`revision:${digest({parent:accepted.revision.id,op}).slice(0,16)}`,parent:accepted.revision.id,status:'candidate',operation:structuredClone(op)};
  return {status:'candidate',model,geometry,diff:{changedNodeIds:[spaceId],addedApertureIds:[apertureId],addedPortIds:portIds,preservedDecisionIds:Object.keys(accepted.decisions),metrics:{policy:op.parameters.metricPolicy,before:beforeGeometry.metrics,after:geometry.metrics,reason:'Opening may remove an extreme ink point; keep advance and derive bearings from resulting ink bounds.'},preservedCounterIds:accepted.construction.nodes.filter(n=>n.component==='counter'&&n.id!==spaceId).map(n=>n.id)}};
 }catch(error){return {status:'rejected',model:accepted,error:error.message,diff:null};}
}
