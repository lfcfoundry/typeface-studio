import { interpretBrief } from './brief.js';
import { generateContourFamily } from './recipes.js';
import { compileTypeface } from './font.js';
import { validateGlyph } from './contours.js';

const systems = ['geometric', 'humanist', 'serif'];
const defaultBrief = 'A friendly humanist sans-serif with open apertures, slightly rounded terminals, and generous spacing.';
const requestedSystem = new URLSearchParams(location.search).get('system');
const state = { brief: defaultBrief, spec: null, families: {}, compiled: {}, selectedSystem: systems.includes(requestedSystem) ? requestedSystem : 'geometric', initialSystem: systems.includes(requestedSystem) ? requestedSystem : null, selectedGlyph: 'A' };
const root = document.querySelector('#prototype');
const esc = value => String(value).replace(/[&<>"']/g, x => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[x]);

function shell() {
  root.innerHTML = `<main class="wrap">
    <header class="top"><div><div class="eyebrow">LFCFoundry · isolated engineering prototype</div><h1>From brief to contours</h1><p>Three recipe systems, one explicit design specification, real TrueType output.</p></div><span class="badge">Production app unchanged</span></header>
    <section class="card brief-card"><label for="familyName">Prototype family name</label><input id="familyName" value="Studio Prototype" maxlength="48"><label for="brief" style="margin-top:12px">Describe a typeface</label><textarea id="brief" rows="3">${esc(state.brief)}</textarea><div class="controls"><label>Compare construction <select id="system"><option value="geometric">Geometric sans</option><option value="humanist">Humanist-inspired sans</option><option value="serif">Serif</option></select></label><button class="primary" id="generate">Interpret and generate</button><span class="status" id="status">Ready</span></div></section>
    <section class="columns"><article class="card"><div class="card-title"><div><div class="eyebrow">1 · Interpretation</div><h2>What the brief means</h2></div></div><div id="summary"></div><details><summary>Structured design specification</summary><pre id="spec"></pre></details></article><article class="card"><div class="eyebrow">2 · Construction comparison</div><h2>Same brief, three systems</h2><p class="muted">Select a letter to inspect its recipe contours. The systems use different lowercase anatomy and construction rules.</p><div class="system-tabs" id="tabs"></div><div class="glyph-grid" id="glyphs"></div><div class="inspect" id="inspect"></div></article></section>
    <section class="card"><div class="columns"><div><div class="eyebrow">3 · Compiled font preview</div><h2>Actual generated TTF</h2><label for="sample">Specimen text</label><textarea id="sample" rows="2">Hamburgefontsiv · AVATAR 012345</textarea></div><div class="actions"><button id="compile" class="primary">Compile all three systems · Regular + Bold</button><span class="status" id="fontStatus">FontFace preview not loaded yet</span></div></div><div id="fontCards" class="font-cards"></div></section>
    <section class="card"><div class="eyebrow">4 · Geometry checks</div><h2>Structural evidence</h2><div id="checks" class="check-grid"></div></section>
    <footer>Prototype only. Quadratic outlines are compiled with the repository’s existing fontsketch 0.1.0. Browser rendering requires opening this HTML in a browser with FontFace support.</footer>
  </main>`;
  document.querySelector('#brief').addEventListener('input', e => state.brief = e.target.value);
  document.querySelector('#system').addEventListener('change', e => { state.selectedSystem = e.target.value; renderFamilies(); });
  document.querySelector('#generate').addEventListener('click', generate);
  document.querySelector('#compile').addEventListener('click', compileAll);
  document.querySelector('#sample').addEventListener('input', renderFontCards);
  document.querySelector('#tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-system]'); if (!tab) return;
    state.selectedSystem = tab.dataset.system; document.querySelector('#system').value = state.selectedSystem; renderFamilies();
  });
  document.querySelector('#glyphs').addEventListener('click', e => {
    const item = e.target.closest('[data-glyph]'); if (!item) return;
    state.selectedGlyph = item.dataset.glyph; renderFamilies();
  });
}

