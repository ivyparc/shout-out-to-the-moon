const BASE_WIDTH = 1179;
const BASE_HEIGHT = 2556;
const BASE_RATIO = BASE_WIDTH / BASE_HEIGHT;
const UFO_TRIGGER_PROGRESS = 0.03;
const UFO_END_PROGRESS = 0.62;
const MOON_TRIGGER_PROGRESS = 1;
const MOON_REVEAL_DELAY_MS = 2000;
// NASA: lowest to highest. Higher layers sit ABOVE the launch viewport.
const ATMOSPHERE_BACKGROUNDS = [
  "troposphere.png", "stratosphere.png", "mesosphere.png",
  "thermosphere.png", "exosphere.png", "space.png",
];
const ATMOSPHERE_STRIPS = ATMOSPHERE_BACKGROUNDS.flatMap((name) => name === "space.png" ? [name] : [name, name]);
// Sky colors sampled from the decoded motion assets (space uses its still).
// Adjacent strips share the exact same midpoint color at their touching edges.
const ATMOSPHERE_SKY_COLORS = {
  "troposphere.png": [134, 164, 209], "stratosphere.png": [98, 110, 161],
  "mesosphere.png": [70, 60, 125], "thermosphere.png": [52, 34, 90],
  "exosphere.png": [34, 13, 61], "space.png": [25, 12, 42],
};
function atmospherePoster(name) {
  return name === "space.png" ? name : name.replace(".png", "-motion-poster.png");
}
function atmosphereStripStyle(name, index) {
  const color = ATMOSPHERE_SKY_COLORS[name];
  const above = ATMOSPHERE_SKY_COLORS[ATMOSPHERE_STRIPS[index + 1]] || color;
  const below = ATMOSPHERE_SKY_COLORS[ATMOSPHERE_STRIPS[index - 1]] || color;
  const rgb = values => `rgb(${values.join(",")})`;
  const middle = other => rgb(color.map((value, channel) => Math.round((value + other[channel]) / 2)));
  return `top:${-index * 100}%;--sky-color:${rgb(color)};--sky-above:${middle(above)};--sky-below:${middle(below)};--fade-top:${index === ATMOSPHERE_STRIPS.length - 1 || ATMOSPHERE_STRIPS[index + 1] === name ? "0%" : "6%"};--fade-bottom:${index === 0 || ATMOSPHERE_STRIPS[index - 1] === name ? "100%" : "94%"}`;
}
// Keep the moon at the same viewport position when the hold challenge begins.
const MOON_APPEAR_PROGRESS = MOON_TRIGGER_PROGRESS - 0.6 / (ATMOSPHERE_STRIPS.length - 1);
const BACKGROUND_STILL_TIME = 0.001; // Seek within frame zero so WebKit paints the decoded video.
const UFO_ENABLED = false; // Temporary: retain encounter logic for later reactivation.
const CLAP_WINDOW_MS = 8000;
const CLAP_MIN_GAP_MS = 260;
const CLAP_DB_THRESHOLD = 72;
const HOLD_TARGET_MIN = 50;
const HOLD_TARGET_MAX = 60;
const HOLD_REQUIRED_MS = 5000;
const HOLD_FAIL_GRACE_MS = 2200;
const HOLD_START_GRACE_MS = 1500;
const LAUNCH_WORDS = ["launch", "launched", "launches", "lunch", "런치", "론치"];
const REPLAY_WORDS = ["replay", "yes", "restart", "again", "예스", "다시", "리플레이"];

const DEFAULT_STATS = {
  speed: 10,
  fuel: 10,
  money: 1,
  coins: 0,
};

// Source: SOTM, "dB - Speed"!A2:F9 and "Atmospheric Layers"!A3:D10.
// https://docs.google.com/spreadsheets/d/1Z7Bft-n0MNSQMPITQEgAo0O_mGSvueM2QRrhg_HDNoA/edit
// Snapshot imported 2026-10-15; costs use the current stat before purchase.
const BALANCE = { fuelBurnPerSecond: 1 };
const UPGRADE_COST_TIERS = [
  { max: 20, cost: 50 },
  { max: 30, cost: 100 },
  { max: 40, cost: 150 },
  { max: 50, cost: 200 },
  { max: Infinity, cost: 250 },
];

const DISTANCE_SEGMENTS = [
  { name: "Launch Pad", distance: 1000 },
  { name: "Troposphere", distance: 3000 },
  { name: "Stratosphere", distance: 3000 },
  { name: "Mesosphere", distance: 3500 },
  { name: "Thermosphere", distance: 3000 },
  { name: "Exosphere", distance: 3000 },
  { name: "Space", distance: 3000 },
];

const TOTAL_DISTANCE_KM = DISTANCE_SEGMENTS.reduce((sum, segment) => sum + segment.distance, 0);

const DB_RANGES = [
  { id: "20-40", min: 20, max: 40, label: ["20", "40"] },
  { id: "40-60", min: 40, max: 60, label: ["40", "60"] },
  { id: "60-80", min: 60, max: 80, label: ["60", "80"] },
  { id: "80-100", min: 80, max: 100, label: ["80", "100"] },
  { id: "100+", min: 100, max: 110, label: ["100", "+"] },
];

const STRINGS = {
  ko: {
    title: "Shout Out to the Moon",
    subtitle: "Launch라고 외친 뒤, dB로 로켓을 달까지 보내세요.",
    current: "현재",
    max: "최대",
    test: "테스트 dB",
    timer: "Energy",
    coins: "Coins",
    waitingLaunch: "Say “Launch”",
    flying: "Make some noise!",
    avoidUfo: "UFO를 피하세요!",
    avoidUfoHint: "소리를 크게/작게 내서 속도를 바꾸세요",
    getReadyHold: "곧 50~60dB 유지!",
    getReadyClap: "다음은 박수 3번!",
    clapPrompt: "박수 3번!",
    clapHint: "8초 안에 박수 3번 또는 아래 Clap 버튼",
    holdPrompt: "50~60dB 유지!",
    holdHint: "5초 동안 50~60dB를 유지하세요",
    landing: "Landing...",
    landedTitle: "Congratulations!",
    landedBody: "You've landed successfully.",
    replayPrompt: "Replay?",
    failed: "Game Over",
    micStatus: "마이크를 허용하면 실제 소리로 플레이할 수 있습니다.",
    speechUnsupported: "Speech Recognition is not available in this browser.",
    voiceEnable: "Voice",
    voiceReady: "음성 인식 중 — Launch라고 말하세요",
    voiceStarting: "음성 인식에 연결 중…",
    voiceNetwork: "음성 인식 서비스 연결에 실패했습니다. 일반 Chrome/Safari에서 열고 Voice를 눌러 다시 시도하세요.",
    voicePermission: "마이크·음성 인식 권한을 허용한 뒤 Voice를 눌러주세요.",
    voiceHeard: "인식",
    clapFailed: "박수 3번을 8초 안에 완료하지 못했습니다.",
    holdFailed: "50~60dB를 5초간 유지하지 못했습니다.",
    ufoFailed: "UFO에 닿았습니다. UFO가 보이는 동안은 dB로 속도를 조절해 피하세요.",
    energyFailed: "Energy가 0이 되었습니다.",
    distance: "Distance",
    earn: "Earn",
    exit: "Exit",
    continue: "Continue",
  },
  en: {
    title: "Shout Out to the Moon",
    subtitle: "Say Launch, then use dB to fly to the moon.",
    current: "Current",
    max: "Max",
    test: "Test dB",
    timer: "Energy",
    coins: "Coins",
    waitingLaunch: "Say “Launch”",
    flying: "Make some noise!",
    avoidUfo: "Avoid the UFO!",
    avoidUfoHint: "Change your dB to speed up or slow down",
    getReadyHold: "Get ready: hold 50-60dB!",
    getReadyClap: "Next: clap 3 times!",
    clapPrompt: "Clap 3 times!",
    clapHint: "Clap 3 times within 8 seconds or tap the Clap button below",
    holdPrompt: "Hold 50-60dB!",
    holdHint: "Keep 50-60dB steady for 5 seconds",
    landing: "Landing...",
    landedTitle: "Congratulations!",
    landedBody: "You've landed successfully.",
    replayPrompt: "Replay?",
    failed: "Game Over",
    micStatus: "Allow microphone access to play with real sound.",
    speechUnsupported: "Speech Recognition is not available in this browser.",
    voiceEnable: "Voice",
    voiceReady: "Listening — say Launch",
    voiceStarting: "Connecting to speech recognition…",
    voiceNetwork: "Cannot connect to the speech service. Open in Chrome/Safari and press Voice to retry.",
    voicePermission: "Allow microphone and speech recognition, then press Voice to retry.",
    voiceHeard: "Heard",
    clapFailed: "You did not clap 3 times within 8 seconds.",
    holdFailed: "You did not hold 50-60dB for 5 seconds.",
    ufoFailed: "You touched the UFO. Change dB to dodge it while it is on screen.",
    energyFailed: "Energy reached zero.",
    distance: "Distance",
    earn: "Earn",
    exit: "Exit",
    continue: "Continue",
  },
};

const state = {
  language: getLanguage(),
  phase: "waitingLaunch",
  db: 0,
  maxDb: 0,
  progress: 0,
  distanceKm: 0,
  fuelRemaining: DEFAULT_STATS.fuel,
  speedMultiplier: DEFAULT_STATS.speed,
  fuelCapacity: DEFAULT_STATS.fuel,
  moneyMultiplier: DEFAULT_STATS.money,
  coins: DEFAULT_STATS.coins,
  lastEarnedCoins: 0,
  hasSettledRun: false,
  tryCount: 0,
  flightHistory: [],
  lastTick: Date.now(),
  flightStartedAt: 0,
  manualModeUntil: 0,
  lastButtonActionAt: 0,
  clapCount: 0,
  clapStartedAt: 0,
  lastClapAt: 0,
  holdMs: 0,
  holdOutMs: 0,
  holdStartedAt: 0,
  moonSceneStartScroll: 0,
  status: "",
  speechStatus: "",
  heardSpeech: "",
  ufoSeed: Math.random(),
  ufoStartedAt: 0,
  ufoExitStartedAt: 0,
  landingStartedAt: 0,
  landingSceneX: 50,
  landingSceneY: 50,
};

