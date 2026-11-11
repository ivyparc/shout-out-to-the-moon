const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('server/schema.sql','utf8'));
  function prepare(sql, values=[]) {
    const statement = () => db.prepare(sql);
    return { bind(...args) { return prepare(sql,args); },
      async first() { return statement().get(...values) || null; },
      async all() { return { results: statement().all(...values) }; },
      async run() { return this.sync(); },
      sync() { const r=statement().run(...values); return { success:true, results:[], meta:{ changes:Number(r.changes) } }; },
    };
  }
  return { db, prepare, async batch(statements) { db.exec('BEGIN'); try { const results=statements.map(s=>s.sync()); db.exec('COMMIT'); return results; } catch(e) { db.exec('ROLLBACK'); throw e; } } };
}
async function server() {
  const { createMoonService } = await import('../server/moon-service.mjs');
  const database=d1();
  let now=Date.parse('2026-10-22T12:00:00Z');
  const admin='a'.repeat(64);
  const service=createMoonService(database,{adminSecret:admin,now:()=>new Date(now)});
  async function request(action, body={}, token, method='POST') {
    const params={namespace:'shout-out-to-the-moon',scope:'default',...body,...(action?{action}:{})};
    const url=new URL('https://moon.example/api/leaderboard');
    if(method==='GET') Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    const response=await service.handle(new Request(url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(method==='GET'?{}:{body:JSON.stringify(params)})}));
    return { status:response.status,...await response.json() };
  }
  const id=await request('identity');
  const api=(action,body={},method='POST')=>request(action,body,id.token,method);
  const approve=async(save, playerId=id.playerId)=>request('admin_migration',{playerId,save,reason:'Verified test save'},admin);
  return { ...database,service,api,request,id,approve,advance:ms=>{now+=ms;},setDate:date=>{now=Date.parse(date);} };
}
function flight(stats, { complete=true, db=75 }={}) {
  let now=100000;
  const frames=[];
  const root={addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},style:{setProperty(){}}};
  class Clock extends Date { static now(){return now;} }
  const context=vm.createContext({ Date:Clock,navigator:{language:'en'},document:{getElementById:()=>root},window:{SHOUT_MOON_NATIVE_AUDIO:true,innerWidth:390,innerHeight:844,addEventListener(){},setInterval(){},setTimeout(){},clearTimeout(){},localStorage:{getItem(){return null;},setItem(){}}},frames });
  const source=readFileSync('src/web/main.js','utf8');
  vm.runInContext(source.slice(0,source.lastIndexOf('\nloadEconomy();')),context);
  const run=s=>vm.runInContext(s,context);
  run(`leaderboard={view:{online:false},record:e=>frames.push(e),landed(){},invalidate(){}}; state.speedMultiplier=${stats.speed}; state.fuelCapacity=${stats.fuel}; state.moneyMultiplier=${stats.money}; startGame();`);
  for(let i=0;i<20000;i++) {
    now+=50;
    const phase=run('state.phase');
    if(phase==='flying')run(`setMeasuredDb(${db})`);
    if(phase==='holdPrompt')run('setMeasuredDb(55)');
    if(phase==='clapPrompt'&&complete)run('registerClap(90)');
    run('updateGame(50)');
    if(['landed','failed'].includes(run('state.phase')))return {frames:JSON.parse(JSON.stringify(frames)),duration:now-100000,earned:run('state.lastEarnedCoins'),phase:run('state.phase')};
  }
  throw new Error('Flight did not end');
}
async function finish(s,stats,options) {
  const start=await s.api('start',{input:{rulesVersion:2,loadout:stats}}); assert.equal(start.status,200,JSON.stringify(start));
  const trace=flight(stats,options); s.advance(trace.duration);
  if (['landed','failed'].includes(trace.phase)) {
    assert.equal((await s.api('arrival',{runId:start.runId,elapsedMs:1})).status,200);
    s.advance(options?.uploadDelay || 0);
    assert.equal((await s.api('arrival',{runId:start.runId})).status,200);
  }
  let sequence=0;
  for(let i=0;i<trace.frames.length;i+=200) {
    const result=await s.api('event',{runId:start.runId,event:{type:'frames',sequence:sequence++,frames:trace.frames.slice(i,i+200)}});
    assert.equal(result.status,200,JSON.stringify(result));
  }
  const end=await s.api('event',{runId:start.runId,event:{type:'finish'}});
  assert.equal(end.status,200,JSON.stringify(end));
  return {runId:start.runId,trace,end};
}