function generate() {
  const status = document.querySelector('#status'); status.textContent = 'Interpreting brief and building recipe contours…';
  try {
    state.brief = document.querySelector('#brief').value;
    const family = document.querySelector('#familyName')?.value || 'Studio Prototype';
    state.spec = interpretBrief(state.brief);
    state.spec.source.family = family;
    state.selectedSystem = state.initialSystem || state.spec.resolvedParameters.system;
    state.initialSystem = null;
    document.querySelector('#system').value = state.selectedSystem;
    state.families = Object.fromEntries(systems.map(system => [system, generateContourFamily(state.spec, { system })]));
    state.compiled = {};
    renderInterpretation(); renderFamilies(); renderChecks(); renderFontCards();
    status.classList.remove('error'); status.textContent = `Generated 10 recipe glyphs in 3 construction systems · spec v${state.spec.version}`;
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
}

function renderInterpretation() {
  const s = state.spec;
  const rows = s.instructions.map(item => `<li><b>${esc(item.sourceSpan.text)}</b> → ${esc(item.concept)} <span class="cap ${item.capability}">${item.capability}</span><small>${esc(item.explanation)}</small></li>`).join('');
  const contexts = s.usageContext.map(x => `<span class="pill">Usage context: ${esc(x.value)}</span>`).join('');
  const defaults = s.defaults.map(x => `${x.parameter} (${x.value})`).join(', ');
  const conflicts = s.conflicts.length ? `<div class="warning"><b>Conflicts:</b> ${s.conflicts.map(x => `${esc(x.parameter)}: ${esc(x.sourceTexts.join(' vs '))}; selected ${esc(x.selected)}`).join('; ')}</div>` : '';
  const unsupported = s.unsupported.length ? `<div class="warning"><b>Not generated:</b> ${s.unsupported.map(x => esc(x.concept)).join(', ')}</div>` : '';
  const approx = s.approximations.length ? `<div class="notice"><b>Approximate:</b> ${s.approximations.map(x => esc(x.concept)).join(', ')}</div>` : '';
  document.querySelector('#summary').innerHTML = `${contexts}<ul class="intent">${rows}</ul>${conflicts}${unsupported}${approx}<p class="muted"><b>Defaults:</b> ${esc(defaults || 'None')}</p><p class="muted"><b>Resolved system:</b> ${esc(s.resolvedParameters.system)} · width ${s.resolvedParameters.width} · contrast ${s.resolvedParameters.contrast} · spacing ${s.resolvedParameters.spacing}</p>`;
  document.querySelector('#spec').textContent = JSON.stringify(s, null, 2);
}

function pathData(contour) {
  let d = `M ${contour.start.x} ${contour.start.y}`;
  for (const seg of contour.segments) {
    if (seg.type === 'line') d += ` L ${seg.to.x} ${seg.to.y}`;
    else d += ` Q ${seg.control.x} ${seg.control.y} ${seg.to.x} ${seg.to.y}`;
  }
  return d + ' Z';
}

function glyphSvg(glyph, large = false) {
  const b = glyph.bounds, pad = large ? 36 : 16, width = Math.max(1, b.xMax - b.xMin), height = Math.max(1, b.yMax - b.yMin);
  const paths = glyph.contours.map(c => `<path d="${pathData(c)}" fill-rule="nonzero" data-role="${esc(c.role)}"/>`).join('');
  return `<svg viewBox="${b.xMin - pad} ${-b.yMax - pad} ${width + 2 * pad} ${height + 2 * pad}" role="img" aria-label="${esc(glyph.character)} contour"><g transform="scale(1,-1)" fill="currentColor">${paths}</g></svg>`;
}

function renderFamilies() {
  if (!state.families[state.selectedSystem]) return;
  document.querySelector('#tabs').innerHTML = systems.map(system => `<button data-system="${system}" class="${state.selectedSystem === system ? 'selected' : ''}">${system === 'humanist' ? 'Humanist-inspired' : system === 'serif' ? 'Serif' : 'Geometric'}</button>`).join('');
  const family = state.families[state.selectedSystem];
  document.querySelector('#glyphs').innerHTML = family.glyphOrder.map(id => {
    const g = family.glyphs[id], errors = validateGlyph({ ...g, advanceWidth: g.metrics.advanceWidth, rightSideBearing: g.metrics.rightSideBearing });
    return `<button class="glyph-tile ${g.character === state.selectedGlyph ? 'selected' : ''} ${errors.length ? 'invalid' : ''}" data-glyph="${esc(g.character)}"><span>${glyphSvg(g)}</span><b>${esc(g.character)}</b><small>${esc(g.recipeId)}</small></button>`;
  }).join('');
  const selected = Object.values(family.glyphs).find(g => g.character === state.selectedGlyph) || family.glyphs[family.glyphOrder[0]];
  document.querySelector('#inspect').innerHTML = `<div class="large-glyph">${glyphSvg(selected, true)}</div><div><h3>${esc(selected.character)} · ${esc(selected.recipeId)}</h3><p>Advance ${selected.metrics.advanceWidth} · LSB ${selected.metrics.leftSideBearing} · RSB ${selected.metrics.rightSideBearing}</p><p>${selected.contours.length} contours · ${selected.contours.reduce((n,c)=>n+c.points.filter(p=>!p.on).length,0)} off-curve controls · ${selected.components.length} recipe components</p><p class="muted">Bounds ${selected.bounds.xMin}, ${selected.bounds.yMin} → ${selected.bounds.xMax}, ${selected.bounds.yMax}</p></div>`;
}

function renderChecks() {
  const cards = [];
  for (const system of systems) {
    const family = state.families[system];
    const invalid = family.glyphOrder.flatMap(id => validateGlyph({ ...family.glyphs[id], advanceWidth: family.glyphs[id].metrics.advanceWidth, rightSideBearing: family.glyphs[id].metrics.rightSideBearing }));
    const e = family.glyphs.u0065, o = family.glyphs.u004f;
    cards.push(`<article><h3>${system}</h3><p>${invalid.length ? `${invalid.length} geometry errors` : '10/10 glyphs pass contour, winding, and counter containment checks'}</p><p>e aperture contour: ${e.contours.some(c => c.id.includes('aperture')) ? 'present' : 'missing'} · O counter: ${o.contours.filter(c => c.role === 'counter').length ? 'present' : 'missing'}</p></article>`);
  }
  document.querySelector('#checks').innerHTML = cards.join('');
}

async function compileAll() {
  const status = document.querySelector('#fontStatus');
  if (!Object.keys(state.families).length) { status.textContent = 'Generate contours first.'; return; }
  status.textContent = 'Compiling six TrueType fonts and loading them with FontFace…'; status.classList.remove('error');
  try {
    for (const system of systems) for (const style of ['Regular', 'Bold']) {
      const family = style === 'Regular' ? state.families[system] : generateContourFamily(state.spec, { system, style });
      const result = compileTypeface(family, style);
      state.compiled[`${system}-${style}`] = result;
      const name = `TypefacePrototype-${system}-${style}`;
      const buffer = result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength);
      const face = new FontFace(name, buffer, { weight: style === 'Bold' ? '700' : String(result.weightClass) });
      await face.load(); document.fonts.add(face);
    }
    status.textContent = 'All six TTFs compiled, checksums verified, parsed, and loaded with FontFace.';
    renderFontCards();
  } catch (error) { status.textContent = `Font compile/FontFace failed: ${error.message}`; status.classList.add('error'); }
}