let leaderboard = null;
let leaderboardSetupError = "";
try {
  if (window.createMoonLeaderboard) leaderboard = window.createMoonLeaderboard(window.SHOUT_MOON_LEADERBOARD);
} catch (error) { leaderboardSetupError = error.message; }
let leaderboardMode = false;
let leaderboardOpen = false;
let leaderboardProfileOpen = false;
leaderboard?.subscribe(() => {
  const view = leaderboard.view;
  if (view.online && view.profile) {
    if (!leaderboardMode) { state.flightHistory = []; loadFlightHistory(); renderFlightMarkers(); }
    leaderboardMode = true;
    if (!isRunningPhase() && state.phase !== "landing") {
      state.speedMultiplier = view.profile.speed;
      state.fuelCapacity = view.profile.fuel;
      state.moneyMultiplier = view.profile.money;
    }
    state.coins = view.profile.coins;
    state.tryCount = isRunningPhase() || state.phase === "landing"
      ? Math.max(state.tryCount, view.profile.tries) : view.profile.tries;
    if (["waitingLaunch", "preparing"].includes(state.phase)) state.fuelRemaining = state.fuelCapacity;
    updateUi();
  }
  if (!view.online) leaderboardMode = false;
  renderLeaderboard();
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function formatRankingTime(milliseconds) {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) return "—";
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor(milliseconds / 1000) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds % 1000).padStart(3, "0")}`;
}

function setLeaderboardOpen(open) {
  const dialog = root.querySelector(".leaderboard-panel");
  if (!dialog) return;
  leaderboardOpen = open;
  if (!open) leaderboardProfileOpen = false;
  root.querySelector(".leaderboard-launcher")?.setAttribute("aria-expanded", String(open));
  if (open) {
    const board = root.querySelector(".phone").getBoundingClientRect();
    Object.assign(dialog.style, { left: `${board.left + 12}px`, top: `${board.top + 12}px`,
      width: `${board.width - 24}px`, height: `${board.height - 24}px` });
    if (!dialog.open) dialog.showModal();
    renderLeaderboard();
  } else {
    dialog.close();
    root.querySelector(".leaderboard-launcher")?.focus();
  }
}

function renderLeaderboard() {
  const panel = root.querySelector(".leaderboard-content");
  const status = root.querySelector(".leaderboard-status");
  if (!panel || !status) return;
  const ko = state.language === "ko";
  const view = leaderboard?.view;
  const messages = ko ? {
    unconfigured: "랭킹 서버 연결 준비 중이에요.", ready: "달까지 가장 빠르게! 짧은 시간이 높은 순위예요.",
    starting: "비행 준비 중…", loading: "달 탐험 기록을 불러오는 중…",
    submitting: "착륙 기록을 등록하고 있어요…", submitted: "새로운 달 착륙 기록이 등록됐어요!",
    error: "연결을 확인하고 새로고침해 주세요.",
  } : {
    unconfigured: "Getting the rankings ready.", ready: "Fastest to the Moon wins!",
    starting: "Preparing your flight…", loading: "Loading Moon explorers…",
    submitting: "Saving your landing…", submitted: "Your Moon landing is on the board!",
    error: "Check your connection and refresh.",
  };
  status.textContent = messages[leaderboardSetupError ? "error" : view?.status || "unconfigured"];
  const dialog = root.querySelector(".leaderboard-panel");
  if (!dialog?.open) return;
  const disabled = !view || view.status === "unconfigured";
  const snapshot = view?.snapshot;
  const rows = snapshot?.entries || [];
  const own = snapshot?.currentPlayer;
  const subtitle = root.querySelector(".leaderboard-subtitle");
  if (subtitle) subtitle.textContent = own
    ? (ko ? `내 순위 #${own.rank} · 나의 가장 빠른 달 여행` : `Your rank #${own.rank} · Your fastest Moon trip`)
    : (ko ? "나의 가장 빠른 달 여행" : "Your fastest trip to the Moon");
  root.querySelector('[data-leaderboard="profile"]')?.setAttribute("aria-expanded", String(leaderboardProfileOpen));
  const draftName = (leaderboardProfileOpen ? root.querySelector('.leaderboard-name input')?.value : null) ?? view?.playerName ?? '';
  const row = (entry, personal = false) => `<tr class="${personal ? 'my-ranking' : entry.rank === own?.rank ? 'own-list-row' : ''}">
    <td><span class="rank-number rank-${entry.rank || 0}">${escapeHtml(entry.rank || "—")}</span></td>
    <td><span class="ranking-name">${escapeHtml(entry.name || (ko ? "나의 기록" : "Your record"))}</span>${personal ? `<span class="ranking-you">${ko ? "나" : "YOU"}</span>` : entry.isToday ? `<span class="ranking-today">${ko ? '오늘' : 'Today'}</span>` : ''}</td>
    <td><span class="ranking-time">${escapeHtml(formatRankingTime(entry.score))}</span></td></tr>`;
  panel.innerHTML = `
    <div class="leaderboard-toolbar" ${leaderboardProfileOpen ? 'inert' : ''}>
      <label class="leaderboard-period-label"><span class="sr-only">${ko ? "기간" : "Period"}</span><select data-leaderboard-period ${disabled ? "disabled" : ""}>
        ${[["active", ko ? "현재 시즌" : "This season"], ["all", ko ? "전체 기록" : "All time"], ...(snapshot?.periods || []).map(period => [period, period])].map(([value, label]) => `<option value="${escapeHtml(value)}" ${view?.period === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
      </select></label>
      <span class="leaderboard-sort">${ko ? "빠른 시간 순" : "Fastest first"}</span>
      <button type="button" class="leaderboard-refresh" data-leaderboard="refresh" aria-label="${ko ? "새로고침" : "Refresh"}" ${disabled ? "disabled" : ""}>↻</button>
    </div>
    ${view?.error || leaderboardSetupError ? `<p class="leaderboard-error" role="alert">${escapeHtml(view?.error || leaderboardSetupError)}</p>` : ""}
    ${leaderboard?.pendingCount() ? `<button type="button" class="leaderboard-retry" data-leaderboard="retry">${ko ? "기록 등록 재시도" : "Retry your landing"} (${leaderboard.pendingCount()})</button>` : ""}
    <div class="leaderboard-list" ${leaderboardProfileOpen ? 'inert' : ''} tabindex="0" aria-label="${ko ? "순위 목록" : "Rankings"}">
      <table><thead><tr><th scope="col">${ko ? "순위" : "Rank"}</th><th scope="col">${ko ? "이름" : "Name"}</th><th scope="col">${ko ? "도착 시간" : "Time"}</th></tr></thead>
      <tbody class="leaderboard-personal">${row(own || { name: view?.playerName }, true)}</tbody>
      <tbody class="leaderboard-entries">${rows.map(entry => row(entry)).join("")}
      ${!rows.length ? `<tr><td colspan="3" class="leaderboard-empty"><img src="${asset("MiniMoon_64.png")}" alt="" /><strong>${ko ? "첫 달 탐험가를 기다려요!" : "A little Moon. A big adventure."}</strong><p>${view?.status === 'loading' ? (ko ? "기록을 불러오고 있어요…" : "Loading the flight log…") : (ko ? "달에 착륙하면 기록이 여기에 나타나요." : "Land on the Moon to leave your first record.")}</p><span aria-hidden="true">✦ · ✧ · ✦</span></td></tr>` : ""}
      </tbody></table>
    </div>
    <section class="leaderboard-profile" ${leaderboardProfileOpen ? '' : 'hidden'} aria-label="${ko ? "내 프로필" : "Your profile"}">
      <h3>${ko ? "나의 우주비행사" : "Your Moon explorer"}</h3>
      <form class="leaderboard-name"><label>${ko ? "닉네임" : "Nickname"}<input name="playerName" maxlength="24" value="${escapeHtml(draftName)}" placeholder="${ko ? "첫 착륙 시 자동 생성" : "Assigned on first landing"}" ${disabled ? "disabled" : ""}></label><button type="submit" ${disabled ? "disabled" : ""}>${ko ? "저장" : "Save"}</button></form>
      ${leaderboardProfileOpen && view?.error ? `<p class="leaderboard-error" role="alert">${escapeHtml(view.error)}</p>` : ""}
      <p class="leaderboard-profile-note">${ko ? "닉네임은 한 달에 3번 바꿀 수 있어요." : "You can change your nickname 3 times a month."}</p>
      <button type="button" class="leaderboard-profile-done" data-leaderboard="profile">${ko ? "순위로 돌아가기" : "Back to rankings"}</button>
    </section>
  `;
}

// Digital microphone amplitude is dBFS, not absolute sound pressure.
// A reference reading supplies the device-specific offset; until then +96 is
// only the legacy game scale, visibly labelled as uncalibrated.
const microphoneMeter = {
  ready: false, signature: "", offset: 96, calibrated: false,
  rawDbfs: -160, lastSampleAt: 0, calibration: null, message: "",
  context: null, processingActive: false,
};

function microphoneFrame(samples) {
  if (!samples.length) return { dbfs: -160, peak: 0 };
  let mean = 0, peak = 0, energy = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) return { dbfs: -160, peak: 0 };
    mean += sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  mean /= samples.length;
  for (const sample of samples) energy += (sample - mean) ** 2;
  return { dbfs: 10 * Math.log10(Math.max(energy / samples.length, 1e-16)), peak };
}

function selectMeterDevice(signature, processingActive = false) {
  if (microphoneMeter.signature === signature) return;
  microphoneMeter.signature = signature;
  microphoneMeter.processingActive = processingActive;
  microphoneMeter.offset = 96;
  microphoneMeter.calibrated = false;
  microphoneMeter.calibration = null;
  microphoneMeter.message = "";
  try {
    const saved = JSON.parse(readStoredValue("audio.reference.v1") || "null");
    if (saved?.signature === signature && Number.isFinite(saved.offset) && saved.offset >= 0 && saved.offset <= 200) {
      microphoneMeter.offset = saved.offset;
      microphoneMeter.calibrated = true;
    }
  } catch { /* An absent or invalid reference leaves the meter uncalibrated. */ }
}

function beginMeterCalibration(reference) {
  const ko = state.language === "ko";
  if (isRunningPhase() || state.phase === "landing") return false;
  if (!Number.isFinite(reference) || reference < 20 || reference > 120) {
    microphoneMeter.message = ko ? "소음계에 표시된 값(20~120)을 입력하세요." : "Enter the reference meter reading (20–120).";
    return false;
  }
  if (!microphoneMeter.ready || Date.now() - microphoneMeter.lastSampleAt > 500) {
    microphoneMeter.message = ko ? "마이크 입력이 필요합니다. 마이크 권한을 확인하세요." : "Microphone input is required. Check microphone access.";
    return false;
  }
  if (microphoneMeter.processingActive) {
    microphoneMeter.message = ko ? "자동 음량 보정이 켜져 있어 보정할 수 없습니다. 원음 입력을 지원하는 마이크를 사용하세요." : "Automatic audio processing is active. Use a microphone that supports unprocessed input.";
    return false;
  }
  microphoneMeter.calibration = { reference, startedAt: Date.now(), elapsed: 0, energy: 0, min: Infinity, max: -Infinity, clipped: false };
  microphoneMeter.message = "";
  return true;
}

function acceptMicrophoneFrame(dbfs, peak = 0) {
  if (!Number.isFinite(dbfs) || !Number.isFinite(peak)) return;
  const now = Date.now();
  const dt = Math.max(0, Math.min(100, now - microphoneMeter.lastSampleAt));
  microphoneMeter.lastSampleAt = now;
  microphoneMeter.rawDbfs = dbfs;
  microphoneMeter.ready = true;
  const capture = microphoneMeter.calibration;
  if (capture) {
    capture.elapsed += dt;
    capture.energy += Math.pow(10, dbfs / 10) * dt;
    capture.min = Math.min(capture.min, dbfs);
    capture.max = Math.max(capture.max, dbfs);
    capture.clipped ||= peak >= 0.98;
    if (capture.elapsed >= 5000 || now - capture.startedAt > 12000) {
      const ko = state.language === "ko";
      const average = 10 * Math.log10(Math.max(capture.energy / Math.max(1, capture.elapsed), 1e-16));
      if (capture.elapsed < 5000 || capture.clipped || average < -100 || capture.max - capture.min > 6) {
        microphoneMeter.message = ko ? "소리가 너무 작거나 크거나 변했습니다. 일정한 소리로 다시 보정하세요." : "Input was missing, too quiet, clipped or changing. Retry with a steady sound.";
      } else {
        microphoneMeter.offset = capture.reference - average;
        microphoneMeter.calibrated = true;
        writeStoredValue("audio.reference.v1", JSON.stringify({ signature: microphoneMeter.signature, offset: microphoneMeter.offset, reference: capture.reference }));
        microphoneMeter.message = ko ? "기준값 보정을 저장했습니다." : "Reference calibration saved.";
      }
      microphoneMeter.calibration = null;
    }
  }
  const db = clampDb(dbfs + microphoneMeter.offset);
  if (state.phase === "clapPrompt") registerClap(db);
  else setMeasuredDb(db);
  updateMeterCalibrationUi();
}

function updateMeterCalibrationUi() {
  const ko = state.language === "ko";
  const capture = microphoneMeter.calibration;
  const status = root.querySelector(".measurement-status");
  if (status) status.textContent = microphoneMeter.calibrated
    ? (ko ? "dB · 기준값 보정 추정치" : "dB · reference-calibrated estimate")
    : (ko ? "dB · 미보정 게임용 수치" : "dB · uncalibrated game level");
  const detail = root.querySelector(".calibration-status");
  if (detail) detail.textContent = capture
    ? `${ko ? "일정한 소리를 유지하세요" : "Keep the sound steady"} · ${Math.max(0, Math.ceil((5000 - capture.elapsed) / 1000))}s`
    : microphoneMeter.message;
  const live = root.querySelector(".calibration-live");
  if (live) live.textContent = microphoneMeter.ready && Date.now() - microphoneMeter.lastSampleAt < 1000
    ? `${clampDb(microphoneMeter.rawDbfs + microphoneMeter.offset)} dB` : "—";
  const button = root.querySelector('[data-action="calibrate-meter"]');
  if (button) button.disabled = !!capture || isRunningPhase() || state.phase === "landing";
}

const speech = {
  recognition: null,
  isListening: false,
  isStarting: false,
  lastError: "",
  networkFailures: 0,
  retryDelay: 350,
  shouldListen: true,
  hasUserGesture: false,
  restartTimer: 0,
};

const root = document.getElementById("root");
state.status = STRINGS[state.language].micStatus;

function asset(name) {
  return window.SHOUT_MOON_ASSETS?.[name] ?? `assets/${name}`;
}

function readStoredValue(key) {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in embedded WebViews. The game should keep running.
  }
}

function readStoredNumber(key, fallback) {
  const stored = Number(readStoredValue(key));
  return Number.isFinite(stored) ? stored : fallback;
}

function loadEconomy() {
  const storedSpeed = readStoredNumber("stats.speed", DEFAULT_STATS.speed);
  const storedFuel = readStoredNumber("stats.fuel", DEFAULT_STATS.fuel);
  const storedMoney = readStoredNumber("stats.money", DEFAULT_STATS.money);
  state.speedMultiplier = storedSpeed < DEFAULT_STATS.speed ? DEFAULT_STATS.speed : storedSpeed;
  state.fuelCapacity = storedFuel < DEFAULT_STATS.fuel ? DEFAULT_STATS.fuel : storedFuel;
  state.moneyMultiplier = storedMoney < DEFAULT_STATS.money ? DEFAULT_STATS.money : storedMoney;
  state.coins = Math.max(0, readStoredNumber("stats.coins", DEFAULT_STATS.coins));
  loadFlightHistory();
  saveEconomy();
  state.fuelRemaining = state.fuelCapacity;
}

function saveEconomy() {
  if (leaderboard?.view.online) return; // Preserve the original device save.
  writeStoredValue("stats.speed", String(state.speedMultiplier));
  writeStoredValue("stats.fuel", String(state.fuelCapacity));
  writeStoredValue("stats.money", String(state.moneyMultiplier));
  writeStoredValue("stats.coins", String(state.coins));
}

function loadFlightHistory() {
  try {
    const saved = JSON.parse(readStoredValue(leaderboard?.view.online ? "flight.online.history.v1" : "flight.history.v1") || "null");
    if (!saved || !Array.isArray(saved.runs)) return;
    state.flightHistory = saved.runs.filter((run) => Number.isInteger(run.try) && run.try > 0 &&
      Number.isFinite(run.distance) && run.distance >= 0 && run.distance <= TOTAL_DISTANCE_KM);
    state.tryCount = Math.max(0, Number.isSafeInteger(saved.tryCount) ? saved.tryCount : 0,
      ...state.flightHistory.map((run) => run.try));
  } catch { /* Keep playing if a saved record is unavailable. */ }
}

function saveFlightHistory() {
  writeStoredValue(leaderboard?.view.online ? "flight.online.history.v1" : "flight.history.v1", JSON.stringify({tryCount: state.tryCount, runs: state.flightHistory}));
}

function bestFlight() {
  return state.flightHistory.reduce((best, run) => !best || run.distance > best.distance ? run : best, null);
}

function flightMarkerY(distance) {
  // Align a past endpoint with the rocket when this run reaches that distance.
  const sky = root.querySelector(".sky");
  const rocket = root.querySelector(".rocket-art");
  let anchor = 0.65;
  if (sky && rocket) {
    const skyRect = sky.getBoundingClientRect();
    const rect = rocket.getBoundingClientRect();
    if (skyRect.height) anchor = (rect.top + rect.height / 2 - skyRect.top) / skyRect.height;
  }
  // The final space image is stationary; retain distinct height markers there.
  const spaceLength = DISTANCE_SEGMENTS.at(-1).distance;
  const coordinate = (km) => getWorldScrollRatio(km / TOTAL_DISTANCE_KM) +
    clamp((km - (TOTAL_DISTANCE_KM - spaceLength)) / spaceLength, 0, 1);
  return anchor + coordinate(state.distanceKm) - coordinate(distance);
}

function displayedFlights() {
  const best = bestFlight();
  const last = state.flightHistory.at(-1);
  if (!best) return [];
  // One label when the latest flight reaches the same height as Best.
  return !last || last === best || Math.abs(last.distance - best.distance) < 1e-6
    ? [best] : [best, last];
}

function renderFlightMarkers() {
  const best = bestFlight();
  const markers = root.querySelector(".flight-markers");
  const map = root.querySelector(".history-map");
  if (markers) markers.innerHTML = displayedFlights().filter(run => run.distance > 0).map(run =>
    `<div class="flight-marker ${run === best ? "best" : ""}" data-distance="${run.distance}" data-try="${run.try}"><i></i><span>${run === best ? "Best " : "Last "}T${run.try}</span></div>`).join("");
  if (map) map.innerHTML = displayedFlights().map(run => {
    const label = run === best ? "Best" : "Last";
    const nearby = run !== best && Math.abs(run.distance - best.distance) / TOTAL_DISTANCE_KM * Math.max(1, map.clientHeight - 24) < 18;
    const sharedLast = run === best && displayedFlights().length === 1 ? ` · Last T${state.flightHistory.at(-1).try}` : "";
    return `<span class="history-label${nearby ? " nearby" : ""}" style="bottom:calc(${run.distance / TOTAL_DISTANCE_KM * 100}% - ${run.distance / TOTAL_DISTANCE_KM * 24}px)" title="${label} · T${run.try}${sharedLast}"><span>${label}</span><i class="history-dot ${run === best ? "best" : ""}"></i></span>`;
  }).join("");
}

function getLanguage() {
  const saved = readStoredValue("settings.language");
  if (saved === "ko" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampDb(db) {
  return Math.max(0, Math.min(110, Math.round(db)));
}

function randomDb(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getRange(db) {
  return DB_RANGES.find((range) => db >= range.min && db < range.max) ?? DB_RANGES[0];
}

function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatStat(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function currentSpeedKms() {
  return clamp(state.db, 0, 110) * state.speedMultiplier;
}

function getFuelRatio() {
  return clamp(state.fuelRemaining / Math.max(1, state.fuelCapacity), 0, 1);
}

function syncProgressFromDistance() {
  state.progress = clamp(state.distanceKm / TOTAL_DISTANCE_KM, 0, 1);
}

function upgradeCost(type) {
  if (!["speed", "fuel", "money"].includes(type)) return Infinity;
  // Money's 1–2 / 2.1–3 bands use the same table in tenths.
  const value = type === "money" ? Math.round(state.moneyMultiplier * 10)
    : type === "speed" ? state.speedMultiplier : state.fuelCapacity;
  return UPGRADE_COST_TIERS.find((tier) => value <= tier.max).cost;
}

function nextUpgradeValue(type) {
  if (type === "money") return Number((state.moneyMultiplier + 0.1).toFixed(1));
  if (type === "fuel") return state.fuelCapacity + 1;
  return state.speedMultiplier + 1;
}

function applyUpgrade(type) {
  if (!["speed", "fuel", "money"].includes(type)) return false;
  if (isRunningPhase() || state.phase === "landing" || state.phase === "preparing") return false;
  if (leaderboard?.view.online) {
    if (leaderboard.view.busy || leaderboard.pendingCount()) return false;
    state.upgradeFeedback = "";
    state.upgradePending = true;
    void leaderboard.upgrade(type).then(success => {
      state.upgradePending = false;
      state.upgradeFeedback = success
        ? (state.language === "ko" ? "업그레이드 완료!" : "Upgrade complete!")
        : leaderboard.view.error;
      updateUi();
    });
    return false;
  }
  const cost = upgradeCost(type);
  if (state.coins < cost) return false;
  state.coins -= cost;
  if (type === "speed") state.speedMultiplier = nextUpgradeValue(type);
  if (type === "fuel") state.fuelCapacity = nextUpgradeValue(type);
  if (type === "money") state.moneyMultiplier = nextUpgradeValue(type);
  if (state.phase === "waitingLaunch") state.fuelRemaining = state.fuelCapacity;
  state.upgradeFeedback = state.language === "ko" ? "업그레이드 완료!" : "Upgrade complete!";
  saveEconomy();
  updateUi();
  return true;
}

function getCurrentSegment() {
  let start = 0;
  for (let index = 0; index < DISTANCE_SEGMENTS.length; index += 1) {
    const segment = DISTANCE_SEGMENTS[index];
    const end = start + segment.distance;
    if (state.distanceKm <= end || index === DISTANCE_SEGMENTS.length - 1) {
      return { ...segment, index, start, end };
    }
    start = end;
  }
  return { name: "Moon", index: DISTANCE_SEGMENTS.length, start: TOTAL_DISTANCE_KM, end: TOTAL_DISTANCE_KM };
}

// Presentation only: gameplay distances, speed, rewards and timing are unchanged.
// Approximate NASA layer boundaries; the last range approaches the Moon.
const DISPLAY_ALTITUDE_BOUNDARIES_KM = [0, 12, 50, 85, 600, 10000, 384400];

function getDisplayAltitudeKm(worldCoordinate) {
  const coordinate = clamp(worldCoordinate, 0, ATMOSPHERE_STRIPS.length);
  let start = 0;
  for (let layer = 0; layer < ATMOSPHERE_BACKGROUNDS.length; layer += 1) {
    const count = ATMOSPHERE_STRIPS.filter((name) => name === ATMOSPHERE_BACKGROUNDS[layer]).length;
    const end = start + count;
    if (coordinate <= end) {
      const fraction = (coordinate - start) / count;
      const low = DISPLAY_ALTITUDE_BOUNDARIES_KM[layer];
      const high = DISPLAY_ALTITUDE_BOUNDARIES_KM[layer + 1];
      return low + (high - low) * fraction;
    }
    start = end;
  }
  return DISPLAY_ALTITUDE_BOUNDARIES_KM.at(-1);
}

function getDistanceMarker(index) {
  // Existing markers run from 19% to 80% down the viewport, lowest first.
  const viewportY = 0.8 - index * 0.305;
  return getDisplayAltitudeKm(getWorldScrollRatio() + 1 - viewportY);
}

function flameLevel(db) {
  return Math.min(5, 1 + Math.floor(clamp(db, 0, 110) / 25));
}

function isRunningPhase() {
  return (
    state.phase === "flying" ||
    state.phase === "clapPrompt" ||
    state.phase === "holdPrompt"
  );
}

function canAcceptDb() {
  return state.phase === "flying" || state.phase === "holdPrompt";
}

function isDistancePhase() {
  return state.phase === "flying";
}

function startGame() {
  if (leaderboardOpen || state.upgradePending || root.querySelector(".upgrade-panel")?.open || state.phase !== "waitingLaunch") return;
  root.querySelector(".upgrade-panel")?.close();
  // Gameplay starts in this turn. The adapter buffers ticks while the server
  // registers this flight; there are no profile/retry round trips on this path.
  const registration = leaderboard?.view.online
    ? leaderboard.begin({ loadout: { speed: state.speedMultiplier, fuel: state.fuelCapacity, money: state.moneyMultiplier } })
    : null;
  microphoneMeter.calibration = null;
  speech.shouldListen = false;
  stopSpeechRecognition();
  state.tryCount += 1;
  saveFlightHistory();
  state.phase = "flying";
  state.flightStartedAt = Date.now();
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.moonSceneStartScroll = 0;
  state.distanceKm = 0;
  state.fuelRemaining = state.fuelCapacity;
  state.lastEarnedCoins = 0;
  state.hasSettledRun = false;
  state.lastTick = Date.now();
  state.manualModeUntil = 0;
  state.clapCount = 0;
  state.holdMs = 0;
  state.holdOutMs = 0;
  state.ufoSeed = Math.random();
  state.ufoStartedAt = Date.now();
  state.ufoExitStartedAt = 0;
  state.status = "";
  updateUi();
  // Returning the promise is useful to callers that need server confirmation;
  // the visual flight and microphone input are already running independently.
  return registration;
}

function beginClapChallenge() {
  state.phase = "clapPrompt";
  state.db = 0;
  state.clapCount = 0;
  state.clapStartedAt = Date.now();
  state.lastClapAt = 0;
  state.manualModeUntil = 0;
  state.status = "";
  updateUi();
}

function beginHoldChallenge() {
  state.phase = "holdPrompt";
  state.db = 0;
  state.holdMs = 0;
  state.holdOutMs = 0;
  state.holdStartedAt = Date.now();
  state.moonSceneStartScroll = getWorldScrollRatio();
  state.ufoExitStartedAt = Date.now();
  state.manualModeUntil = 0;
  state.status = "";
  updateUi();
}

function beginLanding() {
  const sky = root.querySelector(".sky");
  const moon = root.querySelector(".big-moon");
  if (sky && moon) {
    const skyRect = sky.getBoundingClientRect();
    const moonRect = moon.getBoundingClientRect();
    state.landingSceneX = ((moonRect.left + moonRect.width / 2 - skyRect.left) / skyRect.width) * 100;
    state.landingSceneY = ((moonRect.top + moonRect.height / 2 - skyRect.top) / skyRect.height) * 100;
  }
  state.phase = "landing";
  state.progress = 1;
  state.landingStartedAt = Date.now();
  updateUi();
}

function completeLanding() {
  if (state.phase !== "landing") return;
  settleRun(true);
  void leaderboard?.landed();
  state.phase = "landed";
  updateUi();
  window.setTimeout(() => {
    if (state.phase !== "landed") return;
    state.phase = "replayPrompt";
    speech.shouldListen = true;
    startVoiceInput({ force: true });
    updateUi();
  }, 1700);
}

function settleRun(landed = false) {
  if (state.hasSettledRun) return;
  state.lastEarnedCoins = Math.max(0, Math.floor((state.distanceKm / 100) * state.moneyMultiplier + 1e-9));
  if (!leaderboard?.view.online) state.coins += state.lastEarnedCoins;
  state.hasSettledRun = true;
  state.flightHistory.push({try: state.tryCount, distance: state.distanceKm});
  saveFlightHistory();
  renderFlightMarkers();
  saveEconomy();
}

function failGame(message) {
  if (leaderboard?.view.online) void leaderboard.failed();
  else leaderboard?.invalidate();
  settleRun();
  state.phase = "failed";
  state.status = message;
  speech.shouldListen = true;
  startVoiceInput({ force: true });
  updateUi();
}

function reset() {
  if (leaderboard?.view.online && isRunningPhase()) void leaderboard.abandon();
  else leaderboard?.invalidate();
  state.phase = "waitingLaunch";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.moonSceneStartScroll = 0;
  state.distanceKm = 0;
  state.fuelRemaining = state.fuelCapacity;
  state.lastEarnedCoins = 0;
  state.hasSettledRun = false;
  state.lastTick = Date.now();
  state.manualModeUntil = 0;
  state.clapCount = 0;
  state.clapStartedAt = 0;
  state.lastClapAt = 0;
  state.holdMs = 0;
  state.holdOutMs = 0;
  state.holdStartedAt = 0;
  state.heardSpeech = "";
  state.ufoSeed = Math.random();
  state.ufoStartedAt = 0;
  state.ufoExitStartedAt = 0;
  state.landingSceneX = 50;
  state.landingSceneY = 50;
  state.status = STRINGS[state.language].micStatus;
  speech.shouldListen = true;
  updateUi();
  startVoiceInput({ force: true });
}

function setMeasuredDb(value) {
  if (!canAcceptDb()) return;
  state.db = clampDb(value);
  if (state.phase === "holdPrompt" && (state.db < HOLD_TARGET_MIN || state.db > HOLD_TARGET_MAX)) {
    leaderboard?.record({ type: "hold-reset" });
  }
  if (state.phase === "holdPrompt" && (state.db < HOLD_TARGET_MIN || state.db > HOLD_TARGET_MAX)) {
    // Reset on every sample, including brief excursions between game ticks.
    state.holdMs = 0;
  }
  state.maxDb = Math.max(state.maxDb, state.db);
  updateUi();
}

function registerClap(db) {
  if (state.phase !== "clapPrompt") return;
  state.db = clampDb(db);
  state.maxDb = Math.max(state.maxDb, state.db);
  const now = Date.now();
  if (db < CLAP_DB_THRESHOLD || now - state.lastClapAt < CLAP_MIN_GAP_MS) return;
  leaderboard?.record({ type: "clap", db: clampDb(db), at: now - state.flightStartedAt });
  state.lastClapAt = now;
  state.clapCount += 1;
  if (state.clapCount >= 3) {
    beginLanding();
  } else {
    updateUi();
  }
}

function handleButtonAction(target) {
  if (target.disabled) return false;
  if (microphoneMeter.context?.state === "suspended") microphoneMeter.context.resume().catch(() => {});
  if (target.dataset.action === "open-upgrades") {
    state.upgradeFeedback = "";
    if (!isRunningPhase() && !["preparing", "landing"].includes(state.phase)) root.querySelector(".upgrade-panel")?.showModal();
    return true;
  }
  if (target.dataset.action === "close-upgrades") {
    root.querySelector(".upgrade-panel")?.close();
    return true;
  }
  if (target.dataset.action === "calibrate-meter") {
    const value = root.querySelector(".reference-reading")?.value.trim();
    beginMeterCalibration(value ? Number(value) : NaN);
    updateMeterCalibrationUi();
    return true;
  }
  if (target.dataset.action === "cancel-calibration") {
    microphoneMeter.calibration = null;
    microphoneMeter.message = "";
    updateMeterCalibrationUi();
    return true;
  }
  if (target.dataset.action === "reset") {
    reset();
    return true;
  }
  if (target.dataset.action === "debug-launch") {
    startGame();
    return true;
  }
  if (target.dataset.action === "enable-voice") {
    startVoiceInput({ fromUserGesture: true, force: true });
    return true;
  }
  if (target.dataset.action === "debug-clap") {
    if (leaderboard?.view.online) return true;
    registerClap(90);
    return true;
  }
  if (target.dataset.action === "debug-hold") {
    if (leaderboard?.view.online) return true;
    if (state.phase === "holdPrompt") setMeasuredDb(55);
    return true;
  }
  if (target.dataset.action === "debug-replay") {
    if (state.phase === "replayPrompt" || state.phase === "failed") reset();
    return true;
  }
  if (target.dataset.upgrade) {
    applyUpgrade(target.dataset.upgrade);
    return true;
  }
  if (target.dataset.min && target.dataset.max) {
    if (leaderboard?.view.online) return true;
    if (state.phase === "waitingLaunch") startGame();
    setMeasuredDb(randomDb(Number(target.dataset.min), Number(target.dataset.max)));
    return true;
  }
  return false;
}

function getBoardSize() {
  const mobile = window.innerWidth <= 480;
  const maxWidth = Math.min(window.innerWidth - (mobile ? 0 : 32), 520);
  const maxHeight = Math.max(window.innerHeight - (mobile ? 0 : 170), 620);
  const width = Math.min(maxWidth, maxHeight * BASE_RATIO);
  return { width, height: width / BASE_RATIO };
}

function getSkyHeight() {
  return root.querySelector(".sky")?.clientHeight || getBoardSize().height;
}

function getWorldScrollRatio(progress = state.progress) {
  const distance = clamp(progress, 0, 1) * TOTAL_DISTANCE_KM;
  let start = 0;
  for (let layer = 0; layer < ATMOSPHERE_BACKGROUNDS.length - 1; layer += 1) {
    const length = DISTANCE_SEGMENTS[layer + 1].distance + (layer === 0 ? DISTANCE_SEGMENTS[0].distance : 0);
    if (distance < start + length) return layer * 2 + 2 * (distance - start) / length;
    start += length;
  }
  return ATMOSPHERE_STRIPS.length - 1;
}

function getSceneWorldScrollRatio() {
  const flightScroll = getWorldScrollRatio();
  if (state.phase !== "holdPrompt" && state.phase !== "clapPrompt") return flightScroll;
  // Finish the visual transition into space while gameplay distance is paused.
  const fraction = clamp((Date.now() - state.holdStartedAt) / MOON_REVEAL_DELAY_MS, 0, 1);
  const spaceScroll = ATMOSPHERE_STRIPS.length - 1;
  return Math.max(flightScroll, state.moonSceneStartScroll + (spaceScroll - state.moonSceneStartScroll) * fraction);
}

function getWorldAnchoredViewportY(startProgress, startViewportY) {
  const worldY = startViewportY - getWorldScrollRatio(startProgress);
  return {
    worldY,
    viewportY: worldY + getWorldScrollRatio(),
  };
}

function hudIcon(name) {
  const shapes = {
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v5m-4 2h8m-8-2h8"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
    bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
    drop: '<path d="M12 3S6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/>',
    sound: '<path d="M4 10h4l5-4v12l-5-4H4v-4Zm12-2a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    replay: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
    upgrade: '<path d="m5 11 7-7 7 7M5 19l7-7 7 7"/>',
    warning: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/>',
  };
  return `<svg class="hud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || ""}</svg>`;
}

