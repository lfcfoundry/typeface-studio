import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, 'probe-execution.html');
if (existsSync(output)) throw new Error('Refusing to overwrite probe-execution.html.');
const fontDir = resolve(here, '../terminal-profile-font-validation-2026-11-03');
const fontFiles = {
  'a-flat': 'single-storey-a-flat.ttf',
  'a-chamfered': 'single-storey-a-chamfered.ttf',
  'spine-flat': 'spine-bowl-flat.ttf',
  'spine-chamfered': 'spine-bowl-chamfered.ttf'
};
const fonts = Object.fromEntries(Object.entries(fontFiles).map(([id, file]) =>
  [id, readFileSync(resolve(fontDir, file)).toString('base64')]
));
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Canvas TextMetrics controlled experiment</title><h1>Canvas TextMetrics controlled experiment</h1><pre id="status">Loading custom fonts…</pre><script>
const sources=${JSON.stringify(fonts)};
const thresholds=[0,16,128],alignments=['start','left','center','right','end'],repetitions=2,fontSize=512;
const runtimeErrors=[];window.addEventListener('error',e=>runtimeErrors.push(String(e.message||e)));window.addEventListener('unhandledrejection',e=>runtimeErrors.push(String(e.reason)));
function measureRaster(ctx,id,alignment,run){ctx.clearRect(0,0,900,700);ctx.font='400 '+fontSize+'px "'+id+'"';ctx.textAlign=alignment;ctx.direction='ltr';ctx.textBaseline='alphabetic';const requestedFont='400 '+fontSize+'px "'+id+'"',acceptedFont=ctx.font,faceCheck=document.fonts.check(requestedFont,'a');const m=ctx.measureText('a'),x=400,y=650;ctx.fillStyle='#000';ctx.fillText('a',x,y);const pixels=ctx.getImageData(0,0,900,700).data;const boxes=thresholds.map(()=>({xMin:900,yMin:700,xMax:-1,yMax:-1,pixelCount:0}));for(let py=0;py<700;py++)for(let px=0;px<900;px++){const alpha=pixels[(py*900+px)*4+3];for(let i=0;i<thresholds.length;i++)if(alpha>thresholds[i]){const b=boxes[i];b.pixelCount++;b.xMin=Math.min(b.xMin,px);b.yMin=Math.min(b.yMin,py);b.xMax=Math.max(b.xMax,px);b.yMax=Math.max(b.yMax,py)}}const rasterBounds=Object.fromEntries(thresholds.map((t,i)=>[t,boxes[i]]));return {run,fontId:id,profile:id.endsWith('chamfered')?'chamfered':'flat',requestedFont,acceptedFont,fontFaceCheck,text:'a',fontSizeCssPx:fontSize,textAlign:alignment,direction:ctx.direction,textBaseline:ctx.textBaseline,alignmentPoint:{x,y},width:m.width,actualBoundingBoxLeft:m.actualBoundingBoxLeft,actualBoundingBoxRight:m.actualBoundingBoxRight,actualBoundingBoxAscent:m.actualBoundingBoxAscent,actualBoundingBoxDescent:m.actualBoundingBoxDescent,absoluteBoundsFromTextMetrics:{xMin:x-m.actualBoundingBoxLeft,xMax:x+m.actualBoundingBoxRight,yMin:y-m.actualBoundingBoxAscent,yMax:y+m.actualBoundingBoxDescent},rasterThresholds:rasterBounds}}
async function main(){const results={schema:'typeface-studio.canvas-textmetrics-experiment.v1',userAgent:navigator.userAgent,devicePixelRatio,canvasBitmap:{width:900,height:700},unitsPerEm:1000,thresholds,alignments,repetitions,fontFaceLoads:{},samples:[],runtimeErrors};for(const [id,b64] of Object.entries(sources)){const face=new FontFace(id,'url(data:font/ttf;base64,'+b64+')',{weight:'400'});await face.load();document.fonts.add(face);results.fontFaceLoads[id]={status:face.status,check:document.fonts.check('400 512px "'+id+'"','a')};const canvas=document.createElement('canvas');canvas.width=900;canvas.height=700;const ctx=canvas.getContext('2d',{willReadFrequently:true});for(let run=1;run<=repetitions;run++)for(const alignment of alignments)results.samples.push(measureRaster(ctx,id,alignment,run))}results.runtimeErrors=[...runtimeErrors];document.getElementById('status').textContent=JSON.stringify({status:'complete',fontFaceLoads:results.fontFaceLoads,sampleCount:results.samples.length,runtimeErrors:results.runtimeErrors},null,2);const response=await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(results)});if(!response.ok)throw Error('Results save failed: '+await response.text());}main().catch(async e=>{runtimeErrors.push(String(e.stack||e));document.getElementById('status').textContent='FAILED '+runtimeErrors.join('\\n');await fetch('/error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(runtimeErrors)}) });
</script>`;
writeFileSync(output, html, { flag: 'wx' });
console.log(output);
