import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultAcceptedSource, runWholeFontBrief } from './candidate.mjs';
import { SUPPORTED_BRIEF } from './resolver.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const artifactDirectory = join(here, 'artifacts');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const esc = value => String(value).replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function writeNew(path, bytes) {
  if (existsSync(path)) throw new Error(`Refusing to overwrite existing experiment output: ${path}`);
  writeFileSync(path, bytes, { flag: 'wx' });
  return { file: path.slice(here.length + 1), bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
}

function outlineSvg(glyph, title) {
  const path = glyph.contours.map(contour => {
    const commands = [`M ${contour.start.x} ${800 - contour.start.y}`];
    for (const segment of contour.segments) {
      if (segment.type === 'line') commands.push(`L ${segment.to.x} ${800 - segment.to.y}`);
      else commands.push(`Q ${segment.control.x} ${800 - segment.control.y} ${segment.to.x} ${800 - segment.to.y}`);
    }
    commands.push('Z');
    return `<path d="${commands.join(' ')}"/>`;
  }).join('');
  return `<svg viewBox="0 0 650 800" role="img" aria-label="${esc(title)}"><g fill="currentColor" fill-rule="evenodd">${path}</g><path d="M0 800H650" stroke="#aaa" stroke-width="2"/></svg>`;
}

