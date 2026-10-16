const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function game() {
  let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const storage = new Map();
  const flame = {dataset: {}, style: {}};
  const root = { addEventListener() {}, querySelector(selector) { return selector === ".flame" ? flame : null; }, querySelectorAll() { return []; }, style: { setProperty() {} } };
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
  return { run, fly, flame };
}


test('launches count once; completed endpoints, best record and try numbers survive reload', () => {
  const { run } = game();
  run('startGame(); startGame(); state.distanceKm=5000; failGame("fuel"); settleRun();');
  assert.equal(run('state.tryCount'), 1);
  assert.equal(run('state.flightHistory.length'), 1);
  run('reset(); startGame(); state.distanceKm=7000; failGame("fuel"); reset(); startGame(); state.distanceKm=6000; failGame("fuel");');
  assert.equal(run('bestFlight().try'), 2);
  assert.equal(run('bestFlight().distance'), 7000);
  run('state.tryCount=0; state.flightHistory=[]; loadEconomy();');
  assert.equal(run('state.tryCount'), 3);
  assert.equal(run('state.flightHistory.length'), 3);
  assert.equal(run('bestFlight().try'), 2);
  run('reset();');
  assert.equal(run('state.tryCount'), 3);
});

test('invalid stored history cannot break the game or introduce invalid markers', () => {
  const { run } = game();
  run('writeStoredValue("flight.history.v1", "invalid"); loadFlightHistory();');
  assert.equal(run('state.flightHistory.length'), 0);
  run('writeStoredValue("flight.history.v1", JSON.stringify({tryCount: 2, runs: [{try:1,distance:500},{try:"bad",distance:600},{try:2,distance:-1}]})); loadFlightHistory();');
  assert.equal(run('state.flightHistory.length'), 1);
  assert.equal(run('state.tryCount'), 2);
});

test('flame dimensions change on every 5dB boundary and silence hides it', () => {
  const { run, flame } = game();
  run('startGame();');
  for (let db=5; db<=105; db+=5) {
    run(`setMeasuredDb(${db});`);
    const width=flame.style.width, height=flame.style.height;
    run(`setMeasuredDb(${db+4});`);
    assert.equal(flame.style.width,width);
    assert.equal(flame.style.height,height);
    run(`setMeasuredDb(${db+5});`);
    assert.ok(parseFloat(flame.style.width)>parseFloat(width));
    assert.ok(parseFloat(flame.style.height)>parseFloat(height));
  }
  run('setMeasuredDb(0);');
  assert.equal(flame.style.visibility,'hidden');
});

test('Game Over card contains results; replay actions remain outside it', () => {
  const { run } = game();
  run('state.phase="failed"; state.distanceKm=5000; state.lastEarnedCoins=50;');
  const card=run('getCenterMessage(STRINGS.en)');
  assert.match(card,/Distance: 5,000/);
  assert.match(card,/Earn: 50/);
  assert.doesNotMatch(card,/<button|upgrade-list|result-actions/);
});

test('past endpoints align with the rocket and remain distinct in the final space layer', () => {
  const { run } = game();
  run('state.distanceKm=7000; syncProgressFromDistance();');
  assert.ok(Math.abs(run('flightMarkerY(7000)') - 0.65) < 1e-9);
  assert.ok(run('flightMarkerY(6000)') > 0.65);
  assert.ok(run('flightMarkerY(8000)') < 0.65);
  run('state.distanceKm=19000; syncProgressFromDistance();');
  assert.ok(run('flightMarkerY(18000)') > run('flightMarkerY(19000)'));
});
