const BASE_WIDTH = 1179;
const BASE_HEIGHT = 2556;
const BASE_RATIO = BASE_WIDTH / BASE_HEIGHT;
const UFO_TRIGGER_PROGRESS = 0.03;
const UFO_END_PROGRESS = 0.62;
const MOON_TRIGGER_PROGRESS = 0.62;
const MOON_APPEAR_PROGRESS = 0.36;
const WORLD_SCROLL_PIXELS = 4200;
const CLOUD_SCROLL_PIXELS = 360;
const CLAP_WINDOW_MS = 8000;
const CLAP_MIN_GAP_MS = 260;
const CLAP_DB_THRESHOLD = 72;
const HOLD_TARGET_MIN = 50;
const HOLD_TARGET_MAX = 60;
const HOLD_REQUIRED_MS = 5000;
const HOLD_FAIL_GRACE_MS = 2200;
const HOLD_START_GRACE_MS = 1500;
const LAUNCH_WORDS = ["launch", "launched", "launches", "lunch", "런치", "론치"];
const SEPARATION_WORDS = ["separation", "separate", "세퍼레이션", "세퍼레이션이라고", "분리"];
const REPLAY_WORDS = ["replay", "yes", "restart", "again", "예스", "다시", "리플레이"];

const DEFAULT_STATS = {
  speed: 10,
  fuel: 10,
  money: 1,
  coins: 0,
};

const UPGRADE_COSTS = {
  speed: [
    { min: 10, max: 20, cost: 50 },
    { min: 21, max: 30, cost: 100 },
    { min: 31, max: 40, cost: 150 },
    { min: 41, max: 50, cost: 200 },
    { min: 51, max: Infinity, cost: 250 },
  ],
  fuel: [
    { min: 10, max: 20, cost: 50 },
    { min: 21, max: 30, cost: 100 },
    { min: 31, max: 40, cost: 150 },
    { min: 41, max: 50, cost: 200 },
    { min: 51, max: Infinity, cost: 250 },
  ],
  money: [
    { min: 1, max: 2, cost: 50 },
    { min: 2.1, max: 3, cost: 100 },
    { min: 3.1, max: 4, cost: 150 },
    { min: 4.1, max: 5, cost: 200 },
    { min: 5.1, max: Infinity, cost: 250 },
  ],
};

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

