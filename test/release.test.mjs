import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('release HTML is self-contained and carries dependency notice',async()=>{
  const html=await readFile(new URL('../dist/typeface-studio.html',import.meta.url),'utf8');
  assert.match(html,/<style>[\s\S]*<\/style>/);
  assert.match(html,/<script>[\s\S]*<\/script>/);
  assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)=["'](?:https?:|\/\/|\.\/)/i);
  assert.doesNotMatch(html,/\bimport\s*\(/);
  assert.doesNotMatch(html,/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/i);
  assert.match(html,/fontsketch 0\.1\.0 \(MIT\)/);
  assert.match(html,/Copyright \(c\) 2026 Alexandre Kohler/);
});
