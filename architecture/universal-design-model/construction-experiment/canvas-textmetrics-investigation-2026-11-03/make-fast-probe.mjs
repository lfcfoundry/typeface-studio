import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, 'probe-fast.html');
if (existsSync(output)) throw new Error('Refusing to overwrite probe-fast.html.');
const fontDir = resolve(here, '../terminal-profile-font-validation-2026-11-03');
const files = {
  'a-flat': 'single-storey-a-flat.ttf',
  'a-chamfered': 'single-storey-a-chamfered.ttf',
  'spine-flat': 'spine-bowl-flat.ttf',
  'spine-chamfered': 'spine-bowl-chamfered.ttf'
};
const fonts = Object.fromEntries(Object.entries(files).map(([id, file]) =>
  [id, readFileSync(resolve(fontDir, file)).toString('base64')]
));
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Canvas TextMetrics experiment, reduced raster scan</title><h1>Canvas TextMetrics experiment</h1><pre id="status">Loading…</pre><script>
const sources=${JSON.stringify(fonts)},thresholds=[0,16,128],alignments=['start','left','center','right','end'];
const width=760,height=560,fontSize=512,origin={x:400,y:540},runtimeErrors=[];
addEventListener('error',e=>runtimeErrors.push(String(e.message||e)));addEventListener('unhandledrejection',e=>runtimeErrors.push(String(e.reason)));
function readBounds(data){const out=thresholds.map(()=>({xMin:width,yMin:height,xMax:-1,yMax:-1,pixelCount:0}));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=data[(y*width+x)*4+3];if(a>thresholds[0]){let b=out[0];b.pixelCount++;b.xMin=Math.min(b.xMin,x);b.yMin=Math.min(b.yMin,y);b.xMax=Math.max(b.xMax,x);b.yMax=Math.max(b.yMax,y)}if(a>thresholds[1]){let b=out[1];b.pixelCount++;b.xMin=Math.min(b.xMin,x);b.yMin=Math.min(b.yMin,y);b.xMax=Math.max(b.xMax,x);b.yMax=Math.max(b.yMax,y)}if(a>thresholds[2]){let b=out[2];b.pixelCount++;b.xMin=Math.min(b.xMin,x);b.yMin=Math.min(b.yMin,y);b.xMax=Math.max(b.xMax,x);b.yMax=Math.max(b.yMax,y)}}return Object.fromEntries(thresholds.map((t,i)=>[t,out[i]]))}
function one(ctx,id,align,run,draw=true){ctx.clearRect(0,0,width,height);const requestedFont='400 '+fontSize+'px "'+id+'"';ctx.font=requestedFont;ctx.textAlign=align;ctx.direction='ltr';ctx.textBaseline='alphabetic';const m=ctx.measureText('a');let rasterBounds=null;if(draw){ctx.fillStyle='#000';ctx.fillText('a',origin.x,origin.y);rasterBounds=readBounds(ctx.getImageData(0,0,width,height).data)}return {run,fontId:id,profile:id.endsWith('chamfered')?'chamfered':'flat',fontSizeCssPx:fontSize,requestedFont,acceptedFont:ctx.font,fontFaceCheck:document.fonts.check(requestedFont,'a'),text:'a',textAlign:ctx.textAlign,direction:ctx.direction,textBaseline:ctx.textBaseline,alignmentPoint:origin,width:m.width,actualBoundingBoxLeft:m.actualBoundingBoxLeft,actualBoundingBoxRight:m.actualBoundingBoxRight,actualBoundingBoxAscent:m.actualBoundingBoxAscent,actualBoundingBoxDescent:m.actualBoundingBoxDescent,textMetricsBounds:{xMin:origin.x-m.actualBoundingBoxLeft,xMax:origin.x+m.actualBoundingBoxRight,yMin:origin.y-m.actualBoundingBoxAscent,yMax:origin.y+m.actualBoundingBoxDescent},rasterBounds}}
async function main(){const results={schema:'typeface-studio.canvas-textmetrics-threshold-alignment.v1',userAgent:navigator.userAgent,devicePixelRatio,canvasBitmap:{width,height},fontSizeCssPx:fontSize,origin,unitsPerEm:1000,thresholds,alignments,fontFaceLoads:{},samples:[],runtimeErrors};for(const [id,b64] of Object.entries(sources)){const face=new FontFace(id,'url(data:font/ttf;base64,'+b64+')',{weight:'400'});await face.load();document.fonts.add(face);results.fontFaceLoads[id]={status:face.status,check:document.fonts.check('400 '+fontSize+'px "'+id+'"','a')};const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});for(const align of alignments)results.samples.push(one(ctx,id,align,1,true));results.samples.push(one(ctx,id,'start',2,true))}results.runtimeErrors=[...runtimeErrors];document.getElementById('status').textContent=JSON.stringify({status:'complete',fontFaceLoads:results.fontFaceLoads,samples:results.samples.length,runtimeErrors:results.runtimeErrors},null,2);const response=await fetch('/fast-results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(results)});if(!response.ok)throw Error('Could not store browser result: '+await response.text())}main().catch(async e=>{runtimeErrors.push(String(e.stack||e));document.getElementById('status').textContent='FAILED '+runtimeErrors.join('\\n');await fetch('/fast-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(runtimeErrors)})});
</script>`;
writeFileSync(output, html, { flag: 'wx' });
console.log(output);
