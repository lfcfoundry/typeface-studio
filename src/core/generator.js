import { DEFAULT_PARAMS } from './model.js';

const chars = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['111','010','010','010','010','010','111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  a:['00000','00000','01110','00001','01111','10001','01111'],b:['10000','10000','10110','11001','10001','10001','11110'],c:['00000','00000','01111','10000','10000','10000','01111'],d:['00001','00001','01101','10011','10001','10001','01111'],e:['00000','00000','01110','10001','11111','10000','01111'],f:['00110','01001','01000','11100','01000','01000','01000'],g:['00000','01111','10001','10001','01111','00001','01110'],h:['10000','10000','10110','11001','10001','10001','10001'],i:['010','000','110','010','010','010','111'],j:['001','000','011','001','001','101','010'],k:['10000','10000','10010','10100','11000','10100','10010'],l:['110','010','010','010','010','010','111'],m:['00000','00000','11010','10101','10101','10101','10101'],n:['00000','00000','10110','11001','10001','10001','10001'],o:['00000','00000','01110','10001','10001','10001','01110'],p:['00000','11110','10001','10001','11110','10000','10000'],q:['00000','01111','10001','10001','01111','00001','00001'],r:['00000','00000','10110','11001','10000','10000','10000'],s:['00000','00000','01111','10000','01110','00001','11110'],t:['01000','01000','11100','01000','01000','01001','00110'],u:['00000','00000','10001','10001','10001','10011','01101'],v:['00000','00000','10001','10001','10001','01010','00100'],w:['00000','00000','10001','10001','10101','10101','01010'],x:['00000','00000','10001','01010','00100','01010','10001'],y:['00000','10001','10001','10001','01111','00001','01110'],z:['00000','00000','11111','00010','00100','01000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '!':['1','1','1','1','1','0','1'],'?':['01110','10001','00001','00010','00100','00000','00100'],'.':['0','0','0','0','0','0','1'],',':['0','0','0','0','0','1','1'],':':['0','1','0','0','0','1','0'],';':['0','1','0','0','0','1','1'],'-':['000','000','000','111','000','000','000'],'_':['00000','00000','00000','00000','00000','00000','11111'],'+':['000','010','010','111','010','010','000'],'=':['00000','00000','11111','00000','11111','00000','00000'],'/':['00001','00010','00010','00100','01000','01000','10000'],'\\':['10000','01000','01000','00100','00010','00010','00001'],'(':['001','010','100','100','100','010','001'],')':['100','010','001','001','001','010','100'],'[':['110','100','100','100','100','100','110'],']':['011','001','001','001','001','001','011'],'{':['0011','0100','0100','1000','0100','0100','0011'],'}':['1100','0010','0010','0001','0010','0010','1100'],'<':['0001','0010','0100','1000','0100','0010','0001'],'>':['1000','0100','0010','0001','0010','0100','1000'],'*':['00000','10101','01110','11111','01110','10101','00000'],'#':['01010','11111','01010','01010','11111','01010','00000'],'%':['11001','11010','00100','01000','10110','00110','00000'],'&':['01100','10010','10100','01000','10101','10010','01101'],'@':['01110','10001','10111','10101','10111','10000','01110'],'^':['00100','01010','10001','00000','00000','00000','00000'],'~':['00000','00000','01001','10110','00000','00000','00000'],'`':['100','010','000','000','000','000','000'],'\'':['010','010','000','000','000','000','000'],'"':['101','101','000','000','000','000','000'],'$':['00100','01111','10100','01110','00101','11110','00100'],'|':['1','1','1','1','1','1','1']
};
chars[' ']=['00000','00000','00000','00000','00000','00000','00000'];

