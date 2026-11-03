import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileTypeface } from '../../../prototype/src/font.js';
import { auditSfnt } from '../../../prototype/src/sfnt-audit.js';
import { prepareCompositionScenario, prepareHeartScenario, prepareReflectionScenario } from './scenarios.mjs';

const output = join(process.env.TMPDIR || '/tmp', 'typeface-studio-v2-model-to-font');
await mkdir(output, { recursive: true });
const artifacts = [];

function save(name, compiled) {
  const audit = auditSfnt(compiled.bytes);
  if (!audit.valid) throw new Error(`${name} failed the bundled SFNT audit: ${JSON.stringify(audit)}`);
  const path = join(output, name), bytes = Buffer.from(compiled.bytes);
  return writeFile(path, bytes).then(() => artifacts.push({ name, path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), audit: {
    valid: audit.valid, tables: audit.tables, numGlyphs: audit.numGlyphs, unitsPerEm: audit.metadata.unitsPerEm,
    weightClass: audit.metadata.weightClass, cmap: Object.fromEntries([0x004f, 0x006f, 0x002c, 0x0020].map(cp => [`U+${cp.toString(16).toUpperCase()}`, audit.cmap.glyphIndex(cp)]))
  } }));
}

for (const style of ['Regular', 'Bold']) {
  const scenario = prepareHeartScenario(style);
  if (scenario.execution.status !== 'committed-candidate') throw new Error(`Heart ${style}: ${scenario.execution.error}`);
  await save(`heart-humanist-${style.toLowerCase()}-baseline.ttf`, compileTypeface(scenario.family, style));
  await save(`heart-humanist-${style.toLowerCase()}-v2.ttf`, compileTypeface(scenario.execution.family, style));
}

for (const [label, prepare] of [['lowercase-reflection', prepareReflectionScenario], ['heart-then-reflection', prepareCompositionScenario]]) {
  const scenario = prepare();
  if (scenario.execution.status !== 'committed-candidate') throw new Error(`${label}: ${scenario.execution.error}`);
  await save(`${label}-baseline.ttf`, compileTypeface(scenario.family, 'Regular'));
  await save(`${label}-v2.ttf`, compileTypeface(scenario.execution.family, 'Regular'));
}

const summary = { outputDirectory: output, validator: 'repository sfnt-audit (not independent)', artifacts };
await writeFile(join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

