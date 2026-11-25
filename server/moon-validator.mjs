// Install alongside ivyparc/leaderboard/server, in the SAME API service.
// resolveLoadout must resolve trusted upgrades (e.g. a server-signed save),
// never simply echo the client's loadout. Local saves are not proof of upgrades.
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const finite = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const TOTAL_DISTANCE = 384399;
const MARS_FLIGHT_PACE = 0.8;

export function moonValidator({ resolveLoadout, allowFailures = false, sheetMode = false } = {}) {
  if (typeof resolveLoadout !== "function") throw new Error("A trusted Moon loadout resolver is required.");
  return {
    async start({ input, now, scope }) {
      const stats = await resolveLoadout(input?.loadoutProof);
      if (!stats || !finite(stats.speed, sheetMode ? 1 : 10, 10000) || !Number.isInteger(stats.speed) ||
          !finite(stats.fuel, sheetMode ? 1 : 10, 600) || !Number.isInteger(stats.fuel) ||
          !finite(stats.money, sheetMode ? .1 : 1, 10000) || Math.abs(stats.money * 10 - Math.round(stats.money * 10)) > 1e-8) {
        fail("Invalid verified loadout.", 403);
      }
      if (input?.loadout?.speed !== stats.speed || input?.loadout?.fuel !== stats.fuel || input?.loadout?.money !== stats.money) {
        fail("Local upgrades differ from verified upgrades.", 409);
      }
      const rulesVersion = input?.rulesVersion;
      const fullDistance = rulesVersion === 2 || rulesVersion === 3;
      const flightPace = rulesVersion === 3 && scope === "mars" ? MARS_FLIGHT_PACE : 1;
      return { state: { stats, rulesVersion, flightPace, totalDistance: fullDistance ? TOTAL_DISTANCE : 19500, startedAt: now.toISOString(), phase: "flying", distance: 0,
        replay: fullDistance ? [[0, 0]] : null,
        fuel: stats.fuel, elapsed: 0, hold: 0, holdOut: 0, holdAt: 0, clapAt: 0,
        lastClapAt: -1000, claps: 0, sequence: 0, lastBatch: "", landingAt: 0 }, challenge: { protocol: "moon-flight-v1" } };
    },
    event({ state, event, now }) {
      const s = structuredClone(state);
      const realElapsed = now - new Date(s.startedAt);
      const totalDistance = s.totalDistance || 19500;
      if (realElapsed < 0 || realElapsed > 24 * 3600000) fail("Invalid flight clock.");
      if (event?.type === "finish") {
        if (allowFailures && s.phase === "failed") return { state: s, complete: false, failed: true, score: realElapsed, earned: Math.floor(s.distance / 100 * s.stats.money + 1e-9) };
        if (s.phase !== "landing" || realElapsed < s.landingAt + 1400) fail("A completed Moon landing is required.");
        // Ranking time comes from the server clock; coins remain a separate reward.
        return { state: s, complete: true, score: realElapsed,
          earned: Math.floor(totalDistance / 100 * s.stats.money + 1e-9), challenge: null };
      }
      if (event?.type !== "frames" || !Number.isSafeInteger(event.sequence) ||
          !Array.isArray(event.frames) || !event.frames.length || event.frames.length > 200) fail("Invalid flight frames.");
      const encoded = JSON.stringify(event.frames);
      // A retried batch after a lost response is harmless; changed replays reject.
      if (event.sequence === s.sequence - 1 && encoded === s.lastBatch) return { state: s, complete: false };
      if (event.sequence !== s.sequence) fail("Out-of-order flight frames.", 409);
      const flightFailure = message => {
        if (!allowFailures) fail(message);
        s.phase = "failed";
      };
      for (const frame of event.frames) {
        if (frame.type === "tick") {
          if (!["flying", "holdPrompt", "clapPrompt"].includes(s.phase) ||
              !finite(frame.delta, 0, 600000) || !finite(frame.db, 0, 110)) fail("Invalid flight tick.");
          s.elapsed += frame.delta;
          if (s.elapsed > realElapsed + 2000) fail("Flight is faster than the server clock.");
          const burnRate = s.phase === "flying" ? (s.flightPace ?? 1) : 1;
          const flightDelta = Math.min(frame.delta, s.fuel * 1000 / burnRate);
          s.fuel = Math.max(0, s.fuel - frame.delta / 1000 * burnRate);
          if (s.phase === "flying") {
            const distanceBefore = s.distance;
            const speed = frame.db * s.stats.speed * (s.flightPace ?? 1);
            s.distance = Math.min(totalDistance, s.distance + speed * flightDelta / 1000);
            if (s.replay) {
              const travelMs = frame.db && s.distance >= totalDistance
                ? (s.distance - distanceBefore) / speed * 1000 : flightDelta;
              const elapsed = s.elapsed - frame.delta + travelMs;
              const last = s.replay.at(-1);
              if (elapsed > last[0] && (elapsed - last[0] >= 500 || s.distance >= totalDistance || s.fuel <= 1e-9)) {
                s.replay.push([elapsed, s.distance]);
              }
            }
          }
          if (s.fuel <= 1e-9) { s.fuel = 0; flightFailure("Flight ran out of fuel."); continue; }
          if (s.phase === "flying" && s.distance >= totalDistance) {
            s.phase = "holdPrompt";
            s.holdAt = s.elapsed;
            continue;
          }
          if (s.phase === "clapPrompt" && s.elapsed - s.clapAt > 8000) { flightFailure("Clap challenge expired."); continue; }
          if (s.phase === "holdPrompt") {
            const quietEnough = s.rulesVersion === 3 ? frame.db < 60 : frame.db >= 50 && frame.db <= 60;
            if (quietEnough) { s.hold += frame.delta; s.holdOut = 0; }
            else { s.hold = 0; s.holdOut = s.elapsed - s.holdAt < 1500 ? 0 : s.holdOut + frame.delta; }
            if (s.holdOut > 2200) { flightFailure("Continuous hold challenge failed."); continue; }
            if (s.hold >= 5000) { s.phase = "clapPrompt"; s.clapAt = s.elapsed; }
          }
        } else if (frame.type === "hold-reset") {
          if (s.phase !== "holdPrompt") fail("Hold reset outside challenge.");
          s.hold = 0;
        } else if (frame.type === "clap") {
          if (s.phase !== "clapPrompt" || !finite(frame.db, 72, 110) || !finite(frame.at, s.elapsed, s.elapsed + 1000) ||
              frame.at - s.clapAt > 8000 || frame.at - s.lastClapAt < 260 || frame.at > realElapsed + 2000) fail("Invalid clap.");
          s.lastClapAt = frame.at;
          if (++s.claps === 3) { s.phase = "landing"; s.landingAt = frame.at; }
        } else fail("Unknown flight frame.");
      }
      s.sequence += 1; s.lastBatch = encoded;
      return { state: s, complete: false, challenge: { phase: s.phase } };
    },
  };
}