function glyphId(code) { return `u${code.toString(16).padStart(4,'0')}`; }
function rectContour(x0,y0,x1,y1) {
  return [{x:Math.round(x0),y:Math.round(y0),on:true},{x:Math.round(x1),y:Math.round(y0),on:true},{x:Math.round(x1),y:Math.round(y1),on:true},{x:Math.round(x0),y:Math.round(y1),on:true}];
}
function roundedRect(x0,y0,x1,y1,r) {
  const pts=[]; const corners=[[x1-r,y0+r,-90,0],[x1-r,y1-r,0,90],[x0+r,y1-r,90,180],[x0+r,y0+r,180,270]];
  for(const [cx,cy,a,b] of corners) for(let i=0;i<=3;i++){const ang=(a+(b-a)*i/3)*Math.PI/180;pts.push({x:Math.round(cx+r*Math.cos(ang)),y:Math.round(cy+r*Math.sin(ang)),on:true});}
  return pts;
}
function rowRuns(pattern,index) {
  const row=pattern[index]||'',runs=[];let c=0;
  while(c<row.length){if(row[c]!=='1'){c++;continue;}let end=c+1;while(end<row.length&&row[end]==='1')end++;runs.push([c,end]);c=end;}
  return runs;
}
function makeContours(pattern, ch, params, style) {
  const p={...DEFAULT_PARAMS,...params}; const rowCount=pattern.length;
  const widthFactor=Math.min(1.4,Math.max(.65,p.width));
  const stem=Math.min(.86,Math.max(.18,p.stem));
  const cellW=Math.round((62+69*stem+(style==='Bold'?16:0))*widthFactor);
  const side=Math.round(54*p.spacing); const gap=Math.round(12*p.spacing*widthFactor); const stepX=cellW+gap;
  let top, rowStep;
  const lower=/^[a-z]$/.test(ch), desc='gjpqy'.includes(ch), asc='bdfhklt'.includes(ch);
  if(lower && !asc){top=Math.round(700*p.xHeight); rowStep=top/rowCount;}
  else {top=Math.round(700*p.capHeight); rowStep=top/rowCount;}
  const contrast=Math.min(.8,Math.max(0,p.contrast));
  const cols=Math.max(...pattern.map(row=>row.length));
  let maxCol=0;
  for(const row of pattern) for(let c=0;c<row.length;c++) if(row[c]==='1')maxCol=Math.max(maxCol,c+1);
  const contours=[];
  for(let ri=0;ri<rowCount;ri++){
    const row=pattern[ri].padEnd(cols,'0');
    let c=0;
    while(c<cols){if(row[c]!=='1'){c++;continue;}let end=c+1;while(end<cols&&row[end]==='1')end++;
      let yTop=top-ri*rowStep;
      if(lower&&desc&&ri===rowCount-1)yTop=-80;
      if(lower&&desc&&ri===rowCount-2)yTop=0;
      const horizontal=(end-c)/cols>=.6;
      const cellH=rowStep*(horizontal?1-contrast*.55:1);
      let yBottom=yTop-cellH;
      if(lower&&desc&&ri===rowCount-1)yBottom=-180;
      const x0=side+c*stepX, x1=side+(end-1)*stepX+cellW;
      const corner=p.terminals==='Rounded'?Math.max(p.roundness,.58):p.roundness;
      const rad=Math.min((x1-x0)*.18,(yTop-yBottom)*.18)*corner;
      const contour=roundedRect(x0,yBottom,x1,yTop,Math.max(0,rad));
      contours.push(contour);maxCol=Math.max(maxCol,end);c=end;
    }
  }
  const serifMode=p.serifs||p.classification==='Serif'||p.classification==='Slab serif'||p.classification==='Monospace serif';
  if(serifMode&&/^[A-Za-z0-9]$/.test(ch)){
    const occupied=pattern.map((row,i)=>row.includes('1')?i:-1).filter(i=>i>=0);
    const endpoints=[{row:occupied[0],neighbor:1},{row:occupied[occupied.length-1],neighbor:-1}];
    const slab=p.serifStyle==='Slab'||p.classification==='Slab serif';
    const extension=Math.max(14,Math.round(cellW*(slab?.48:.32)));
    const depth=Math.max(16,Math.round(cellW*(slab?.38:.24)));
    for(const {row:ri,neighbor} of endpoints){
      if(ri===undefined||ri+neighbor<0||ri+neighbor>=rowCount)continue;
      const endRuns=rowRuns(pattern,ri),nextRuns=rowRuns(pattern,ri+neighbor);
      for(const [a,b] of endRuns)for(const [na,nb] of nextRuns){
        const first=Math.max(a,na),last=Math.min(b,nb);if(first>=last)continue;
        const x0=side+first*stepX,x1=side+(last-1)*stepX+cellW;
        let yTop=top-ri*rowStep;
        if(lower&&desc&&ri===rowCount-1)yTop=-80;
        let yBottom=yTop-rowStep;
        if(lower&&desc&&ri===rowCount-1)yBottom=-180;
        if(neighbor===1){const y=yTop;contours.push(rectContour(x0-extension,y-depth*.4,x1+extension,y+depth));}
        else {const y=yBottom;contours.push(rectContour(x0-extension,y-depth*.6,x1+extension,y+depth*.4));}
      }
    }
  }
  let all=contours.flat();let left=all.length?Math.min(...all.map(p=>p.x)):0;
  let advance=Math.max(220,Math.round(side*2+maxCol*stepX+18));
  if(p.monospaced){
    advance=Math.max(220,Math.round(side*2+5*stepX+18));
    if(all.length){const right=Math.max(...all.map(pt=>pt.x)),dx=Math.round((advance-(right-left))/2-left);for(const contour of contours)for(const point of contour)point.x+=dx;all=contours.flat();left=Math.min(...all.map(pt=>pt.x));}
  }
  return {contours,advanceWidth:advance,leftSideBearing:left,role:{lower,desc,asc}};
}
function accentContour(x,y,size=90){return [[x,y],[x+size*.28,y+size*.6],[x+size,y+size*1.45],[x+size*.7,y+size*.85]].map(([px,py])=>({x:Math.round(px),y:Math.round(py),on:true}));}