function flightGauge(kind, icon) {
  return `<div class="flight-gauge gauge-${kind}">
    <svg class="gauge-arc" viewBox="0 0 140 82" aria-hidden="true"><path class="gauge-track" d="M10 72a60 60 0 0 1 120 0" pathLength="100"/><path class="gauge-value" d="M10 72a60 60 0 0 1 120 0" pathLength="100"/></svg>
    <div class="gauge-reading">${hudIcon(icon)}<strong></strong><span>${kind === "speed" ? "km/s" : "Fuel"}</span></div>
    <div class="gauge-caption"></div>
  </div>`;
}

function render() {
  const text = STRINGS[state.language];
  const board = getBoardSize();
  root.querySelectorAll(".background-video").forEach(video => video.pause());
  root.innerHTML = `
    <main class="app">
      <header class="top">
        <h1>${text.title}</h1>
        <p>${text.subtitle}</p>
      </header>
      <section class="phone" style="width:${board.width}px;height:${board.height}px">
        <div class="sky">
          <div class="hud">
            <div class="hud-tools"><button type="button" class="leaderboard-launcher" data-leaderboard="open" aria-label="${state.language === "ko" ? "순위 보기" : "View rankings"}" aria-haspopup="dialog" aria-controls="moon-leaderboard" aria-expanded="${leaderboardOpen}">${hudIcon("trophy")}</button>
            <button class="hud-upgrade" type="button" data-action="open-upgrades">${hudIcon("upgrade")}${state.language === "ko" ? "업그레이드" : "Upgrade"}</button></div>
            <span class="coin-pill">${hudIcon("coin")}<strong></strong><small></small></span>
          </div>
          <div class="distance-markers" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="flight-markers" aria-label="Previous flight heights"></div>
          <div class="mini-map">
            <div class="history-map"></div><img class="mini-pad" src="${asset("Launchpad_Small.png")}" alt="" />
            <img class="mini-moon" src="${asset("MiniMoon_64.png")}" alt="" />
            <img class="mini-rocket" src="${asset("MiniRocket_64.png")}" alt="" />
          </div>
          <div class="world">
            <div class="background-track" aria-hidden="true">
              ${ATMOSPHERE_STRIPS.map((name, index) => `<div class="background-strip" style="${atmosphereStripStyle(name, index)}"><div class="background-art" style="background-image:url('${asset(atmospherePoster(name))}')">
                ${name === "space.png" ? "" : `<video class="background-video" data-strip="${index}" data-video="${asset(name.replace(".png", "-motion.mp4"))}" poster="${asset(atmospherePoster(name))}" muted loop playsinline preload="none" aria-hidden="true" disablepictureinpicture></video>`}
              </div></div>`).join("")}
            </div>
            <div class="launch-pad"></div>
            <img class="big-moon" src="${asset("Moon.png")}" alt="" />
            ${UFO_ENABLED ? `<div class="ufo" aria-hidden="true"><img src="${asset("ufo_128.png")}" alt="" /></div>` : ""}
          </div>
          <div class="speed-trails" aria-hidden="true">${[7, 19, 31, 71, 83, 94].map((x, i) => `<i style="left:${x}%;animation-delay:${-i * 0.17}s"></i>`).join("")}</div>
          <div class="rocket">
            <img class="rocket-art" src="${asset("Rocket_256.png")}" alt="" />
            <div class="flame" aria-hidden="true">
              ${[1, 2, 3, 4, 5].map((level) => ["left", "right"].map(side => `
                <img class="flame-image flame-${side} flame-level-${level}" src="${asset(`Flame_Lv${level}.png`)}" alt="" />
              `).join("")).join("")}
            </div>
          </div>
          <div class="landing-scene" aria-hidden="true">
            <img class="landing-moon" src="${asset("Moon_Rabbit.png")}" alt="" />
            <img class="landing-rocket" src="${asset("Rocket_256.png")}" alt="" />
          </div>
          <div class="center-message"></div>
        </div>
        <section class="flight-dashboard" aria-label="Flight instruments">
          <div class="gauges">${flightGauge("speed", "bolt")}${flightGauge("fuel", "drop")}</div>
        </section>
        <section class="flight-result" hidden aria-labelledby="result-heading">
          <h2 id="result-heading">${text.failed}</h2>
          <div class="result-metrics">
            <div><strong class="result-distance"></strong><small class="result-speed-bonus"></small><span>${text.distance}</span></div>
            <div class="result-coins-column"><strong class="result-coins"></strong><small class="result-money-bonus"></small><span>${text.coins}</span></div>
            <div><strong class="result-to-best"></strong><small class="result-best-spacer" aria-hidden="true">&nbsp;</small><span>${state.language === "ko" ? "최고 기록까지" : "to best"}</span></div>
          </div>
          <div class="flight-result-actions">
            <button type="button" data-action="debug-replay">${hudIcon("replay")}${state.language === "ko" ? "다시 하기" : "Replay"}</button>
            <button type="button" data-action="open-upgrades">${hudIcon("upgrade")}${state.language === "ko" ? "업그레이드" : "Upgrade"}</button>
          </div>
        </section>
        <dialog class="upgrade-panel" aria-labelledby="upgrade-heading">
          <div class="upgrade-heading"><h2 id="upgrade-heading">${state.language === "ko" ? "업그레이드" : "Upgrade"}</h2><button type="button" data-action="close-upgrades" aria-label="Close">✕</button></div>
          <p class="upgrade-wallet"></p>
          <div class="stats-row">
            <button type="button" data-upgrade="speed"><span>Speed</span><strong></strong><small></small></button>
            <button type="button" data-upgrade="fuel"><span>Fuel</span><strong></strong><small></small></button>
            <button type="button" data-upgrade="money"><span>Money</span><strong></strong><small></small></button>
          </div>
          <p class="upgrade-feedback" role="status"></p>
          <button class="upgrade-done" type="button" data-action="close-upgrades">${state.language === "ko" ? "완료" : "Done"}</button>
        </dialog>
        <dialog id="moon-leaderboard" class="leaderboard-panel" aria-labelledby="leaderboard-title">
          <div class="leaderboard-heading">
            <button type="button" data-leaderboard="close" aria-label="${state.language === "ko" ? "리더보드 닫기" : "Close leaderboard"}" autofocus>✕</button>
            <div class="leaderboard-title-group"><span class="leaderboard-stars" aria-hidden="true">✧ 🏆 ✧</span><h2 id="leaderboard-title">${state.language === "ko" ? "달 착륙 랭킹" : "Moon rankings"}</h2><p class="leaderboard-subtitle"></p></div>
            <button type="button" data-leaderboard="profile" aria-label="${state.language === "ko" ? "닉네임 및 내 프로필" : "Edit nickname and profile"}" aria-expanded="${leaderboardProfileOpen}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="7" r="3"/><path d="M3 19v-2a6 6 0 0 1 9-5M14 19l1-4 5-5 3 3-5 5-4 1Z"/></svg></button>
          </div>
          <div class="leaderboard-content"></div>
          <footer class="leaderboard-footnote"><span aria-hidden="true">✦</span><p class="leaderboard-status" role="status" aria-live="polite"></p><span aria-hidden="true">✦</span></footer>
        </dialog>
      </section>
      <footer class="bottom">
        <button type="button" data-action="enable-voice">${text.voiceEnable}</button>
        <button type="button" data-action="debug-launch">Launch</button>
        <button type="button" data-action="debug-clap">Clap</button>
        <button type="button" data-action="debug-hold">55dB</button>
        <button type="button" data-action="debug-replay">Replay</button>
        <select data-action="language">
          <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
          <option value="ko" ${state.language === "ko" ? "selected" : ""}>Korean</option>
        </select>
        <p class="audio-status"></p>
        <p class="measurement-status"></p>
        <details class="calibration-panel">
          <summary>${state.language === "ko" ? "소음계 기준값으로 dB 보정" : "Calibrate dB with a sound meter"}</summary>
          <p>${state.language === "ko" ? "소음계와 마이크를 나란히 놓고 일정한 소리를 유지하세요. 소음계의 현재 값을 입력한 뒤 5초 동안 측정합니다." : "Place the sound meter beside your microphone with a steady sound. Enter its current reading, then measure for 5 seconds."}</p>
          <label>${state.language === "ko" ? "소음계 표시값" : "Reference meter reading"} <input class="reference-reading" type="number" min="20" max="120" step="0.1" placeholder="dB" inputmode="decimal" /></label>
          <span class="calibration-live"></span>
          <button type="button" data-action="calibrate-meter">${state.language === "ko" ? "5초 측정·보정" : "Measure & calibrate (5s)"}</button>
          <button type="button" data-action="cancel-calibration">${state.language === "ko" ? "취소" : "Cancel"}</button>
          <p class="calibration-status" role="status"></p>
          <small>${state.language === "ko" ? "한 기준점에 맞춘 추정치입니다. 소리 종류·마이크 감도·입력 설정이 바뀌면 차이가 납니다. 실제 소음계의 정확도나 dBA/dBC 주파수 보정을 제공하지 않습니다." : "A single-reference estimate. Sound spectrum, mic gain and input settings can change the result. This does not provide sound-meter accuracy or dBA/dBC frequency weighting."}</small>
        </details>
      </footer>
    </main>
  `;
  root.querySelectorAll(".background-video").forEach(video => {
    video.muted = true;
    video.addEventListener("loadeddata", () => {
      // PNG posters and video frames follow different color pipelines in Safari.
      // Show the actual paused video frame before Launch, then resume that frame.
      video.removeAttribute("poster");
      if (video.paused && video.currentTime === 0) video.currentTime = BACKGROUND_STILL_TIME;
      video.classList.add("ready");
    });
    video.addEventListener("error", () => video.classList.remove("ready"));
  });
  renderFlightMarkers();
  updateUi();
  renderLeaderboard();
  root.querySelector(".leaderboard-panel")?.addEventListener("cancel", event => {
    event.preventDefault(); setLeaderboardOpen(false);
  });
  if (leaderboardOpen) setLeaderboardOpen(true);
}

