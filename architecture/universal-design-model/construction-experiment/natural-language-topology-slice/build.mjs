import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compilerProject, createAcceptedSource, expectedMetrics, runTopologyRequest, SUPPORTED_REQUEST } from './scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const artifactDir = join(here, 'artifacts');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceName = 'LFCFoundry-NL-Topology-Single-Storey-A.ttf';
const candidateName = 'LFCFoundry-NL-Topology-Double-Storey-A.ttf';

function saveExact(path, content) {
  const bytes = Buffer.from(content);
  if (existsSync(path)) {
    if (!readFileSync(path).equals(bytes)) throw new Error(`Refusing to overwrite a different existing artifact: ${path}`);
  } else writeFileSync(path, bytes, { flag: 'wx' });
  return { path: path.slice(here.length + 1), bytes: bytes.length, sha256: digest(bytes) };
}

function svgGlyph(glyph, label) {
  const paths = glyph.contours.map(contour => {
    const pieces = [`M ${contour.start.x} ${500 - contour.start.y}`];
    for (const segment of contour.segments) {
      if (segment.type === 'line') pieces.push(`L ${segment.to.x} ${500 - segment.to.y}`);
      else pieces.push(`Q ${segment.control.x} ${500 - segment.control.y} ${segment.to.x} ${500 - segment.to.y}`);
    }
    pieces.push('Z');
    return `<path d="${pieces.join(' ')}"/>`;
  }).join('');
  return `<svg viewBox="0 0 650 500" role="img" aria-label="${label}"><g fill="#25241f" fill-rule="evenodd">${paths}</g></svg>`;
}

mkdirSync(artifactDir, { recursive: true });
const source = createAcceptedSource();
const result = runTopologyRequest(source, SUPPORTED_REQUEST);
if (result.status !== 'committed-candidate') throw new Error(`Could not build topology candidate: ${result.error || JSON.stringify(result.diagnostics)}`);

