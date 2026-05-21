#!/usr/bin/env node
// Validates scenarios.js before any deploy.
// Exit 0 = pass. Exit 1 = fail.

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/scenarios.js', 'utf8');

let passed = 0, failed = 0;
const errors = [];

function ok(label) { console.log('✓', label); passed++; }
function fail(label) { console.error('✗', label); errors.push(label); failed++; }

// 1. File parses
let window = {};
try {
  eval(src);
  ok('File parses without error');
} catch (e) {
  fail('File parse error: ' + e.message);
  process.exit(1);
}

const sc = window.scenarios;
const order = window.scenarioOrder;

// 2. scenarioOrder has 30 entries
order.length === 30
  ? ok('scenarioOrder has 30 entries')
  : fail(`scenarioOrder has ${order.length} entries (expected 30)`);

// 3. All order entries exist in scenarios
const missing = order.filter(id => !sc[id]);
missing.length === 0
  ? ok('All scenarioOrder IDs exist in scenarios object')
  : fail('Missing scenarios: ' + missing.join(', '));

// 4. No extra scenarios outside order
const extra = Object.keys(sc).filter(id => !order.includes(id));
extra.length === 0
  ? ok('No extra scenarios outside scenarioOrder')
  : fail('Extra (orphan) scenarios: ' + extra.join(', '));

// 5. Each scenario has required fields
const BANDS = ['0-1','1-2','2-3','3-6'];
let allIds = [];
let idConflicts = [];

for (const id of order) {
  const s = sc[id];
  if (!s) continue;

  ['icon','name','color','phrases'].forEach(field => {
    if (!s[field]) fail(`${id}: missing field "${field}"`);
  });

  // 6. All 4 age bands present
  const missingBands = BANDS.filter(b => !s.phrases[b]);
  missingBands.length === 0
    ? ok(`${id}: has all 4 age bands`)
    : fail(`${id}: missing age bands: ${missingBands.join(', ')}`);

  for (const band of BANDS) {
    const phrases = s.phrases[band];
    if (!phrases) continue;

    // 7. At least 3 phrases per band
    if (phrases.length < 3) fail(`${id}[${band}]: only ${phrases.length} phrases (min 3)`);

    for (const p of phrases) {
      // 8. Required phrase fields
      ['id','en','zh','tip'].forEach(f => {
        if (!p[f] || typeof p[f] !== 'string' || p[f].trim() === '')
          fail(`${id}[${band}] phrase ${p.id || '?'}: missing/empty field "${f}"`);
      });

      // 9. Collect IDs for dupe check
      if (p.id) allIds.push({ id: p.id, scenario: id, band });
    }
  }
}

// 9. Unique phrase IDs
const idMap = {};
for (const entry of allIds) {
  if (idMap[entry.id]) {
    fail(`Duplicate phrase ID "${entry.id}" in ${entry.scenario}[${entry.band}] and ${idMap[entry.id].scenario}[${idMap[entry.id].band}]`);
  } else {
    idMap[entry.id] = entry;
  }
}
if (Object.keys(idMap).length === allIds.length) ok(`All ${allIds.length} phrase IDs are unique`);

// 10. No unescaped ASCII double-quotes inside string values
// Detect patterns like: "somekey":"text"word"text"
const lineRe = /:\s*"([^"\\]*(\\.[^"\\]*)*)"[^,}\]\s]/g;
const lines = src.split('\n');
lines.forEach((line, i) => {
  const stripped = line.trim();
  if (!stripped.startsWith('{ id:') && !stripped.startsWith('{ pattern:')) return;
  // Simple heuristic: count unescaped " — odd number = broken string
  let count = 0, inStr = false, prev = '';
  for (const ch of stripped) {
    if (ch === '"' && prev !== '\\') count++;
    prev = ch;
  }
  if (count % 2 !== 0) fail(`Line ${i+1}: odd number of unescaped quotes — possible syntax error: ${stripped.slice(0,80)}`);
});
if (failed === 0 || errors.every(e => !e.startsWith('Line'))) ok('No bare unescaped double-quotes detected in phrase strings');

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nErrors:\n' + errors.map(e => '  • ' + e).join('\n'));
  process.exit(1);
}
console.log('✓ scenarios.js is valid — safe to deploy');
