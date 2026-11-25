const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function game() {
  const root = {
    addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, style: { setProperty() {} },
  };
  const context = vm.createContext({
    navigator: { language: 'en' },
    document: { getElementById() { return root; } },
    window: { innerWidth: 390, innerHeight: 844, addEventListener() {}, setInterval() {}, clearTimeout() {} },
  });
  const source = readFileSync('src/web/main.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nloadEconomy();')), context);
  const run = (code) => vm.runInContext(code, context);
  run('beginHoldChallenge(); state.holdStartedAt = Date.now() - 2000;');
  return run;
}

test('2 seconds + out of range + 3 seconds does not pass; a new 5 seconds does', () => {
  const run = game();
  run('setMeasuredDb(55); updateGame(2000); setMeasuredDb(61);');
  assert.equal(run('state.holdMs'), 0);
  assert.match(run('getCenterMessage(STRINGS.en)'), />5s</);
  run('updateGame(100); setMeasuredDb(55); updateGame(3000);');
  assert.equal(run('state.phase'), 'holdPrompt');
  run('updateGame(1999);');
  assert.equal(run('state.phase'), 'holdPrompt');
  run('updateGame(1);');
  assert.equal(run('state.phase'), 'clapPrompt');
});

test('even a brief reading at or above 60 dB resets progress between ticks', () => {
  for (const outside of [60, 61]) {
    const run = game();
    run(`setMeasuredDb(55); updateGame(2000); setMeasuredDb(${outside}); setMeasuredDb(55); updateGame(3000);`);
    assert.equal(run('state.holdMs'), 3000);
    assert.equal(run('state.phase'), 'holdPrompt');
  }
});

test('uninterrupted five seconds below 60 dB passes without a minimum', () => {
  const run = game();
  run('setMeasuredDb(0); updateGame(2500); setMeasuredDb(59.9); updateGame(2500);');
  assert.equal(run('state.phase'), 'clapPrompt');
});

test('out-of-range ticks reset progress during initial grace and still enforce failure grace', () => {
  const run = game();
  run('state.holdStartedAt = Date.now(); state.holdMs = 1000; state.db = 60; updateGame(50);');
  assert.equal(run('state.holdMs'), 0);
  assert.equal(run('state.phase'), 'holdPrompt');
  run('state.holdStartedAt = Date.now() - 2000; updateGame(2201);');
  assert.equal(run('state.phase'), 'failed');
});