function updateBackgroundMotion() {
  const scroll = getSceneWorldScrollRatio();
  const moving = (isRunningPhase() || state.phase === "landing") && !document.hidden &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll(".background-video").forEach(video => {
    const strip = Number(video.dataset.strip);
    const near = strip >= Math.floor(scroll) - 1 && strip <= Math.floor(scroll) + 2;
    if (near && !video.getAttribute("src")) {
      video.preload = "auto";
      video.src = video.dataset.video;
      video.load();
    }
    const visible = Math.abs(strip - scroll) < 1;
    const play = moving && visible;
    if (play && video.dataset.playing !== "true") {
      video.dataset.playing = "true";
      video.play()?.catch(() => { /* Static poster remains if autoplay is unavailable. */ });
    } else if (!play && video.dataset.playing === "true") {
      video.dataset.playing = "false";
      video.pause();
    }
    if (state.phase === "waitingLaunch" && video.readyState > 0 && video.currentTime > 1 / 30) video.currentTime = BACKGROUND_STILL_TIME;
  });
}

document.addEventListener?.("visibilitychange", updateBackgroundMotion);

function updateUi() {
  updateMeterCalibrationUi();
  const text = STRINGS[state.language];
  const leaderboardButton = root.querySelector(".leaderboard-launcher");
  if (leaderboardButton) leaderboardButton.disabled = isRunningPhase() || ["landing", "preparing"].includes(state.phase);
  const upgradeButton = root.querySelector(".hud-upgrade");
  if (upgradeButton) upgradeButton.disabled = !["waitingLaunch", "failed", "landed", "replayPrompt"].includes(state.phase);
  const displayedDb = state.phase === "waitingLaunch" ? 0 : Math.round(state.db);
  const range = getRange(state.db);
  const flightDistance = clamp(state.progress, 0, 1);
  const fuelRatio = getFuelRatio();
  const ufo = getUfoState();
  const segment = getCurrentSegment();

  const sky = root.querySelector(".sky");
  if (sky) {
    sky.dataset.segment = String(segment.index);
  }

  const coinPill = root.querySelector(".coin-pill");
  if (coinPill) {
    coinPill.querySelector("strong").textContent = formatNumber(state.coins);
    coinPill.querySelector("small").textContent = `×${formatStat(state.moneyMultiplier)}`;
  }
  const dashboard = root.querySelector(".flight-dashboard");
  if (dashboard) {
    dashboard.hidden = state.phase === "failed";
    dashboard.classList.toggle("low-fuel", fuelRatio <= 0.25);
    dashboard.querySelector(".gauge-speed strong").textContent = formatNumber(currentSpeedKms());
    dashboard.querySelector(".gauge-fuel strong").textContent = `${formatStat(state.fuelRemaining)} t`;
    dashboard.querySelector(".gauge-speed .gauge-value").style.strokeDasharray = `${clamp(state.db / 110, 0, 1) * 100} 100`;
    dashboard.querySelector(".gauge-fuel .gauge-value").style.strokeDasharray = `${fuelRatio * 100} 100`;
    dashboard.querySelector(".gauge-speed .gauge-caption").innerHTML = `${hudIcon("sound")}${displayedDb} dB <em>×${formatStat(state.speedMultiplier)}</em>`;
    dashboard.querySelector(".gauge-fuel .gauge-caption").innerHTML = fuelRatio <= 0.25 ? `${hudIcon("warning")}${state.language === "ko" ? "연료 부족!" : "Low fuel!"}` : "";
  }
  const result = root.querySelector(".flight-result");
  if (result) {
    result.hidden = state.phase !== "failed";
    result.querySelector(".result-distance").textContent = formatNumber(Math.floor(state.distanceKm));
    result.querySelector(".result-coins").textContent = `+${formatNumber(state.lastEarnedCoins)}`;
    result.querySelector(".result-speed-bonus").textContent = `×${formatStat(state.speedMultiplier)}`;
    result.querySelector(".result-money-bonus").textContent = `×${formatStat(state.moneyMultiplier)}`;
    result.querySelector(".result-to-best").textContent = `-${formatNumber(Math.max(0, Math.floor((bestFlight()?.distance || 0) - state.distanceKm)))}`;
  }
  const wallet = root.querySelector(".upgrade-wallet");
  if (wallet) wallet.textContent = `${text.coins}: ${formatNumber(state.coins)}`;
  const feedback = root.querySelector(".upgrade-feedback");
  if (feedback) feedback.textContent = leaderboard?.view.busy
    ? (state.language === "ko" ? "처리 중…" : "Processing…")
    : leaderboard?.pendingCount()
      ? (leaderboard.view.error || (state.language === "ko" ? "비행 보상을 저장 중입니다…" : "Saving flight rewards…"))
      : (state.upgradeFeedback || (state.language === "ko" ? "업그레이드할 항목을 선택하세요." : "Choose an upgrade."));

  root.querySelectorAll(".distance-markers span").forEach((marker, index) => {
    // The top of the viewport is farther along the ascent, so markers descend
    // from the largest distance to the smallest near the launch pad.
    marker.textContent = formatNumber(getDistanceMarker(2 - index));
  });

  const world = root.querySelector(".world");
  if (world) world.style.setProperty("--scroll", `${getSceneWorldScrollRatio() * getSkyHeight()}px`);
  updateBackgroundMotion();
  const trails = root.querySelector(".speed-trails");
  if (trails) {
    const moving = isDistancePhase() && currentSpeedKms() > 0;
    trails.classList.toggle("moving", moving);
    trails.style.setProperty("--trail-duration", `${clamp(550 / Math.max(1, currentSpeedKms()), 0.18, 1.5)}s`);
    trails.style.opacity = moving ? clamp(state.db / 110, 0.12, 0.65) : 0;
  }
  const launchPad = root.querySelector(".launch-pad");
  if (launchPad) {
    launchPad.style.backgroundImage = `url("${asset("Launchpad_Big.png")}")`;
    if (state.phase === "waitingLaunch" && dashboard && sky) {
      // Both the sky and instrument panel share the phone's origin. Anchor the
      // pad's visible bottom to the actual panel top, including responsive size.
      sky.style.setProperty("--launch-base", `${sky.getBoundingClientRect().bottom - dashboard.getBoundingClientRect().top}px`);
      sky.style.setProperty("--launch-pad-art-height", `${Math.min(launchPad.clientHeight, launchPad.clientWidth * 189 / 221)}px`);
    }
  }

  const rocket = root.querySelector(".rocket");
  if (rocket) {
    rocket.classList.toggle("launching", state.phase !== "waitingLaunch");
    rocket.classList.toggle("hidden", state.phase === "landing" || state.phase === "landed" || state.phase === "replayPrompt");
  }

  const flame = root.querySelector(".flame");
  if (flame) {
    const step = Math.floor(clamp(state.db, 0, 110) / 5);
    const level = flameLevel(state.db);
    flame.dataset.level = String(level);
    flame.dataset.step = String(step);
    flame.style.width = `${40 + step * 4}px`;
    flame.style.height = `${60 + step * 7}px`;
    flame.style.visibility = state.db > 0 ? "visible" : "hidden";
    flame.style.filter = `brightness(${0.85 + step * 0.025}) saturate(${1 + step * 0.025}) drop-shadow(0 0 ${step * 0.55}px rgba(255,174,0,${0.15 + step * 0.025}))`;
    flame.style.animationDuration = `${Math.max(65, 280 - step * 9)}ms`;
    flame.style.setProperty("--flame-spread", `${2 + step * 0.6}%`);
    flame.style.setProperty("--flame-pulse", String(1.02 + step * 0.004));
    root.querySelectorAll(".flame-image").forEach((image) => {
      image.classList.toggle("active", image.classList.contains(`flame-level-${level}`));
    });
  }

  let bestMarkerY = null;
  root.querySelectorAll(".flight-marker").forEach((marker) => {
    const y = flightMarkerY(Number(marker.dataset.distance));
    marker.style.top = `${y * 100}%`;
    const overlapsBest = bestMarkerY !== null && Math.abs(y - bestMarkerY) * getSkyHeight() < 32;
    marker.hidden = y < 0.08 || y > 0.94 || overlapsBest;
    if (bestMarkerY === null) bestMarkerY = y;
  });
  const miniRocket = root.querySelector(".mini-rocket");
  if (miniRocket) {
    miniRocket.style.bottom = `calc(${flightDistance * 100}% - ${flightDistance * 24}px)`;
  }

  const bigMoon = root.querySelector(".big-moon");
  if (bigMoon) {
    const moon = getMoonState();
    bigMoon.classList.toggle("visible", moon.visible);
    bigMoon.style.top = `${moon.y * 100}%`;
    bigMoon.style.opacity = moon.visible ? moon.opacity : 0;
  }

  const ufoEl = root.querySelector(".ufo");
  if (ufoEl) {
    ufoEl.classList.toggle("visible", ufo.visible);
    ufoEl.style.left = `${ufo.x * 100}%`;
    ufoEl.style.top = `${ufo.y * 100}%`;
    ufoEl.style.opacity = ufo.visible ? ufo.opacity : 0;
  }

  const landingScene = root.querySelector(".landing-scene");
  if (landingScene) {
    landingScene.classList.toggle("visible", state.phase === "landing" || state.phase === "landed" || state.phase === "replayPrompt");
    landingScene.style.left = `${state.landingSceneX}%`;
    landingScene.style.top = `${state.landingSceneY}%`;
  }

  const centerMessage = root.querySelector(".center-message");
  if (centerMessage) {
    centerMessage.className = `center-message phase-${state.phase}`;
    centerMessage.innerHTML = getCenterMessage(text);
  }

  root.querySelectorAll(".stats-row button").forEach((button) => {
    button.disabled = isRunningPhase() || state.phase === "landing" || state.phase === "preparing" || !!leaderboard?.view.busy || !!leaderboard?.pendingCount() || state.coins < upgradeCost(button.dataset.upgrade);
    const price = button.querySelector("small");
    if (price) price.textContent = `${upgradeCost(button.dataset.upgrade)} ${text.coins}`;
  });

  const stats = root.querySelectorAll(".stats-row button strong");
  if (stats[0]) stats[0].textContent = `×${formatStat(state.speedMultiplier)} → ×${formatStat(nextUpgradeValue("speed"))}`;
  if (stats[1]) stats[1].textContent = `${formatStat(state.fuelCapacity)} → ${formatStat(nextUpgradeValue("fuel"))} t`;
  if (stats[2]) stats[2].textContent = `×${formatStat(state.moneyMultiplier)} → ×${formatStat(nextUpgradeValue("money"))}`;

  const footerStatus = root.querySelector(".audio-status");
  if (footerStatus) {
    const heard = state.heardSpeech ? `${text.voiceHeard}: ${state.heardSpeech}` : "";
    const syncError = leaderboard?.view.online && leaderboard.view.status === "error" ? leaderboard.view.error : "";
    footerStatus.textContent = [state.status, state.speechStatus, heard, syncError].filter(Boolean).join(" ");
  }

  root.querySelectorAll(".buttons button").forEach((button) => {
    button.classList.toggle("active", canAcceptDb() && button.dataset.rangeId === range.id);
  });
}

