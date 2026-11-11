const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function fixture(options = {}) {
  const { moonValidator } = await import('../server/moon-validator.mjs');
  let now = 100000;
  let lost = false;
  let offline = false;
  let nextId = 1;
  let submits = 0;
  let releaseStart, releaseSubmit;
  const submitGate = options.delaySubmit ? new Promise(resolve => { releaseSubmit = resolve; }) : null;
  const startGate = options.delayStart ? new Promise(resolve => { releaseStart = resolve; }) : null;
  const stats = { speed: 300, fuel: 40, money: 1.5 };
  const validator = moonValidator({ resolveLoadout: async () => stats, allowFailures: true });
  const storage = new Map();
  const sessions = new Map();
  const calls = [];
  const fetch = async (url, init) => {
    const body = init.method === 'GET' ? Object.fromEntries(new URL(url).searchParams) : JSON.parse(init.body);
    calls.push({ method: init.method, body, headers: init.headers });
    if (offline) throw new Error('Offline');
    const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
    try {
      if (body.action === 'identity') return response({ token: 'signed-credential', playerId: 'private-id' });
      assert.equal(init.headers.Authorization, 'Bearer signed-credential');
      if (init.method === 'GET') return response({ entries: [], periods: [], currentPlayer: null });
      if (init.method === 'PATCH') return options.rejectRename
        ? response({ error: 'That name is already in use.' }, 409)
        : response({ playerName: body.playerName });
      if (body.action === 'profile') return response({ playerId: 'private-id', profile: { ...stats, coins: 0, tries: sessions.size }, activeRunId: null });
      if (body.action === 'start') {
        if (options.rejectStart) return response({ error: 'Server temporarily unavailable' }, 503);
        const initial = await validator.start({ input: body.input, now: new Date(now) });
        const runId = String(nextId++);
        sessions.set(runId, initial);
        if (startGate) await startGate;
        return response({ runId, challenge: initial.challenge, profile: { ...stats, coins: 0, tries: sessions.size } });
      }
      const run = sessions.get(body.runId);
      if (body.action === 'arrival') {
        run.arrivalAt ??= now;
        if (!lost && options.lose === 'arrival') { lost = true; throw new Error('Response lost'); }
        return response({ received: true });
      }
      if (body.action === 'event') {
        if (run.complete) return response({ error: 'Game already completed.' }, 409);
        const result = validator.event({ state: run.state, event: body.event, now: new Date(run.arrivalAt ?? now) });
        Object.assign(run, result);
        if (!lost && options.lose === body.event.type) { lost = true; throw new Error('Response lost'); }
        return response(result);
      }
      if (body.action === 'submit') {
        if (submitGate) await submitGate;
        assert.equal(body.score, undefined, 'client never submits an authoritative score');
        if (!run.complete && !run.failed) return response({ error: 'A server-verified completed game is required.' }, 400);
        if (!run.consumed) { submits++; run.consumed = true; }
        if (!lost && options.lose === 'submit') { lost = true; throw new Error('Response lost'); }
        return response({ playerName: 'MoonRabbit', replayed: true });
      }
      throw new Error('Unexpected request');
    } catch (error) {
      if (error.message === 'Response lost') throw error;
      return response({ error: error.message }, error.status || 500);
    }
  };
  const root = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: { setProperty() {} } };
  class Clock extends Date { static now() { return now; } }
  const window = { SHOUT_MOON_NATIVE_AUDIO: true, innerWidth: 390, innerHeight: 844,
    SHOUT_MOON_LEADERBOARD: { endpoint: 'https://leaderboard.example/api/leaderboard', namespace: 'shout-out-to-the-moon', scope: 'default', loadoutProof: 'test-only-proof' },
    fetch, addEventListener() {}, setInterval() {}, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  };
  const context = vm.createContext({ window, Date: Clock, URL, AbortController, setTimeout, clearTimeout,
    navigator: { language: 'en' }, document: { getElementById() { return root; } } });
  vm.runInContext(readFileSync('src/web/leaderboard.js', 'utf8'), context);
  const makeLeaderboard = window.createMoonLeaderboard;
  window.createMoonLeaderboard = config => makeLeaderboard(config, { wait: async ms => { now += ms; } });
  const source = readFileSync('src/web/main.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nloadEconomy();')), context);
  const run = code => vm.runInContext(code, context);
  run('state.speedMultiplier=300; state.fuelCapacity=40; state.moneyMultiplier=1.5; leaderboard.view.online=true;');
  async function fly({ land = true, interruptHold = false, resume = false } = {}) {
    if (!resume) run('reset(); startGame();');
    await flush();
    let interrupted = false;
    for (let i = 0; i < 2000; i++) {
      now += 50;
      const phase = run('state.phase');
      if (phase === 'flying') run('setMeasuredDb(75);');
      if (phase === 'holdPrompt') {
        if (interruptHold && !interrupted && run('state.holdMs') >= 2500) { run('setMeasuredDb(61);'); interrupted = true; }
        run('setMeasuredDb(55);');
      }
      if (phase === 'clapPrompt' && land) run('registerClap(90);');
      run('updateGame(50);');
      if (['landed', 'failed'].includes(run('state.phase'))) { await flush(); return; }
    }
    throw new Error('Game did not finish');
  }
  return { run, fly, calls, sessions, stats, validator, storage, window, releaseStart, releaseSubmit, advance(ms) { now += ms; },
    get submits() { return submits; }, setOffline(value) { offline = value; } };
}

