import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const experiment = dirname(fileURLToPath(import.meta.url));
const repo = resolve(experiment, '../../../../');
const baselinePath = join(experiment, 'preservation-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const branch = git('branch', '--show-current')[0];
const head = git('rev-parse', 'HEAD')[0];
const stagedPaths = git('diff', '--cached', '--name-only').sort();
const trackedModifiedPaths = git('diff', '--name-only').sort();
const untrackedPaths = git('ls-files', '--others', '--exclude-standard').sort();
const prefix = relative(repo, experiment).replaceAll('\\', '/') + '/';
const preexistingUntracked = untrackedPaths.filter(path => !path.startsWith(prefix));
if (branch !== baseline.branch || head !== baseline.head) throw new Error('Branch or HEAD differs from the recorded start baseline.');
if (JSON.stringify(stagedPaths) !== JSON.stringify([...baseline.stagedPaths].sort())) throw new Error('Staged paths differ from the recorded start baseline.');
if (JSON.stringify(trackedModifiedPaths) !== JSON.stringify([...baseline.preexistingTrackedModifiedPaths].sort())) throw new Error('Tracked modification inventory differs from the recorded start baseline.');
if (preexistingUntracked.length !== baseline.preexistingUntrackedPathCount) throw new Error(`Expected ${baseline.preexistingUntrackedPathCount} pre-existing untracked files, found ${preexistingUntracked.length}.`);

const baselineHashes = Object.entries(baseline.sha256).map(([path, expected]) => {
  const actual = createHash('sha256').update(readFileSync(join(repo, path))).digest('hex');
  return { path, expectedSha256: expected, actualSha256: actual, preserved: actual === expected };
});
if (baselineHashes.some(item => !item.preserved)) throw new Error('A hash-protected pre-existing source or artifact changed.');
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path);
    else {
      const relativePath = relative(experiment, path).replaceAll('\\', '/');
      if (relativePath === 'sha256-manifest.json') continue;
      files.push({ path: relativePath, bytes: stats.size, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
    }
  }
}
walk(experiment);
files.sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  purpose: 'Hashes for the isolated lowercase-h experiment and before/after preservation evidence.',
  branch, head, initialBranch: baseline.branch, initialHead: baseline.head,
  initialStagedPaths: baseline.stagedPaths, currentStagedPaths: stagedPaths,
  initialTrackedModifiedPaths: baseline.preexistingTrackedModifiedPaths, currentTrackedModifiedPaths: trackedModifiedPaths,
  initialPreexistingUntrackedPathCount: baseline.preexistingUntrackedPathCount,
  currentPreexistingUntrackedPathCount: preexistingUntracked.length,
  preservation: { allRecordedRelevantInputHashesMatch: true, inventoryMatches: true,
    recordedInputs: baselineHashes, experimentFiles: files,
    manifestDoesNotHashItself: true },
  artifacts: files.filter(item => item.path.startsWith('artifacts/') || item.path.startsWith('browser-evidence/'))
};
writeFileSync(join(experiment, 'sha256-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ branch, head, trackedModified: trackedModifiedPaths.length, staged: stagedPaths.length,
  preexistingUntracked: preexistingUntracked.length, relevantInputHashes: baselineHashes.length,
  experimentFilesHashed: files.length }, null, 2));