function getCenterMessage(text) {
  if (state.phase === "waitingLaunch") return text.waitingLaunch;
  if (state.phase === "flying") {
    if (state.progress >= MOON_TRIGGER_PROGRESS * 0.92 && hasUfoClearedRocketForChallenge()) {
      return `<strong>${text.getReadyHold}</strong><span>${text.holdHint}</span>`;
    }
    if (UFO_ENABLED && state.progress >= UFO_TRIGGER_PROGRESS) {
      return `<strong>${text.avoidUfo}</strong><span>${text.avoidUfoHint}</span>`;
    }
    return Date.now() - state.flightStartedAt < 3000 ? text.flying : "";
  }
  if (state.phase === "clapPrompt") {
    const clapsLeft = Math.max(0, 3 - state.clapCount);
    const secondsLeft = Math.max(0, Math.ceil((CLAP_WINDOW_MS - (Date.now() - state.clapStartedAt)) / 1000));
    return `<strong>${text.clapPrompt}</strong><span>${text.clapHint}</span><span class="challenge-count">${clapsLeft} / ${secondsLeft}s</span>`;
  }
  if (state.phase === "holdPrompt") {
    const seconds = Math.max(0, Math.ceil((HOLD_REQUIRED_MS - state.holdMs) / 1000));
    return `<strong>${text.holdPrompt}</strong><span>${text.holdHint}</span><span class="challenge-count">${seconds}s</span>`;
  }
  if (state.phase === "landing") return text.landing;
  if (state.phase === "landed") return `<strong>${text.landedTitle}</strong><span>${text.landedBody}</span>`;
  if (state.phase === "replayPrompt") return text.replayPrompt;
  if (state.phase === "failed") return "";
  return "";
}

