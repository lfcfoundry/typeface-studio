import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = {
  'a-flat': 'single-storey-a-flat.ttf',
  'a-chamfer': 'single-storey-a-chamfered.ttf',
  'spine-flat': 'spine-bowl-flat.ttf',
  'spine-chamfer': 'spine-bowl-chamfered.ttf'
};
const faces = Object.entries(files).map(([family, file]) =>
  `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${readFileSync(resolve(here, file)).toString('base64')}) format("truetype");font-weight:400}`
).join('\n');
const payloads = Object.fromEntries(Object.entries(files).map(([family, file]) =>
  [family, readFileSync(resolve(here, file)).toString('base64')]
));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser font raster probe</title><style>${faces}\nbody{font:16px system-ui;max-width:900px;margin:auto;padding:16px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}section{border:1px solid #999;padding:12px;overflow:hidden}.glyph{font-size:clamp(130px,30vw,260px)}.ok{color:#176d30}.fail{color:#b32020}</style><body><h1>Chrome font load and raster comparison</h1><p>All TTF data is embedded. The page renders the same U+0061 at 512px into Canvas and compares flat/chamfered pixel masks.</p><div class="grid">${Object.entries(files).map(([family]) => `<section><h2>${family}</h2><div class="glyph" style="font-family:&quot;${family}&quot;">a</div><p id="${family}">Loading…</p></section>`).join('')}</div><pre id="result"></pre><script>
const source=${JSON.stringify(files)};
const fontData=${JSON.stringify(payloads)};
function raster(family){const c=document.createElement('canvas');c.width=520;c.height=620;const x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='400 512px "'+family+'"';x.textBaseline='alphabetic';const m=x.measureText('a');x.fillText('a',32,550);const pixels=x.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1,count=0;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){if(pixels[(y*c.width+xx)*4+3]>16){count++;x0=Math.min(x0,xx);y0=Math.min(y0,y);x1=Math.max(x1,xx);y1=Math.max(y1,y)}}return {advancePx:m.width,actualInkBox:{left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent},pixelBounds:{xMin:x0,yMin:y0,xMax:x1,yMax:y1},inkPixels:count,advanceExpectedPx:650*512/1000}}
async function main(){const rows={};for(const family of Object.keys(source)){const face=new FontFace(family,'url(data:font/ttf;base64,'+fontData[family]+')');await face.load();document.fonts.add(face);rows[family]=raster(family);document.getElementById(family).textContent='FontFace loaded; '+rows[family].inkPixels+' ink pixels';document.getElementById(family).className='ok'}const compare=(flat,chamfer)=>{const a=raster(flat),b=raster(chamfer),c=document.createElement('canvas');c.width=520;c.height=620;const x=c.getContext('2d',{willReadFrequently:true});for(const f of [flat,chamfer]){const face=document.fonts.check('512px "'+f+'"');if(!face)throw Error('Font is not available: '+f)}x.font='400 512px "'+flat+'"';x.textBaseline='alphabetic';x.fillText('a',32,550);const p=x.getImageData(0,0,c.width,c.height).data;x.clearRect(0,0,c.width,c.height);x.font='400 512px "'+chamfer+'"';x.fillText('a',32,550);const q=x.getImageData(0,0,c.width,c.height).data;let n=0,x0=520,y0=620,x1=-1,y1=-1;for(let y=0;y<620;y++)for(let xx=0;xx<520;xx++){const i=(y*520+xx)*4;if(Math.abs(p[i+3]-q[i+3])>16){n++;x0=Math.min(x0,xx);y0=Math.min(y0,y);x1=Math.max(x1,xx);y1=Math.max(y1,y)}}return {flat,chamfer,changedPixels:n,differenceBounds:{xMin:x0,yMin:y0,xMax:x1,yMax:y1},advanceDifferencePx:Math.abs(a.advancePx-b.advancePx),samePixelBounds:JSON.stringify(a.pixelBounds)===JSON.stringify(b.pixelBounds),differenceAtUpperRight:n>0&&x1>=a.pixelBounds.xMax-16&&y0<=a.pixelBounds.yMin+16}}
const comparisons=[compare('a-flat','a-chamfer'),compare('spine-flat','spine-chamfer')];const result={userAgent:navigator.userAgent,devicePixelRatio,fonts:rows,comparisons};document.getElementById('result').textContent=JSON.stringify(result,null,2);for(const c of comparisons)if(!c.differenceAtUpperRight||c.advanceDifferencePx>0.01||!c.samePixelBounds)throw Error('Unexpected raster comparison: '+JSON.stringify(c));await fetch('/?browser-results='+encodeURIComponent(JSON.stringify(result)));}main().catch(e=>{document.getElementById('result').textContent='FAILED: '+e.stack;fetch('/?browser-error='+encodeURIComponent(e.stack));});
</script></body></html>`;
const output = resolve(here, 'browser-probe.html');
if (existsSync(output)) throw new Error('Refusing to overwrite existing browser probe.');
writeFileSync(output, html, { flag: 'wx' });
console.log(output);
