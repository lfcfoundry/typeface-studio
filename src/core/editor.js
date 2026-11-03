import { validateGlyph } from './generator.js';

export function editGlyphPoint(glyph, contourIndex, pointIndex, x, y) {
  const next=structuredClone(glyph);
  if(!next.contours?.[contourIndex]?.[pointIndex])throw new Error('That outline point no longer exists.');
  next.contours[contourIndex][pointIndex]={...next.contours[contourIndex][pointIndex],x:Math.round(x),y:Math.round(y)};
  next.manualEdited=true;next.editCount=(next.editCount||0)+1;next.lastEditedAt=new Date().toISOString();next.invalid=validateGlyph(next).length>0;return next;
}
export function editMetrics(glyph, {advanceWidth,leftSideBearing,rightSideBearing}) {
  const next=structuredClone(glyph);const xs=next.contours.flat().map(p=>p.x);let min=xs.length?Math.min(...xs):0,max=xs.length?Math.max(...xs):0;
  if(Number.isFinite(leftSideBearing)&&xs.length){const delta=Math.round(leftSideBearing)-min;next.contours=next.contours.map(c=>c.map(p=>({...p,x:p.x+delta})));min+=delta;max+=delta;next.leftSideBearing=min;}
  if(Number.isFinite(advanceWidth))next.advanceWidth=Math.max(0,Math.round(advanceWidth));
  else if(Number.isFinite(rightSideBearing))next.advanceWidth=Math.max(0,max+Math.round(rightSideBearing));
  next.rightSideBearing=next.advanceWidth-max;
  next.manualEdited=true;next.editCount=(next.editCount||0)+1;next.lastEditedAt=new Date().toISOString();next.invalid=validateGlyph(next).length>0;return next;
}
export function restoreGenerated(glyph) {
  if(!glyph?.generatedContours)throw new Error('This glyph has no generated version to restore.');
  return {...structuredClone(glyph),contours:structuredClone(glyph.generatedContours),advanceWidth:glyph.generatedAdvanceWidth??glyph.advanceWidth,leftSideBearing:glyph.generatedLeftSideBearing??glyph.leftSideBearing,rightSideBearing:glyph.generatedRightSideBearing??glyph.rightSideBearing,manualEdited:false,invalid:false};
}
