const assert = require('node:assert/strict');
const {readFileSync, existsSync} = require('node:fs');
const {test} = require('node:test');
const vm = require('node:vm');

test('launch waits for route selection and switching restores each flight log', () => {
  const listeners = [];
  const missionButton = {};
  const store = new Map([['flight.history.v1', JSON.stringify({tryCount: 4, runs: [{try: 4, distance: 500}]})]]);
  const root = {
    addEventListener(type, fn) { if (type === 'click') listeners.push(fn); },
    querySelector(selector) { return selector === '.mission-switch' ? missionButton : null; },
    querySelectorAll() { return []; },
    style: { setProperty() {} },
  };
  const ctx = vm.createContext({navigator: {language:'ko'}, document: {getElementById: () => root},
    window: {innerWidth:390, innerHeight:844, SHOUT_MOON_NATIVE_AUDIO:true,
      localStorage: {getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v)},
      addEventListener() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}}});
  const run = expression => vm.runInContext(expression, ctx);
  run(readFileSync('src/web/main.js','utf8'));
  const choose = mission => {
    const target = {dataset:{mission}, closest: sel => sel === '[data-mission]' ? target : null};
    listeners.forEach(fn => fn({target}));
  };
  const assertReadyToLaunch = () => {
    assert.equal(run('state.phase'), 'waitingLaunch');
    assert.equal(run('state.distanceKm'), 0);
    assert.equal(run('state.progress'), 0);
    assert.equal(run('state.fuelRemaining'), run('state.fuelCapacity'));
  };
  assert.match(root.innerHTML, /지구 → 달/);
  assert.match(root.innerHTML, /달 → 화성/);
  run('handleSpeechTranscript("launch")');
  assert.equal(run('state.phase'), 'waitingLaunch');
  choose('mars');
  assert.match(root.innerHTML, /화성 탐험 랭킹/);
  assert.equal(run('state.flightHistory.length'), 0);
  for (const match of root.innerHTML.matchAll(/assets\/(mars-[\w.-]+)/g)) {
    assert.ok(existsSync('public/assets/'+match[1]), match[1]);
  }
  const switchMission = 'handleButtonAction({dataset:{action:"choose-mission"}})';
  run('startGame()');
  assert.equal(missionButton.hidden, true);
  run(switchMission);
  assert.equal(run('mission'), 'mars');
  run('state.distanceKm = 1200; state.fuelRemaining = 0; failGame("test"); state.upgradePending = true; updateUi()');
  assert.equal(missionButton.hidden, false);
  assert.equal(missionButton.disabled, true);
  run(switchMission);
  assert.equal(run('mission'), 'mars');
  run('state.upgradePending = false; updateUi()');
  assert.equal(missionButton.disabled, false);
  assert.match(root.innerHTML, /class="hud-tools"><button[^>]*data-action="choose-mission">항로<\/button>/);
  const resultActions = root.innerHTML.match(/class="flight-result-actions">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual([...resultActions.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]), ['debug-replay', 'open-upgrades']);
  run(switchMission);
  assert.equal(run('mission'), null);
  choose('moon');
  assert.match(root.innerHTML, /달 탐험 랭킹/);
  assert.equal(run('state.flightHistory[0].distance'), 500);
  assertReadyToLaunch();
  run('startGame(); state.distanceKm = 800; state.fuelRemaining = 0; failGame("test")');
  run(switchMission);
  assert.equal(run('mission'), null);
  choose('mars');
  assertReadyToLaunch();
  assert.equal(run('state.flightHistory.at(-1).distance'), 1200);
  run(switchMission);
  choose('moon');
  assertReadyToLaunch();
  assert.equal(run('state.flightHistory.at(-1).distance'), 800);
});
