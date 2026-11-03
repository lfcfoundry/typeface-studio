import {split} from '../aperture-operation/aperture.mjs';
import {PathBuilder,orientContour,contourBounds,validateGlyph} from '../../../../prototype/src/contours.js';
export function closedProjection(model) {
 const m=structuredClone(model);
 for(const a of m.apertureExtension.apertures){m.construction.nodes.find(n=>n.id===a.spaceId).component='counter';m.construction.relations.find(r=>r.type==='open-space-of'&&r.source===a.spaceId).type='contained-by';}
 m.apertureExtension={version:1,apertures:[],ports:[]};return m;
}
export function checkDescriptor(d) {
 if(d?.version!==1||!d.id||!d.structureId||!d.spaceId||d.classification!=='enclosed-region'||!d.aliases?.length||!d.revisionId)throw Error('Invalid boundary descriptor identity');
 if(d.orientation!=='outer-clockwise-inner-counterclockwise'||d.parameterization!=='quadratic-local-t'||d.portOrder?.join('|')!=='lower|upper'||d.terminalTreatments?.join('|')!=='flat')throw Error('Incompatible boundary orientation or port contract');
 if(!d.range||d.range.length!==2||!d.range.every(Number.isFinite)||d.range[0]<0||d.range[1]>=.5||d.range[0]>=d.range[1])throw Error('Invalid permitted aperture range');
 for(const side of ['outer','inner'])if(!d[side]?.contourId||!d[side].approach||!d[side].depart||d[side].approach===d[side].depart)throw Error('Missing boundary segment references');
 return d;
}
function append(b,s,id=s.id){if(s.type==='quadratic')b.quad(id,s.control.x,s.control.y,s.to.x,s.to.y);else b.line(id,s.to.x,s.to.y);}
export function validateGeometry(g) {
 const errors=validateGlyph({...g,advanceWidth:g.metrics.advanceWidth,rightSideBearing:g.metrics.rightSideBearing});
 for(const c of g.contours) {
  for(let i=0;i<c.segments.length;i++){const s=c.segments[i],next=c.segments[(i+1)%c.segments.length];if(s.to.x!==next.from.x||s.to.y!==next.from.y)errors.push('Non-G0 contour');if(s.type==='line'&&s.from.x===s.to.x&&s.from.y===s.to.y)errors.push('Degenerate line');}
 }
 if(errors.length)throw Error(errors.join('; '));return g;
}
// One contour realizer for both grammars. Descriptors provide references, not callbacks.
export function openBoundary(g,d,a) {
 checkDescriptor(d);const outer=g.contours.find(c=>c.id===d.outer.contourId),inner=g.contours.find(c=>c.id===d.inner.contourId);
 if(!outer||!inner||outer.role!=='outer'||inner.role!=='counter')throw Error('Invalid boundary contour classification');
 const oi=outer.segments.findIndex(s=>s.id===d.outer.approach),oj=outer.segments.findIndex(s=>s.id===d.outer.depart),ii=inner.segments.findIndex(s=>s.id===d.inner.approach),ij=inner.segments.findIndex(s=>s.id===d.inner.depart);
 if(oi<0||oj!==oi+1||ii<0||ij!==(ii+1)%inner.segments.length)throw Error('Unsupported or contradictory boundary adjacency');
 for(const s of [outer.segments[oi],outer.segments[oj],inner.segments[ii],inner.segments[ij]])if(s.type!=='quadratic')throw Error('Aperture boundary requires quadratic segments');
 const [ol]=split(outer.segments[oi],1-a.halfExtent),[,ou]=split(outer.segments[oj],a.halfExtent);
 const [iu]=split(inner.segments[ii],1-a.halfExtent),[,il]=split(inner.segments[ij],a.halfExtent);
 const b=new PathBuilder(outer.id,'outer',outer.start.x,outer.start.y);
 outer.segments.slice(0,oi).forEach(s=>append(b,s));append(b,ol);b.line(`${a.portIds[0]}.cap`,il.from.x,il.from.y);append(b,il,`${a.spaceId}.${il.id}.open`);
 for(let j=(ij+1)%inner.segments.length;j!==ii;j=(j+1)%inner.segments.length)append(b,inner.segments[j],`${a.spaceId}.${inner.segments[j].id}.open`);
 append(b,iu,`${a.spaceId}.${iu.id}.open`);b.line(`${a.portIds[1]}.cap`,ou.from.x,ou.from.y);append(b,ou);outer.segments.slice(oj+1).forEach(s=>append(b,s));
 const contours=g.contours.filter(c=>c.id!==inner.id).map(c=>c.id===outer.id?orientContour(b.close(),'outer'):c),bounds=contourBounds(contours);
 const result={...g,contours,bounds,metrics:{...g.metrics,leftSideBearing:bounds.xMin,rightSideBearing:g.metrics.advanceWidth-bounds.xMax},components:g.components.map(n=>n.id===a.spaceId?{...n,kind:'anatomy.open-space'}:n),aperturePorts:a.portIds.map((id,i)=>{const cap=contours.find(c=>c.id===outer.id).segments.find(s=>s.id===`${id}.cap`);return {id,endpoints:i?{outer:cap.to,inner:cap.from}:{outer:cap.from,inner:cap.to}};})};
 return validateGeometry(result);
}
