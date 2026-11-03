import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import {dirname,resolve,relative} from 'node:path';import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),source=resolve(here,'baseline/architecture/universal-design-model/integration-experiment/engine.mjs');
let code=readFileSync(source,'utf8');
code=code.replace(/from '([.][^']+)'/g,(_,ref)=>`from './${relative(here,resolve(dirname(source),ref))}'`);
function patch(a,b){if(code.split(a).length!==2)throw Error('Executor snapshot no longer matches extension anchor');code=code.replace(a,b);}
patch('function reflectGlyph(glyph) {','export function reflectGlyph(glyph) {');
patch("{ revisionLabel = 'v2-operation-transaction' } = {}", "{ revisionLabel = 'v2-operation-transaction', operationHandlers = {} } = {}");
patch("else throw new Error(`Operation ${op.id} has unsupported executor type ${op.type}.`);", "else if (Object.hasOwn(operationHandlers, op.type)) operationHandlers[op.type]({ model: stagedModel, family: stagedFamily, glyph, operation: op });\n        else throw new Error(`Operation ${op.id} has unsupported executor type ${op.type}.`);");
patch('digest({ base: model.revisions.headRevisionId, operationIds, changedGlyphIds })', 'digest({ base: model.revisions.headRevisionId, operations: stagedModel.operations, changedGlyphIds, glyphHashes: stagedFamily.glyphOrder.map(id => digest(glyphState(stagedFamily.glyphs[id]))), constructionState: stagedModel.constructionIntegration })');
const target=resolve(here,'extended-executor.mjs');if(existsSync(target)){if(readFileSync(target,'utf8')!==code)throw Error('Refusing to replace different executor');}else writeFileSync(target,code,{flag:'wx'});
console.log(JSON.stringify({sourceSha256:createHash('sha256').update(readFileSync(source)).digest('hex'),extendedSha256:createHash('sha256').update(code).digest('hex'),changes:['relative import relocation','export existing reflection helper','optional operation handler dispatch','content-addressed revision identity']},null,2));
