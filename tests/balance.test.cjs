const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function game() {
  let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const storage = new Map();
  const root = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: { setProperty() {} } };
  const context = vm.createContext({
    Date: Clock, navigator: { language: 'en' }, document: { getElementById() { return root; } },
    window: {
      SHOUT_MOON_NATIVE_AUDIO: true, innerWidth: 390, innerHeight: 844,
      addEventListener() {}, clearTimeout() {}, setTimeout() {}, setInterval() {},
      localStorage: { getItem(key) { return storage.get(key) ?? null; }, setItem(key, value) { storage.set(key, value); } },
    },
  });
  const source = readFileSync('src/web/main.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nloadEconomy();')), context);
  const run = code => vm.runInContext(code, context);
  function fly(db) {
    run('reset(); startGame();');
    for (let tick = 0; tick < 10000; tick++) {
      now += 50;
      if (run('state.phase') === 'separationPrompt') run('completeSeparation()');
      if (run('isDistancePhase()')) run(`setMeasuredDb(${Array.isArray(db) ? db[tick % db.length] : db})`);
      if (run('state.phase') === 'holdPrompt') run('setMeasuredDb(55)');
      if (run('state.phase') === 'clapPrompt') run('registerClap(90)');
      run('updateGame(50)');
      if (['landed', 'failed'].includes(run('state.phase'))) return run('state.phase');
    }
    throw new Error('Run did not finish');
  }
  return { run, fly };
}

for (const firstUpgrade of ['speed', 'fuel']) for (const [db, expected] of [[40, 10], [50, 10], [55, 9], [65, 9], [80, 9], [110, 9], [[45, 55, 70], 10]]) {
  test(`fresh save (${firstUpgrade} first): ${JSON.stringify(db)}dB reaches the Moon on run ${expected}`, () => {
    const { run, fly } = game();
    let upgrade = firstUpgrade;
    let firstLanding = null;
    for (let attempt = 1; attempt <= 10; attempt++) {
      const result = fly(db);
      if (result === 'landed') { firstLanding = attempt; break; }
      while (run(`applyUpgrade('${upgrade}')`)) upgrade = upgrade === 'speed' ? 'fuel' : 'speed';
    }
    assert.equal(firstLanding, expected);
  });
}

test('without upgrades, even maximum loudness cannot reach the Moon in ten runs', () => {
  const { run, fly } = game();
  for (let attempt = 0; attempt < 10; attempt++) assert.equal(fly(110), 'failed');
  assert.equal(run('state.speedMultiplier'), 10);
  assert.equal(run('state.fuelCapacity'), 10);
});

test('both successful and failed runs award coins exactly once', () => {
  const { run, fly } = game();
  assert.equal(fly(55), 'failed');
  const firstCoins = run('state.coins');
  assert.ok(firstCoins > 0);
  run('failGame("again"); settleRun();');
  assert.equal(run('state.coins'), firstCoins);
  run('state.speedMultiplier=14; state.fuelCapacity=14;');
  assert.equal(fly(55), 'landed');
  assert.equal(run('state.lastEarnedCoins'), 121);
  assert.equal(run('state.coins'), firstCoins + 121);
  run('completeLanding(); settleRun(true);');
  assert.equal(run('state.coins'), firstCoins + 121);
});

test('purchases cost coins, cannot happen in flight, and survive reload', () => {
  const { run } = game();
  run('state.coins=250;');
  assert.equal(run('applyUpgrade("speed")'), true);
  assert.equal(run('state.coins'), 190);
  assert.equal(run('upgradeCost("speed")'), 70);
  assert.equal(run('applyUpgrade("fuel")'), true);
  assert.equal(run('applyUpgrade("money")'), true);
  run('state.speedMultiplier=10; state.fuelCapacity=10; state.moneyMultiplier=1; state.coins=0; loadEconomy();');
  assert.equal(run('state.speedMultiplier'), 11);
  assert.equal(run('state.fuelCapacity'), 11);
  assert.equal(run('state.moneyMultiplier'), 1.1);
  assert.equal(run('state.coins'), 80);
  run('startGame();');
  const before = run('JSON.stringify([state.coins,state.speedMultiplier,state.fuelCapacity])');
  assert.equal(run('applyUpgrade("speed")'), false);
  assert.equal(run('JSON.stringify([state.coins,state.speedMultiplier,state.fuelCapacity])'), before);
});

test('large distance steps cannot skip the hold and clap challenges', () => {
  const { run } = game();
  run('startGame(); state.speedMultiplier=2000; state.db=110; updateGame(1000);');
  assert.equal(run('state.phase'), 'holdPrompt');
  assert.equal(run('state.progress'), 0.94);
  assert.equal(run('UFO_ENABLED'), false);
});
