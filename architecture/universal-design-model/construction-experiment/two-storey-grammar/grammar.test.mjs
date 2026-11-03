import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {design,derive,resolve,resizeBowl,continuity,sampleContour} from './grammar.mjs';
import {fonts} from './font.mjs';
import {buildLowercaseACandidate} from '../a-experiment.mjs';
const xy=g=>g.contours.map(c=>c.points.map(({x,y,on})=>({x,y,on})));
const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
test('one grammar resolves distinct one- and two-bowl topology with individual enclosure relationships',()=>{
 for(const n of [1,2]) {const m=design(n),r=resolve(m);assert.equal(r.bowls.length,n);assert.equal(new Set(r.bowls.map(b=>b.counterId)).size,n);assert.equal(r.joins.length,n-1);assert.equal(derive(m).contours.length,n+1);}
});
test('topology rejects missing, contradictory, unsupported, orphan and overlapping structures before derivation',()=>{
 const mutations=[m=>m.construction.relations.splice(2,1),m=>m.construction.relations.push({...m.construction.relations.find(r=>r.type==='contained-by'),target:'bowl:1'}),m=>m.construction.relations.find(r=>r.type==='attaches').side='right',m=>m.construction.nodes.push({id:'orphan',component:'counter'}),m=>m.construction.nodes.find(n=>n.id==='bowl:1').parameters.bottom=.5,m=>m.construction.relations.find(r=>r.type==='connects').continuity='C1',m=>m.construction.relations.find(r=>r.type==='connects').upper='absent'];
 for(const mutate of mutations){const m=design();mutate(m);assert.throws(()=>resolve(m));}
});
test('single-storey grammar preserves existing a coordinates and metrics without calling its constructor',()=>{
 const old=buildLowercaseACandidate().model.derived.geometry.glyphs['glyph:u0061'];const actual=derive(design(1));assert.deepEqual(xy(actual),xy(old));assert.deepEqual(actual.metrics,old.metrics);
});
test('semantic upper-stem chamfer preserves the flat default and derives role-relative geometry',()=>{
 const flatModel=design(),flat=derive(flatModel),candidate=structuredClone(flatModel),terminal=candidate.construction.nodes.find(n=>n.id==='top');
 const originalNodes=structuredClone(candidate.construction.nodes),originalRelations=structuredClone(candidate.construction.relations);
 terminal.parameters={profile:'chamfered',orientation:'outer-right',cutRatio:.2};
 const chamfer=derive(candidate),segments=chamfer.contours[0].segments;
 assert.deepEqual(derive(flatModel),flat,'default flat output remains identical');
 assert.equal(terminal.id,'top');assert.equal(terminal.role,'upper-stem-terminal');
 assert.deepEqual(candidate.construction.relations,originalRelations);
 assert.deepEqual(candidate.construction.nodes.filter(n=>n.id!=='top'),originalNodes.filter(n=>n.id!=='top'));
 assert.deepEqual(resolve(candidate).terminals.top,{node:terminal,profile:'chamfered',orientation:'outer-right',cut:18,cutRatio:.2});
 assert.deepEqual([segments[0].from,segments[0].to,segments[1].from,segments[1].to].map(p=>[p.x,p.y]),[[505,500],[577,500],[577,500],[595,482]]);
 assert.equal(segments[1].id,'terminal.top.bevel-edge');assert.equal(segments[2].id,'spine.outer');
 assert.notDeepEqual(xy(chamfer),xy(flat));assert.deepEqual(chamfer,derive(candidate),'identical semantic input derives deterministic geometry');
 assert.deepEqual(chamfer.bounds,flat.bounds);assert.deepEqual(chamfer.bounds,{xMin:55,yMin:0,xMax:595,yMax:500});
 assert.deepEqual(chamfer.metrics,{advanceWidth:650,leftSideBearing:55,rightSideBearing:55});
 assert.equal(chamfer.metrics.advanceWidth,flat.metrics.advanceWidth);
 const outer=sampleContour(chamfer.contours[0],96);for(const c of chamfer.contours.slice(1))for(const p of sampleContour(c,96))assert.ok(inside(p,outer));
});
test('legacy flat terminal nodes still derive the established default outline',()=>{
 const current=design(),legacy=structuredClone(current);for(const id of ['top','bottom']){const terminal=legacy.construction.nodes.find(n=>n.id===id);delete terminal.role;delete terminal.parameters;}
 assert.deepEqual(derive(legacy),derive(current));
});
test('terminal-profile resolver rejects unsupported profiles, parameters, roles, and dimensions',()=>{
 const invalid=[
  m=>{m.construction.nodes.find(n=>n.id==='top').parameters={profile:'rounded'};},
  m=>{m.construction.nodes.find(n=>n.id==='top').parameters={profile:'chamfered',orientation:'outer-left',cutRatio:.2};},
  m=>{m.construction.nodes.find(n=>n.id==='top').parameters={profile:'chamfered',orientation:'outer-right',cutRatio:.001};},
  m=>{m.construction.nodes.find(n=>n.id==='top').parameters={profile:'flat',cutRatio:.2};},
  m=>{m.construction.nodes.find(n=>n.id==='bottom').parameters={profile:'chamfered',orientation:'outer-right',cutRatio:.2};},
  m=>{m.construction.nodes.find(n=>n.id==='top').role='lower-stem-terminal';},
 ];
 for(const mutate of invalid){const m=design();mutate(m);assert.throws(()=>derive(m));}
});
test('closed deterministic geometry has disjoint counters fully inside the outer sampled boundary',()=>{
 const m=design(),g=derive(m);assert.deepEqual(g,derive(m));const outer=sampleContour(g.contours[0],64);
 for(const c of g.contours.slice(1)){assert.ok(c.closed);for(const p of sampleContour(c,64))assert.ok(inside(p,outer));}
 const r=resolve(m);assert.ok(r.bowls[0].y1<r.bowls[1].y0);assert.deepEqual(g.bounds,{xMin:55,yMin:0,xMax:595,yMax:500});assert.deepEqual(g.metrics,{advanceWidth:650,leftSideBearing:55,rightSideBearing:55});
});
test('connector boundary joins are G0/G1 with accurate C1 classification and intentional terminal corners',()=>{
 const rows=continuity(derive(design()).contours[0]);assert.ok(rows.every(j=>j.G0));
 const joins=rows.filter(j=>j.from.includes('join:')||j.to.includes('join:'));assert.equal(joins.length,3);assert.ok(joins.every(j=>j.G1));assert.equal(joins.filter(j=>j.C1).length,1);assert.equal(rows.filter(j=>!j.G1).length,2);
});
test('name and encoding do not select geometry; shared dimensions regenerate both topologies',()=>{
 for(const n of [1,2]){const m=design(n),old=derive(m);m.id='unusual:glyph';m.name='not-a';m.characterIdentity=[0x2600];m.encoding=[];assert.deepEqual(xy(derive(m)),xy(old));m.decisions.stem=100;assert.notDeepEqual(xy(derive(m)),xy(old));}
});
test('immutable semantic width candidate preserves lower bowl and counter, with invalid candidate rollback',()=>{
 const accepted=design(),snapshot=structuredClone(accepted),base=derive(accepted);const c=resizeBowl(accepted,'bowl:1',.62);assert.deepEqual(accepted,snapshot);assert.equal(c.model.revision.status,'candidate');assert.equal(c.model.revision.parent,accepted.revision.id);assert.notDeepEqual(xy(c.geometry),xy(base));assert.deepEqual(c.geometry.contours[1],base.contours[1]);assert.deepEqual(c.geometry.metrics,base.metrics);assert.deepEqual(c.diff.preservedCounterIds,['counter:0']);assert.throws(()=>resizeBowl(accepted,'bowl:1',10));assert.deepEqual(accepted,snapshot);
});
test('TTF retains unencoded alternate and review fonts use identical compiled outlines with only U+0061 mapping',()=>{
 const f=fonts(),again=fonts();assert.deepEqual(f.inventory.bytes,again.inventory.bytes);assert.equal(f.inventory.audit.valid,true);
 assert.deepEqual(f.inventory.parsed.glyphs.a.unicodes,[97]);assert.deepEqual(f.inventory.parsed.glyphs['a.alt'].unicodes,[]);assert.equal(f.inventory.parsed.glyphs['a.alt'].contours.length,3);
 assert.deepEqual(f.inventory.parsed.glyphs['a.alt'].contours,f.double.parsed.glyphs.a.contours);assert.deepEqual(f.inventory.parsed.glyphs.a.contours,f.single.parsed.glyphs.a.contours);assert.equal(f.inventory.parsed.glyphs['a.alt'].advanceWidth,650);
});
test('all untouched protected files retain baseline hashes and promotions match their audit hashes',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./preservation-baseline.json',import.meta.url))),promotions=baseline.authorizedPromotions||{};
 for(const [path,expected]of Object.entries(baseline.files)){
  const actual=createHash('sha256').update(readFileSync(path)).digest('hex'),promotion=promotions[path];
  if(!promotion)assert.equal(actual,expected,path);
  else{assert.equal(promotion.fromSha256,expected,`${path}: original hash record`);assert.equal(actual,promotion.toSha256,`${path}: authorized promotion`);}
 }
 for(const path of Object.keys(promotions))assert.ok(Object.hasOwn(baseline.files,path),`Promotion ${path} must retain its original hash record.`);
});
test('semantic upper-bowl candidate propagates into compiled font without changing the single form or lower counter',()=>{
 const candidate=resizeBowl(design(),'bowl:1',.62),base=fonts(),next=fonts(candidate.geometry);
 assert.deepEqual(base.inventory.parsed.glyphs.a,next.inventory.parsed.glyphs.a);
 const old=base.inventory.parsed.glyphs['a.alt'],changed=next.inventory.parsed.glyphs['a.alt'];
 assert.notDeepEqual(old.contours,changed.contours);assert.deepEqual(old.contours[1],changed.contours[1]);assert.equal(old.advanceWidth,changed.advanceWidth);
});
test('review embeds exact generated bytes and saved fonts match current deterministic compilation',()=>{
 const html=readFileSync(new URL('./review.html',import.meta.url),'utf8'),f=fonts();
 for(const [key,name]of Object.entries({inventory:'a-Alternates',single:'Single-Review',double:'Double-Review'})) {
 const bytes=readFileSync(new URL(`./artifacts/LFCFoundry-Grammar-${name}.ttf`,import.meta.url));assert.deepEqual(bytes,Buffer.from(f[key].bytes));assert.ok(html.includes(bytes.toString('base64')));}
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|fetch\(|import\(/i);
});
