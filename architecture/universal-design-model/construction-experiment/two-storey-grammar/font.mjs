import {compileTypeface} from '../../../../prototype/src/font.js';
import {auditSfnt} from '../../../../prototype/src/sfnt-audit.js';
import {design,derive} from './grammar.mjs';
export function compile(glyphs,family='LFCFoundry Two Storey Grammar') {
 const result=compileTypeface({metadata:{family,designer:'LFCFoundry',version:'0.100'},metrics:{unitsPerEm:1000,ascender:800,descender:-200},design:{weight:400,xHeight:500,capHeight:700},glyphOrder:glyphs.map(g=>g.id),glyphs:Object.fromEntries(glyphs.map(g=>[g.id,g]))});
 const audit=auditSfnt(result.bytes);if(!audit.valid) throw Error(JSON.stringify(audit));return {...result,audit};
}
export function fonts(candidate=null) {
 const single=derive(design(1)), double=candidate??derive(design(2));
 return {inventory:compile([single,double]),single:compile([single],'LFCFoundry Grammar Single Review'),double:compile([{...double,name:'a',unicode:97}],'LFCFoundry Grammar Double Review')};
}