function getUpgradeLine(type, label) {
  const current =
    type === "speed" ? state.speedMultiplier : type === "fuel" ? state.fuelCapacity : state.moneyMultiplier;
  const next = nextUpgradeValue(type);
  const cost = upgradeCost(type);
  return `<button type="button" data-upgrade="${type}">[${label}: ${formatStat(current)} -> ${formatStat(next)}: ${cost}]</button>`;
}

function getUfoState() {
  const position = getWorldAnchoredViewportY(UFO_TRIGGER_PROGRESS, -0.08);
  const exitingMs = state.ufoExitStartedAt > 0 ? Date.now() - state.ufoExitStartedAt : 0;
  const exitOffset = state.ufoExitStartedAt > 0 ? Math.min(1.25, exitingMs / 2800) : 0;
  const viewportY = position.viewportY + exitOffset;
  const activePhase =
    state.phase === "flying" ||
    state.phase === "holdPrompt" ||
    state.phase === "clapPrompt" ||
    state.phase === "landing" ||
    state.phase === "landed";
  const visible = UFO_ENABLED && activePhase && state.progress >= UFO_TRIGGER_PROGRESS && viewportY < 1.32;
  const elapsed = state.ufoStartedAt > 0 ? Date.now() - state.ufoStartedAt : 0;
  const wave = Math.cos(elapsed / 5200);
  return {
    visible,
    x: clamp(0.5 + wave * 0.28, 0.18, 0.82),
    y: position.worldY + exitOffset,
    viewportY,
    opacity: 1,
  };
}