test('distance minus time ranks all flights; personal best and legacy records remain intact',async()=>{
  const s=await server(), stats={speed:300,fuel:40,money:1.5};
  const approval=await s.approve({...stats,coins:0}); await s.api('migrate',{code:approval.code});
  s.db.prepare('insert into moon_scores(player,period,score,achieved_at) values(?,?,?,?)').run(s.id.playerId,'2026-10',999999,Date.parse('2026-10-22'));
  const first=await finish(s,stats); const board=await s.api(null,{},'GET');
  assert.equal(board.currentPlayer.score,384399-first.trace.duration/1000);
  const achieved=board.currentPlayer.updatedAt;
  await finish(s,stats);
  assert.equal((await s.api(null,{},'GET')).currentPlayer.updatedAt,achieved);
  const slower=await finish(s,stats,{db:65});
  assert.ok(slower.trace.duration>first.trace.duration);
  assert.equal((await s.api(null,{},'GET')).currentPlayer.score,board.currentPlayer.score);
  assert.equal((await s.api('upgrade',{type:'speed',expected:300})).status,200);
  const faster=await finish(s,{...stats,speed:420});
  assert.ok(faster.trace.duration<first.trace.duration);
  assert.equal((await s.api(null,{},'GET')).currentPlayer.score,384399-faster.trace.duration/1000);
  assert.equal(s.db.prepare('select score from moon_scores').get().score,999999);
});

test('premature arrival, forged timestamps and cross-player arrival cannot create a ranking',async()=>{
  const s=await server(),stats={speed:300,fuel:40,money:1.5};
  const approval=await s.approve({...stats,coins:0}); await s.api('migrate',{code:approval.code});
  const start=await s.api('start',{input:{rulesVersion:2,loadout:stats}});
  const other=await s.request('identity');
  assert.equal((await s.request('arrival',{runId:start.runId},other.token)).status,404);
  await s.api('arrival',{runId:start.runId,elapsedMs:1,arrivedAt:'2099-01-01'});
  const recorded=s.db.prepare('select arrival_at from moon_runs where id=?').get(start.runId).arrival_at;
  const trace=flight(stats); s.advance(trace.duration);
  await s.api('arrival',{runId:start.runId});
  assert.equal(s.db.prepare('select arrival_at from moon_runs where id=?').get(start.runId).arrival_at,recorded);
  let rejected=false;
  for(let i=0;i<trace.frames.length;i+=200) {
    const result=await s.api('event',{runId:start.runId,event:{type:'frames',sequence:i/200,frames:trace.frames.slice(i,i+200)}});
    if(result.status!==200) { rejected=true; break; }
  }
  assert.equal(rejected,true);
  assert.equal((await s.api('event',{runId:start.runId,event:{type:'finish'}})).status,400);
  assert.equal((await s.api('submit',{runId:start.runId,score:1})).status,400);
  assert.equal((await s.api('profile')).profile.coins,0);
});

test('pending coin-era completions settle without blocking the outbox or becoming time scores',async()=>{
  const s=await server(),runId=crypto.randomUUID(),at=Date.parse('2026-10-22T11:00:00Z');
  s.db.prepare('insert into moon_runs(id,player,state,started_at,finished_at,landed,score,settled) values(?,?,?,?,?,1,292,1)').run(runId,s.id.playerId,'{}',at-20000,at);
  const result=await s.api('submit',{runId});
  assert.equal(result.status,200); assert.equal(result.legacyRecord,true);
  assert.equal((await s.api('submit',{runId})).legacyRecord,true);
  assert.equal((await s.api(null,{},'GET')).entries.length,0);
  assert.equal(s.db.prepare('select score from moon_runs where id=?').get(runId).score,292);
});

test('API rejects foreign origins, injection, oversized bodies, bad content types and identity floods',async()=>{
  const s=await server();
  const url='https://moon.example/api/leaderboard';
  const send=(body,headers={})=>s.service.handle(new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body}));
  assert.equal((await send('{}',{origin:'https://evil.example'})).status,403);
  assert.equal((await send('x'.repeat(65537))).status,413);
  assert.equal((await send('{}',{'content-type':'text/plain'})).status,415);
  assert.equal((await send('{')).status,400);
  assert.equal((await s.api(null,{playerName:"<script>alert(1)</script>"},'PATCH')).status,400);
  assert.equal((await s.api('upgrade',{type:"coins=999999--",expected:10})).status,400);
  assert.equal((await s.request('profile',{},'b'.repeat(64))).status,401);
  for(let i=0;i<29;i++) assert.equal((await s.request('identity')).status,200);
  assert.equal((await s.request('identity')).status,429);
  const response=await s.service.handle(new Request(url+'?namespace=shout-out-to-the-moon&action=capabilities'));
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});