function renderFontCards() {
  const sample = document.querySelector('#sample')?.value || 'Hamburgefontsiv · AVATAR 012345';
  document.querySelector('#fontCards').innerHTML = systems.map(system => {
    const regular = state.compiled[`${system}-Regular`], bold = state.compiled[`${system}-Bold`];
    if (!regular || !bold) return `<article class="font-card"><h3>${system}</h3><p class="muted">Compile the actual TTFs to preview this system.</p></article>`;
    const rName = `TypefacePrototype-${system}-Regular`, bName = `TypefacePrototype-${system}-Bold`;
    const r = regular.parsed, b = bold.parsed;
    const gR = r.glyphs.O, gB = b.glyphs.O;
    return `<article class="font-card"><h3>${system}</h3><div class="font-sample" style="font-family:'${rName}'">${esc(sample)}</div><div class="font-sample bold" style="font-family:'${bName}'">${esc(sample)}</div><p>Regular: ${Object.keys(r.glyphs).length} glyphs · O ${gR?.advanceWidth || '?'} units · Bold O ${gB?.advanceWidth || '?'} units</p><div class="download-row"><button data-download="${system}-Regular">Download Regular TTF</button><button data-download="${system}-Bold">Download Bold TTF</button></div></article>`;
  }).join('');
}

document.addEventListener('click', e => {
  const button = e.target.closest('[data-download]'); if (!button) return;
  const key = button.dataset.download, result = state.compiled[key]; if (!result) return;
  const blob = new Blob([result.bytes], { type: 'font/ttf' }), url = URL.createObjectURL(blob);
  const family = String(state.spec?.source?.family || 'Typeface-Studio').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a'); a.href = url; a.download = `${family}-${key}.ttf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

shell();
generate();