test('viewing a ranking never registers a name or submits a score', async () => {
  const f = await fixture();
  await f.run('leaderboard.refresh()');
  assert.deepEqual(f.calls.map(call => call.body.action || call.method), ['identity', 'GET']);
  assert.equal(f.submits, 0);
});

test('nickname saving reports success only after the server accepts it', async () => {
  const accepted = await fixture();
  assert.equal(await accepted.run('leaderboard.rename("MoonBunny")'), true);
  assert.equal(accepted.run('leaderboard.view.playerName'), 'MoonBunny');
  const rejected = await fixture({ rejectRename: true });
  assert.equal(await rejected.run('leaderboard.rename("TakenName")'), false);
  assert.equal(rejected.run('leaderboard.view.status'), 'error');
  assert.equal(rejected.run('leaderboard.view.playerName'), '');
});

test('a real Moon flight validates distance, uninterrupted hold, claps and coins, then submits once', async () => {
  const f = await fixture();
  await f.fly({ interruptHold: true });
  assert.equal(f.run('state.phase'), 'landed');
  assert.equal(f.run('leaderboard.view.status'), 'submitted');
  assert.equal(f.submits, 1);
  const session = [...f.sessions.values()][0];
  assert.equal(session.score, session.arrivalAt - Date.parse(session.state.startedAt));
  assert.equal(session.earned, 5765);
  assert.equal(f.run('state.lastEarnedCoins'), 5765);
  f.run('completeLanding(); settleRun(true);');
  await f.run('leaderboard.landed()');
  await f.run('leaderboard.retry()');
  assert.equal(f.submits, 1);
});

test('failed flights submit once and abandoned flights do not submit', async () => {
  const f = await fixture();
  await f.fly({ land: false });
  assert.equal(f.run('state.phase'), 'failed');
  await f.run('leaderboard.landed()');
  assert.equal(f.submits, 1);
  f.run('reset(); startGame(); reset();');
  await f.run('leaderboard.landed()');
  assert.equal(f.submits, 1);
});

for (const lose of ['arrival', 'frames', 'finish', 'submit']) {
  test(`lost ${lose} response survives reload and retry without duplicate scores`, async () => {
    const f = await fixture({ lose });
    await f.fly();
    assert.equal(f.run('leaderboard.view.status'), 'error');
    f.run('leaderboard = window.createMoonLeaderboard(window.SHOUT_MOON_LEADERBOARD);');
    await f.run('leaderboard.retry()');
    assert.equal(f.run('leaderboard.view.status'), 'submitted');
    assert.equal(f.submits, 1);
    assert.equal(f.run('leaderboard.pendingCount()'), 0);
  });
}

