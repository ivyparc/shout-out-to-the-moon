const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function game() {
  let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const storage = new Map();
  const flame = {dataset: {}, style: {setProperty() {}}};
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
      if (run('isDistancePhase()')) run(`setMeasuredDb(${Array.isArray(db) ? db[tick % db.length] : db})`);
      if (run('state.phase') === 'holdPrompt') run('setMeasuredDb(55)');
      if (run('state.phase') === 'clapPrompt') run('registerClap(90)');
      run('updateGame(50)');
      if (['landed', 'failed'].includes(run('state.phase'))) return run('state.phase');
    }
    throw new Error('Run did not finish');
  }
  return { run, fly, flame, advance(ms) { now += ms; } };
}



test('floating input resolves quiet sounds without a 50dB floor and ignores DC bias', () => {
  const { run } = game();
  for (const [amplitude, expected] of [[0,0],[0.0001,16],[0.001,36],[0.01,56]]) {
    run(`constFrame = microphoneFrame([${amplitude},${-amplitude}]);`);
    assert.equal(run('clampDb(constFrame.dbfs+96)'), expected);
  }
  assert.equal(run('microphoneFrame([0.1,0.1]).dbfs'), -160);
});

test('five-second reference calibration saves an offset for this microphone only', () => {
  const { run, advance } = game();
  run('selectMeterDevice("mic-a"); acceptMicrophoneFrame(-60,0.001);');
  assert.equal(run('beginMeterCalibration(45)'), true);
  for (let i=0;i<50;i++) { advance(100); run('acceptMicrophoneFrame(-60,0.001);'); }
  assert.equal(run('microphoneMeter.calibrated'), true);
  assert.ok(Math.abs(run('microphoneMeter.offset')-105)<1e-9);
  run('startGame(); acceptMicrophoneFrame(-60,0.001);');
  assert.equal(run('state.db'),45);
  run('selectMeterDevice("mic-b");');
  assert.equal(run('microphoneMeter.calibrated'),false);
  assert.equal(run('microphoneMeter.offset'),96);
  run('selectMeterDevice("mic-a");');
  assert.equal(run('microphoneMeter.calibrated'),true);
});

test('invalid references, active processing and stale microphone input cannot calibrate', () => {
  const { run, advance } = game();
  run('selectMeterDevice("processed",true); acceptMicrophoneFrame(-40,0.01);');
  assert.equal(run('beginMeterCalibration(60)'),false);
  run('selectMeterDevice("raw");');
  assert.equal(run('beginMeterCalibration(NaN)'),false);
  assert.equal(run('beginMeterCalibration(0)'),false);
  advance(1000);
  assert.equal(run('beginMeterCalibration(60)'),false);
});

test('silence, clipping and unstable sound reject calibration without replacing a previous value', () => {
  for (const kind of ['silence','clipped','unstable']) {
    const { run, advance } = game();
    run('selectMeterDevice("raw"); acceptMicrophoneFrame(-40,0.01); beginMeterCalibration(60);');
    for (let i=0;i<50;i++) {
      advance(100);
      const dbfs=kind==='silence'?-160:kind==='unstable'?(i%2?-30:-50):-40;
      run(`acceptMicrophoneFrame(${dbfs},${kind==='clipped'?1:0.01});`);
    }
    assert.equal(run('microphoneMeter.calibrated'),false);
    assert.equal(run('microphoneMeter.offset'),96);
  }
});