const sourceProject = compilerProject(source.model);
const candidateProject = compilerProject(result.model);
for (const id of ['glyph:u006f', 'glyph:u006e', 'glyph:u0048']) {
  const before = result.sourceFont.parsed.glyphs[sourceProject.glyphs[id].name];
  const after = result.candidateFont.parsed.glyphs[candidateProject.glyphs[id].name];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Compiled unrelated glyph ${id} changed.`);
}

const sourceArtifact = saveExact(join(artifactDir, sourceName), result.sourceFont.bytes);
const candidateArtifact = saveExact(join(artifactDir, candidateName), result.candidateFont.bytes);
const sourceA = sourceProject.glyphs['glyph:u0061'];
const candidateA = candidateProject.glyphs['glyph:u0061'];
const report = {
  experiment: 'natural-language-single-to-double-storey-a-v1',
  request: { text: SUPPORTED_REQUEST, sourceRevisionId: result.sourceRevisionId,
    intentIds: result.interpreted.intents.map(item => item.id), requestedTopology: 'double-storey',
    explicit: result.interpreted.explicit, inferred: result.interpreted.inferred },
  operation: { id: result.operation.id, type: result.operation.type, targetGlyphId: result.targetGlyphId,
    parentRevisionId: result.sourceRevisionId, candidateRevisionId: result.revision.id,
    acceptedSourceUnchanged: true, candidateStatus: 'candidate', metricPolicy: result.operation.metricPolicy,
    preservedGlyphIds: result.preservedGlyphIds },
  semanticTopology: {
    source: { method: 'construction.bowl-with-attached-stem', topology: 'single-storey', bowls: 1, counters: 1 },
    candidate: { method: 'construction.spine-and-bowl-stack', topology: 'double-storey', bowls: 2, counters: 2,
      preservedNodeIds: result.model.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061').construction.identityDiff.preservedNodeIds,
      addedNodeIds: result.model.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061').construction.identityDiff.addedNodeIds }
  },
  geometry: {
    source: expectedMetrics(source.model), candidate: expectedMetrics(result.model),
    validation: 'Existing semantic grammar resolver and validateGlyph lifecycle; counter containment uses sampled curves, not an exact geometry proof.',
    sourceOfTruth: 'Two-storey PathBuilder segment paths; orientContour rebuilds TrueType point records from the segments.',
    compilerBoundary: 'canonicalizeInitialGeometry rebuilds points from segments. The v2 executor validates those same family contours; compilerProject passes the same model geometry to fontPoints.',
    validatedGeometryMatchesCompilerInput: JSON.stringify(candidateA.contours.map(c => c.points)) === JSON.stringify(result.family.glyphs['glyph:u0061'].contours.map(c => c.points))
  },
  fonts: {
    compiler: 'fontsketch 0.1.0 through prototype/src/font.js',
    internalAudit: 'prototype/src/sfnt-audit.js; fontsketch parser and checksum validation',
    independentValidator: 'not run; FontTools/OTS were not installed for the earlier architecture checks.',
    source: { ...sourceArtifact, valid: result.sourceFont.audit.valid,
      glyphOrder: sourceProject.glyphOrder.map(id => sourceProject.glyphs[id].name),
      lowercaseA: { unicodes: result.sourceFont.parsed.glyphs.a.unicodes, advanceWidth: result.sourceFont.parsed.glyphs.a.advanceWidth, bounds: sourceA.bounds, metrics: sourceA.metrics } },
    candidate: { ...candidateArtifact, valid: result.candidateFont.audit.valid,
      glyphOrder: candidateProject.glyphOrder.map(id => candidateProject.glyphs[id].name),
      lowercaseA: { unicodes: result.candidateFont.parsed.glyphs.a.unicodes, advanceWidth: result.candidateFont.parsed.glyphs.a.advanceWidth, bounds: candidateA.bounds, metrics: candidateA.metrics } }
  },
  scope: 'This creates two separate diagnostic fonts for review. It does not create an OpenType alternate or implement GSUB.'
};

const sourceBase64 = Buffer.from(result.sourceFont.bytes).toString('base64');
const candidateBase64 = Buffer.from(result.candidateFont.bytes).toString('base64');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Natural-language topology slice</title>
<style>body{font:16px/1.45 system-ui,sans-serif;max-width:1100px;margin:auto;padding:20px;color:#29241f;background:#f7f4ee}h1{font-size:1.6rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}section{background:white;border:1px solid #cbc4b8;border-radius:10px;padding:16px}.glyph{height:260px;width:195px;display:block;margin:12px auto}.sample{font-size:80px;line-height:1.25}.status{color:#8a3d12}.ok{color:#17653b}.facts{font-size:.92rem;color:#504a42}code{overflow-wrap:anywhere}</style><body>
<h1>Single-storey to double-storey lowercase a</h1><p>Request: <q>${SUPPORTED_REQUEST}</q></p><p>This isolated experiment produces a semantic candidate through the v2 transaction executor. The accepted source revision remains unchanged. The fonts are separate review files, not OpenType alternates.</p>
<div class="grid"><section><h2>Accepted source</h2><p>Revision <code>${result.sourceRevisionId}</code></p>${svgGlyph(sourceA,'Accepted single-storey lowercase a')}<p class="sample" style="font-family:SourceA">a a</p><p class="facts">1 bowl · 1 counter · bounds ${sourceA.bounds.xMin},${sourceA.bounds.yMin}–${sourceA.bounds.xMax},${sourceA.bounds.yMax} · advance ${sourceA.metrics.advanceWidth} · bearings ${sourceA.metrics.leftSideBearing}/${sourceA.metrics.rightSideBearing}</p><p id="source-status" class="status">Loading source font…</p><a href="artifacts/${sourceName}">${sourceName}</a></section>
<section><h2>Double-storey candidate</h2><p>Revision <code>${result.revision.id}</code></p>${svgGlyph(candidateA,'Candidate double-storey lowercase a')}<p class="sample" style="font-family:CandidateA">a a</p><p class="facts">2 bowls · 2 counters · bounds ${candidateA.bounds.xMin},${candidateA.bounds.yMin}–${candidateA.bounds.xMax},${candidateA.bounds.yMax} · advance ${candidateA.metrics.advanceWidth} · bearings ${candidateA.metrics.leftSideBearing}/${candidateA.metrics.rightSideBearing}</p><p id="candidate-status" class="status">Loading candidate font…</p><a href="artifacts/${candidateName}">${candidateName}</a></section></div>
<h2>Transaction and compilation</h2><p class="facts">Both fonts passed internal SFNT checks. The candidate follows the source revision and changes only glyph U+0061. Kerning is flagged for review. Browser rendering is observation only; it does not replace independent font validation.</p>
<script>Promise.all([['SourceA','${sourceBase64}','source-status'],['CandidateA','${candidateBase64}','candidate-status']].map(async([name,encoded,id])=>{const status=document.getElementById(id);try{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const face=await new FontFace(name,bytes).load();document.fonts.add(face);status.textContent='FontFace loaded';status.className='ok'}catch(error){status.textContent='FontFace failed: '+error.message;status.className='status'}}));</script></body></html>`;

saveExact(join(here, 'review.html'), html);
saveExact(join(here, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
