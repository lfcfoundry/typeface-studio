import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const relativeDirectory = 'architecture/universal-design-model/whole-font-brief-specimen';
const output = `${relativeDirectory}/preservation-baseline.json`;
if (existsSync(output)) throw new Error(`Refusing to overwrite ${output}`);

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd();
const paths = [...new Set([
  ...git('ls-files', '--cached').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n')
])].filter(path => path && !path.startsWith(`${relativeDirectory}/`)).sort();
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const baseline = {
  purpose: 'Read-only preservation snapshot taken before this experiment adds implementation files.',
  branch: git('branch', '--show-current'),
  head: git('rev-parse', 'HEAD'),
  status: git('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean),
  preExistingPaths: paths,
  sha256: Object.fromEntries(paths.map(path => [path, sha256(path)]))
};
writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(JSON.stringify({ output, branch: baseline.branch, head: baseline.head, preExistingFiles: paths.length,
  modifiedOrUntrackedEntries: baseline.status.length }, null, 2));
