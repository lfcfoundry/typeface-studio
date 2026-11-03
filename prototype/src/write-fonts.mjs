import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { interpretBrief } from './brief.js';
import { generateContourFamily } from './recipes.js';
import { compileTypeface } from './font.js';
import { auditSfnt } from './sfnt-audit.js';

const systems = ['geometric', 'humanist', 'serif'];
const styles = ['Regular', 'Bold'];
const spec = interpretBrief('A humanist-inspired sans-serif with open apertures, a generous x-height, and regular weight.');
spec.source.family = 'LFCFoundry Contour Prototype';
const output = resolve(import.meta.dirname, '../artifacts');
mkdirSync(output, { recursive: true });
const reports = [];
for (const system of systems) for (const style of styles) {
  const family = generateContourFamily(spec, { system, style });
  const result = compileTypeface(family, style);
  const audit = auditSfnt(result.bytes);
  if (!audit.valid) throw new Error(`${system} ${style} failed SFNT audit: ${JSON.stringify(audit)}`);
  const path = resolve(output, `LFCFoundry-Contour-${system}-${style}.ttf`);
  writeFileSync(path, result.bytes);
  reports.push({ path, bytes: result.bytes.length, system, style, weightClass: result.weightClass, tableCount: audit.tables.length, glyphCount: audit.numGlyphs, checksumValid: audit.wholeChecksumValid });
}
console.log(JSON.stringify(reports, null, 2));
