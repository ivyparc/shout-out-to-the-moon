const assert = require('node:assert/strict');
const {readFileSync, existsSync} = require('node:fs');
const {test} = require('node:test');
const vm = require('node:vm');

test('launch waits for route selection and switching restores each flight log', () => {
  const listeners = [];
  const store = new Map([['flight.history.v1', JSON.stringify({tryCount: 4, runs: [{try: 4, distance: 500}]})]]);
  const root = {
    addEventListener(type, fn) { if (type === 'click') listeners.push(fn); },
    querySelector() { return null; }, querySelectorAll() { return []; },
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
  run('handleButtonAction({dataset:{action:"choose-mission"}})');
  choose('moon');
  assert.match(root.innerHTML, /달 탐험 랭킹/);
  assert.equal(run('state.flightHistory[0].distance'), 500);
});