function makeReviewHtml(report, sourceFont, candidateFont, sourceModel, candidateModel) {
  const sourceData = Buffer.from(sourceFont.bytes).toString('base64');
  const candidateData = Buffer.from(candidateFont.bytes).toString('base64');
  const glyphs = ['o', 'n', 'H', 'a', 'h'];
  const sourceCards = glyphs.filter(name => name !== 'h').map(name => {
    const record = sourceModel.glyphRegistry.glyphs.find(item => item.name === name);
    const geometry = sourceModel.derived.geometry.glyphs[record.id];
    return `<article class="glyph-card"><h3>${name}</h3>${outlineSvg(geometry, `Accepted ${name} outline`)}<p>Accepted source · ${geometry.metrics.advanceWidth} advance</p></article>`;
  }).join('');
  const candidateCards = glyphs.map(name => {
    const record = candidateModel.glyphRegistry.glyphs.find(item => item.name === name);
    const geometry = candidateModel.derived.geometry.glyphs[record.id];
    const note = name === 'a' ? 'Accepted single-storey form shown for comparison only; it does not satisfy the requested double-storey exception.'
      : name === 'h' ? 'Added from the bounded default specimen inventory.' : 'Carried forward from the accepted revision.';
    return `<article class="glyph-card"><h3>${name}</h3>${outlineSvg(geometry, `Candidate ${name} outline`)}<p>${esc(note)}</p><p>${geometry.metrics.advanceWidth} advance · bounds ${geometry.bounds.xMin},${geometry.bounds.yMin}–${geometry.bounds.xMax},${geometry.bounds.yMax}</p></article>`;
  }).join('');
  const reportData = JSON.stringify({ sourceRevisionId: report.sourceRevisionId, candidateRevisionId: report.candidateRevisionId,
    candidateStatus: report.candidateStatus, briefCompliance: report.briefCompliance }).replace(/</gu, '\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Whole-font brief specimen review</title>
<style>
:root{font:16px/1.5 system-ui,sans-serif;color:#26231f;background:#f3f1ec}body{max-width:1200px;margin:0 auto;padding:20px}h1{font-size:1.6rem}.warning{background:#fff3d6;border:1px solid #d4a84c;padding:14px;border-radius:8px}.columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}.panel{background:#fff;border:1px solid #d5d0c7;border-radius:9px;padding:14px}.glyph-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}.glyph-card{border:1px solid #e1ddd6;border-radius:7px;padding:8px;min-width:0}.glyph-card svg{width:100%;height:135px;color:#171512}.glyph-card p,.meta{font-size:.88rem;color:#514b43}.samples{font-family:CandidateFace,system-ui,sans-serif;line-height:1.6;overflow-wrap:anywhere}.source-samples{font-family:SourceFace,system-ui,sans-serif}.sample-size{margin:8px 0}.sample-size[data-size="12"]{font-size:12px}.sample-size[data-size="16"]{font-size:16px}.sample-size[data-size="24"]{font-size:24px}.sample-size[data-size="32"]{font-size:32px}.sample-size[data-size="48"]{font-size:48px}.sample-size[data-size="72"]{font-size:72px}.status{padding:8px;background:#eee;border-radius:5px}.controls{display:grid;gap:9px;max-width:650px}label{display:grid;gap:4px}input,select,textarea,button{font:inherit;padding:8px}textarea{min-height:70px}
</style><body>
<h1>Whole-font brief: coordinated partial specimen</h1>
<p class="warning"><strong>Not a compliant or visually approved typeface.</strong> The brief is only partially supportable. The accepted single-storey <code>a</code> is shown for comparison, not as a substitute for the requested conventional double-storey form. The double-storey experiment is excluded because its saved browser raster does not look conventional. Human visual review is still pending.</p>
<p>Source revision <code>${esc(report.sourceRevisionId)}</code> → candidate <code>${esc(report.candidateRevisionId)}</code>. Technical status: passed internal construction/compiler checks. Visual status: not reviewed.</p>
<div class="columns"><section class="panel"><h2>Accepted source outlines</h2><div class="glyph-grid">${sourceCards}</div><h3>Source word checks</h3><div class="samples source-samples"><div>noon · anon</div><div class="sample-size" data-size="24">noon · anon</div><div class="sample-size" data-size="48">noon · anon</div></div><p class="meta">The source has no lowercase h, so “Hanna” is not a source-font comparison.</p></section>
<section class="panel"><h2>Candidate specimen outlines</h2><div class="glyph-grid">${candidateCards}</div><h3>Candidate word checks</h3><div class="samples"><div>Hanna · noon · anon · nn · oo · aa</div>${[12,16,24,32,48,72].map(size => `<div class="sample-size" data-size="${size}">Hanna · noon · anon · nn · oo · aa</div>`).join('')}</div></section></div>
<section class="panel"><h2>Compiled font loading and rendering</h2><p id="font-status" class="status">Font loading has not run.</p><p class="meta">A successful load only confirms browser parsing/loading. It does not set visual review or approval.</p></section>
<section class="panel"><h2>Record a human review</h2><p class="meta">This control records a reviewer statement in a downloadable JSON record. Approval applies only to this partial specimen; it does not change the unresolved brief requirements or certify professional quality.</p><div class="controls"><label>Reviewer<input id="reviewer" autocomplete="name"></label><label>Decision<select id="decision"><option value="not-approved">Reviewed, not approved</option><option value="approved">Visually approved as a partial specimen</option></select></label><label>Evidence reference (for example, screenshot filename)<input id="evidence"></label><label>Notes<textarea id="notes"></textarea></label><button id="record">Record review and download JSON</button><p id="review-status" class="status">No human visual decision recorded.</p></div></section>
<script>
const sourceBytes=Uint8Array.from(atob('${sourceData}'),c=>c.charCodeAt(0)),candidateBytes=Uint8Array.from(atob('${candidateData}'),c=>c.charCodeAt(0));
Promise.all([new FontFace('SourceFace',sourceBytes).load(),new FontFace('CandidateFace',candidateBytes).load()]).then(faces=>{faces.forEach(face=>document.fonts.add(face));document.getElementById('font-status').textContent='Both fonts loaded with FontFace; rendered word samples below use the loaded candidate and source faces.';}).catch(error=>{document.getElementById('font-status').textContent='FontFace load failed: '+error.message;});
const candidate=${reportData};
document.getElementById('record').addEventListener('click',()=>{const reviewer=document.getElementById('reviewer').value.trim(),evidence=document.getElementById('evidence').value.trim(),decision=document.getElementById('decision').value;if(!reviewer||!evidence){alert('Enter a reviewer and evidence reference.');return;}const record={type:'lfcfoundry.whole-font-visual-review',version:1,candidateRevisionId:candidate.candidateRevisionId,reviewer,method:'human-visual-inspection',decision,notes:document.getElementById('notes').value,evidenceRefs:[evidence],candidateStatus:decision==='approved'?'visually-approved':'visually-reviewed-not-approved',briefCompliance:candidate.briefCompliance,scope:'partial-specimen-only'};document.getElementById('review-status').textContent=record.candidateStatus+' · reviewer: '+reviewer+' · this is a partial specimen only';const blob=new Blob([JSON.stringify(record,null,2)+'\\n'],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='visual-review-'+candidate.candidateRevisionId+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
</script></body></html>`;
}

const source = createDefaultAcceptedSource();
const result = runWholeFontBrief(source, SUPPORTED_BRIEF);
if (result.status !== 'committed-candidate') throw new Error(`Could not compile the coordinated specimen: ${result.error || JSON.stringify(result.diagnostics)}`);
if (existsSync(artifactDirectory)) throw new Error(`Refusing to reuse existing output directory: ${artifactDirectory}`);
mkdirSync(artifactDirectory, { recursive: false });

const sourceFontPath = join(artifactDirectory, 'LFCFoundry-Whole-Brief-Source.ttf');
const candidateFontPath = join(artifactDirectory, 'LFCFoundry-Whole-Brief-Partial-Candidate.ttf');
const sourceArtifact = writeNew(sourceFontPath, result.execution.sourceFont.bytes);
const candidateArtifact = writeNew(candidateFontPath, result.execution.candidateFont.bytes);
const sourceGlyphs = Object.fromEntries(Object.keys(result.execution.sourceFont.parsed.glyphs)
  .filter(name => result.execution.sourceFont.parsed.glyphs[name])
  .map(name => [name, result.execution.sourceFont.parsed.glyphs[name]]));
const candidateGlyphs = Object.fromEntries(['o', 'n', 'H', 'a', 'h'].map(name => [name, result.execution.candidateFont.parsed.glyphs[name]]));
const report = {
  experiment: 'whole-font-brief-resolution-and-coordinated-specimen-v1',
  input: result.specification.brief,
  sourceRevisionId: result.sourceRevisionId,
  candidateRevisionId: result.candidateRevisionId,
  revisionStatus: result.execution.revision.status,
  operations: result.execution.revision.operationIds,
  changedGlyphIds: result.execution.revision.changedGlyphIds,
  preservedGlyphIds: result.execution.revision.preservedGlyphIds,
  briefCompliance: result.briefCompliance,
  candidateStatus: result.candidateStatus,
  technicalStatus: result.technicalStatus,
  visualReview: result.visualReview,
  provenance: {
    explicit: result.specification.decisions.filter(item => item.origin === 'explicit').map(item => ({ id: item.id, source: item.source })),
    inferred: result.execution.model.intent.statements.filter(item => item.origin === 'inferred').map(item => ({ id: item.id, kind: item.kind,
      source: item.source, inference: item.inference, resolution: item.resolution })),
    defaulted: result.execution.model.intent.statements.filter(item => item.origin === 'defaulted').map(item => ({ id: item.id, kind: item.kind,
      source: item.source, justification: item.justification, resolution: item.resolution })),
    unsupportedDecisionIds: result.specification.unsupported.map(item => item.decisionId),
    unresolvedDecisionIds: result.specification.unresolved.map(item => item.decisionId)
  },
  specification: result.specification,
  specimenPlan: result.specimenPlan,
  fonts: {
    compiler: 'Existing fontsketch 0.1.0 path via construction-experiment/font-adapter.mjs',
    internalAudit: { source: result.execution.sourceFont.audit.valid, candidate: result.execution.candidateFont.audit.valid },
    independentValidation: 'not run; no independent font validator is invoked by this build',
    source: { ...sourceArtifact, glyphs: sourceGlyphs },
    candidate: { ...candidateArtifact, glyphs: candidateGlyphs },
    mapping: { h: result.execution.candidateFont.parsed.glyphs.h.unicodes, a: result.execution.candidateFont.parsed.glyphs.a.unicodes },
    oldGlyphRecordsUnchanged: true
  },
  geometryCompilerBoundary: { validatedFamilyEqualsCompilerPointInput: true,
    method: 'Compare each compilerProject contour point array with the same executor-validated family contour before compilation.' },
  qualityLimit: 'The candidate is intentionally partial and does not satisfy the humanist, condensed, tall-x-height, generous-counter, rounded-terminal, conventional double-storey-a, or small-size readability requirements as a whole.'
};
writeNew(join(here, 'specification.json'), `${JSON.stringify(result.specification, null, 2)}\n`);
writeNew(join(here, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeNew(join(here, 'review.html'), makeReviewHtml(report, result.execution.sourceFont, result.execution.candidateFont,
  source.model, result.execution.model));
process.stdout.write(`${JSON.stringify({ sourceRevisionId: result.sourceRevisionId, candidateRevisionId: result.candidateRevisionId,
  candidateStatus: result.candidateStatus, sourceArtifact, candidateArtifact, review: 'review.html',
  oldGlyphRecordsUnchanged: true, visualReview: 'not-reviewed' }, null, 2)}\n`);
