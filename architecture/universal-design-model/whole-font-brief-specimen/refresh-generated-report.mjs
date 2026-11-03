import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createDefaultAcceptedSource, runWholeFontBrief } from './candidate.mjs';
import { SUPPORTED_BRIEF } from './resolver.mjs';

const reportPath = 'architecture/universal-design-model/whole-font-brief-specimen/build-report.json';
const reportBytes = readFileSync(reportPath);
const reportHash = createHash('sha256').update(reportBytes).digest('hex');
const expectedReportHash = '9c8a82c86fa33aa0885aaf99b923a051613132b6daf1ec2b16d2db868b0749e0';
if (reportHash !== expectedReportHash) throw new Error('Refusing to update a report that differs from the build output recorded for this task.');
const report = JSON.parse(reportBytes.toString('utf8'));
const candidate = runWholeFontBrief(createDefaultAcceptedSource(), SUPPORTED_BRIEF);
if (candidate.candidateRevisionId !== report.candidateRevisionId) throw new Error('Rebuilt candidate revision does not match the saved report.');
report.provenance = {
  explicit: candidate.specification.decisions.filter(item => item.origin === 'explicit').map(item => ({ id: item.id, source: item.source })),
  inferred: candidate.execution.model.intent.statements.filter(item => item.origin === 'inferred').map(item => ({ id: item.id, kind: item.kind,
    source: item.source, inference: item.inference, resolution: item.resolution })),
  defaulted: candidate.execution.model.intent.statements.filter(item => item.origin === 'defaulted').map(item => ({ id: item.id, kind: item.kind,
    source: item.source, justification: item.justification, resolution: item.resolution })),
  unsupportedDecisionIds: candidate.specification.unsupported.map(item => item.decisionId),
  unresolvedDecisionIds: candidate.specification.unresolved.map(item => item.decisionId)
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' });
process.stdout.write(JSON.stringify({ report: reportPath, candidateRevisionId: report.candidateRevisionId,
  explicit: report.provenance.explicit.length, inferred: report.provenance.inferred.length, defaulted: report.provenance.defaulted.length }, null, 2));