export function generateFamily(project, {replaceManual=false,style='Regular'}={}) {
  if(!project||!project.design)throw new Error('A project with design settings is required.');
  const previous=project.glyphs||{};const generation=project.generation?.revision||0;const created={};const order=[];
  const inventory=[...Array(95)].map((_,i)=>32+i);
  const notdefId='notdef',notdefOutline=[[{x:60,y:0,on:true},{x:60,y:700,on:true},{x:520,y:700,on:true},{x:520,y:0,on:true}],[{x:110,y:80,on:true},{x:470,y:80,on:true},{x:470,y:620,on:true},{x:110,y:620,on:true}]];
  const oldNotdef=previous[notdefId];created[notdefId]=oldNotdef?.manualEdited&&!replaceManual?structuredClone(oldNotdef):{id:notdefId,name:'.notdef',character:'□',unicode:null,contours:notdefOutline,generatedContours:structuredClone(notdefOutline),outlines:notdefOutline,advanceWidth:600,leftSideBearing:60,rightSideBearing:80,manualEdited:false,invalid:false,components:[],generationRevision:generation+1};order.push(notdefId);
  for(const code of inventory){const ch=String.fromCodePoint(code);const pattern=chars[ch];if(!pattern)throw new Error(`The design system has no source pattern for ${JSON.stringify(ch)}.`);
    const geom=makeContours(pattern,ch,project.design,style);if(ch===' '){if(!project.design.monospaced)geom.advanceWidth=Math.round(300*project.design.spacing);geom.leftSideBearing=0;}const id=glyphId(code);
    const old=previous[id];const keep=old?.manualEdited&&!replaceManual;
    created[id]=keep?structuredClone(old):{id,name:ch===' '?'space':ch,character:ch,unicode:code,contours:geom.contours,generatedContours:structuredClone(geom.contours),outlines:geom.contours,advanceWidth:geom.advanceWidth,leftSideBearing:geom.leftSideBearing,rightSideBearing:Math.max(0,geom.advanceWidth-geom.leftSideBearing-(Math.max(...geom.contours.flat().map(pt=>pt.x),0)-geom.leftSideBearing)),manualEdited:false,invalid:false,components:[],generationRevision:generation+1};
    order.push(id);
  }
  const acuteId=glyphId(0x301), acuteContour=accentContour(270,600,75);
  const oldMark=previous[acuteId];created[acuteId]=oldMark?.manualEdited&&!replaceManual?structuredClone(oldMark):{id:acuteId,name:'acutecomb',character:'◌́',unicode:0x301,contours:[acuteContour],generatedContours:[structuredClone(acuteContour)],outlines:[acuteContour],advanceWidth:0,leftSideBearing:0,rightSideBearing:0,manualEdited:false,invalid:false,components:[],generationRevision:generation+1};order.push(acuteId);
  const eId=glyphId(0x65), eacuteId=glyphId(0xe9);const e=created[eId];const mark=accentContour(270,600,110);const eacuteContours=[...structuredClone(e.contours),mark];
  const oldE=previous[eacuteId];created[eacuteId]=oldE?.manualEdited&&!replaceManual?structuredClone(oldE):{id:eacuteId,name:'eacute',character:'é',unicode:0xe9,contours:eacuteContours,generatedContours:structuredClone(eacuteContours),outlines:eacuteContours,advanceWidth:e.advanceWidth,leftSideBearing:e.leftSideBearing,rightSideBearing:e.rightSideBearing,manualEdited:false,invalid:false,components:[eId,acuteId],generationRevision:generation+1};order.push(eacuteId);
  for(const glyph of Object.values(created)){if(glyph.generatedAdvanceWidth===undefined)glyph.generatedAdvanceWidth=glyph.advanceWidth;if(glyph.generatedLeftSideBearing===undefined)glyph.generatedLeftSideBearing=glyph.leftSideBearing;if(glyph.generatedRightSideBearing===undefined)glyph.generatedRightSideBearing=glyph.rightSideBearing;}
  project.glyphs=created;project.glyphOrder=order;project.generation.revision=generation+1;project.generation.history=[...(project.generation.history||[]),{revision:generation+1,at:new Date().toISOString(),seed:project.design.seed,summary:`Generated ${order.length} glyphs with shared grid-sans rules.`}].slice(-10);
  project.styles={Regular:{weight:400},Bold:{weight:700}};project.generatedStyle=style;
  return project;
}

