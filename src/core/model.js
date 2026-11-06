export const SCHEMA_VERSION = 1;
export const DEFAULT_PARAMS = Object.freeze({
  classification: 'Geometric sans', character: 'Geometric', width: 1, weight: 400,
  xHeight: 0.72, capHeight: 0.98, stem: 0.42, contrast: 0.12,
  roundness: 0.16, terminals: 'Square', spacing: 1,
  serifs: false, serifStyle: 'None', monospaced: false,
  openness: 0.3, squareness: 2, stress: 0
});

export function createProject({ family = 'Untitled Sans', designer = '', prompt = '', params = DEFAULT_PARAMS, seed = 73 } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `project-${Date.now().toString(36)}`,
    metadata: { family: family.trim() || 'Untitled Sans', designer, copyright: `Copyright © ${new Date().getFullYear()} ${designer || 'Typeface Studio user'}`, license: '', licenseURL: '', version: '1.000' },
    description: { original: prompt, interpreted: structuredClone(params) },
    design: { ...DEFAULT_PARAMS, ...params, seed },
    metrics: { unitsPerEm: 1000, ascender: 800, descender: -200, lineGap: 0 },
    glyphOrder: [], glyphs: {}, spacing: { pairs: { 'A|V': -70, 'A|W': -45, 'A|T': -48, 'T|o': -42, 'T|a': -42, 'V|a': -42, 'W|a': -35, 'Y|o': -48 } },
    generation: { revision: 0, seed, history: [], createdAt: new Date().toISOString() },
    provenance: { generatedBy: 'LFCFoundry Typeface Studio procedural grid sans', license: 'Unspecified; user controls rights and may add a license notice.', referenceSources: [] }
  };
}

export function validateProject(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Project must be a JSON object.'];
  if (value.schemaVersion !== SCHEMA_VERSION) errors.push(`Unsupported project version ${String(value.schemaVersion)}. This application supports version ${SCHEMA_VERSION}.`);
  if (!value.metadata || typeof value.metadata.family !== 'string' || typeof value.metadata.designer !== 'string' || typeof value.metadata.copyright !== 'string' || typeof value.metadata.license !== 'string' || typeof value.metadata.licenseURL !== 'string' || typeof value.metadata.version !== 'string' || !value.design || !value.description || typeof value.description.original !== 'string' || !value.glyphs || typeof value.glyphs !== 'object' || Array.isArray(value.glyphs)) errors.push('Project metadata, design settings, description, or glyph collection is missing.');
  if (!Array.isArray(value.glyphOrder)) errors.push('Glyph order must be an array.');
  if (!value.metrics || value.metrics.unitsPerEm !== 1000) errors.push('This project must use 1000 units per em.');
  if (!Number.isInteger(value.generation?.seed)) errors.push('Generation seed must be an integer.');
  if (!value.spacing || !value.spacing.pairs || typeof value.spacing.pairs !== 'object' || Array.isArray(value.spacing.pairs)) errors.push('Spacing pairs must be an object.');
  for(const key of ['width','weight','xHeight','capHeight','stem','contrast','roundness','spacing'])if(!Number.isFinite(value.design?.[key]))errors.push(`Design setting ${key} must be a finite number.`);
  if (Array.isArray(value.glyphOrder)) {
    const seen = new Set(), unicodes = new Set();
    for (const id of value.glyphOrder) {
      const glyph = value.glyphs?.[id];
      if (typeof id !== 'string' || seen.has(id) || !glyph || glyph.id !== id) { errors.push(`Invalid or duplicate glyph identity: ${String(id)}.`); break; }
      seen.add(id);
      if (!Number.isInteger(glyph.advanceWidth) || glyph.advanceWidth < 0 || !Array.isArray(glyph.outlines)) { errors.push(`Glyph ${id} has invalid metrics or outlines.`); break; }
      if (glyph.unicode !== null && glyph.unicode !== undefined && (!Number.isInteger(glyph.unicode) || glyph.unicode < 0 || glyph.unicode > 0x10ffff)) { errors.push(`Glyph ${id} has an invalid Unicode mapping.`); break; }
      if(glyph.unicode!==null&&glyph.unicode!==undefined){if(unicodes.has(glyph.unicode)){errors.push(`Unicode U+${glyph.unicode.toString(16).toUpperCase()} is mapped more than once.`);break;}unicodes.add(glyph.unicode);}
      for (const contour of glyph.outlines) {
        if (!Array.isArray(contour) || contour.length < 3 || contour.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || typeof p.on !== 'boolean')) { errors.push(`Glyph ${id} contains an invalid contour.`); break; }
      }
      if (errors.length) break;
    }
    if(value.glyphOrder.length&&value.glyphOrder[0]!=='notdef')errors.push('The project glyph order must begin with .notdef.');
  }
  return errors;
}

export function serializeProject(project) {
  const errors = validateProject(project);
  if (errors.length) throw new Error(errors.join('\n'));
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid project JSON.'); }
  const errors = validateProject(data);
  if (errors.length) throw new Error(errors.join('\n'));
  return data;
}