test('one API rejects unauthenticated writes and does not register names/scores on reads',async()=>{
  const s=await server();
  assert.equal((await s.request('submit',{score:999999})).status,401);
  assert.equal((await s.api('submit',{score:999999})).status,400);
  assert.equal((await s.api('profile',{playerId:'another-player'})).status,403);
  assert.equal((await s.api(null,{},'GET')).entries.length,0);
  assert.equal((await s.api('leaderboard_name')).registered,false);
  assert.equal(s.db.prepare('select name from moon_players where id=?').get(s.id.playerId).name,null);
  const caps=await s.request('capabilities',{},undefined,'GET');
  assert.equal(caps.singleServer,true); assert.equal(caps.authoritativeProgression,true);
  assert.notEqual(s.db.prepare('select token_hash from moon_players').get().token_hash,s.id.token);
});

test('reviewed migration is target-bound, one-time, and never creates a historical score',async()=>{
  const s=await server(),save={speed:30,fuel:40,money:1.5,coins:500};
  assert.equal((await s.api('admin_migration',{playerId:s.id.playerId,save,reason:'testing'})).status,401);
  const approval=await s.approve(save); assert.equal(approval.status,200);
  const other=await s.request('identity');
  assert.equal((await s.request('migrate',{code:approval.code},other.token)).status,400);
  const results=await Promise.all([s.api('migrate',{code:approval.code}),s.api('migrate',{code:approval.code})]);
  assert.ok(results.some(r=>r.status===200));
  assert.equal((await s.api('profile')).profile.coins,500);
  assert.equal((await s.api('migrate',{code:approval.code})).profile.coins,500);
  assert.equal((await s.api(null,{},'GET')).entries.length,0);
  assert.equal(s.db.prepare('select count(*) as n from moon_migrations where redeemed_at is not null').get().n,1);
});

test('failed flight earns server-calculated coins once; upgrade retries cannot charge twice',async()=>{
  const s=await server();
  const f=await finish(s,{speed:10,fuel:10,money:1});
  assert.equal(f.trace.phase,'failed'); assert.equal(f.end.failed,true);
  assert.equal(f.end.profile.coins,f.trace.earned);
  await s.api('event',{runId:f.runId,event:{type:'finish'}});
  assert.equal((await s.api('profile')).profile.coins,f.trace.earned);
  assert.equal((await s.api('submit',{runId:f.runId})).status,200);
  assert.equal((await s.api(null,{},'GET')).currentPlayer.score,7500-10);
  const attempts=await Promise.all([s.api('upgrade',{type:'speed',expected:10}),s.api('upgrade',{type:'speed',expected:10})]);
  assert.equal(attempts.filter(r=>r.status===200).length,1);
  const p=(await s.api('profile')).profile; assert.equal(p.speed,14); assert.equal(p.coins,f.trace.earned-50);
});

test('Moon ranking uses server arrival time; retries do not duplicate rewards or change time',async()=>{
  const s=await server(),stats={speed:300,fuel:40,money:1.5};
  const code=await s.approve({...stats,coins:500}); await s.api('migrate',{code:code.code});
  const f=await finish(s,stats,{uploadDelay:60000});
  assert.equal(f.trace.phase,'landed'); assert.equal(f.end.score,f.trace.duration);
  const submitted=await s.api('submit',{runId:f.runId,score:999999}); assert.equal(submitted.status,200);
  await s.api('submit',{runId:f.runId});
  assert.equal((await s.api('profile')).profile.coins,6265);
  const board=await s.api(null,{},'GET'); assert.equal(board.entries.length,1); assert.equal(board.entries[0].score,384399-f.trace.duration/1000); assert.equal(board.currentPlayer.rank,1);
  assert.equal(board.metric,'distance_minus_seconds'); assert.equal(board.order,'desc');
  const second=await finish(s,stats); await s.api('submit',{runId:second.runId});
  assert.equal((await s.api(null,{},'GET')).entries.length,1);
});

test('server owns upgrades, active flight and identity; falsified starts and cross-player runs fail',async()=>{
  const s=await server();
  assert.equal((await s.api('start',{input:{loadout:{speed:1000,fuel:600,money:100}}})).status,409);
  const run=await s.api('start',{input:{loadout:{speed:10,fuel:10,money:1}}});
  assert.equal((await s.api('start',{input:{loadout:{speed:10,fuel:10,money:1}}})).status,409);
  assert.equal((await s.api('upgrade',{type:'speed',expected:10})).status,409);
  const other=await s.request('identity');
  assert.equal((await s.request('event',{runId:run.runId,event:{type:'finish'}},other.token)).status,404);
  assert.equal((await s.api('event',{runId:run.runId,event:{type:'finish'}})).status,400);
  await s.api('abandon',{runId:run.runId});
  assert.equal((await s.api('event',{runId:run.runId,event:{type:'frames',sequence:0,frames:[{type:'tick',delta:50,db:75}]}})).status,409);
});