export function regenerateStyle(project, style='Regular') {
  const clone=structuredClone(project);const prior=clone.glyphs;generateFamily(clone,{replaceManual:true,style});
  for(const id of clone.glyphOrder){const before=prior[id],after=clone.glyphs[id];if(!before?.manualEdited)continue;
    const base=before.generatedContours||before.contours;const edited=before.contours;
    if(base.length===after.contours.length&&base.every((c,i)=>c.length===after.contours[i].length)&&edited.every((c,i)=>c.length===base[i].length)){
      after.contours=after.contours.map((contour,ci)=>contour.map((pt,pi)=>({x:pt.x+(edited[ci][pi].x-base[ci][pi].x),y:pt.y+(edited[ci][pi].y-base[ci][pi].y),on:pt.on})));
    }else after.contours=structuredClone(edited);
    const xs=after.contours.flat().map(p=>p.x);if(xs.length){const dx=(before.leftSideBearing??Math.min(...xs))-Math.min(...xs);if(dx)after.contours=after.contours.map(c=>c.map(p=>({...p,x:p.x+dx})));}
    after.manualEdited=true;after.advanceWidth=before.advanceWidth;after.leftSideBearing=before.leftSideBearing;after.rightSideBearing=before.rightSideBearing;
  }
  return clone;
}

export function validateGlyph(glyph) {
  const errors=[];
  if(!Number.isInteger(glyph.advanceWidth)||glyph.advanceWidth<0)errors.push('Advance width must be a non-negative integer.');
  if(!Array.isArray(glyph.contours))errors.push('Contours are missing.');
  for(let i=0;i<(glyph.contours||[]).length;i++){
    const c=glyph.contours[i];if(!Array.isArray(c)||c.length<3){errors.push(`Contour ${i+1} needs at least three points.`);continue;}
    if(c.some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||Math.abs(p.x)>32767||Math.abs(p.y)>32767))errors.push(`Contour ${i+1} contains coordinates outside TrueType integer bounds.`);
    const area=c.reduce((sum,p,j)=>sum+p.x*c[(j+1)%c.length].y-c[(j+1)%c.length].x*p.y,0);
    if(Math.abs(area)<2)errors.push(`Contour ${i+1} has no measurable area.`);
    for(let a=0;a<c.length&&!errors.some(e=>e.startsWith(`Contour ${i+1} self-intersects`));a++)for(let b=a+2;b<c.length;b++){
      if(a===0&&b===c.length-1)continue;
      const p=c[a],q=c[(a+1)%c.length],r=c[b],s=c[(b+1)%c.length];
      const orient=(u,v,w)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);
      if(orient(p,q,r)*orient(p,q,s)<0&&orient(r,s,p)*orient(r,s,q)<0){errors.push(`Contour ${i+1} self-intersects.`);break;}
    }
    if(errors.length>3)break;
  }
  return errors;
}

export const PRINTABLE_ASCII = Array.from({length:95},(_,i)=>String.fromCharCode(i+32));
