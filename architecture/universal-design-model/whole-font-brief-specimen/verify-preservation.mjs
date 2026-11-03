import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const directory = 'architecture/universal-design-model/whole-font-brief-specimen';
const baseline = JSON.parse(readFileSync(`${directory}/preservation-baseline.json`, 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd();
const status = () => git('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean);
const outsideExperiment = entries => entries.filter(line => {
  const path = line.slice(3);
  return !path.startsWith(`${directory}/`);
});
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const missing = baseline.preExistingPaths.filter(path => !existsSync(path));
const changed = baseline.preExistingPaths.filter(path => existsSync(path) && sha256(path) !== baseline.sha256[path]);
const currentOutside = outsideExperiment(status());
const baselineOutside = outsideExperiment(baseline.status);
const branch = git('branch', '--show-current');
const head = git('rev-parse', 'HEAD');
const result = { branch, head, baselineBranch: baseline.branch, baselineHead: baseline.head,
  preExistingFileCount: baseline.preExistingPaths.length, missing, changed,
  outsideExperimentStatusMatchesBaseline: JSON.stringify(currentOutside) === JSON.stringify(baselineOutside),
  baselineOutsideStatusCount: baselineOutside.length, currentOutsideStatusCount: currentOutside.length };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (branch !== baseline.branch || head !== baseline.head || missing.length || changed.length || !result.outsideExperimentStatusMatchesBaseline) process.exitCode = 1;
