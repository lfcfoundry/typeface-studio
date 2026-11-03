import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
if (existsSync(resolve(here, 'probe-v2.html'))) throw new Error('Refusing to overwrite probe-v2.html.');
const source = resolve(here, '../terminal-profile-font-validation-2026-11-03');
const names = {
  'a-flat': 'single-storey-a-flat.ttf',
  'a-chamfer': 'single-storey-a-chamfered.ttf',
  'spine-flat': 'spine-bowl-flat.ttf',
  'spine-chamfer': 'spine-bowl-chamfered.ttf'
};
const data = Object.fromEntries(Object.entries(names).map(([name, file]) =>
  [name, readFileSync(resolve(source, file)).toString('base64')]
));
const html = `<!doctype html><meta charset="utf-8"><title>Canvas TextMetrics investigation</title>
<h1>TextMetrics vs raster coverage</h1><pre id="out">Running…</pre><script>
const fontData=${JSON.stringify(data)};
const sizes=[64,128,256,512], thresholds=[0,16,128];
function rasterBounds(pixels,w,h){const b=thresholds.map(()=>({xMin:w,yMin:h,xMax:-1,yMax:-1,pixelCount:0}));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=pixels[(y*w+x)*4+3];for(let i=0;i<thresholds.length;i++)if(a>thresholds[i]){const q=b[i];q.pixelCount++;q.xMin=Math.min(q.xMin,x);q.yMin=Math.min(q.yMin,y);q.xMax=Math.max(q.xMax,x);q.yMax=Math.max(q.yMax,y)}}return Object.fromEntries(thresholds.map((t,i)=>[t,b[i]]))}
function measure(ctx,family,size,align,draw=true){ctx.font='400 '+size+'px "'+family+'"';const requestedFont='400 '+size+'px "'+family+'"';ctx.textAlign=align;ctx.direction='ltr';ctx.textBaseline='alphabetic';const m=ctx.measureText('a'),x=400,y=650;let raster=null;if(draw){ctx.clearRect(0,0,900,700);ctx.fillStyle='#000';ctx.fillText('a',x,y);raster=rasterBounds(ctx.getImageData(0,0,900,700).data,900,700)}return {requestedFont,acceptedFont:ctx.font,fontFaceLoaded:document.fonts.check(requestedFont,'a'),textAlign:ctx.textAlign,direction:ctx.direction,textBaseline:ctx.textBaseline,origin:{x,y},width:m.width,actualBoundingBoxLeft:m.actualBoundingBoxLeft,actualBoundingBoxRight:m.actualBoundingBoxRight,actualBoundingBoxAscent:m.actualBoundingBoxAscent,actualBoundingBoxDescent:m.actualBoundingBoxDescent,expectedInkBoundsFromTextMetrics:{xMin:x-m.actualBoundingBoxLeft,xMax:x+m.actualBoundingBoxRight,yMin:y-m.actualBoundingBoxAscent,yMax:y+m.actualBoundingBoxDescent},raster}}
async function main(){const results={userAgent:navigator.userAgent,devicePixelRatio,unitsPerEm:1000,thresholds,fonts:{}};for(const [family,b64] of Object.entries(fontData)){const face=new FontFace(family,'url(data:font/ttf;base64,'+b64+')',{weight:'400'});await face.load();document.fonts.add(face);const canvas=document.createElement('canvas');canvas.width=900;canvas.height=700;const ctx=canvas.getContext('2d',{willReadFrequently:true});const samples=sizes.map(size=>measure(ctx,family,size,'start'));const alignmentSamples=['left','center','right','start','end'].map(align=>measure(ctx,family,512,align,false));results.fonts[family]={fontFaceStatus:face.status,fontFaceLoaded:document.fonts.check('400 512px "'+family+'"','a'),samples,alignmentSamples}}document.getElementById('out').textContent=JSON.stringify(results,null,2);await fetch('/?investigation='+encodeURIComponent(JSON.stringify(results)))}main().catch(e=>{document.getElementById('out').textContent='FAILED '+e.stack;fetch('/?error='+encodeURIComponent(e.stack))});
</script>`;
mkdirSync(here, { recursive: true });
writeFileSync(resolve(here, 'probe-v2.html'), html, { flag: 'wx' });
console.log(resolve(here, 'probe-v2.html'));
