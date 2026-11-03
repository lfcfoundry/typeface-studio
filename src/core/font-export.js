import { addGlyph, createFont, exportFont, glyphNameFor, validateFont, verifyChecksums } from 'fontsketch/core';
import { regenerateStyle, validateGlyph } from './generator.js';

export function buildFont(project, style='Regular') {
  if(!project?.glyphOrder?.length)throw new Error('Generate the glyph set before exporting a font.');
  const bold=style==='Bold';const source=bold?regenerateStyle(project,'Bold'):project;
  const weightClass=bold?700:400;
  const family=project.metadata.family.trim();if(!family)throw new Error('Enter a family name before exporting.');
  const meta={family,style,version:project.metadata.version||'1.000',designer:project.metadata.designer||'',copyright:project.metadata.copyright||'',license:project.metadata.license||'',licenseURL:project.metadata.licenseURL||'',unitsPerEm:1000,ascender:800,descender:-200,xHeight:Math.round(700*source.design.xHeight),capHeight:Math.round(700*source.design.capHeight),weightClass,vendorID:'LFCF'};
  const font=createFont(meta);
  const ordered=project.glyphOrder.map(id=>source.glyphs[id]).filter(Boolean);
  for(const glyph of ordered){
    const errors=validateGlyph(glyph);if(errors.length)throw new Error(`${glyph.character||glyph.name}: ${errors.join(' ')}`);
    if(!glyph.name)continue;
    const name=glyph.unicode===null||glyph.unicode===undefined?glyph.name:glyphNameFor(glyph.unicode);
    addGlyph(font,{name,unicodes:glyph.unicode===null||glyph.unicode===undefined?[]:[glyph.unicode],advanceWidth:glyph.advanceWidth,leftSideBearing:glyph.leftSideBearing||0,contours:glyph.contours.map(points=>({closed:true,points:points.map(p=>({x:Math.round(p.x),y:Math.round(p.y),on:p.on!==false}))}))});
  }
  font.kerning.pairs={...(project.spacing?.pairs||{})};
  const problems=validateFont(font);if(Array.isArray(problems)&&problems.length)throw new Error(`Font model validation failed: ${problems.map(p=>typeof p==='string'?p:p.message||JSON.stringify(p)).join('; ')}`);
  const bytes=exportFont(font,{format:'ttf',hinting:'none',legacyKern:true,timestamp:new Date('2024-01-01T00:00:00Z'),onWarning:()=>{}});
  const checksum=verifyChecksums(bytes);if(checksum.length)throw new Error(`The generated TTF failed its SFNT checksum check: ${checksum.join('; ')}`);
  return {font,bytes,style,weightClass,glyphCount:Object.keys(font.glyphs).length,checksumsVerified:true,checksumProblems:checksum};
}

export async function independentSelfParse(bytes) {
  const { parseFont }=await import('fontsketch/core');
  const parsed=parseFont(bytes);
  return {family:parsed.meta.family,style:parsed.meta.style,glyphCount:Object.keys(parsed.glyphs).length,mappings:Object.values(parsed.glyphs).flatMap(g=>g.unicodes||[]).length};
}

export function ttfFilename(family,style){const safe=String(family).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'Typeface';return `${safe}-${style}.ttf`;}
