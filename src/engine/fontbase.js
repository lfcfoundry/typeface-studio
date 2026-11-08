// Hybrid letter base (round 24, owner chose "Hybrid: real fonts by default", 2026.11.07 8:11 PM Eastern).
// pickBase(settings) turns the reader's pen settings into a real open-license variable font plus axis values.
// Plain ES module, no Node imports. Fonts: ./fonts/*.woff2 (Latin, Latin-1, Latin Extended-A; unused axes pinned).
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const BASES = {
  RobotoFlex: { file: 'fonts/RobotoFlex.woff2', name: 'Roboto Flex', license: 'SIL OFL 1.1', author: 'The Roboto Flex Project Authors', axes: { wght: [100, 1000], wdth: [25, 151], slnt: [-10, 0], YOPQ: [25, 135], YTLC: [416, 570] } },
  Fraunces: { file: 'fonts/Fraunces.woff2', name: 'Fraunces', license: 'SIL OFL 1.1', author: 'The Fraunces Project Authors', axes: { wght: [100, 900], opsz: [9, 144], SOFT: [0, 100] } },
  RobotoSerif: { file: 'fonts/RobotoSerif.woff2', name: 'Roboto Serif', license: 'SIL OFL 1.1', author: 'The Roboto Serif Project Authors', axes: { wght: [100, 900], wdth: [50, 150] } },
  RobotoSlab: { file: 'fonts/RobotoSlab.woff2', name: 'Roboto Slab', license: 'Apache 2.0', author: 'The Roboto Slab Project Authors', axes: { wght: [100, 900] } },
  Nunito: { file: 'fonts/Nunito.woff2', name: 'Nunito', license: 'SIL OFL 1.1', author: 'The Nunito Project Authors', axes: { wght: [200, 1000] } },
  RobotoMono: { file: 'fonts/RobotoMono.woff2', name: 'Roboto Mono', license: 'SIL OFL 1.1', author: 'The Roboto Mono Project Authors', axes: { wght: [100, 700] } },
};
// pen stem 90 = regular (wght 400); 151 = bold (stem x1.68 = wght 700, measured on Google Fonts variable fonts in round 9)
export const wghtFromStem = stem => Math.round(400 + (stem / 90 - 1) / 0.68 * 300);
export function pickBase(s) {
  const wght = wghtFromStem(s.stem ?? 90), wdth = clamp(Math.round(100 * (s.width ?? 1)), 50, 150);
  const slant = s.slant || 0, italic = !!s.italic || slant > 0, ls = +(((s.spacing ?? 1) - 1) * 0.12).toFixed(3);
  let id, variation;
  if (s.mono) { id = 'RobotoMono'; variation = { wght: clamp(wght, 100, 700) }; }
  else if (s.style === 'slab') { id = 'RobotoSlab'; variation = { wght: clamp(wght, 100, 900) }; }
  else if (s.style === 'serif' || s.slab) {
    if (s.caps === 'round' || (s.contrast ?? 0.05) >= 0.28) { id = 'Fraunces'; variation = { wght: clamp(wght, 100, 900), opsz: 72, SOFT: s.caps === 'round' ? 100 : 0 }; }
    else { id = 'RobotoSerif'; variation = { wght: clamp(wght, 100, 900), wdth }; } }
  else if (s.caps === 'round') { id = 'Nunito'; variation = { wght: clamp(wght, 200, 1000) }; }
  else { id = 'RobotoFlex';
    variation = { wght: clamp(wght, 100, 1000), wdth: clamp(wdth, 25, 151), YOPQ: clamp(Math.round(79 * (1 - ((s.contrast ?? 0.05) - 0.05) * 1.8)), 25, 135), YTLC: clamp(Math.round(514 + ((s.xHeight ?? 520) - 520)), 416, 570), slnt: slant ? -clamp(slant, 0, 10) : 0 }; }
  const b = BASES[id]; // italic for bases with no slant axis: oblique skew in CSS
  const noSlantAxis = !b.axes.slnt;
  const css = { fontFamily: `'${b.name}'`, fontVariationSettings: Object.entries(variation).map(([k, v]) => `'${k}' ${v}`).join(', '), letterSpacing: `${ls}em`, fontStyle: italic && noSlantAxis ? `oblique ${clamp(slant || 10, 6, 14)}deg` : 'normal' };
  return { id, ...b, variation, css, italic, attribution: `Based on ${b.name} (${b.license}), ${b.author}` };
}
