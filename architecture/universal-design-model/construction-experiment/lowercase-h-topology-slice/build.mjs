import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilerProject } from '../font-adapter.mjs';
import { acceptCandidate, compilerInputMatchesValidatedGeometry, createAcceptedSource, runRequest, SUPPORTED_REQUEST } from './scenario.mjs';
import { H_GLYPH_ID } from './grammar.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = join(here, 'artifacts');
const sha = value => createHash('sha256').update(value).digest('hex');
const writeNew = (path, data) => {
  writeFileSync(path, data, { flag: 'wx' });
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return { path: path.slice(here.length + 1), bytes: bytes.length, sha256: sha(bytes) };
};
const escape = value => String(value).replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function svg(glyph, label) {
  const paths = glyph.contours.map(contour => {
    const pieces = [`M ${contour.start.x} ${800 - contour.start.y}`];
    for (const segment of contour.segments) {
      if (segment.type === 'line') pieces.push(`L ${segment.to.x} ${800 - segment.to.y}`);
      else pieces.push(`Q ${segment.control.x} ${800 - segment.control.y} ${segment.to.x} ${800 - segment.to.y}`);
    }
    pieces.push('Z');
    return `<path d="${pieces.join(' ')}"/>`;
  }).join('');
  return `<svg viewBox="0 0 650 800" role="img" aria-label="${escape(label)}"><g fill="#28231e" fill-rule="evenodd">${paths}</g></svg>`;
}

mkdirSync(artifacts, { recursive: false });
const source = createAcceptedSource();
const result = runRequest(source, SUPPORTED_REQUEST);
if (result.status !== 'committed-candidate') throw new Error(`Could not produce h candidate: ${result.error || JSON.stringify(result.diagnostics)}`);
if (!compilerInputMatchesValidatedGeometry(result.model, result.family)) throw new Error('Compiler input does not match executor-validated h geometry.');

const sourceProject = compilerProject(source.model), candidateProject = compilerProject(result.model);
const previousNames = sourceProject.glyphOrder.map(id => sourceProject.glyphs[id].name);
for (const name of previousNames) {
  if (JSON.stringify(result.sourceFont.parsed.glyphs[name]) !== JSON.stringify(result.candidateFont.parsed.glyphs[name])) {
    throw new Error(`Existing compiled glyph record ${name} differs in the candidate font.`);
  }
}
const geometry = result.model.derived.geometry.glyphs[H_GLYPH_ID];
const hRecord = result.model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID);
const nRecord = result.model.glyphRegistry.glyphs.find(item => item.name === 'n');
const hNodes = hRecord.construction.nodes;
const sourceFont = writeNew(join(artifacts, 'LFCFoundry-Distinct-Topology-Parent.ttf'), result.sourceFont.bytes);
const candidateFont = writeNew(join(artifacts, 'LFCFoundry-Distinct-Topology-H.ttf'), result.candidateFont.bytes);

