// First-party vocabulary and capability map. NLP supplies words/tags; these
// entries and the resolver supply all typography-specific meaning.
export const DOMAIN_RULES = [
  { phrases: ['slab serif', 'slab-serif'], concept: 'classification.slab-serif', parameter: 'system', value: 'serif', secondary: { family: 'serif', construction: 'slab' }, capability: 'approximate', explanation: 'Selects serif recipes, but the current engine does not construct slab-specific terminal proportions.' },
  { phrases: ['sans serif', 'sans-serif', 'sans'], concept: 'classification.sans-serif', parameter: 'family', value: 'sans', capability: 'supported', explanation: 'Selects a sans construction family.' },
  { phrases: ['serif'], concept: 'classification.serif', parameter: 'family', value: 'serif', capability: 'supported', explanation: 'Selects serif recipes and actual serif contours.' },
  { phrases: ['geometric'], concept: 'construction.geometric', parameter: 'system', value: 'geometric', capability: 'supported', explanation: 'Uses geometric glyph recipes, bowl proportions, and shared stem rules.' },
  { phrases: ['humanist'], concept: 'construction.humanist', parameter: 'system', value: 'humanist', capability: 'supported', explanation: 'Uses the distinct humanist-inspired lowercase recipes, proportions, and open forms.' },
  { phrases: ['grotesque', 'neo grotesque', 'grotesk'], concept: 'construction.grotesque', parameter: 'system', value: 'geometric', capability: 'approximate', explanation: 'Uses the geometric sans system as a neutral grotesque approximation; no separate grotesque recipe exists.' },
  { phrases: ['circular forms', 'circular bowls', 'geometric bowls'], concept: 'bowl.shape.circular', capability: 'supported', explanation: 'Uses the system’s rounded bowl contours for O and o.' },

  { phrases: ['ultra condensed', 'extra condensed', 'strongly condensed', 'condensed', 'compressed', 'squeezed', 'narrow'], concept: 'proportion.width', parameter: 'width', value: 0.76, polarity: 'narrow', capability: 'supported', explanation: 'Reconstructs each glyph with narrower recipe coordinates and reduces advances.' },
  { phrases: ['extra wide', 'ultra wide', 'very wide', 'extended', 'expanded', 'wide', 'broad', 'generous proportions'], concept: 'proportion.width', parameter: 'width', value: 1.24, polarity: 'wide', capability: 'supported', explanation: 'Reconstructs glyph-specific proportions and increases advances.' },
  { phrases: ['normal width', 'standard width'], concept: 'proportion.width', parameter: 'width', value: 1, polarity: 'normal', capability: 'supported', explanation: 'Uses the default glyph proportions and advances.' },

  { phrases: ['hairline weight', 'thin weight', 'hairline'], concept: 'weight.static', parameter: 'weight', value: 300, polarity: 'light', capability: 'supported', explanation: 'Uses the lighter static stroke profile.' },
  { phrases: ['thin strokes', 'light', 'delicate'], concept: 'weight.static', parameter: 'weight', value: 300, polarity: 'light', capability: 'supported', explanation: 'Uses the lighter static stroke profile.' },
  { phrases: ['regular weight', 'book weight', 'regular'], concept: 'weight.static', parameter: 'weight', value: 400, polarity: 'regular', capability: 'supported', explanation: 'Uses the regular stroke profile.' },
  { phrases: ['medium'], concept: 'weight.static', parameter: 'weight', value: 500, polarity: 'medium', capability: 'supported', explanation: 'Uses the medium stroke profile.' },
  { phrases: ['semibold', 'semi bold'], concept: 'weight.static', parameter: 'weight', value: 600, polarity: 'bold', capability: 'supported', explanation: 'Uses a heavier static stroke profile.' },
  { phrases: ['extra bold', 'ultra bold', 'black weight', 'black', 'bold', 'heavy'], concept: 'weight.static', parameter: 'weight', value: 700, polarity: 'bold', capability: 'supported', explanation: 'Uses the bold stroke profile while recalculating counters and joins.' },

  { phrases: ['high contrast', 'strong contrast', 'contrasty', 'thin horizontal strokes', 'hairline crossbars'], concept: 'stroke.contrast', parameter: 'contrast', value: 0.68, polarity: 'high', capability: 'supported', explanation: 'Thins horizontal strokes relative to vertical stems in the glyph recipes.' },
  { phrases: ['low contrast', 'uniform strokes', 'uniform stroke', 'monoline', 'monolinear'], concept: 'stroke.contrast', parameter: 'contrast', value: 0.04, polarity: 'low', capability: 'supported', explanation: 'Keeps horizontal and vertical stroke profiles close.' },
  { phrases: ['thick vertical stems', 'heavy vertical stems'], concept: 'stroke.weight', parameter: 'stem', value: 138, capability: 'supported', explanation: 'Builds thicker vertical stem contours while preserving the selected contrast relationship.' },

  { phrases: ['open apertures', 'open aperture', 'open e'], concept: 'aperture.open', parameter: 'aperture', value: 0.27, polarity: 'open', capability: 'supported', explanation: 'Widens the actual mouth in the e contour and the open humanist forms.' },
  { phrases: ['generous counters', 'large counters', 'open counters', 'open counter'], concept: 'counter.open', parameter: 'counterScale', value: 1.18, polarity: 'open', capability: 'supported', explanation: 'Enlarges the inner counter contours in closed bowl glyphs.' },
  { phrases: ['wide apertures', 'wide aperture'], concept: 'aperture.open', parameter: 'aperture', value: 0.3, polarity: 'open', capability: 'supported', explanation: 'Widens the actual mouth in the e contour and the open humanist forms.' },
  { phrases: ['closed apertures', 'closed aperture', 'closed counters'], concept: 'aperture.open', parameter: 'aperture', value: 0.06, polarity: 'closed', capability: 'supported', explanation: 'Narrows the actual aperture geometry.' },
  { phrases: ['open forms', 'open shapes', 'shapes open'], concept: 'aperture.open', parameter: 'aperture', value: 0.25, polarity: 'open', capability: 'supported', explanation: 'Opens the e and humanist bowl forms in the current glyph set.' },
  { phrases: ['slightly rounded terminals', 'slightly rounded terminal'], concept: 'terminal.rounded-degree', parameter: 'terminalRadiusRatio', value: 0.18, secondary: { terminal: 'rounded' }, capability: 'supported', explanation: 'Uses a subtle terminal radius equal to 0.18 of the adjusted stem width.' },
  { phrases: ['strongly rounded terminals', 'strongly rounded terminal'], concept: 'terminal.rounded-degree', parameter: 'terminalRadiusRatio', value: 0.55, secondary: { terminal: 'rounded' }, capability: 'supported', explanation: 'Uses a pronounced terminal radius equal to 0.55 of the adjusted stem width.' },
  { phrases: ['rounded terminals', 'rounded terminal', 'soft terminals', 'soft terminal', 'rounded corners'], concept: 'terminal.rounded', parameter: 'terminal', value: 'rounded', polarity: 'rounded', capability: 'supported', explanation: 'Uses the standard terminal radius equal to 0.35 of the adjusted stem width.' },
  { phrases: ['rounded'], concept: 'terminal.rounded', parameter: 'terminal', value: 'rounded', polarity: 'rounded', capability: 'supported', explanation: 'Changes terminal contour end caps and corner construction.' },
  { phrases: ['square terminals', 'square terminal', 'angular terminals', 'angular terminal', 'sharp terminals'], concept: 'terminal.rounded', parameter: 'terminal', value: 'square', polarity: 'square', capability: 'supported', explanation: 'Uses square terminal geometry.' },
  { phrases: ['square construction'], concept: 'construction.geometric', parameter: 'system', value: 'geometric', capability: 'supported', explanation: 'Uses straight-sided geometric construction recipes.' },
  { phrases: ['bracketed serifs', 'bracketed serif'], concept: 'serif.bracketed', parameter: 'serifBracket', value: 0.22, secondary: { family: 'serif', system: 'serif' }, capability: 'supported', explanation: 'Builds serif contours with curved transitions into the stems.' },

  { phrases: ['large x height', 'high x height', 'tall x height', 'generous x height', 'large lowercase', 'tall lowercase'], concept: 'proportion.x-height', parameter: 'xHeight', value: 570, capability: 'supported', explanation: 'Raises the lowercase construction height.' },
  { phrases: ['small x height', 'low x height', 'short lowercase'], concept: 'proportion.x-height', parameter: 'xHeight', value: 470, capability: 'supported', explanation: 'Lowers the lowercase construction height.' },
  { phrases: ['tall capitals', 'tall cap height', 'high cap height'], concept: 'proportion.cap-height', parameter: 'capHeight', value: 735, capability: 'supported', explanation: 'Raises the cap construction height.' },
  { phrases: ['short capitals', 'low cap height'], concept: 'proportion.cap-height', parameter: 'capHeight', value: 660, capability: 'supported', explanation: 'Lowers the cap construction height.' },

  { phrases: ['generous spacing', 'open spacing', 'loose spacing', 'spacing loose', 'spacing open', 'spacing generous', 'ample letter spacing', 'generous letter spacing', 'loose letter spacing', 'relaxed tracking'], concept: 'spacing.generous', parameter: 'spacing', value: 1.22, polarity: 'open', capability: 'supported', explanation: 'Increases side bearings and advances.' },
  { phrases: ['tight spacing', 'compact spacing', 'tight tracking', 'compact tracking', 'letters tightly', 'tightly spaced', 'set tightly'], concept: 'spacing.generous', parameter: 'spacing', value: 0.82, polarity: 'tight', capability: 'supported', explanation: 'Reduces side bearings and advances.' },
  { phrases: ['monospaced', 'monospace', 'fixed pitch', 'typewriter'], concept: 'spacing.monospaced', parameter: 'monospaced', value: true, capability: 'supported', explanation: 'Centers glyphs in a common advance-width cell.' },

  { phrases: ['friendly', 'playful', 'approachable'], concept: 'character.friendly', parameter: 'terminal', value: 'rounded', origin: 'inferred', confidence: 0.72, capability: 'approximate', explanation: 'Rounds terminals as a limited visual proxy; tone itself is subjective.' },
  { phrases: ['almost square', 'near square', 'nearly square', 'squarish bowls'], concept: 'bowl.shape.square', capability: 'unsupported', explanation: 'This prototype does not yet construct squarish bowl contours.' },
  { phrases: ['modern', 'contemporary', 'clean', 'minimalist', 'editorial', 'elegant', 'futuristic', 'traditional', 'classical', 'old style', 'display', 'severe', 'sharply cut', 'ink pressed into metal', 'technical'], concept: 'character.unsupported', capability: 'unsupported', explanation: 'The prototype has no separate historical, display, or editorial drawing system.' },
  { phrases: ['diagonal stress', 'calligraphic stress', 'tapered terminals', 'wedge terminals', 'short descenders', 'long descenders', 'short ascenders', 'long ascenders', 'diagonal leg', 'curved tail', 'double storey'], concept: 'anatomy.unsupported', capability: 'unsupported', explanation: 'This prototype does not expose this glyph anatomy or stress control yet.' }
];

export const PARAMETERS = Object.freeze({
  family: 'sans', system: 'geometric', width: 1, weight: 400, stem: 94,
  contrast: 0.08, xHeight: 520, capHeight: 700, aperture: 0.15,
  counterScale: 1, terminal: 'square', terminalRadiusRatio: 0.35, spacing: 1, monospaced: false, serifBracket: 0.2
});

export const USAGE_CONTEXTS = ['screen', 'screens', 'header', 'headers', 'headline', 'headlines', 'poster', 'posters', 'body text', 'reading', 'interface', 'print'];

export function tokenizePhrase(text) {
  return String(text).toLowerCase().replace(/[‐‑‒–—]/g, '-').replace(/sans[- ]serif/g, 'sans serif').replace(/semi[- ]bold/g, 'semibold').replace(/extra[- ]bold/g, 'extra bold').replace(/ultra[- ]bold/g, 'ultra bold').replace(/ultra[- ]wide/g, 'ultra wide').replace(/extra[- ]wide/g, 'extra wide').replace(/ultra[- ]condensed/g, 'ultra condensed').replace(/extra[- ]condensed/g, 'extra condensed').replace(/double[- ]storey/g, 'double storey').match(/[\p{L}\p{N}]+/gu) || [];
}
