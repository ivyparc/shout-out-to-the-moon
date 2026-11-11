import { moonValidator } from './moon-validator.mjs';

const APP = 'shout-out-to-the-moon';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
const dateParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
const day = date => { const p = dateParts(date); return `${p.year}-${p.month}-${p.day}`; };
const month = date => day(date).slice(0, 7);
const profile = p => ({ speed: p.speed, fuel: p.fuel, money: p.money / 10, coins: p.coins, tries: p.tries, migrated: !!p.migrated });
const cost = (type, value) => Math.max(50, Math.round(50 * (value / 10) ** (type === 'speed' ? 1.3 : type === 'fuel' ? 1 : 1.5) / 5) * 5);
const nextValue = (type, value) => type === 'speed' ? Math.min(10000, Math.ceil(value * 1.4)) : type === 'fuel' ? Math.min(600, value + 3) : Math.min(100000, value + 1);
const week = date => { const d = new Date(day(date) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
const statsValid = p => p && ['speed','fuel','coins'].every(k => Number.isSafeInteger(p[k])) && p.speed >= 10 && p.speed <= 10000 && p.fuel >= 10 && p.fuel <= 600 && p.coins >= 0 && p.coins <= 100000000 && Number.isFinite(p.money) && p.money >= 1 && p.money <= 10000 && Math.abs(p.money * 10 - Math.round(p.money * 10)) < 1e-8;

// One API in the existing game Worker. D1 is its private storage binding;
// clients have no database credentials or direct table access.
export function createMoonService(database, { adminSecret = '', now = () => new Date() } = {}) {
  const db = database.withSession ? database.withSession('first-primary') : database;
  const stmt = (sql, ...args) => db.prepare(sql).bind(...args);
  const one = (sql, ...args) => stmt(sql, ...args).first();
  const all = async (sql, ...args) => (await stmt(sql, ...args).all()).results;
  const player = id => one('select * from moon_players where id=?', id);
  const rankPeriod = async () => week(now());
  async function limit(key, maximum, seconds = 60) {
    const bucket = `${key}:${Math.floor(now().getTime() / (seconds * 1000))}`;
    const result = await one('insert into moon_limits(key,count,expires) values(?,1,?) on conflict(key) do update set count=count+1 returning count', bucket, now().getTime() + seconds * 2000);
    if (result.count > maximum) fail(429, 'Too many requests. Try again later.');
    // Only ephemeral rate counters expire; scores and progression never do.
    await stmt('delete from moon_limits where expires<?', now().getTime()).run();
  }
  async function authenticate(token) {
    if (!/^[a-f0-9]{64}$/.test(token)) fail(401, 'Player authentication required.');
    const p = await one('select * from moon_players where token_hash=?', await hash(token));
    if (!p) fail(401, 'Player authentication required.');
    return p;
  }
  async function rename(p, value, automatic = false) {
    const name = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
    if (!/^[\p{L}\p{N}_ -]{2,24}$/u.test(name)) fail(400, 'Use 2–24 letters, numbers, spaces, underscores or hyphens.');
    const quota = month(now());
    try {
      const row = await one(`update moon_players set name=?,name_key=?,rename_count=case when ?=1 or name=? then rename_count when rename_month=? then rename_count+1 else 1 end,rename_month=? where id=? and (?=1 or name=? or rename_month<>? or rename_count<3) returning name`, name, name.toLocaleLowerCase('en-US'), automatic ? 1 : 0, name, quota, quota, p.id, automatic ? 1 : 0, name, quota);
      if (!row) fail(429, 'Three name changes per Toronto month are allowed.');
      return row.name;
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) fail(409, 'That name is already in use.');
      throw error;
    }
  }
  async function ensureName(p) {
    if (p.name) return p.name;
    // Subway convention: adjective + noun + two-digit random suffix.
    const adjectives = ['Amber','Aqua','Azure','Blue','Coral','Gold','Green','Jade','Lilac','Mint','Pink','Ruby','Silver','Sunny','Brave','Calm','Lucky','Swift','Lunar','Stellar'];
    const nouns = ['Fox','Owl','Panda','Tiger','Whale','Rabbit','Ivy','Maple','Comet','Moon','Nova','Orbit','Star','Cloud','Flame','Rocket','Spark','River','Clover','Cosmos'];
    for (let attempt = 0; attempt < 50; attempt++) {
      const r = crypto.getRandomValues(new Uint32Array(3));
      const name = adjectives[r[0] % adjectives.length] + nouns[r[1] % nouns.length] + String(r[2] % 100).padStart(2, '0');
      try { return await rename(p, name, true); } catch (error) { if (error.status !== 409) throw error; }
    }
    fail(503, 'Could not assign a name. Please retry.');
  }
  async function snapshot(p, selected = 'active') {
    if (!['active','all'].includes(selected) && !/^\d{4}-\d{2}-\d{2}$/.test(selected)) fail(400, 'Invalid period.');
    const activePeriod = await rankPeriod();
    const period = selected === 'active' ? activePeriod : selected;
    const rows = await all(`with best as (select s.*,p.name,row_number() over(partition by s.player order by score desc,achieved_at asc) as pick from moon_flight_scores s join moon_players p on p.id=s.player where (?='all' or s.period=?)), ranked as (select *,row_number() over(order by score desc,achieved_at asc,player asc) as rank from best where pick=1) select * from ranked where rank<=100 or player=? order by rank`, period, period, p.id);
    const map = r => ({ rank: r.rank, name: r.name, score: r.score, distance: r.distance, elapsedMs: r.elapsed_ms, landed: !!r.landed, updatedAt: new Date(r.achieved_at).toISOString(), isToday: day(new Date(r.achieved_at)) === day(now()) });
    const heights = await all(`with best as (select s.*,p.name,row_number() over(partition by s.player order by distance desc,landed desc,achieved_at asc) as pick from moon_flight_scores s join moon_players p on p.id=s.player where period=?) select name,distance,landed,achieved_at from best where pick=1 and player<>? order by distance desc`, activePeriod, p.id);
    return { entries: rows.filter(r => r.rank <= 100).map(map), currentPlayer: rows.find(r => r.player === p.id) ? map(rows.find(r => r.player === p.id)) : null,
      markers: heights.filter(r => !r.landed), moonFinishers: (await one('select count(distinct player) as total from moon_flight_scores where period=? and landed=1', activePeriod)).total,
      metric: 'distance_minus_seconds', order: 'desc', activePeriod, period, periods: (await all('select distinct period from moon_flight_scores order by period desc')).map(r => r.period) };
  }
  async function start(p, input) {
    await limit(`start:${p.id}`, 120, 3600);
    const stats = profile(p);
    const validator = moonValidator({ resolveLoadout: async () => stats, allowFailures: true });
    const initial = await validator.start({ input, now: now() });
    const id = crypto.randomUUID();
    const result = await db.batch([
      stmt('update moon_players set active_run=?,tries=tries+1 where id=? and active_run is null and speed=? and fuel=? and money=?', id, p.id, p.speed, p.fuel, p.money),
      stmt('insert into moon_runs(id,player,state,started_at,version,settled,consumed) select ?,id,?,?,0,0,0 from moon_players where id=? and active_run=?', id, JSON.stringify(initial.state), now().getTime(), p.id, id),
    ]);
    if (!result[0].meta.changes) fail(409, 'Finish or abandon your active flight before launching.');
    return { runId: id, challenge: initial.challenge, profile: profile(await player(p.id)) };
  }
  async function gameEvent(p, runId, event) {
    const r = await one('select * from moon_runs where id=? and player=?', runId, p.id);
    if (!r) fail(404, 'Flight not found.');
    if (r.finished_at) { await saveFlightScore(p, runId); return { complete: r.landed === 1, failed: r.landed !== 1, score: r.elapsed_ms, profile: profile(await player(p.id)) }; }
    if (p.active_run !== runId) fail(409, 'This flight is no longer active.');
    if (now().getTime() - r.started_at > 86400000) fail(410, 'Flight expired. Abandon it before launching again.');
    const s = JSON.parse(r.state);
    const validator = moonValidator({ resolveLoadout: async () => s.stats, allowFailures: true });
    // Arrival freezes the server clock before replay uploads. Retries cannot
    // improve or worsen that time. Old clients use their first finish request.
    const result = validator.event({ state: s, event, now: r.arrival_at === null ? now() : new Date(r.arrival_at) });
    const terminal = event.type === 'finish' && (result.complete || result.failed);
    const earned = result.earned || 0;
    const updated = await db.batch([
      stmt('update moon_runs set state=?,version=version+1,finished_at=?,landed=?,score=?,elapsed_ms=? where id=? and player=? and version=? and finished_at is null', JSON.stringify(result.state), terminal ? (r.arrival_at ?? now().getTime()) : null, result.complete ? 1 : 0, terminal ? earned : null, terminal ? result.score : null, runId, p.id, r.version),
      stmt('update moon_players set coins=coins+?,active_run=null where id=? and active_run=? and exists(select 1 from moon_runs where id=? and version=? and settled=0 and finished_at is not null)', earned, p.id, runId, runId, r.version + 1),
      stmt('update moon_runs set settled=1 where id=? and version=? and finished_at is not null', runId, r.version + 1),
    ]);
    if (!updated[0].meta.changes) fail(409, 'Flight changed. Retry the same event.');
    if (terminal && s.totalDistance === 384399) await saveFlightScore(p, runId);
    return { complete: !!result.complete, failed: !!result.failed, score: result.score, profile: profile(await player(p.id)) };
  }
  async function saveFlightScore(p, runId) {
    const run = await one('select * from moon_runs where id=? and player=?', runId, p.id);
    if (!run?.finished_at) fail(400, 'A server-verified completed game is required.');
    const state = JSON.parse(run.state);
    if (state.totalDistance !== 384399) return { legacyRecord: true, profile: profile(await player(p.id)) };
    const name = await ensureName(await player(p.id));
    const distance = Math.min(384399, Math.max(0, state.distance));
    const elapsed = run.elapsed_ms;
    if (!Number.isFinite(elapsed) || elapsed < state.elapsed - 2000 || elapsed < 0) fail(409, 'Invalid verified flight time.');
    const score = Math.round((distance - elapsed / 1000) * 1000) / 1000;
    await stmt('insert into moon_flight_scores(run_id,player,period,score,distance,elapsed_ms,landed,achieved_at) values(?,?,?,?,?,?,?,?) on conflict(run_id) do nothing', run.id, p.id, week(new Date(run.finished_at)), score, distance, elapsed, run.landed, run.finished_at).run();
    await stmt('update moon_runs set consumed=1 where id=? and player=?', runId, p.id).run();
    return { playerName: name, profile: profile(await player(p.id)), score };
  }
  async function submit(p, runId) { return saveFlightScore(p, runId); }
  async function arrival(p, runId) {
    const r = await one('select * from moon_runs where id=? and player=?', runId, p.id);
    if (!r) fail(404, 'Flight not found.');
    if (r.finished_at) return { received: true };
    if (p.active_run !== runId) fail(409, 'This flight is no longer active.');
    if (now().getTime() - r.started_at > 86400000) fail(410, 'Flight expired.');
    // No client timestamp is accepted. This receipt alone never awards anything.
    await stmt('update moon_runs set arrival_at=coalesce(arrival_at,?) where id=? and player=? and finished_at is null', now().getTime(), runId, p.id).run();
    return { received: true };
  }
  async function migrate(p, code) {
    if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) fail(400, 'Invalid migration code.');
    const h = await hash(code);
    const m = await one('select * from moon_migrations where code_hash=? and player=?', h, p.id);
    if (!m || m.expires_at < now().getTime()) fail(400, 'Migration code is invalid or expired.');
    if (m.redeemed_at) {
      if (p.migrated) return { profile: profile(p), replayed: true };
      fail(409, 'Migration code was already used.');
    }
    const save = JSON.parse(m.save);
    const result = await db.batch([
      stmt('update moon_players set speed=?,fuel=?,money=?,coins=?,migrated=1 where id=? and migrated=0 and tries=0 and active_run is null and exists(select 1 from moon_migrations where code_hash=? and redeemed_at is null and expires_at>=?)', save.speed, save.fuel, Math.round(save.money * 10), save.coins, p.id, h, now().getTime()),
      stmt('update moon_migrations set redeemed_at=? where code_hash=? and redeemed_at is null and exists(select 1 from moon_players where id=? and migrated=1)', now().getTime(), h, p.id),
    ]);
    if (!result[0].meta.changes) fail(409, 'Migration requires an unused online profile.');
    return { profile: profile(await player(p.id)) };
  }
  async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    // Native WebViews may have an opaque Origin. Authorization remains mandatory.
    if (origin && origin !== 'null' && origin !== url.origin) return Response.json({ error: 'Origin not allowed.' }, { status: 403 });
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type' } });
    try {
      if (!['GET','POST','PATCH'].includes(request.method)) fail(405, 'Method not allowed.');
      let input;
      if (request.method === 'GET') input = Object.fromEntries(url.searchParams);
      else {
        if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'JSON required.');
        // Bound the streamed request, including chunked uploads without length.
        const reader = request.body?.getReader(); let text = ''; let bytes = 0;
        const decoder = new TextDecoder();
        if (reader) for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 65536) { await reader.cancel(); fail(413, 'Request too large.'); } text += decoder.decode(value, { stream: true }); }
        text += decoder.decode();
        try { input = JSON.parse(text || '{}'); } catch { fail(400, 'Invalid JSON.'); }
      }
      if (input?.namespace !== APP || (input.scope || 'default') !== 'default') fail(404, 'Unknown leaderboard.');
      const action = input.action;
      let result;
      if (action === 'capabilities' && request.method === 'GET') result = { protocol: 2, singleServer: true, metric: 'distance_minus_seconds', order: 'desc', clock: 'server', timeZone: 'America/Toronto', automaticDeletion: false, legacyNameTransferEnabled: false, authoritativeProgression: true };
      else if (action === 'identity' && request.method === 'POST') {
        await limit(`identity:${await hash(request.headers.get('cf-connecting-ip') || 'unknown')}`, 30, 3600);
        const token = secret(), id = crypto.randomUUID();
        await stmt('insert into moon_players(id,token_hash,created_at) values(?,?,?)', id, await hash(token), now().getTime()).run();
        result = { playerId: id, token };
      } else {
        const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
        if (action === 'admin_migration' && request.method === 'POST') {
          if (adminSecret.length < 32 || await hash(token) !== await hash(adminSecret)) fail(401, 'Administrator authentication required.');
          if (!statsValid(input.save) || typeof input.reason !== 'string' || input.reason.trim().length < 5) fail(400, 'A reviewed save and approval reason are required.');
          const p = await player(input.playerId);
          if (!p || p.tries || p.migrated || p.active_run) fail(409, 'An unused online player ID is required.');
          const code = secret();
          await stmt('insert into moon_migrations(code_hash,player,save,reason,created_at,expires_at) values(?,?,?,?,?,?)', await hash(code), p.id, JSON.stringify(input.save), input.reason.trim(), now().getTime(), now().getTime() + 86400000).run();
          result = { code, expiresAt: new Date(now().getTime() + 86400000).toISOString() };
        } else {
          const p = await authenticate(token);
          await limit(`api:${p.id}`, 1200);
          if (input.playerId && input.playerId !== p.id) fail(403, 'Identity does not match.');
          if (['event', 'submit', 'arrival', 'abandon'].includes(action) && (typeof input.runId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.runId))) fail(400, 'A valid flight ID is required.');
          if (request.method === 'GET') result = await snapshot(p, input.period);
          else if (request.method === 'PATCH') result = { playerName: await rename(p, input.playerName) };
          else if (action === 'profile') result = { playerId: p.id, profile: profile(p), activeRunId: p.active_run, playerName: await ensureName(p) };
          else if (action === 'leaderboard_name') result = { playerName: p.name || '', registered: !!p.name };
          else if (action === 'leaderboard_period') result = { period: await rankPeriod() };
          else if (action === 'start') result = await start(p, input.input);
          else if (action === 'event') result = await gameEvent(p, input.runId, input.event);
          else if (action === 'arrival') result = await arrival(p, input.runId);
          else if (action === 'submit') result = await submit(p, input.runId);
          else if (action === 'migrate') result = await migrate(p, input.code);
          else if (action === 'abandon') {
            await stmt('update moon_players set active_run=null where id=? and active_run=?', p.id, input.runId).run();
            result = { profile: profile(await player(p.id)) };
          } else if (action === 'upgrade') {
            if (!['speed','fuel','money'].includes(input.type)) fail(400, 'Unknown upgrade.');
            const value = p[input.type], price = cost(input.type, value);
            if (input.expected !== (input.type === 'money' ? value / 10 : value)) fail(409, 'Upgrade already changed. Refresh your balance.');
            const max = input.type === 'fuel' ? 600 : input.type === 'speed' ? 10000 : 100000;
            // Identifiers come only from the fixed allowlist above.
            const changed = await stmt(`update moon_players set ${input.type}=?,coins=coins-? where id=? and coins>=? and ${input.type}=? and ${input.type}<? and active_run is null`, nextValue(input.type, value), price, p.id, price, value, max).run();
            if (!changed.meta.changes) fail(409, 'Upgrade unavailable. Refresh your balance.');
            result = { profile: profile(await player(p.id)) };
          } else fail(400, 'Unknown action.');
        }
      }
      return Response.json(result, { headers });
    } catch (error) {
      const status = error.status || 500;
      return Response.json({ error: error.status ? error.message : 'Leaderboard request failed.' }, { status, headers });
    }
  }
  return { handle };
}
