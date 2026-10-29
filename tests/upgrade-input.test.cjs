const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function fixture() {
  const handlers = {};
  const root = { addEventListener(type, fn) { (handlers[type] ??= []).push(fn); }, querySelector() { return null; }, querySelectorAll() { return []; }, style: { setProperty() {} } };
  const storage = new Map();
  const context = vm.createContext({ Date, navigator: { language: 'en' }, document: { getElementById: () => root }, window: {
    SHOUT_MOON_NATIVE_AUDIO: true, innerWidth: 390, innerHeight: 844,
    addEventListener() {}, setInterval() {}, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  } });
  const source = readFileSync('src/web/main.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nloadEconomy();')), context);
  const run = code => vm.runInContext(code, context);
  run('state.coins=158; state.speedMultiplier=11;');
  const button = { dataset: { upgrade: 'speed' }, disabled: false };
  const event = { target: { closest: selector => selector === 'button' ? button : null }, preventDefault() {} };
  return { run, button, fire: type => handlers[type].forEach(fn => fn(event)) };
}

test('click-only activation buys an upgrade, deducts once and persists it', () => {
  const { run, fire } = fixture();
  fire('click');
  assert.equal(run('state.speedMultiplier'), 12);
  assert.equal(run('state.coins'), 108);
  assert.equal(run('state.upgradeFeedback'), 'Upgrade complete!');
  run('loadEconomy()');
  assert.equal(run('state.speedMultiplier'), 12);
  assert.equal(run('state.coins'), 108);
});

test('pointer press and release charge only once; disabled buttons never buy', () => {
  const { run, fire, button } = fixture();
  fire('pointerdown');
  assert.equal(run('state.coins'), 158);
  fire('click');
  assert.equal(run('state.coins'), 108);
  button.disabled = true;
  fire('pointerdown'); fire('click');
  assert.equal(run('state.coins'), 108);
});

test('fuel purchase immediately updates the waiting dashboard', () => {
  const { run, fire, button } = fixture();
  button.dataset.upgrade = 'fuel';
  fire('click');
  assert.equal(run('state.fuelCapacity'), 11);
  assert.equal(run('state.fuelRemaining'), 11);
});

test('online purchase errors are reported and a retry clears the error', async () => {
  let reject = true;
  let coins = 158;
  let speed = 11;
  const window = { localStorage: { getItem: () => null, setItem() {} }, fetch: async (url, init) => {
    const request = JSON.parse(init.body);
    let data = { profile: { speed, fuel: 10, money: 1, coins } };
    let ok = true;
    if (request.action === 'identity') data = { token: 'test', playerId: 'test-player' };
    if (request.action === 'upgrade') {
      assert.equal(request.expected, 11);
      if (reject) { ok = false; data = { error: 'Upgrade unavailable. Refresh your balance.' }; }
      else { coins -= 50; speed++; data = { profile: { speed, fuel: 10, money: 1, coins } }; }
    }
    return { ok, status: ok ? 200 : 409, json: async () => data };
  } };
  const context = vm.createContext({ window, URL, AbortController, setTimeout, clearTimeout });
  vm.runInContext(readFileSync('src/web/leaderboard.js', 'utf8'), context);
  const api = window.createMoonLeaderboard({ endpoint: 'https://test.example/api', namespace: 'test', scope: 'test' });
  await api.connect('new');
  assert.equal(await api.upgrade('speed'), false);
  assert.match(api.view.error, /Upgrade unavailable/);
  assert.equal(api.view.busy, false);
  reject = false;
  assert.equal(await api.upgrade('speed'), true);
  assert.equal(api.view.error, '');
  assert.equal(api.view.profile.coins, 108);
  assert.equal(api.view.profile.speed, 12);
});