test('unconfigured endpoint leaves gameplay available and sends no requests', async () => {
  const f = await fixture();
  f.run('window.SHOUT_MOON_LEADERBOARD.endpoint=""; leaderboard=window.createMoonLeaderboard(window.SHOUT_MOON_LEADERBOARD);');
  await f.fly();
  assert.equal(f.run('state.phase'), 'landed');
  assert.equal(f.calls.length, 0);
  assert.equal(f.run('leaderboard.view.status'), 'unconfigured');
});

test('server refuses client-only upgrades, premature finish, skipped challenges and impossible time', async () => {
  const f = await fixture();
  await assert.rejects(f.validator.start({ input: { loadout: { ...f.stats, money: 10000 } }, now: new Date() }), /differ/);
  const now = new Date(100000);
  const initial = await f.validator.start({ input: { loadout: f.stats }, now });
  const send = (event, at = now) => f.validator.event({ state: initial.state, event, now: at });
  assert.throws(() => send({ type: 'finish', score: 999999 }), /completed Moon landing/);
  assert.throws(() => send({ type: 'frames', sequence: 0, frames: [{ type: 'clap', at: 0, db: 90 }] }), /Invalid clap/);
  assert.throws(() => send({ type: 'frames', sequence: 0, frames: [{ type: 'tick', delta: 5000, db: 75 }] }), /server clock/);
  assert.throws(() => send({ type: 'frames', sequence: 1, frames: [{ type: 'tick', delta: 50, db: 75 }] }), /Out-of-order/);
});


test('Launch flies immediately during a delayed registration and keeps early frames', async () => {
  const f = await fixture({ delayStart: true });
  f.run('const registration = startGame();');
  assert.equal(f.run('state.phase'), 'flying');
  f.run('startGame();'); // Repeated voice results cannot create another session.
  await flush();
  assert.equal(f.calls.filter(c => c.body.action === 'start').length, 1);
  assert.equal(f.calls.filter(c => c.body.action === 'profile').length, 0);
  f.advance(500);
  f.run('setMeasuredDb(60); updateGame(500);');
  assert.equal(f.run('state.distanceKm'), 9000);
  assert.equal(f.run('state.fuelRemaining'), 39.5);
  f.releaseStart();
  await f.run('registration');
  assert.equal(f.run('state.distanceKm'), 9000);
  assert.equal(f.run('state.fuelRemaining'), 39.5);
  assert.equal(f.run('state.tryCount'), 1);
  await f.fly({ resume: true });
  assert.equal(f.submits, 1);
  assert.equal([...f.sessions.values()][0].earned, 5765);
  assert.equal(f.run('leaderboard.pendingCount()'), 0);
});

test('a rejected server registration reports the error without freezing or restarting flight', async () => {
  const f = await fixture({ rejectStart: true });
  const registration = f.run('startGame()');
  assert.equal(f.run('state.phase'), 'flying');
  await registration;
  assert.equal(f.run('state.phase'), 'flying');
  assert.equal(f.run('leaderboard.view.status'), 'error');
  f.advance(500);
  f.run('setMeasuredDb(60); updateGame(500);');
  assert.equal(f.run('state.distanceKm'), 9000);
  assert.equal(f.submits, 0);
});


test('Replay starts visually while the previous result syncs, with separate server sessions', async () => {
  const f = await fixture({ delaySubmit: true });
  await f.fly();
  assert.equal(f.run('state.phase'), 'landed');
  f.run('reset(); const nextRegistration = startGame();');
  assert.equal(f.run('state.phase'), 'flying');
  f.advance(500);
  f.run('setMeasuredDb(60); updateGame(500);');
  assert.equal(f.run('state.distanceKm'), 9000);
  assert.equal(f.sessions.size, 1);
  f.releaseSubmit();
  await f.run('nextRegistration');
  assert.equal(f.sessions.size, 2);
  assert.equal(f.run('state.distanceKm'), 9000);
  await f.fly({ resume: true });
  assert.equal(f.submits, 2);
  assert.equal(f.run('leaderboard.pendingCount()'), 0);
});


test('connecting from a local save uses the server try count before launch', async () => {
  const f = await fixture();
  f.run('state.tryCount=99;');
  await f.run('leaderboard.connect()');
  assert.equal(f.run('state.tryCount'),0);
});