const sourceBase64 = Buffer.from(result.sourceFont.bytes).toString('base64');
const candidateBase64 = Buffer.from(result.candidateFont.bytes).toString('base64');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lowercase h distinct topology experiment</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:1100px;margin:auto;padding:22px;color:#29241f;background:#f6f3ed}h1{font-size:1.65rem}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}.card{background:#fff;border:1px solid #c9c1b5;border-radius:9px;padding:16px}.outline{width:220px;height:270px;display:block;margin:8px auto}.render{font-size:120px;line-height:1.3;text-align:center;margin:8px}.meta{font-size:.9rem;color:#554e45;overflow-wrap:anywhere}.ok{color:#17643b}.bad{color:#a12d19}canvas{display:block;background:#fff;border:1px solid #ddd;margin:12px auto;width:390px;height:420px}code{overflow-wrap:anywhere}</style><body>
<h1>Distinct semantic construction: lowercase h</h1><p>Request: <q>${escape(SUPPORTED_REQUEST)}</q></p>
<p>Candidate revision <code>${result.revision.id}</code>, parent <code>${result.sourceRevisionId}</code>. The comparison uses the same parent source font and a separate candidate font.</p>
<div class="cards"><section class="card"><h2>Existing lowercase n</h2>${svg(result.model.derived.geometry.glyphs[nRecord.id], 'Existing lowercase n outline')}<p class="meta">Two-stem connected shoulder construction. This is the existing structural comparison.</p></section>
<section class="card"><h2>New lowercase h — derived outline</h2>${svg(geometry, 'Lowercase h outline derived from semantic construction')}<p class="meta">One ascender stem · shoulder return · explicit open counter and baseline opening.</p></section>
<section class="card"><h2>Candidate font rendering</h2><p class="render" style="font-family:CandidateH">h h h</p><p id="status" class="meta">Waiting for FontFace load…</p><p class="meta">The raster preview below is drawn by the browser from the loaded candidate font.</p><canvas id="raster" width="390" height="420"></canvas></section></div>
<h2>Derived bounds and metrics</h2><p class="meta">Bounds ${geometry.bounds.xMin},${geometry.bounds.yMin} to ${geometry.bounds.xMax},${geometry.bounds.yMax} font units. Advance ${geometry.metrics.advanceWidth}; side bearings ${geometry.metrics.leftSideBearing}/${geometry.metrics.rightSideBearing}. Existing glyph records ${previousNames.map(escape).join(', ')} are identical in the internal compiler parse.</p>
<script>
const fonts=[['ParentSource','${sourceBase64}'],['CandidateH','${candidateBase64}']];
Promise.all(fonts.map(async([name,data])=>{const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const face=await new FontFace(name,bytes).load();document.fonts.add(face);return name})).then(names=>{const status=document.getElementById('status');status.textContent='FontFace loaded: '+names.join(', ');status.className='meta ok';const c=document.getElementById('raster'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#28231e';ctx.font='320px CandidateH';ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillText('h',32,354);window.typefaceStudioBrowserEvidence={loaded:names,fontCheck:document.fonts.check('320px CandidateH'),textMetrics:(()=>{ctx.font='320px CandidateH';const m=ctx.measureText('h');return {width:m.width,actualBoundingBoxLeft:m.actualBoundingBoxLeft,actualBoundingBoxRight:m.actualBoundingBoxRight,actualBoundingBoxAscent:m.actualBoundingBoxAscent,actualBoundingBoxDescent:m.actualBoundingBoxDescent}})(),canvasDataUrl:c.toDataURL('image/png')}}).catch(error=>{const status=document.getElementById('status');status.textContent='Font loading failed: '+error.message;status.className='meta bad';window.typefaceStudioBrowserEvidence={error:String(error)}});
</script></body></html>`;
const review = writeNew(join(here, 'review.html'), html);

const report = {
  experiment: 'distinct-lowercase-h-topology-slice-v1',
  request: { text: SUPPORTED_REQUEST, sourceRevisionId: result.sourceRevisionId,
    candidateRevisionId: result.revision.id, operationId: result.operation.id,
    explicit: result.interpreted.explicit, inferred: result.interpreted.inferred,
    spans: result.interpreted.intents.map(intent => ({ intentId: intent.id, start: intent.source.start, end: intent.source.end, text: intent.source.text })) },
  topology: { method: hRecord.construction.method, supportedScope: 'one new lowercase h in this experiment',
    components: hNodes.filter(node => !node.kind.endsWith('boundary')).map(node => ({ id: node.id, kind: node.kind, role: node.role })),
    boundaries: hNodes.filter(node => node.kind === 'anatomy.boundary').map(node => ({ id: node.id, role: node.role, ownerId: node.parameters.ownerId })),
    differenceFromExistingN: { h: 'one ascender stem; the shoulder owns an integrated descending return; open space and the baseline opening are explicit',
      n: 'two semantic stems connected by an arched bridge; lower negative space is not represented as this explicit open-space node' },
    terminalRoles: hNodes.filter(node => node.kind === 'anatomy.terminal').map(node => ({ id: node.id, role: node.role, profile: node.parameters.profile, alignmentDecisionId: node.parameters.alignmentDecisionId })) },
  geometry: { bounds: geometry.bounds, metrics: geometry.metrics, contourCount: geometry.contours.length,
    segmentTypes: geometry.contours.flatMap(contour => contour.segments.map(segment => segment.type)),
    explicitOpenSpace: geometry.openSpaces, validation: 'Existing validateGlyph checks point range, winding, area, sampled self-intersection and containment. Sample-based checks are not mathematical proofs.',
    boundsMethod: 'contourBounds computes endpoints and quadratic extrema analytically for this path.',
    geometryValidatedByTransactionExecutor: true, geometryPointRecordsMatchCompilerInput: compilerInputMatchesValidatedGeometry(result.model, result.family),
    metricPolicy: result.operation.metricPolicy, kerningReviewFlag: result.revision.invalidated.includes('kerning') },
  transaction: { status: result.status, revisionStatus: result.revision.status, parentRevisionIds: result.revision.parentRevisionIds,
    changedGlyphIds: result.revision.changedGlyphIds, preservedGlyphIds: result.revision.preservedGlyphIds,
    targetGlyphIds: result.revision.targetedGlyphIds, acceptedParentUnchanged: source.model.revisions.headRevisionId === result.sourceRevisionId },
  fonts: { compiler: 'fontsketch 0.1.0 through prototype/src/font.js', internalAudit: 'prototype/src/sfnt-audit.js and compiler parse; not independent validation',
    independentValidator: 'not run; no independent validator was installed or used',
    source: { ...sourceFont, internalAuditValid: result.sourceFont.audit.valid, glyphOrder: sourceProject.glyphOrder.map(id => sourceProject.glyphs[id].name) },
    candidate: { ...candidateFont, internalAuditValid: result.candidateFont.audit.valid, glyphOrder: candidateProject.glyphOrder.map(id => candidateProject.glyphs[id].name),
      lowercaseH: { name: result.candidateFont.parsed.glyphs.h.name, unicodes: result.candidateFont.parsed.glyphs.h.unicodes,
        advanceWidth: result.candidateFont.parsed.glyphs.h.advanceWidth, compiledContourCount: result.candidateFont.parsed.glyphs.h.contours.length,
        compiledPointsEqualValidatedFamilyPoints: JSON.stringify(result.candidateFont.parsed.glyphs.h.contours[0].points) ===
          JSON.stringify(result.family.glyphs[H_GLYPH_ID].contours[0].points.map(({ x, y, on }) => ({ x, y, on }))) } },
    existingCompiledGlyphsUnchanged: previousNames, existingGlyphRecordsEqual: true },
  browser: { status: 'review page generated; browser rendering is not established by this build step', reviewPage: review.path },
  limits: ['One new topology is demonstrated; no arbitrary topology compiler is provided.',
    'Outline validation includes sampled checks and does not prove all geometric properties.',
    'Internal SFNT audit is not independent font validation; no general shaping or installability claim is made.']
};
const reportFile = writeNew(join(here, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, files: [sourceFont, candidateFont, review, reportFile] }, null, 2));
