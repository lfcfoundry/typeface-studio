import { createHash } from 'node:crypto';
import { PathBuilder, orientContour, contourBounds, validateGlyph, sampleContour } from '../../../../prototype/src/contours.js';
export const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const library = Object.freeze({ bowl: {kind:'anatomy.bowl', profile:'quadratic-half-ellipse'}, counter:{kind:'anatomy.counter'}, spine:{kind:'anatomy.stem'}, connector:{kind:'anatomy.join',profile:'rounded-return'}, terminal:{kind:'anatomy.terminal',profile:'flat'} });
export function design(count=2) {
  const nodes=[{id:'spine',component:'spine'}, {id:'top',component:'terminal'}, {id:'bottom',component:'terminal'}];
  const bands=count===1 ? [[0,1,.9,1]] : [[0,.58,.9,.65],[.66,1,.68,.5]];
  const relations=[{type:'terminates',source:'top',target:'spine',port:'top'},{type:'terminates',source:'bottom',target:'spine',port:'bottom'}];
  bands.forEach(([bottom,top,width,inset],i)=>{
    nodes.push({id:`bowl:${i}`,component:'bowl',parameters:{bottom,top,width}}, {id:`counter:${i}`,component:'counter',parameters:{inset}});
    relations.push({type:'attaches',source:`bowl:${i}`,target:'spine',side:'left'}, {type:'contained-by',source:`counter:${i}`,target:`bowl:${i}`});
    if(i) { nodes.push({id:`join:${i}`,component:'connector'}); relations.push({type:'connects',source:`join:${i}`,lower:`bowl:${i-1}`,upper:`bowl:${i}`,target:'spine',continuity:'G1'}); }
  });
  return {extension:'lfcfoundry.spine-bowl-grammar',version:1,universalModelVersion:2,
    id:count===1?'glyph:a.single':'glyph:a.double',name:count===1?'a':'a.alt',characterIdentity:[97],encoding:count===1?[97]:[],
    decisions:{stem:90,xHeight:500,baseline:0,advance:650,bearing:55,connectorRadius:20},
    provenance:{origin:'explicit',source:'isolated topology experiment',parentConstruction:'construction.bowl-with-attached-stem'},
    construction:{version:1,nodes,relations},revision:{id:'revision:base',status:'accepted',parent:null}};
}
export function resolve(model) {
  if(model.extension!=='lfcfoundry.spine-bowl-grammar'||model.version!==1) throw Error('Unsupported construction extension');
  const {nodes,relations}=model.construction;
  const ids=new Map(nodes.map(n=>[n.id,n]));
  if(ids.size!==nodes.length) throw Error('Duplicate anatomy identity');
  if(nodes.some(n=>!library[n.component])) throw Error('Unsupported component');
  const spines=nodes.filter(n=>n.component==='spine');
  if(spines.length!==1) throw Error('Exactly one spine required');
  const spine=spines[0]; const d=model.decisions;
  if(Object.values(d).some(v=>!Number.isFinite(v))||d.stem<=0||d.xHeight<=0||d.bearing<0||d.connectorRadius<=0) throw Error('Invalid shared dimensions');
  for(const r of relations) {
    if(!['terminates','attaches','contained-by','connects'].includes(r.type)) throw Error('Unsupported relationship');
    for(const k of ['source','target','lower','upper']) if(r[k]&&!ids.has(r[k])) throw Error('Missing relationship target');
  }
  for(const port of ['top','bottom']) {
    const r=relations.filter(r=>r.type==='terminates'&&r.target===spine.id&&r.port===port);
    if(r.length!==1||ids.get(r[0].source).component!=='terminal') throw Error('Missing or contradictory terminal relationship');
  }
  const stemX=d.advance-d.bearing-d.stem;
  const bowls=nodes.filter(n=>n.component==='bowl').map(n=>{
    const attachment=relations.filter(r=>r.type==='attaches'&&r.source===n.id);
    if(attachment.length!==1||attachment[0].target!==spine.id||attachment[0].side!=='left') throw Error('Invalid bowl attachment');
    const contained=relations.filter(r=>r.type==='contained-by'&&r.target===n.id);
    if(contained.length!==1||ids.get(contained[0].source).component!=='counter') throw Error('Every bowl needs its own counter');
    const counter=ids.get(contained[0].source);
    if(relations.filter(r=>r.type==='contained-by'&&r.source===counter.id).length!==1) throw Error('Counter has contradictory enclosure');
    const p=n.parameters; const y0=Math.round(d.baseline+p.bottom*d.xHeight), y1=Math.round(d.baseline+p.top*d.xHeight);
    const x0=stemX-Math.round(p.width*d.xHeight); const inset=Math.round(d.stem*counter.parameters.inset);
    if(![y0,y1,x0,inset].every(Number.isFinite)||y0<d.baseline||y1>d.baseline+d.xHeight||x0<0||x0>=stemX||inset<=0||2*inset>=y1-y0||inset>=stemX-x0) throw Error('Collapsed bowl/counter dimensions');
    return {id:n.id,counterId:counter.id,y0,y1,x0,inset};
  }).sort((a,b)=>a.y0-b.y0||a.id.localeCompare(b.id));
  if(!bowls.length||nodes.filter(n=>n.component==='counter').length!==bowls.length) throw Error('Missing or orphan counter');
  if(bowls[0].y0!==d.baseline||bowls.at(-1).y1!==d.baseline+d.xHeight) throw Error('Stack must reach both terminal alignments');
  const joins=[];
  for(let i=1;i<bowls.length;i++) {
    const lo=bowls[i-1],hi=bowls[i];
    if(hi.y0-lo.y1<2*d.connectorRadius) throw Error('Bowl overlap or insufficient connector clearance');
    const matches=relations.filter(r=>r.type==='connects'&&r.lower===lo.id&&r.upper===hi.id&&r.target===spine.id);
    if(matches.length!==1||ids.get(matches[0].source).component!=='connector'||matches[0].continuity!=='G1') throw Error('Missing or contradictory connector relationship');
    joins.push(matches[0]);
  }
  if(relations.filter(r=>r.type==='connects').length!==joins.length || nodes.filter(n=>n.component==='connector').length!==joins.length) throw Error('Orphan or duplicate connector');
  return {bowls,joins,stemX,decisions:d};
}
export function derive(model) {
  const {bowls,joins,stemX,decisions:d}=resolve(model);
  const top=d.baseline+d.xHeight;
  const b=new PathBuilder(`${model.id}.outer`,'outer',stemX,top);
  b.line('terminal.top',stemX+d.stem,top).line('spine.outer',stemX+d.stem,d.baseline).line('terminal.bottom',stemX,d.baseline);
  const counters=[];
  bowls.forEach((v,i)=>{
    const mid=(v.y0+v.y1)/2;
    const endX=stemX-(i<bowls.length-1?d.connectorRadius:0);
    b.quad(`${v.id}.lower`,v.x0,v.y0,v.x0,mid).quad(`${v.id}.upper`,v.x0,v.y1,endX,v.y1);
    if(i<bowls.length-1) {
      const next=bowls[i+1],r=d.connectorRadius,id=joins[i].source;
      b.quad(`${id}.exit`,stemX,v.y1,stemX,v.y1+r);
      if(next.y0-r>v.y1+r) b.line(`${id}.bridge`,stemX,next.y0-r);
      b.quad(`${id}.entry`,stemX,next.y0,stemX-r,next.y0);
    }
    const c=new PathBuilder(`${model.id}.${v.counterId}`,'counter',stemX,v.y0+v.inset);
    c.line('wall',stemX,v.y1-v.inset).quad('upper',v.x0+v.inset,v.y1-v.inset,v.x0+v.inset,mid).quad('lower',v.x0+v.inset,v.y0+v.inset,stemX,v.y0+v.inset);
    counters.push(orientContour(c.close(),'counter'));
  });
  const contours=[orientContour(b.close(),'outer'),...counters]; const bounds=contourBounds(contours);
  const glyph={id:model.id,name:model.name,unicode:model.encoding[0]??null,contours,bounds,metrics:{advanceWidth:d.advance,leftSideBearing:bounds.xMin,rightSideBearing:d.advance-bounds.xMax},components:model.construction.nodes.map(n=>({id:n.id,kind:library[n.component].kind}))};
  const errors=validateGlyph({...glyph,advanceWidth:d.advance,rightSideBearing:glyph.metrics.rightSideBearing});
  if(errors.length) throw Error(errors.join('; '));
  return glyph;
}
// Additional improvement: an immutable semantic proportion revision, not a contour patch.
export function resizeBowl(accepted,bowlId,width) {
  const candidate=structuredClone(accepted),node=candidate.construction.nodes.find(n=>n.id===bowlId&&n.component==='bowl');
  if(!node||!Number.isFinite(width)||width<=0) throw Error('Unknown bowl or invalid width');
  const before=derive(accepted);node.parameters.width=width;
  const after=derive(candidate);candidate.revision={id:`revision:${digest(candidate.construction).slice(0,16)}`,parent:accepted.revision.id,status:'candidate',operation:{type:'construct.parameter.set',targetNodeId:bowlId,parameter:'width',value:width,origin:'explicit'}};
  return {model:candidate,geometry:after,diff:{changedNodeIds:[bowlId],beforeHash:digest(before.contours),afterHash:digest(after.contours),preservedCounterIds:accepted.construction.nodes.filter(n=>n.component==='counter'&&!accepted.construction.relations.some(r=>r.type==='contained-by'&&r.source===n.id&&r.target===bowlId)).map(n=>n.id)}};
}
export function continuity(contour) {
  return contour.segments.map((a,i,all)=>{
    const b=all[(i+1)%all.length];const end=a.type==='quadratic'?a.control:a.from,start=b.type==='quadratic'?b.control:b.to;
    const u={x:a.to.x-end.x,y:a.to.y-end.y},v={x:start.x-b.from.x,y:start.y-b.from.y};
    const factorA=a.type==='quadratic'?2:1,factorB=b.type==='quadratic'?2:1;
    return {from:a.id,to:b.id,G0:a.to.x===b.from.x&&a.to.y===b.from.y,G1:Math.abs(u.x*v.y-u.y*v.x)<1e-6&&u.x*v.x+u.y*v.y>0,C1:factorA*u.x===factorB*v.x&&factorA*u.y===factorB*v.y};
  });
}
export {sampleContour};
