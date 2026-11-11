/* API v2 adapter for https://github.com/ivyparc/leaderboard.
 * The server validates events and calculates the score; submit never sends one.
 */
(function (host) {
  function createMoonLeaderboard(config, options = {}) {
    const storage = options.storage || host.localStorage;
    const fetchRequest = options.fetch || host.fetch.bind(host);
    const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const prefix = `${config.namespace}.${config.scope}.moon.v2.${config.endpoint}`;
    const identityKey = `${config.namespace}.identity.v2.${config.endpoint}`;
    const read = (key, fallback) => {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    };
    const write = (key, value) => storage.setItem(key, JSON.stringify(value));
    let identityPromise;
    let pending = read(`${prefix}.pending`, []);
    let submitting;
    let current = null;
    let listener = () => {};
    const view = { status: config.endpoint ? "ready" : "unconfigured", error: "", snapshot: null, period: "active", playerName: read(`${prefix}.name`, ""), online: read(`${prefix}.online`, false), profile: null, playerId: null, activeRunId: null, busy: false };
    const changed = () => listener(view);
    const report = error => { view.status = "error"; view.error = error.message; changed(); };
    async function request(method, fields, token) {
      const url = new URL(config.endpoint);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
        throw new Error("An HTTPS leaderboard API URL is required.");
      }
      const payload = { namespace: config.namespace, scope: config.scope, ...fields };
      if (method === "GET") Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetchRequest(url.toString(), {
          method, signal: controller.signal, cache: "no-store", credentials: "omit",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          ...(method !== "GET" ? { body: JSON.stringify(payload) } : {}),
        });
        const data = await response.json();
        if (!response.ok) {
          const error = new Error(data.error || `Leaderboard HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        return data;
      } finally { clearTimeout(timer); }
    }
    async function identity() {
      const saved = read(identityKey, null);
      if (saved?.token && saved?.playerId) return saved;
      if (!identityPromise) identityPromise = request("POST", { action: "identity" }).then(value => {
        if (!value.token || !value.playerId) throw new Error("Invalid identity response.");
        write(identityKey, value);
        return value;
      }).finally(() => { identityPromise = null; });
      return identityPromise;
    }
    async function api(method, fields) {
      return request(method, fields, (await identity()).token);
    }
    function receive(result) {
      if (result.profile) view.profile = result.profile;
      if (result.playerId) view.playerId = result.playerId;
      if ('activeRunId' in result) view.activeRunId = result.activeRunId;
      if (result.playerName) view.playerName = result.playerName;
      changed();
      return result;
    }
    async function connect(mode, code) {
      if (!config.endpoint || view.busy) return false;
      view.busy = true; view.error = ''; changed();
      try {
        let result = await api('POST', { action: 'profile' });
        if (mode === 'migrate') result = { ...result, ...await api('POST', { action: 'migrate', code }) };
        if (mode === 'new' || mode === 'migrate') { view.online = true; write(`${prefix}.online`, true); }
        receive(result); view.status = 'ready'; return true;
      } catch (error) { report(error); return false; }
      finally { view.busy = false; changed(); }
    }
    async function upgrade(type) {
      if (!view.online || !view.profile || view.busy) return false;
      view.busy = true; view.error = ''; changed();
      try {
        // A reload can leave a server flight behind with no local flight to
        // finish it. Release only that orphan; never discard queued rewards or
        // interrupt a live flight to make a purchase.
        if (current && !current.completed && !current.invalid) throw new Error('Finish the current flight before upgrading.');
        if (current?.finishing) await current.finishing;
        if (pending.length || submitting) await retry();
        if (pending.length) throw new Error('Flight rewards are waiting to sync. Retry from rankings.');
        if (view.activeRunId) {
          const runId = view.activeRunId;
          receive(await api('POST', { action: 'abandon', runId }));
          if (view.activeRunId === runId) view.activeRunId = null;
        }
        receive(await api('POST', { action: 'upgrade', type, expected: view.profile[type] }));
        view.status = 'ready'; return true;
      }
      catch (error) { try { receive(await api('POST', { action: 'profile' })); } catch {} report(error); return false; }
      finally { view.busy = false; changed(); }
    }
    function abandon() {
      const run = current;
      invalidate();
      const cancel = (async () => {
        if (run) await run.started;
        const runId = run?.runId || view.activeRunId;
        if (!runId) return;
        try {
          receive(await api('POST', { action: 'abandon', runId }));
          if (view.activeRunId === runId) view.activeRunId = null;
          if (current === run) current = null;
          view.status = 'ready'; changed();
        } catch (error) { report(error); }
      })();
      if (run) run.abandoning = cancel;
      return cancel;
    }
    async function refresh(period = view.period) {
      if (!config.endpoint) return;
      view.period = period;
      view.status = "loading"; view.error = ""; changed();
      try {
        const snapshot = await api("GET", { period, limit: 100 });
        if (view.period !== period) return;
        view.snapshot = snapshot; view.status = "ready"; changed();
      } catch (error) { report(error); }
    }
    function begin(input) {
      const previous = current;
      if (!config.endpoint) return Promise.resolve(false);
      const run = { runId: null, events: [], sequence: 0, completed: false, invalid: false, elapsed: 0, acknowledgedAt: 0, queued: false };
      current = run;
      view.status = "starting"; view.error = ""; changed();
      run.started = (async () => {
        // A fast Replay may precede settlement of the last flight. Serialize
        // server sessions, while the new flight already records its own ticks.
        if (previous?.finishing) await previous.finishing;
        if (previous?.abandoning) await previous.abandoning;
        if (pending.length || submitting) await retry();
        if (pending.length) throw new Error("Previous flight is still waiting to sync. Retry from rankings.");
        const result = await api("POST", { action: "start", input });
        if (!result.runId) throw new Error("Invalid game session response.");
        run.runId = result.runId;
        run.acknowledgedAt = Date.now();
        view.activeRunId = result.runId;
        receive(result);
        return true;
      })().catch(async error => {
        run.invalid = true;
        try { receive(await api('POST', { action: 'profile' })); } catch {}
        report(error); return false;
      });
      return run.started;
    }
    function record(event) {
      if (!current || current.completed || current.invalid) return;
      if (current.events.length >= 24000) {
        current.invalid = true; report(new Error("Flight is too long for ranking.")); return;
      }
      current.events.push(event);
      if (event.type === "tick") current.elapsed += event.delta;
      else if (event.type === "clap") current.elapsed = Math.max(current.elapsed, event.at);
    }
    function invalidate() {
      if (current && !current.completed) current.invalid = true;
    }
    function finish(landed = true) {
      const run = current;
      if (!run || run.invalid) return Promise.resolve();
      if (run.completed) return run.finishing || Promise.resolve();
      run.completed = true;
      run.finishing = (async () => {
        if (!await run.started || run.invalid) return;
        // Never relax the server clock check for an optimistic launch. If the
        // handshake was slow, wait here (after gameplay) until the server has
        // had enough time to validate every buffered tick and landing.
        const notBefore = run.acknowledgedAt + run.elapsed + (landed ? 1400 : 0);
        pending.push({ runId: run.runId, events: run.events, sequence: 0, offset: 0, landed, notBefore });
        run.queued = true;
        try { write(`${prefix}.pending`, pending); } catch (error) { report(error); return; }
        await retry();
      })();
      return run.finishing;
    }
    function retry() {
      if (submitting) return submitting;
      submitting = (async () => {
        if (!config.endpoint || !pending.length) return;
        view.status = "submitting"; view.error = ""; changed();
        let landedAny = false;
        try {
          for (const run of [...pending]) {
            const remaining = (run.notBefore || 0) - Date.now();
            if (remaining > 0) await wait(remaining);
            // Freeze server arrival time before potentially slow frame uploads.
            // Repeating this after a lost response returns the original receipt.
            if (!run.arrivalReceived) {
              await api('POST', { action: 'arrival', runId: run.runId });
              run.arrivalReceived = true;
              write(`${prefix}.pending`, pending);
            }
            while (run.offset < run.events.length) {
              const batch = run.events.slice(run.offset, run.offset + 200);
              await api("POST", { action: "event", runId: run.runId,
                event: { type: "frames", sequence: run.sequence, frames: batch } });
              run.offset += batch.length; run.sequence += 1;
              write(`${prefix}.pending`, pending);
            }
            // Try submit first on every retry: a lost finish response may already
            // have completed the server run. The service makes submit idempotent.
            let result;
            if (run.landed === false) {
              result = await api('POST', { action: 'event', runId: run.runId, event: { type: 'finish' } });
              result = { ...result, ...await api('POST', { action: 'submit', runId: run.runId }) };
            } else try { result = await api("POST", { action: "submit", runId: run.runId, playerName: view.playerName || undefined }); }
            catch (error) {
              if (error.status !== 400) throw error;
              await api("POST", { action: "event", runId: run.runId, event: { type: "finish" } });
              result = await api("POST", { action: "submit", runId: run.runId, playerName: view.playerName || undefined });
            }
            if (result.playerName) { view.playerName = result.playerName; write(`${prefix}.name`, view.playerName); }
            view.activeRunId = null;
            receive(result);
            landedAny ||= run.landed !== false && !result.legacyRecord;
            pending = pending.filter(item => item !== run);
            write(`${prefix}.pending`, pending);
          }
          await refresh();
          if (view.status !== "error") { view.status = landedAny ? "submitted" : "ready"; changed(); }
        } catch (error) { report(error); }
      })().finally(() => { submitting = null; });
      return submitting;
    }
    async function rename(playerName) {
      if (!config.endpoint) return false;
      try {
        const result = await api("PATCH", { playerName });
        view.playerName = result.playerName; write(`${prefix}.name`, result.playerName);
        await refresh();
        return true;
      } catch (error) { report(error); return false; }
    }
    return { view, begin, record, invalidate, landed: () => finish(true), failed: () => { if (current) current.landed = false; return finish(false); }, refresh, retry, rename, connect, upgrade, abandon,
      disconnect() { invalidate(); view.online = false; write(`${prefix}.online`, false); view.status = 'ready'; changed(); },
      subscribe(fn) { listener = fn; }, pendingCount() { return pending.length + (current?.completed && !current.invalid && !current.queued ? 1 : 0); } };
  }
  host.createMoonLeaderboard = createMoonLeaderboard;
})(typeof window === "undefined" ? globalThis : window);
