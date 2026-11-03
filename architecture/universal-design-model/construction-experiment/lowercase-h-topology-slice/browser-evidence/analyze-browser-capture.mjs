import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = here;
const pngPath = join(dir, 'android-chrome-canvas.png');
const resultPath = join(dir, 'android-chrome-results.json');
const png = readFileSync(pngPath);
const rawResults = JSON.parse(readFileSync(resultPath, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Expected a PNG capture.');

let width, height, bitDepth, colorType;
const compressed = [];
for (let offset = 8; offset < png.length;) {
  const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
  const data = png.subarray(offset + 8, offset + 8 + length);
  if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
  if (type === 'IDAT') compressed.push(data);
  offset += 12 + length;
  if (type === 'IEND') break;
}
if (bitDepth !== 8 || colorType !== 6) throw new Error(`Unsupported PNG encoding: ${bitDepth}-bit color type ${colorType}.`);
const bpp = 4, rowBytes = width * bpp, packed = inflateSync(Buffer.concat(compressed));
const pixels = Buffer.alloc(height * rowBytes);
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0; y < height; y++) {
  const filter = packed[y * (rowBytes + 1)], source = packed.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1));
  for (let x = 0; x < rowBytes; x++) {
    const left = x >= bpp ? pixels[y * rowBytes + x - bpp] : 0;
    const up = y ? pixels[(y - 1) * rowBytes + x] : 0;
    const upperLeft = y && x >= bpp ? pixels[(y - 1) * rowBytes + x - bpp] : 0;
    const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upperLeft) : NaN;
    if (!Number.isFinite(predictor)) throw new Error(`Unsupported PNG row filter ${filter}.`);
    pixels[y * rowBytes + x] = (source[x] + predictor) & 255;
  }
}
function inkBounds(region, threshold = 245) {
  let xMin = region.x + region.width, yMin = region.y + region.height, xMax = -1, yMax = -1, count = 0;
  for (let y = region.y; y < region.y + region.height; y++) for (let x = region.x; x < region.x + region.width; x++) {
    const offset = y * rowBytes + x * bpp;
    const alpha = pixels[offset + 3], darkest = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    if (alpha > 24 && darkest < threshold) {
      xMin = Math.min(xMin, x); yMin = Math.min(yMin, y); xMax = Math.max(xMax, x); yMax = Math.max(yMax, y); count++;
    }
  }
  return count ? { xMin, yMin, xMax, yMax, pixelCount: count, alphaThreshold: 24, rgbDarkestChannelThreshold: threshold } : null;
}

const corrected = {
  ...rawResults,
  render: { ...rawResults.render, rasterBounds: {
    parentN: inkBounds({ x: 70, y: 30, width: 330, height: 340 }),
    candidateH: inkBounds({ x: 470, y: 30, width: 300, height: 340 })
  }, rasterMaskCorrection: 'Original capture had an opaque white background; alpha alone included the full crop. Bounds were recomputed from the same browser PNG using alpha > 24 and darkest RGB channel < 245.' },
  evidence: { screenshotType: 'Android Chrome Canvas raster of loaded font glyphs', file: 'android-chrome-canvas.png',
    bytes: png.length, sha256: sha256(png), dimensions: { width, height },
    initialResultsFile: 'android-chrome-results.json', initialRasterMaskWasSuperseded: true }
};
const correctedPath = join(dir, 'android-chrome-results-final.json');
writeFileSync(correctedPath, `${JSON.stringify(corrected, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(corrected, null, 2));