const CLOUDS = [
  { x: 0.14, y: 0.1, scale: 0.48, front: false, delay: 0 },
  { x: 0.7, y: 0.18, scale: 0.54, front: true, delay: 0.15 },
  { x: 0.24, y: 0.3, scale: 0.58, front: true, delay: 0.3 },
  { x: 0.72, y: 0.42, scale: 0.5, front: false, delay: 0.45 },
  { x: 0.16, y: 0.54, scale: 0.64, front: true, delay: 0.6 },
  { x: 0.62, y: 0.62, scale: 0.52, front: false, delay: 0.75 },
  { x: 0.34, y: 0.76, scale: 0.44, front: false, delay: 0.9 },
  { x: 0.78, y: 0.86, scale: 0.58, front: true, delay: 1.05 },
  { x: 0.46, y: 1.02, scale: 0.5, front: false, delay: 1.2 },
  { x: 0.12, y: 1.18, scale: 0.62, front: true, delay: 1.35 },
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
    separationPrompt: "Say “Separation”",
    separationHint: "연료가 50% 남았습니다",
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
    voiceReady: "Launch 음성 인식 대기 중",
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
    separationPrompt: "Say “Separation”",
    separationHint: "Fuel is at 50%",
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
    voiceReady: "Listening for Launch",
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
  separationDone: false,
  lastTick: Date.now(),
  manualModeUntil: 0,
  lastButtonActionAt: 0,
  clapCount: 0,
  clapStartedAt: 0,
  lastClapAt: 0,
  holdMs: 0,
  holdOutMs: 0,
  holdStartedAt: 0,
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

const speech = {
  recognition: null,
  isListening: false,
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
  saveEconomy();
  state.fuelRemaining = state.fuelCapacity;
}

function saveEconomy() {
  writeStoredValue("stats.speed", String(state.speedMultiplier));
  writeStoredValue("stats.fuel", String(state.fuelCapacity));
  writeStoredValue("stats.money", String(state.moneyMultiplier));
  writeStoredValue("stats.coins", String(state.coins));
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
  return Math.round(0.012 * state.db * state.db * state.speedMultiplier);
}

function getFuelRatio() {
  return clamp(state.fuelRemaining / Math.max(1, state.fuelCapacity), 0, 1);
}

function syncProgressFromDistance() {
  state.progress = clamp(state.distanceKm / TOTAL_DISTANCE_KM, 0, 1);
}

function upgradeCost(type) {
  const value =
    type === "speed" ? state.speedMultiplier : type === "fuel" ? state.fuelCapacity : state.moneyMultiplier;
  const table = UPGRADE_COSTS[type] ?? [];
  const fallback = table.length > 0 ? table[table.length - 1].cost : 0;
  return table.find((entry) => value >= entry.min && value <= entry.max)?.cost ?? fallback;
}

function nextUpgradeValue(type) {
  if (type === "money") return Number((state.moneyMultiplier + 0.1).toFixed(1));
  if (type === "fuel") return state.fuelCapacity + 1;
  return state.speedMultiplier + 1;
}

function applyUpgrade(type) {
  const cost = upgradeCost(type);
  if (state.coins < cost) return false;
  state.coins -= cost;
  if (type === "speed") state.speedMultiplier = nextUpgradeValue(type);
  if (type === "fuel") state.fuelCapacity = nextUpgradeValue(type);
  if (type === "money") state.moneyMultiplier = nextUpgradeValue(type);
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

function getDistanceMarker(index) {
  if (state.distanceKm < 100) return (index + 1) * 100;
  const center = Math.max(100, Math.round(state.distanceKm / 100) * 100);
  return Math.max(0, center + (index - 1) * 100);
}

function flameLevel(db) {
  if (db < 40) return 1;
  if (db < 60) return 2;
  if (db < 80) return 3;
  if (db < 100) return 4;
  return 5;
}

function isRunningPhase() {
  return (
    state.phase === "flying" ||
    state.phase === "separationPrompt" ||
    state.phase === "clapPrompt" ||
    state.phase === "holdPrompt"
  );
}

function canAcceptDb() {
  return state.phase === "flying" || state.phase === "separationPrompt" || state.phase === "holdPrompt";
}

function isDistancePhase() {
  return state.phase === "flying" || state.phase === "separationPrompt";
}

function startGame() {
  if (state.phase !== "waitingLaunch") return;
  speech.shouldListen = false;
  stopSpeechRecognition();
  state.phase = "flying";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.distanceKm = 0;
  state.fuelRemaining = state.fuelCapacity;
  state.lastEarnedCoins = 0;
  state.hasSettledRun = false;
  state.separationDone = false;
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
}

function beginSeparationPrompt() {
  if (state.phase !== "flying" || state.separationDone) return;
  state.phase = "separationPrompt";
  state.status = "";
  speech.shouldListen = true;
  startVoiceInput({ force: true });
  updateUi();
}

function completeSeparation() {
  if (state.phase !== "separationPrompt") return;
  state.phase = "flying";
  state.separationDone = true;
  state.status = "";
  updateUi();
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

function failGame(message) {
  if (!state.hasSettledRun) {
    state.lastEarnedCoins = Math.max(0, Math.floor((state.distanceKm / 100) * state.moneyMultiplier));
    state.coins += state.lastEarnedCoins;
    state.hasSettledRun = true;
    saveEconomy();
  }
  state.phase = "failed";
  state.status = message;
  speech.shouldListen = true;
  startVoiceInput({ force: true });
  updateUi();
}

function reset() {
  state.phase = "waitingLaunch";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.distanceKm = 0;
  state.fuelRemaining = state.fuelCapacity;
  state.lastEarnedCoins = 0;
  state.hasSettledRun = false;
  state.separationDone = false;
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
  state.maxDb = Math.max(state.maxDb, state.db);
  updateUi();
}

function registerClap(db) {
  if (state.phase !== "clapPrompt") return;
  state.db = clampDb(db);
  state.maxDb = Math.max(state.maxDb, state.db);
  const now = Date.now();
  if (db < CLAP_DB_THRESHOLD || now - state.lastClapAt < CLAP_MIN_GAP_MS) return;
  state.lastClapAt = now;
  state.clapCount += 1;
  if (state.clapCount >= 3) {
    beginLanding();
  } else {
    updateUi();
  }
}

function handleButtonAction(target) {
  if (target.dataset.action === "reset") {
    reset();
    return true;
  }
  if (target.dataset.action === "debug-launch") {
    startGame();
    return true;
  }
  if (target.dataset.action === "debug-separation") {
    completeSeparation();
    return true;
  }
  if (target.dataset.action === "enable-voice") {
    startVoiceInput({ fromUserGesture: true, force: true });
    return true;
  }
  if (target.dataset.action === "debug-clap") {
    registerClap(90);
    return true;
  }
  if (target.dataset.action === "debug-hold") {
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
    if (state.phase === "waitingLaunch") startGame();
    setMeasuredDb(randomDb(Number(target.dataset.min), Number(target.dataset.max)));
    return true;
  }
  return false;
}

function getBoardSize() {
  const maxWidth = Math.min(window.innerWidth - 32, 520);
  const maxHeight = Math.max(window.innerHeight - 170, 620);
  const width = Math.min(maxWidth, maxHeight * BASE_RATIO);
  return { width, height: width / BASE_RATIO };
}

function getSkyHeight() {
  return getBoardSize().height - 136;
}

function getWorldScrollRatio(progress = state.progress) {
  return (clamp(progress, 0, 1) * WORLD_SCROLL_PIXELS) / getSkyHeight();
}

function getCloudScrollRatio(progress = state.progress) {
  return (clamp(progress, 0, 1) * CLOUD_SCROLL_PIXELS) / getSkyHeight();
}

function getWorldAnchoredViewportY(startProgress, startViewportY) {
  const worldY = startViewportY - getWorldScrollRatio(startProgress) - getCloudScrollRatio(startProgress);
  return {
    worldY,
    viewportY: worldY + getWorldScrollRatio() + getCloudScrollRatio(),
  };
}

function render() {
  const text = STRINGS[state.language];
  const board = getBoardSize();
  root.style.setProperty("--cloud-image", `url("${asset("clouds.png")}")`);
  root.innerHTML = `
    <main class="app">
      <header class="top">
        <h1>${text.title}</h1>
        <p>${text.subtitle}</p>
      </header>
      <section class="phone" style="width:${board.width}px;height:${board.height}px">
        <div class="sky">
          <div class="atmosphere-layer" aria-hidden="true"></div>
          <div class="hud">
            <span class="timer"></span>
            <span class="coin-pill"></span>
          </div>
          <div class="distance-markers" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="mini-map">
            <img class="mini-moon" src="${asset("MiniMoon_64.png")}" alt="" />
            <img class="mini-rocket" src="${asset("MiniRocket_64.png")}" alt="" />
          </div>
          <div class="world">
            <div class="background-track" aria-hidden="true">
              ${["troposphere.png", "stratosphere.png", "mesosphere.png", "thermosphere.png", "exosphere.png", "space.png"].map((name, index) => `<div class="background-strip background-strip-${index}" style="background-image:url('${asset(name)}')"></div>`).join("")}
            </div>
            <div class="launch-pad"></div>
            ${CLOUDS.map((cloud, index) => `
              <div class="cloud cloud-${index} ${cloud.front ? "front-cloud" : "back-cloud"}"><img src="${asset("clouds.png")}" alt="" /></div>
            `).join("")}
            <img class="big-moon" src="${asset("Moon.png")}" alt="" />
            <div class="ufo" aria-hidden="true">
              <img src="${asset("ufo_128.png")}" alt="" />
            </div>
          </div>
          <div class="rocket">
            <img class="rocket-art" src="${asset("Rocket_256.png")}" alt="" />
            <div class="flame" aria-hidden="true">
              ${[1, 2, 3, 4, 5].map((level) => `
                <img class="flame-image flame-level-${level}" src="${asset(`Flame_Lv${level}.png`)}" alt="" />
              `).join("")}
            </div>
          </div>
          <div class="landing-scene" aria-hidden="true">
            <img class="landing-moon" src="${asset("Moon_Rabbit.png")}" alt="" />
            <img class="landing-rocket" src="${asset("Rocket_256.png")}" alt="" />
          </div>
          <div class="center-message"></div>
        </div>
        <div class="stats-row">
          <button type="button" data-upgrade="speed"><span>Speed</span><strong></strong></button>
          <button type="button" data-upgrade="fuel"><span>Fuel</span><strong></strong></button>
          <button type="button" data-upgrade="money"><span>Money</span><strong></strong></button>
        </div>
        <div class="meter">
          <span class="fuel-fill"></span>
          <strong></strong>
        </div>
      </section>
      <footer class="bottom">
        <button type="button" data-action="enable-voice">${text.voiceEnable}</button>
        <button type="button" data-action="debug-launch">Launch</button>
        <button type="button" data-action="debug-separation">Separation</button>
        <button type="button" data-action="debug-clap">Clap</button>
        <button type="button" data-action="debug-hold">55dB</button>
        <button type="button" data-action="debug-replay">Replay</button>
        <select data-action="language">
          <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
          <option value="ko" ${state.language === "ko" ? "selected" : ""}>Korean</option>
        </select>
        <div class="buttons">
          ${DB_RANGES.map((item) => `
            <button type="button" data-range-id="${item.id}" data-min="${item.min}" data-max="${item.max}">
              <span>${item.label[0]}</span><span>${item.label[1]}</span>
            </button>
          `).join("")}
        </div>
        <p></p>
      </footer>
    </main>
  `;
  updateUi();
}

function updateUi() {
  const text = STRINGS[state.language];
  const displayedDb = state.phase === "waitingLaunch" ? 0 : Math.round(state.db);
  const range = getRange(state.db);
  const flightDistance = clamp(state.progress, 0, 1);
  const fuelRatio = getFuelRatio();
  const ufo = getUfoState();
  const segment = getCurrentSegment();

  const sky = root.querySelector(".sky");
  if (sky) {
    sky.dataset.segment = String(segment.index);
    const backgrounds = ["Launchpad_Big.png", "troposphere.png", "stratosphere.png", "mesosphere.png", "thermosphere.png", "exosphere.png", "space.png"];
    const atmosphere = sky.querySelector(".atmosphere-layer");
    if (atmosphere) {
      const nextBackground = segment.index <= 1 ? "none" : `url("${asset(backgrounds[segment.index] ?? "space.png")}")`;
      if (atmosphere.dataset.segment !== String(segment.index)) {
        atmosphere.dataset.segment = String(segment.index);
        atmosphere.classList.remove("reveal");
        void atmosphere.offsetWidth;
        atmosphere.classList.add("reveal");
      }
      atmosphere.style.backgroundImage = nextBackground;
    }
  }

  const timer = root.querySelector(".timer");
  if (timer) timer.textContent = `Fuel: ${formatStat(state.fuelRemaining)} t`;

  const coinPill = root.querySelector(".coin-pill");
  if (coinPill) coinPill.textContent = `${text.coins}: ${formatNumber(state.coins)}`;

  root.querySelectorAll(".distance-markers span").forEach((marker, index) => {
    // The top of the viewport is farther along the ascent, so markers descend
    // from the largest distance to the smallest near the launch pad.
    marker.textContent = formatNumber(getDistanceMarker(2 - index));
  });

  const world = root.querySelector(".world");
  if (world) world.style.setProperty("--scroll", `${flightDistance * WORLD_SCROLL_PIXELS}px`);
  const launchPad = root.querySelector(".launch-pad");
  if (launchPad) launchPad.style.backgroundImage = `url("${asset("Launchpad_Big.png")}")`;

  root.querySelectorAll(".cloud").forEach((cloud, index) => {
    const config = CLOUDS[index];
    cloud.style.display = segment.index === 1 ? "none" : "block";
    const drift = Math.sin((Date.now() / 9000 + config.delay) * Math.PI * 2) * 28;
    cloud.style.left = `${config.x * 100}%`;
    cloud.style.top = `${config.y * 100}%`;
    cloud.style.transform = `translate(${drift}px, ${flightDistance * CLOUD_SCROLL_PIXELS}px) scale(${config.scale})`;
  });

  const rocket = root.querySelector(".rocket");
  if (rocket) {
    rocket.classList.toggle("launching", state.phase !== "waitingLaunch");
    rocket.classList.toggle("hidden", state.phase === "landing" || state.phase === "landed" || state.phase === "replayPrompt");
  }

  const flame = root.querySelector(".flame");
  if (flame) {
    const level = flameLevel(state.db);
    flame.dataset.level = String(level);
    root.querySelectorAll(".flame-image").forEach((image) => {
      image.classList.toggle("active", image.classList.contains(`flame-level-${level}`));
    });
  }

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

  const stats = root.querySelectorAll(".stats-row button strong");
  if (stats[0]) stats[0].textContent = `X ${formatStat(state.speedMultiplier)}`;
  if (stats[1]) stats[1].textContent = `${formatStat(state.fuelCapacity)} t`;
  if (stats[2]) stats[2].textContent = `X ${formatStat(state.moneyMultiplier)}`;

  const currentDb = root.querySelector(".meter strong");
  if (currentDb) {
    currentDb.innerHTML =
      state.phase === "waitingLaunch"
        ? text.waitingLaunch
        : `${displayedDb} dB X ${formatStat(state.speedMultiplier)} = <b>${formatNumber(currentSpeedKms())}</b> KM/S`;
  }

  const fuelFill = root.querySelector(".fuel-fill");
  if (fuelFill) fuelFill.style.width = `${fuelRatio * 100}%`;

  const footerStatus = root.querySelector(".bottom p");
  if (footerStatus) {
    const heard = state.heardSpeech ? `${text.voiceHeard}: ${state.heardSpeech}` : "";
    footerStatus.textContent = [state.status, state.speechStatus, heard].filter(Boolean).join(" ");
  }

  root.querySelectorAll(".buttons button").forEach((button) => {
    button.classList.toggle("active", canAcceptDb() && button.dataset.rangeId === range.id);
  });
}

function getCenterMessage(text) {
  if (state.phase === "waitingLaunch") return text.waitingLaunch;
  if (state.phase === "flying") {
    if (!state.separationDone && getFuelRatio() <= 0.5) {
      return `<strong>${text.separationPrompt}</strong><span>${text.separationHint}</span>`;
    }
    if (state.progress >= MOON_TRIGGER_PROGRESS * 0.72 && hasUfoClearedRocketForChallenge()) {
      return `<strong>${text.getReadyHold}</strong><span>${text.holdHint}</span>`;
    }
    if (state.progress >= UFO_TRIGGER_PROGRESS) {
      return `<strong>${text.avoidUfo}</strong><span>${text.avoidUfoHint}</span>`;
    }
    return text.flying;
  }
  if (state.phase === "separationPrompt") {
    return `<strong>${text.separationPrompt}</strong><span>${text.separationHint}</span>`;
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
  if (state.phase === "failed") {
    return `
      <div class="result-card">
        <strong>${text.failed}</strong>
        ${state.status ? `<em>${state.status}</em>` : ""}
        <span>${text.distance}: ${formatNumber(Math.floor(state.distanceKm))} Km</span>
        <span>${text.earn}: ${formatNumber(state.lastEarnedCoins)} Coins</span>
        <div class="upgrade-list">
          ${getUpgradeLine("speed", "Speed")}
          ${getUpgradeLine("fuel", "Fuel")}
          ${getUpgradeLine("money", "Money")}
        </div>
        <div class="result-actions">
          <button type="button" data-action="debug-replay">[ ${text.exit} ]</button>
          <button type="button" data-action="debug-replay">[ ${text.continue} ]</button>
        </div>
      </div>
    `;
  }
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
    state.phase === "separationPrompt" ||
    state.phase === "holdPrompt" ||
    state.phase === "clapPrompt" ||
    state.phase === "landing" ||
    state.phase === "landed";
  const visible = activePhase && state.progress >= UFO_TRIGGER_PROGRESS && viewportY < 1.32;
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
  const viewportY = position.viewportY;
  const visible = activePhase && state.progress >= MOON_APPEAR_PROGRESS && viewportY < 1.05;
  const fadeIn = clamp((viewportY + 0.2) / 0.12, 0, 1);
  return {
    visible,
    y: position.worldY,
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
  const ufoEl = root.querySelector(".ufo");
  const rocketArt = root.querySelector(".rocket-art");
  if (!ufoEl || !rocketArt) return state.progress >= UFO_END_PROGRESS;
  const ufoRect = ufoEl.getBoundingClientRect();
  const rocketRect = rocketArt.getBoundingClientRect();
  return ufoRect.top >= rocketRect.bottom + 18;
}

function updateGame(delta) {
  const text = STRINGS[state.language];
  if (isRunningPhase()) {
    // Fuel is a generous flight resource; loud inputs can move hundreds of km/s
    // without ending the run after only a few seconds.
    state.fuelRemaining = Math.max(0, state.fuelRemaining - (delta / 1000) * 0.15);
    if (state.fuelRemaining <= 0) {
      failGame(text.energyFailed);
      return;
    }
  }

  if (isDistancePhase()) {
    state.distanceKm = Math.min(TOTAL_DISTANCE_KM, state.distanceKm + currentSpeedKms() * (delta / 1000));
    syncProgressFromDistance();
    checkUfoCollision();
    if (!isDistancePhase()) return;
    if (state.distanceKm >= TOTAL_DISTANCE_KM) {
      beginLanding();
      return;
    }
  }

  if (state.phase === "flying") {
    if (!state.separationDone && getFuelRatio() <= 0.5) {
      beginSeparationPrompt();
      return;
    }
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
    } else if (Date.now() - state.holdStartedAt < HOLD_START_GRACE_MS) {
      state.holdOutMs = 0;
    } else {
      state.holdOutMs += delta;
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
  startVoiceInput({ fromUserGesture: true });
  const target = event.target.closest("button");
  if (!target) return;
  if (handleButtonAction(target)) {
    state.lastButtonActionAt = Date.now();
    event.preventDefault();
  }
});

root.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.action || (target.dataset.min && target.dataset.max)) {
    if (Date.now() - state.lastButtonActionAt > 250) {
      handleButtonAction(target);
      state.lastButtonActionAt = Date.now();
    }
    event.preventDefault();
  }
});

root.addEventListener("change", (event) => {
  if (event.target.dataset.action !== "language") return;
  state.language = event.target.value;
  writeStoredValue("settings.language", state.language);
  state.status = STRINGS[state.language].micStatus;
  render();
});

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
  if (!transcript) return;
  state.heardSpeech = normalizeSpeechText(transcript).slice(0, 36);
  if (state.phase === "waitingLaunch" && transcriptMatchesAny(transcript, LAUNCH_WORDS)) {
    startGame();
  } else if (state.phase === "separationPrompt" && transcriptMatchesAny(transcript, SEPARATION_WORDS)) {
    completeSeparation();
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
      state.phase !== "separationPrompt" &&
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
  if (!speech.recognition || !speech.isListening) return;
  try {
    speech.recognition.stop();
  } catch {
    // Some browsers throw if recognition is already stopping.
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

  recognition.onresult = (event) => {
    const transcript = readSpeechTranscript(event);
    handleSpeechTranscript(transcript);
  };

  recognition.onerror = (event) => {
    speech.isListening = false;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.speechStatus = "Speech recognition permission was denied.";
      speech.shouldListen = false;
    } else if (event.error === "no-speech") {
      state.speechStatus = STRINGS[state.language].voiceReady;
      scheduleSpeechRestart(250);
    } else if (event.error === "audio-capture") {
      state.speechStatus = "Speech recognition cannot access the microphone.";
      scheduleSpeechRestart(1000);
    } else if (event.error !== "aborted") {
      state.speechStatus = `Speech recognition error: ${event.error}`;
      scheduleSpeechRestart(1000);
    }
    updateUi();
  };

  recognition.onend = () => {
    speech.isListening = false;
    scheduleSpeechRestart(speech.hasUserGesture ? 350 : 1200);
  };
  return recognition;
}

function startSpeechRecognition(options = {}) {
  const text = STRINGS[state.language];
  if (options.fromUserGesture) speech.hasUserGesture = true;
  if (!speech.shouldListen && !options.force) return;
  if (
    state.phase !== "waitingLaunch" &&
    state.phase !== "separationPrompt" &&
    state.phase !== "replayPrompt" &&
    state.phase !== "failed"
  ) {
    return;
  }
  speech.shouldListen = true;
  if (!speech.recognition) speech.recognition = createSpeechRecognition();
  if (!speech.recognition) {
    state.speechStatus = text.speechUnsupported;
    updateUi();
    return;
  }
  if (speech.isListening) return;
  try {
    speech.recognition.start();
    speech.isListening = true;
    state.speechStatus = text.voiceReady;
  } catch (error) {
    speech.isListening = false;
    state.speechStatus = error instanceof Error ? error.message : "Speech recognition could not start.";
    scheduleSpeechRestart(speech.hasUserGesture ? 700 : 1500);
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Browser audio analysis API is not available.");
    }
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    function tick() {
      analyser.getByteTimeDomainData(samples);
      let total = 0;
      samples.forEach((sample) => {
        const normalized = (sample - 128) / 128;
        total += normalized * normalized;
      });
      const rms = Math.sqrt(total / samples.length);
      const db = Math.max(0, Math.min(110, Math.round(20 * Math.log10(rms + 0.00001) + 96)));
      if (state.phase === "clapPrompt") {
        state.db = clampDb(db);
        state.maxDb = Math.max(state.maxDb, state.db);
        registerClap(db);
      } else {
        setMeasuredDb(db, false);
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
  const db = Number(event.detail?.db);
  if (!Number.isFinite(db)) return;
  if (state.phase === "clapPrompt") {
    state.db = clampDb(db);
    state.maxDb = Math.max(state.maxDb, state.db);
    registerClap(db);
  } else {
    setMeasuredDb(db);
  }
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
if (!window.SHOUT_MOON_NATIVE_AUDIO) {
  startVoiceInput();
  startMeter();
}
