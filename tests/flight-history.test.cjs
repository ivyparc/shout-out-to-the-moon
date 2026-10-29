const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function game({ adapter = null } = {}) {
  let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const storage = new Map();
  const flame = {dataset: {}, style: {setProperty() {}}};
  const map = { clientHeight: 300, innerHTML: "" };
  const root = { addEventListener() {}, querySelector(selector) { return selector === ".flame" ? flame : selector === ".history-map" ? map : null; }, querySelectorAll() { return []; }, style: { setProperty() {} } };
  const context = vm.createContext({
    Date: Clock, navigator: { language: 'en' }, document: { getElementById() { return root; } },
    window: {
      createMoonLeaderboard: adapter ? () => adapter : undefined,
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
  return { run, fly, flame, map };
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

test('Game Over uses a dedicated result panel without covering flight messages', () => {
  const { run } = game();
  run('state.phase="failed"; state.distanceKm=5000; state.lastEarnedCoins=50;');
  assert.equal(run('getCenterMessage(STRINGS.en)'), '');
  run('render()');
  const html = run('root.innerHTML');
  assert.match(html, /class="flight-result"/);
  assert.match(html, /class="result-distance"/);
  assert.match(html, /class="result-coins"/);
  assert.match(html, /class="result-to-best"/);
  assert.match(html, /data-action="open-upgrades"/);
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

test('only Best and the latest flight are selected, with equal-height records merged', () => {
  const { run, map } = game();
  run('state.flightHistory=[{try:1,distance:4000},{try:2,distance:7000},{try:3,distance:5000}];');
  assert.equal(run('JSON.stringify(displayedFlights().map(r=>r.try))'), '[2,3]');
  run('renderFlightMarkers()');
  assert.match(map.innerHTML, /<span>Best<\/span>/);
  assert.match(map.innerHTML, /<span>Last<\/span>/);
  run('state.flightHistory.push({try:4,distance:7000});');
  assert.equal(run('JSON.stringify(displayedFlights().map(r=>r.try))'), '[2]');
  run('renderFlightMarkers()');
  assert.match(map.innerHTML, /<span>Best<\/span>/);
  assert.doesNotMatch(map.innerHTML, /<span>Last<\/span>/);
  run('state.flightHistory.push({try:5,distance:8000});');
  assert.equal(run('JSON.stringify(displayedFlights().map(r=>r.try))'), '[5]');
});

test('flight hint disappears at three seconds and returns on a new launch', () => {
  const { run } = game();
  run('startGame(); state.flightStartedAt=Date.now()-2999;');
  assert.equal(run('getCenterMessage(STRINGS.en)'), 'Make some noise!');
  run('state.flightStartedAt=Date.now()-3000;');
  assert.equal(run('getCenterMessage(STRINGS.en)'), '');
  run('reset(); startGame();');
  assert.equal(run('getCenterMessage(STRINGS.en)'), 'Make some noise!');
});

test('minimap keeps Last for reused try numbers, small height differences and zero distance', () => {
  const { run, map } = game();
  for (const distance of [5000, 6999.5, 0]) {
    run(`state.flightHistory=[{try:10,distance:7000},{try:10,distance:${distance}}]; renderFlightMarkers();`);
    assert.equal(run('displayedFlights().length'), 2);
    assert.match(map.innerHTML, /<span>Best<\/span>/);
    assert.match(map.innerHTML, /<span>Last<\/span>/);
  }
  run('state.flightHistory=[{try:10,distance:0}]; renderFlightMarkers();');
  assert.match(map.innerHTML, /<span>Best<\/span>/);
  assert.doesNotMatch(map.innerHTML, /<span>Last<\/span>/);
});

test('switching to online history immediately refreshes the minimap', () => {
  let notify;
  const adapter = { view: { online: false }, subscribe(fn) { notify = fn; }, pendingCount: () => 0 };
  const { run, map } = game({ adapter });
  run(`state.flightHistory=[{try:1,distance:1000}]; renderFlightMarkers();
    writeStoredValue('flight.online.history.v1', JSON.stringify({tryCount:10,runs:[{try:8,distance:7000},{try:10,distance:5000}]}));`);
  adapter.view = { online: true, profile: { speed: 13, fuel: 11, money: 1.1, coins: 5, tries: 10 } };
  notify();
  assert.match(map.innerHTML, /Best · T8/);
  assert.match(map.innerHTML, /Last · T10/);
});

test('half fuel does not interrupt flight or react to Separation', () => {
  const { run } = game();
  run('startGame(); setMeasuredDb(55); updateGame(5000);');
  assert.equal(run('state.phase'), 'flying');
  run('handleSpeechTranscript("separation"); updateGame(1000);');
  assert.equal(run('state.phase'), 'flying');
  assert.equal(run('state.distanceKm'), 3300);
});


test('background videos follow the existing layer order and only visible layers play', () => {
  const { run } = game();
  run(`const videos = Array.from({length:10}, (_,i) => ({
    dataset:{strip:String(i),video:'layer-'+i+'.mp4'}, readyState:1, currentTime:0,
    getAttribute(){return this.src || null;}, load(){},
    play(){this.plays=(this.plays||0)+1;return Promise.resolve();},
    pause(){this.pauses=(this.pauses||0)+1;}
  }));
  root.querySelectorAll = selector => selector === '.background-video' ? videos : [];
  updateBackgroundMotion();`);
  assert.equal(run('videos.filter(v=>v.plays).length'),0);
  run('state.phase="flying"; updateBackgroundMotion();');
  assert.equal(run('videos.filter(v=>v.dataset.playing==="true").length'),1);
  run('state.progress=8750/19500; updateBackgroundMotion();');
  assert.equal(run('videos[0].dataset.playing'),'false');
  assert.equal(run('videos[5].dataset.playing'),'true');
  run('state.phase="failed"; updateBackgroundMotion();');
  assert.equal(run('videos.filter(v=>v.dataset.playing==="true").length'),0);
  run('state.phase="waitingLaunch"; updateBackgroundMotion();');
  assert.equal(run('videos.filter(v=>v.dataset.playing==="true").length'),0);
});
