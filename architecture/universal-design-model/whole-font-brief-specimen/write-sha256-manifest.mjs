import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const directory = 'architecture/universal-design-model/whole-font-brief-specimen';
const output = join(directory, 'sha256-manifest.json');
if (existsSync(output)) throw new Error(`Refusing to overwrite ${output}`);
function walk(path) {
  return readdirSync(path).flatMap(name => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? walk(child) : [child];
  });
}
const files = walk(directory).filter(path => path !== output).map(path => {
  const bytes = readFileSync(path);
  return { file: relative(root, path).replaceAll('\\', '/'), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') };
}).sort((a, b) => a.file.localeCompare(b.file));
const manifest = { version: 1, generatedBy: 'write-sha256-manifest.mjs', excludesSelf: true, files };
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ output, fileCount: files.length }, null, 2)}\n`);