test('names are unique without case, release immediately, and enforce monthly quota',async()=>{
  const s=await server();
  assert.equal((await s.api(null,{playerName:'MoonRabbit'},'PATCH')).status,200);
  const other=await s.request('identity');
  assert.equal((await s.request(null,{playerName:'moonrabbit'},other.token,'PATCH')).status,409);
  assert.equal((await s.api(null,{playerName:'MoonFox'},'PATCH')).status,200);
  assert.equal((await s.request(null,{playerName:'MoonRabbit'},other.token,'PATCH')).status,200);
  await s.api(null,{playerName:'MoonBear'},'PATCH');
  assert.equal((await s.api(null,{playerName:'MoonWolf'},'PATCH')).status,429);
  assert.equal((await s.api(null,{playerName:'MoonBear'},'PATCH')).status,200);
  s.setDate('2026-11-02T12:00:00Z');
  assert.equal((await s.api(null,{playerName:'MoonWolf'},'PATCH')).status,200);
});

test('upgrade recovers a flight left behind by reload without losing coins', async () => {
  const s = await server();
  const approved = await s.approve({ speed: 11, fuel: 10, money: 1, coins: 158 });
  await s.api('migrate', { code: approved.code });
  const interrupted = await s.api('start', { input: { loadout: { speed: 11, fuel: 10, money: 1 } } });
  assert.equal(interrupted.status, 200);
  assert.equal((await s.api('upgrade', { type: 'speed', expected: 11 })).status, 409);
  const actions = [];
  const storage = new Map();
  const window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, fetch: async (url, init) => {
    const body = JSON.parse(init.body);
    actions.push(body.action);
    const result = body.action === 'identity' ? s.id : await s.api(body.action, body);
    return { ok: result.status < 400, status: result.status, json: async () => result };
  } };
  const context = vm.createContext({ window, URL, AbortController, setTimeout, clearTimeout });
  vm.runInContext(readFileSync('src/web/leaderboard.js', 'utf8'), context);
  const api = window.createMoonLeaderboard({ endpoint: 'https://moon.example/api/leaderboard', namespace: 'shout-out-to-the-moon', scope: 'default' });
  assert.equal(await api.connect('new'), true, api.view.error);
  assert.equal(api.view.activeRunId, interrupted.runId);
  assert.equal(await api.upgrade('speed'), true, api.view.error);
  assert.equal(api.view.profile.speed, 16);
  assert.equal(api.view.profile.coins, 103);
  assert.equal(api.view.activeRunId, null);
  assert.deepEqual(actions.slice(-2), ['abandon', 'upgrade']);
  assert.equal((await s.api('profile')).activeRunId, null);
  // A real flight in this tab must still block purchases, with no abandonment.
  await api.begin({ loadout: { speed: 16, fuel: 10, money: 1 } });
  const count = actions.filter(action => action === 'abandon').length;
  assert.equal(await api.upgrade('fuel'), false);
  assert.equal(actions.filter(action => action === 'abandon').length, count);
  assert.equal(api.view.profile.coins, 103);
});

