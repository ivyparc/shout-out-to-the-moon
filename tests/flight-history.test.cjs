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
  const markers = {innerHTML:""};
  const root = { addEventListener() {}, querySelector(selector) { return selector === ".flame" ? flame : selector === ".history-map" ? map : selector === ".flight-markers" ? markers : null; }, querySelectorAll() { return []; }, style: { setProperty() {} } };
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
  return { run, fly, flame, map, markers };
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
  assert.match(html, /class="result-fuel-used"/);
  assert.match(html, /data-action="open-upgrades"/);
});

test('past endpoints align with the rocket and remain distinct in the final space layer', () => {
  const { run } = game();
  run('state.distanceKm=7000; syncProgressFromDistance();');
  assert.ok(Math.abs(run('flightMarkerY(7000) - flightAnchorY()')) < 1e-9);
  assert.ok(run('flightMarkerY(6000) > flightAnchorY()'));
  assert.ok(run('flightMarkerY(8000) < flightAnchorY()'));
  run('state.distanceKm=19000; syncProgressFromDistance();');
  assert.ok(run('flightMarkerY(18000)') > run('flightMarkerY(19000)'));
});

test('minimap shows only Best even when the latest flight is different', () => {
  const { run, map } = game();
  run('state.flightHistory=[{try:1,distance:4000},{try:2,distance:7000},{try:3,distance:5000}];');
  assert.equal(run('JSON.stringify(displayedFlights().map(r=>r.try))'), '[2]');
  run('renderFlightMarkers()');
  assert.match(map.innerHTML, /<span>B<\/span>/);
  assert.doesNotMatch(map.innerHTML, /<span>L<\/span>/);
  run('state.flightHistory.push({try:4,distance:7000});');
  assert.equal(run('JSON.stringify(displayedFlights().map(r=>r.try))'), '[2]');
  run('renderFlightMarkers()');
  assert.match(map.innerHTML, /<span>B<\/span>/);
  assert.doesNotMatch(map.innerHTML, /<span>L<\/span>/);
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

test('minimap never shows Last, including reused tries and zero distance', () => {
  const { run, map } = game();
  for (const distance of [5000, 6999.5, 0]) {
    run(`state.flightHistory=[{try:10,distance:7000},{try:10,distance:${distance}}]; renderFlightMarkers();`);
    assert.equal(run('displayedFlights().length'), 1);
    assert.match(map.innerHTML, /<span>B<\/span>/);
    assert.doesNotMatch(map.innerHTML, /<span>L<\/span>/);
  }
  run('state.flightHistory=[{try:10,distance:0}]; renderFlightMarkers();');
  assert.match(map.innerHTML, /<span>B<\/span>/);
  assert.doesNotMatch(map.innerHTML, /<span>L<\/span>/);
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
  assert.doesNotMatch(map.innerHTML, /L · T10/);
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
  run('state.progress=.5; state.sceneScroll=5; updateBackgroundMotion();');
  assert.equal(run('videos[0].dataset.playing'),'false');
  assert.equal(run('videos[5].dataset.playing'),'true');
  run('state.phase="failed"; updateBackgroundMotion();');
  assert.equal(run('videos.filter(v=>v.dataset.playing==="true").length'),0);
  run('state.phase="waitingLaunch"; updateBackgroundMotion();');
  assert.equal(run('videos.filter(v=>v.dataset.playing==="true").length'),0);
});

test('Game Over always retains the current Try, including a zero-distance or new-best flight', () => {
  const {run, markers} = game();
  for (const distance of [0, 100, 50000]) {
    run(`state.flightHistory=[];state.tryCount=4;state.activeTry=4;state.distanceKm=${distance};state.hasSettledRun=false;settleRun();renderFlightMarkers();`);
    assert.match(markers.innerHTML, /class="flight-marker latest"/);
    assert.match(markers.innerHTML, /<span>T4<\/span>/);
  }
});

test('distance ticks move down, retain their values and never change scale at layer boundaries', () => {
  const {run} = game();
  run('startGame();');
  const step=run('distanceRulerLayout().step');
  for(const km of [12,50,85,600,10000,200000]) {
    run(`state.distanceKm=${km};`);
    assert.equal(run('distanceRulerLayout().step'),step);
    assert.equal(run('distanceRulerTicks().every(t=>t.distance%5===0)'),true);
    const ticks=JSON.parse(run('JSON.stringify(distanceRulerTicks())'));
    run('state.distanceKm+=20;');
    const later=JSON.parse(run('JSON.stringify(distanceRulerTicks())'));
    const shared=ticks.find(t=>later.some(n=>n.distance===t.distance));
    assert.ok(shared);
    assert.ok(Math.abs(later.find(n=>n.distance===shared.distance).y-shared.y-12.8)<1e-8);
  }
});

test('launch scrolls briskly without skipping screens or changing distance', () => {
  const {run}=game();run('startGame();setMeasuredDb(70);updateGame(50);');
  assert.equal(run('state.distanceKm'),35);
  assert.ok(run('getSceneWorldScrollRatio()')<.08);
  assert.ok(run('distanceRulerTicks().length')>3);
  run('for(let i=1;i<200;i++)updateGame(50);');
  assert.ok(Math.abs(run('state.distanceKm')-7000)<1e-8);
  assert.ok(run('getSceneWorldScrollRatio()')>3);
  assert.ok(run('getSceneWorldScrollRatio()')<4);
  const stopped=run('getSceneWorldScrollRatio()');
  run('updateGame(50);');
  assert.equal(run('getSceneWorldScrollRatio()'),stopped);
  run('reset();');
  assert.equal(run('getSceneWorldScrollRatio()'),0);
});

test('powerful engines and delayed frames cannot skip background screens', () => {
  const {run}=game();
  run('state.speedMultiplier=1000;state.fuelCapacity=100;startGame();setMeasuredDb(100);updateGame(50);');
  assert.ok(run('getSceneWorldScrollRatio()')<.08);
  const before=run('getSceneWorldScrollRatio()');
  run('updateGame(2000);');
  assert.ok(run('getSceneWorldScrollRatio()')-before<=.16);
});

test('louder flight moves the background faster and silence eases its motion', () => {
  function travel(db) {const {run}=game();run(`startGame();setMeasuredDb(${db});for(let i=0;i<20;i++)updateGame(50);`);return run('getSceneWorldScrollRatio()');}
  assert.ok(travel(80)>travel(30));
  const {run}=game();run('startGame();setMeasuredDb(70);for(let i=0;i<20;i++)updateGame(50);setMeasuredDb(0);for(let i=0;i<40;i++)updateGame(50);');
  assert.ok(run('state.sceneScrollVelocity')<.001);
});

test('Moon transition begins at the actual camera and retains its final position', () => {
  const {run}=game();
  run('state.sceneScroll=8;state.progress=1;beginHoldChallenge();');
  assert.ok(Math.abs(run('getSceneWorldScrollRatio()')-8)<.01);
  run('state.holdStartedAt=Date.now()-2100;advanceWorldScroll(50);');
  assert.equal(run('getSceneWorldScrollRatio()'),10);
  run('beginLanding();');
  assert.equal(run('getSceneWorldScrollRatio()'),10);
});

test('result fuel used is captured once and does not change after upgrades', () => {
  const {run} = game();
  run('state.fuelCapacity=30;startGame();state.fuelRemaining=5;settleRun();state.phase="failed";state.coins=999;applyUpgrade("fuel");');
  assert.equal(run('state.fuelCapacity'),33);
  assert.equal(run('state.lastFuelUsed'),25);
  assert.equal(run('state.runFuelCapacity'),30);
});


test('distance ruler, personal and community heights share the visible rocket nose', () => {
  const {run}=game();
  run(`const originalQuery=root.querySelector.bind(root);
    const sky={clientHeight:800,getBoundingClientRect:()=>({top:40,height:800})};
    const rocket={getBoundingClientRect:()=>({top:300,height:126})};
    root.querySelector=selector=>selector==='.sky'?sky:selector==='.rocket-art'?rocket:originalQuery(selector);
    state.distanceKm=5000;`);
  const tip=(300+126*3/256-40)/800;
  assert.equal(run('flightAnchorY()'),tip);
  assert.equal(run('flightMarkerY(5000)'),tip);
  const tick=JSON.parse(run('JSON.stringify(distanceRulerTicks().find(t=>t.distance===5000))'));
  assert.ok(Math.abs(run('distanceRulerLayout().top')+tick.y-tip*800)<1e-9);
  run('state.activeTry=1;state.tryCount=1;settleRun();');
  assert.equal(run('bestFlight().distance'),5000);
  assert.equal(run('state.lastEarnedCoins'),50);
});

test('minimap Best dot meets the miniature nose at launch, midflight and Moon', () => {
  const {run,map}=game();
  for(const progress of [0,.01,.5,1]) {
    const position=JSON.parse(run(`JSON.stringify(minimapPosition(${progress}))`));
    const cssPixels=value=>{const [,percent,sign,px]=value.match(/calc\(([-.\d]+)% ([+-]) ([-.\d]+)px\)/);return Number(percent)/100*300+(sign==='+'?1:-1)*Number(px);};
    assert.ok(Math.abs(cssPixels(position.tipBottom)-cssPixels(position.rocketBottom)-24*(1-1/64))<1e-9);
    run(`state.flightHistory=[{try:1,distance:TOTAL_DISTANCE_KM*${progress}}];renderFlightMarkers();`);
    assert.ok(map.innerHTML.includes(position.tipBottom));
    assert.doesNotMatch(map.innerHTML,/Last|<span>L<\/span>/);
  }
});
