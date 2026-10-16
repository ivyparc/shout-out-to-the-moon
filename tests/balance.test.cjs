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

for (const firstUpgrade of ['speed', 'fuel']) for (const [db, expected] of [[55, 13], [65, 10], [70, 10], [75, 9]]) {
  test(`fresh save (${firstUpgrade} first): ${JSON.stringify(db)}dB reaches the Moon on run ${expected}`, () => {
    const { run, fly } = game();
    let upgrade = firstUpgrade;
    let firstLanding = null;
    for (let attempt = 1; attempt <= 15; attempt++) {
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
  run('state.speedMultiplier=22; state.fuelCapacity=22;');
  assert.equal(fly(55), 'landed');
  assert.equal(run('state.lastEarnedCoins'), Math.floor(run('state.distanceKm') / 100));
  const reward = run('state.lastEarnedCoins');
  assert.equal(run('state.coins'), firstCoins + reward);
  run('completeLanding(); settleRun(true);');
  assert.equal(run('state.coins'), firstCoins + reward);
});

test('purchases cost coins, cannot happen in flight, and survive reload', () => {
  const { run } = game();
  run('state.coins=250;');
  assert.equal(run('applyUpgrade("speed")'), true);
  assert.equal(run('state.coins'), 200);
  assert.equal(run('upgradeCost("speed")'), 50);
  assert.equal(run('applyUpgrade("fuel")'), true);
  assert.equal(run('applyUpgrade("money")'), true);
  run('state.speedMultiplier=10; state.fuelCapacity=10; state.moneyMultiplier=1; state.coins=0; loadEconomy();');
  assert.equal(run('state.speedMultiplier'), 11);
  assert.equal(run('state.fuelCapacity'), 11);
  assert.equal(run('state.moneyMultiplier'), 1.1);
  assert.equal(run('state.coins'), 100);
  run('startGame();');
  const before = run('JSON.stringify([state.coins,state.speedMultiplier,state.fuelCapacity])');
  assert.equal(run('applyUpgrade("speed")'), false);
  assert.equal(run('JSON.stringify([state.coins,state.speedMultiplier,state.fuelCapacity])'), before);
});

test('large distance steps cannot skip the hold and clap challenges', () => {
  const { run } = game();
  run('startGame(); state.speedMultiplier=2000; state.db=110; updateGame(1000);');
  assert.equal(run('state.phase'), 'holdPrompt');
  assert.equal(run('state.progress'), 1);
  assert.equal(run('state.distanceKm'), 19500);
  assert.equal(run('UFO_ENABLED'), false);
});


test('speed is exactly dB times engine; fuel burns one tonne per real second', () => {
  const { run } = game();
  run('startGame(); setMeasuredDb(58);');
  assert.equal(run('currentSpeedKms()'), 580);
  run('updateGame(1000);');
  assert.equal(run('state.distanceKm'), 580);
  assert.equal(run('state.fuelRemaining'), 9);
  for (const db of [0, 40, 55, 80, 110]) {
    run(`state.phase="flying"; state.fuelRemaining=10; setMeasuredDb(${db}); updateGame(1000);`);
    assert.equal(run('currentSpeedKms()'), 10 * db);
    assert.equal(run('state.fuelRemaining'), 9);
  }
});

test('default fuel lasts ten seconds and counts the final flight interval', () => {
  const { run } = game();
  run('startGame(); setMeasuredDb(58); updateGame(5000); completeSeparation(); updateGame(4999);');
  assert.equal(run('state.phase'), 'flying');
  run('updateGame(1);');
  assert.equal(run('state.phase'), 'failed');
  assert.ok(Math.abs(run('state.distanceKm') - 5800) < 1e-8);
  assert.equal(run('state.lastEarnedCoins'), 58);
});

test('hold uses real seconds and the same fuel burn', () => {
  const { run } = game();
  run('state.phase="holdPrompt"; state.fuelRemaining=10; state.db=55; state.holdMs=0; updateGame(1000);');
  assert.equal(run('state.holdMs'), 1000);
  assert.equal(run('state.fuelRemaining'), 9);
});

test('document example: fuel 22 to 23 costs 100 coins', () => {
  const { run } = game();
  run('state.fuelCapacity=22; state.coins=100;');
  assert.equal(run('upgradeCost("fuel")'), 100);
  assert.equal(run('applyUpgrade("fuel")'), true);
  assert.equal(run('state.fuelCapacity'), 23);
  assert.equal(run('state.coins'), 0);
});

test('rewards use distance divided by 100 times Money without bonuses', () => {
  const { run } = game();
  run('state.distanceKm=5800; state.moneyMultiplier=1.5; settleRun();');
  assert.equal(run('state.lastEarnedCoins'), 87);
});

test('background boundaries follow configured layer distances, two strips per layer', () => {
  const { run } = game();
  for (const [distance, scroll] of [[0,0], [4000,2], [7000,4], [10500,6], [13500,8], [16500,10], [19500,10]]) {
    assert.ok(Math.abs(run(`getWorldScrollRatio(${distance}/TOTAL_DISTANCE_KM)`) - scroll) < 1e-8);
  }
  assert.equal(run('ATMOSPHERE_STRIPS.filter(name => name === "space.png").length'), 1);
});

test('all upgrade price boundaries match the source spreadsheet', () => {
  const { run } = game();
  for (const [value, expected] of [[10,50],[20,50],[21,100],[30,100],[31,150],[40,150],[41,200],[50,200],[51,250],[100,250]]) {
    run(`state.speedMultiplier=${value}; state.fuelCapacity=${value}; state.moneyMultiplier=${value / 10};`);
    for (const type of ['speed','fuel','money']) assert.equal(run(`upgradeCost("${type}")`), expected);
  }
});