test('real game + client + secure API submits landing and preserves the original device save',async()=>{
  const s=await server();
  const storage=new Map([['stats.speed','30'],['stats.fuel','40'],['stats.money','1.5'],['stats.coins','500']]);
  const root={addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},style:{setProperty(){}}};
  let clock=100000;
  class Clock extends Date { static now(){return clock;} }
  const fetch=async(url,init)=>{
    const body=init.method==='GET'?Object.fromEntries(new URL(url).searchParams):JSON.parse(init.body);
    const result=await s.request(body.action,body,init.headers.Authorization?.replace('Bearer ',''),init.method);
    return {ok:result.status<400,status:result.status,json:async()=>result};
  };
  const window={SHOUT_MOON_NATIVE_AUDIO:true,innerWidth:390,innerHeight:844,addEventListener(){},setInterval(){},setTimeout(){},clearTimeout(){},fetch,
    SHOUT_MOON_LEADERBOARD:{endpoint:'https://moon.example/api/leaderboard',namespace:'shout-out-to-the-moon',scope:'default'},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
  const context=vm.createContext({Date:Clock,window,URL,AbortController,setTimeout,clearTimeout,navigator:{language:'en'},document:{getElementById:()=>root}});
  vm.runInContext(readFileSync('src/web/leaderboard.js','utf8'),context);
  const source=readFileSync('src/web/main.js','utf8');
  vm.runInContext(source.slice(0,source.lastIndexOf('\nloadEconomy();')),context);
  const run=code=>vm.runInContext(code,context);
  run('loadEconomy();');
  await run('leaderboard.connect()');
  const target=run('leaderboard.view.playerId');
  const approved=await s.approve({speed:300,fuel:40,money:1.5,coins:500},target);
  assert.equal(await run(`leaderboard.connect('migrate',${JSON.stringify(approved.code)})`),true);
  await run('startGame()');
  assert.equal(run('state.phase'),'flying');
  for(let i=0;i<1500;i++) {
    clock+=50;s.advance(50);
    const phase=run('state.phase');
    if(phase==='flying')run('setMeasuredDb(75)');
    if(phase==='holdPrompt')run('setMeasuredDb(55)');
    if(phase==='clapPrompt')run('registerClap(90)');
    run('updateGame(50)');
    if(run('state.phase')==='landed')break;
  }
  await new Promise(resolve=>setImmediate(resolve));
  await run('leaderboard.retry()');
  assert.equal(run('leaderboard.view.status'),'submitted',run('leaderboard.view.error'));
  assert.equal(run('state.coins'),6265);
  assert.equal(run('state.tryCount'),1);
  assert.equal(run('leaderboard.view.snapshot.currentPlayer.score'),384399-(clock-100000)/1000);
  assert.equal(storage.get('stats.coins'),'500');
  run('leaderboard.disconnect(); loadEconomy();');
  assert.equal(run('state.coins'),500);
});

test('weekly best heights exclude self and Moon arrivals; new week resets visible records, not history', async () => {
  const s = await server();
  await finish(s, {speed:10,fuel:10,money:1});
  const name = (await s.api('profile')).playerName;
  assert.match(name, /^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  assert.equal(s.db.prepare('select rename_count from moon_players where id=?').get(s.id.playerId).rename_count, 0);
  const other = await s.request('identity');
  let board = await s.request(null, {}, other.token, 'GET');
  assert.equal(board.markers.length, 1);
  assert.equal(board.markers[0].name, name);
  assert.ok(Math.abs(board.markers[0].distance-7500)<1e-6);
  assert.equal(board.moonFinishers, 0);
  assert.equal((await s.api(null, {}, 'GET')).markers.length, 0);
  // A second verified flight replaces this player's weekly marker, not a new person.
  await finish(s, {speed:10,fuel:10,money:1}, {db:80});
  board = await s.request(null, {}, other.token, 'GET');
  assert.equal(board.markers.length, 1); assert.ok(Math.abs(board.markers[0].distance-8000)<1e-6);
  // A landing moves the player from the height list into Moon arrivals.
  s.db.prepare('update moon_players set speed=300,fuel=40 where id=?').run(s.id.playerId);
  await finish(s, {speed:300,fuel:40,money:1});
  board = await s.request(null, {}, other.token, 'GET');
  assert.equal(board.markers.length, 0); assert.equal(board.moonFinishers, 1);
  s.setDate('2026-10-26T03:59:59Z'); // Sunday 23:59 Toronto.
  assert.equal((await s.api(null, {}, 'GET')).entries.length, 1);
  s.setDate('2026-10-26T04:00:00Z'); // Monday local midnight.
  board = await s.request(null, {}, other.token, 'GET');
  assert.equal(board.entries.length, 0); assert.equal(board.markers.length, 0); assert.equal(board.moonFinishers, 0);
  assert.equal((await s.api(null, {period:'all'}, 'GET')).entries.length, 1);
  assert.equal(s.db.prepare('select count(*) as n from moon_flight_scores').get().n, 3);
});

test('failed-flight ranks prefer more distance, subtract verified elapsed seconds and ignore client scores', async () => {
  const s = await server();
  const first = await finish(s, {speed:10,fuel:10,money:1}, {db:55,uploadDelay:60000});
  assert.equal(first.end.score, 10000);
  const forged = await s.api('submit', {runId:first.runId,score:999999999,distance:384399,time:0});
  assert.equal(forged.score, 5490);
  const second = await finish(s, {speed:10,fuel:10,money:1}, {db:60});
  assert.equal((await s.api(null, {}, 'GET')).currentPlayer.score, 5990);
  await s.api('submit', {runId:second.runId});
  assert.equal(s.db.prepare('select count(*) as n from moon_flight_scores').get().n, 2);
});
