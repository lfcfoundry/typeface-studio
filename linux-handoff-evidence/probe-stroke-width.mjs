// Diagnostic geometry/compilation probe only; not a maintained weight transaction.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,deriveGuarded,compile} from '../architecture/universal-design-model/family-xheight-propagation/scenario.mjs';
import {canonicalizeInitialGeometry} from '../architecture/universal-design-model/integration-experiment/engine.mjs';
const out=process.argv[2]||'linux-handoff-evidence/stroke-width-artifacts';mkdirSync(out); // refuse replacement
const source=fixture(),report={scope:'in-memory diagnostic derivation; no weight transaction or accepted revision',xHeight:520,fonts:[]};
for(const width of [90,100,95]){
 const model=structuredClone(source.model);model.state.characteristics.find(d=>d.id==='decision:x-height').value.value=520;model.state.characteristics.find(d=>d.id==='decision:shared-stem-width').value.value=width;
 const rows=[];let failed=false;
 for(const glyph of model.glyphRegistry.glyphs){try{const {geometry}=deriveGuarded(glyph,model);const canonical=canonicalizeInitialGeometry({glyphOrder:[glyph.id],glyphs:{[glyph.id]:geometry}}).glyphs[glyph.id];model.derived.geometry.glyphs[glyph.id]=canonical;rows.push({glyph:glyph.name,bounds:canonical.bounds,metrics:canonical.metrics});}catch(e){failed=true;rows.push({glyph:glyph.name,error:e.message});}}
 if(failed){report.fonts.push({width,status:'unsupported-dimensions',glyphs:rows});continue;}
 const font=compile(model),filename=`primary-width-${width}.ttf`;if(!font.audit.valid)throw Error('Internal audit failed');writeFileSync(`${out}/${filename}`,font.bytes,{flag:'wx'});const sha256=createHash('sha256').update(font.bytes).digest('hex');
 if(width===90&&sha256!=='43310f5c97481f0c802d02f16e56ac29f5dba67c7aea3c0f9a4a5b3f9d0fdd8f')throw Error('Width-90 probe does not match saved x-height candidate');
 report.fonts.push({width,status:'compiled-diagnostic',filename,sha256,bytes:font.bytes.length,audit:font.audit,glyphs:rows});
}
writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report.fonts.map(f=>({width:f.width,status:f.status,sha256:f.sha256})),null,2));