function getMoonState() {
  const activePhase = state.phase === "flying" || state.phase === "clapPrompt" || state.phase === "holdPrompt";
  const position = getWorldAnchoredViewportY(MOON_APPEAR_PROGRESS, -0.22);
  const viewportY = 0.5;
  const revealReady = (state.phase === "holdPrompt" || state.phase === "clapPrompt") &&
    Date.now() - state.holdStartedAt >= MOON_REVEAL_DELAY_MS;
  const visible = activePhase && revealReady && state.progress >= MOON_APPEAR_PROGRESS && viewportY < 1.05;
  const fadeIn = clamp((viewportY + 0.2) / 0.12, 0, 1);
  return {
    visible,
    // Keep the moon's screen position while the satellite background clears.
    y: viewportY - getSceneWorldScrollRatio(),
    viewportY,
    opacity: fadeIn,
  };
}

function checkUfoCollision() {
  const text = STRINGS[state.language];
  const ufo = getUfoState();
  if (!ufo.visible) return;
  const ufoBody = root.querySelector(".ufo");
  const rocketArt = root.querySelector(".rocket-art");
  if (!ufoBody || !rocketArt) return;
  const ufoRect = ufoBody.getBoundingClientRect();
  const rocketRect = rocketArt.getBoundingClientRect();
  const rocketHit = {
    left: rocketRect.left + rocketRect.width * 0.32,
    right: rocketRect.right - rocketRect.width * 0.32,
    top: rocketRect.top + rocketRect.height * 0.18,
    bottom: rocketRect.top + rocketRect.height * 0.84,
  };
  const ufoHit = {
    left: ufoRect.left + ufoRect.width * 0.24,
    right: ufoRect.right - ufoRect.width * 0.24,
    top: ufoRect.top + ufoRect.height * 0.34,
    bottom: ufoRect.bottom - ufoRect.height * 0.28,
  };
  const overlapsX = ufoHit.right >= rocketHit.left && ufoHit.left <= rocketHit.right;
  const overlapsY = ufoHit.bottom >= rocketHit.top && ufoHit.top <= rocketHit.bottom;
  if (overlapsX && overlapsY) {
    failGame(text.ufoFailed);
  }
}

function hasUfoClearedRocketForChallenge() {
  if (!UFO_ENABLED) return true;
  const ufoEl = root.querySelector(".ufo");
  const rocketArt = root.querySelector(".rocket-art");
  if (!ufoEl || !rocketArt) return state.progress >= UFO_END_PROGRESS;
  const ufoRect = ufoEl.getBoundingClientRect();
  const rocketRect = rocketArt.getBoundingClientRect();
  return ufoRect.top >= rocketRect.bottom + 18;
}

function updateGame(delta) {
  if (isRunningPhase()) leaderboard?.record({ type: "tick", delta, db: state.db });
  const text = STRINGS[state.language];
  const flightDelta = isRunningPhase() ? Math.min(delta, state.fuelRemaining * 1000 / BALANCE.fuelBurnPerSecond) : delta;
  if (isDistancePhase()) {
    state.distanceKm = Math.min(TOTAL_DISTANCE_KM * MOON_TRIGGER_PROGRESS, state.distanceKm + currentSpeedKms() * (flightDelta / 1000));
    syncProgressFromDistance();
  }
  if (isRunningPhase()) {
    state.fuelRemaining = Math.max(0, state.fuelRemaining - (delta / 1000) * BALANCE.fuelBurnPerSecond);
    if (state.fuelRemaining <= 1e-9) {
      state.fuelRemaining = 0;
      failGame(text.energyFailed);
      return;
    }
  }

  if (isDistancePhase()) {
    checkUfoCollision();
    if (!isDistancePhase()) return;
  }

  if (state.phase === "flying") {
    checkUfoCollision();
    if (state.phase !== "flying") return;
    if (state.progress >= MOON_TRIGGER_PROGRESS && hasUfoClearedRocketForChallenge()) beginHoldChallenge();
  }

  if (state.phase === "clapPrompt" && Date.now() - state.clapStartedAt > CLAP_WINDOW_MS) {
    failGame(text.clapFailed);
  }

  if (state.phase === "holdPrompt") {
    if (state.db >= HOLD_TARGET_MIN && state.db <= HOLD_TARGET_MAX) {
      state.holdMs += delta;
      state.holdOutMs = 0;
    } else {
      state.holdMs = 0;
      if (Date.now() - state.holdStartedAt < HOLD_START_GRACE_MS) {
        state.holdOutMs = 0;
      } else {
        state.holdOutMs += delta;
      }
    }
    if (state.holdOutMs > HOLD_FAIL_GRACE_MS) {
      failGame(text.holdFailed);
      return;
    }
    if (state.holdMs >= HOLD_REQUIRED_MS) beginClapChallenge();
  }

  if (state.phase === "landing" && Date.now() - state.landingStartedAt > 1400) {
    completeLanding();
  }
}

root.addEventListener("pointerdown", (event) => {
  speech.hasUserGesture = true;
  const target = event.target.closest("button");
  if (!target) return;
  // Purchases use the native click event: mouse, touch and keyboard all reach
  // the same path, and a press/release can never charge twice.
  if (target.dataset.upgrade) return;
  if (handleButtonAction(target)) {
    state.lastButtonActionAt = Date.now();
    event.preventDefault();
  }
});

root.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.upgrade) {
    handleButtonAction(target);
    event.preventDefault();
    return;
  }
  if (target.dataset.action || (target.dataset.min && target.dataset.max)) {
    if (Date.now() - state.lastButtonActionAt > 250) {
      handleButtonAction(target);
      state.lastButtonActionAt = Date.now();
    }
    event.preventDefault();
  }
});

root.addEventListener("change", (event) => {
  if (event.target.hasAttribute?.("data-leaderboard-period")) {
    void leaderboard?.refresh(event.target.value);
    return;
  }
  if (event.target.dataset.action !== "language") return;
  state.language = event.target.value;
  writeStoredValue("settings.language", state.language);
  state.status = STRINGS[state.language].micStatus;
  render();
});

root.addEventListener("click", event => {
  const action = event.target.closest("[data-leaderboard]")?.dataset.leaderboard;
  if (action === "open" && !isRunningPhase() && !["landing", "preparing"].includes(state.phase)) {
    setLeaderboardOpen(true); void leaderboard?.refresh();
  }
  if (action === "close") setLeaderboardOpen(false);
  if (action === "profile") {
    leaderboardProfileOpen = !leaderboardProfileOpen;
    renderLeaderboard();
    if (leaderboardProfileOpen) root.querySelector('.leaderboard-name input')?.focus();
    else root.querySelector('[data-leaderboard="profile"]')?.focus();
  }
  if (action === "refresh") void leaderboard?.refresh();
  if (action === "retry") void leaderboard?.retry();

});
root.addEventListener("submit", event => {
  if (!event.target.matches(".leaderboard-name")) return;
  event.preventDefault();
  const name = new FormData(event.target).get("playerName").trim();
  if (name && leaderboard) void leaderboard.rename(name).then(saved => {
    if (!saved) return;
    leaderboardProfileOpen = false;
    renderLeaderboard();
    if (leaderboardOpen) root.querySelector('[data-leaderboard="profile"]')?.focus();
  });
});
window.addEventListener("online", () => { void leaderboard?.retry(); });

window.addEventListener("resize", render);

window.setInterval(() => {
  const now = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;
  updateGame(delta);
  updateUi();
}, 50);

function normalizeSpeechText(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
}

function transcriptMatchesAny(transcript, words) {
  const normalized = normalizeSpeechText(transcript);
  return words.some((word) => normalized.includes(word));
}

function readSpeechTranscript(event) {
  const transcripts = [];
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
      const transcript = result[alternativeIndex]?.transcript;
      if (transcript) transcripts.push(transcript);
    }
  }
  return transcripts.join(" ");
}

function handleSpeechTranscript(transcript) {
  if (leaderboardOpen) return;
  if (!transcript) return;
  state.heardSpeech = normalizeSpeechText(transcript).slice(0, 36);
  if (state.phase === "waitingLaunch" && transcriptMatchesAny(transcript, LAUNCH_WORDS)) {
    startGame();

  } else if ((state.phase === "replayPrompt" || state.phase === "failed") && transcriptMatchesAny(transcript, REPLAY_WORDS)) {
    reset();
  } else {
    updateUi();
  }
}

function scheduleSpeechRestart(delay = 700) {
  if (
    !speech.shouldListen ||
    (state.phase !== "waitingLaunch" &&
      state.phase !== "replayPrompt" &&
      state.phase !== "failed")
  ) {
    return;
  }
  window.clearTimeout(speech.restartTimer);
  speech.restartTimer = window.setTimeout(() => {
    startSpeechRecognition({ force: true });
  }, delay);
}

function stopSpeechRecognition() {
  speech.shouldListen = false;
  window.clearTimeout(speech.restartTimer);
  state.speechStatus = "";
  if (!speech.recognition || (!speech.isListening && !speech.isStarting)) return;
  try {
    speech.recognition.abort();
  } catch {
    speech.isStarting = false;
    speech.isListening = false;
  }
}

function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    speech.isStarting = false;
    if (!speech.shouldListen) {
      recognition.abort();
      return;
    }
    speech.isListening = true;
    // start() only requests a session; onstart confirms that it actually began.
    if (!speech.lastError) state.speechStatus = STRINGS[state.language].voiceReady;
    updateUi();
  };

  recognition.onresult = (event) => {
    if (!speech.shouldListen || !speech.isListening) return;
    speech.lastError = "";
    speech.networkFailures = 0;
    state.speechStatus = STRINGS[state.language].voiceReady;
    handleSpeechTranscript(readSpeechTranscript(event));
  };

  recognition.onerror = (event) => {
    speech.lastError = event.error;
    const text = STRINGS[state.language];
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.speechStatus = text.voicePermission;
      speech.shouldListen = false;
    } else if (event.error === "network") {
      speech.networkFailures += 1;
      state.speechStatus = text.voiceNetwork;
      speech.retryDelay = 1500 * speech.networkFailures;
      if (speech.networkFailures >= 3) speech.shouldListen = false;
    } else if (event.error === "audio-capture") {
      state.speechStatus = "Speech recognition cannot access the microphone. Press Voice to retry.";
      speech.shouldListen = false;
    } else if (event.error === "no-speech") {
      speech.lastError = "";
      state.speechStatus = text.voiceStarting;
      speech.retryDelay = 350;
    } else if (event.error !== "aborted") {
      state.speechStatus = `Speech recognition error: ${event.error}`;
      speech.shouldListen = false;
    }
    // Restart only after onend: an error does not mean the session has ended.
    updateUi();
  };

  recognition.onend = () => {
    speech.isListening = false;
    speech.isStarting = false;
    if (speech.shouldListen && !speech.lastError) {
      state.speechStatus = STRINGS[state.language].voiceStarting;
    }
    scheduleSpeechRestart(speech.retryDelay);
    updateUi();
  };
  return recognition;
}

function startSpeechRecognition(options = {}) {
  const text = STRINGS[state.language];
  if (options.fromUserGesture) {
    speech.hasUserGesture = true;
    speech.shouldListen = true;
    speech.lastError = "";
    speech.networkFailures = 0;
    speech.retryDelay = 350;
  }
  if (!speech.shouldListen && !options.force) return;
  if (
    state.phase !== "waitingLaunch" &&
    state.phase !== "replayPrompt" &&
    state.phase !== "failed"
  ) return;
  if (speech.isListening || speech.isStarting) return;
  window.clearTimeout(speech.restartTimer);
  speech.shouldListen = true;
  if (!speech.recognition) speech.recognition = createSpeechRecognition();
  if (!speech.recognition) {
    state.speechStatus = text.speechUnsupported;
    speech.shouldListen = false;
    updateUi();
    return;
  }
  try {
    speech.isStarting = true;
    if (!speech.lastError) state.speechStatus = text.voiceStarting;
    speech.recognition.start();
  } catch (error) {
    speech.isStarting = false;
    speech.isListening = false;
    speech.shouldListen = false;
    state.speechStatus = error instanceof Error ? error.message : "Speech recognition could not start. Press Voice to retry.";
  } finally {
    updateUi();
  }
}

function startVoiceInput(options = {}) {
  if (window.SHOUT_MOON_NATIVE_AUDIO) {
    speech.shouldListen = true;
    if (options.fromUserGesture) speech.hasUserGesture = true;
    return;
  }
  startSpeechRecognition(options);
}

async function startMeter() {
  if (!navigator.mediaDevices?.getUserMedia) {
    state.status = "Browser microphone API is not available.";
    render();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false, channelCount: 1 } });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Browser audio analysis API is not available.");
    }
    const audioContext = new AudioContextClass();
    microphoneMeter.context = audioContext;
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    selectMeterDevice(JSON.stringify({ device: settings.deviceId || track.label, sampleRate: settings.sampleRate || audioContext.sampleRate,
      agc: settings.autoGainControl, noise: settings.noiseSuppression, echo: settings.echoCancellation }),
      settings.autoGainControl === true || settings.noiseSuppression === true || settings.echoCancellation === true);
    track.addEventListener("ended", () => { microphoneMeter.ready = false; microphoneMeter.calibration = null; setMeasuredDb(0); });
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    if (state.status === STRINGS[state.language].micStatus) state.status = "";
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    function tick() {
      if (audioContext.state === "running" && track.readyState === "live" && !track.muted) {
        analyser.getFloatTimeDomainData(samples);
        const frame = microphoneFrame(samples);
        acceptMicrophoneFrame(frame.dbfs, frame.peak);
      } else {
        microphoneMeter.ready = false;
        microphoneMeter.calibration = null;
        setMeasuredDb(0);
      }
      requestAnimationFrame(tick);
    }

    tick();
  } catch (error) {
    state.status = error instanceof Error ? error.message : "Microphone dB measurement failed.";
    render();
  }
}

window.addEventListener("native-decibel", (event) => {
  const dbfs = Number(event.detail?.dbfs);
  if (!Number.isFinite(dbfs)) return;
  selectMeterDevice(`native:${String(event.detail?.device || "default")}`);
  acceptMicrophoneFrame(dbfs, Number(event.detail?.peak) || 0);
});

window.addEventListener("native-speech", (event) => {
  handleSpeechTranscript(String(event.detail?.transcript ?? ""));
});

window.addEventListener("native-audio-status", (event) => {
  const message = String(event.detail?.message ?? "");
  if (!message) return;
  state.status = message;
  updateUi();
});

loadEconomy();
render();
void leaderboard?.retry();
if (leaderboard?.view.online) void leaderboard.connect();
else if (leaderboard && state.tryCount === 0 && state.coins === 0 && state.speedMultiplier === 10 && state.fuelCapacity === 10 && state.moneyMultiplier === 1) {
  void leaderboard.connect('new');
}
if (!window.SHOUT_MOON_NATIVE_AUDIO) {
  startVoiceInput();
  startMeter();
}
