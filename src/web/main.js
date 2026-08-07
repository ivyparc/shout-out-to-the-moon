const BASE_WIDTH = 1179;
const BASE_HEIGHT = 2556;
const BASE_RATIO = BASE_WIDTH / BASE_HEIGHT;
const GAME_SECONDS = 60;
const CLAP_WINDOW_MS = 4000;
const CLAP_MIN_GAP_MS = 260;
const CLAP_DB_THRESHOLD = 72;
const CLAP_START_PROGRESS = 0.86;

const DB_RANGES = [
  { id: "20-40", min: 20, max: 40, label: ["20", "40"] },
  { id: "40-60", min: 40, max: 60, label: ["40", "60"] },
  { id: "60-80", min: 60, max: 80, label: ["60", "80"] },
  { id: "80-100", min: 80, max: 100, label: ["80", "100"] },
  { id: "100+", min: 100, max: 110, label: ["100", "+"] },
];

const STAGES = [
  { key: "F", name: "우주" },
  { key: "E", name: "외기권" },
  { key: "D", name: "열권" },
  { key: "C", name: "중간권" },
  { key: "B", name: "성층권" },
  { key: "A", name: "대류권" },
];

const STRINGS = {
  ko: {
    title: "Shout Out to the Moon",
    subtitle: "Launch라고 외친 뒤, 소리 크기로 로켓을 달까지 보내세요.",
    current: "현재",
    max: "최대",
    test: "테스트 dB",
    timer: "타이머",
    waitingLaunch: "Say “Launch”",
    flying: "Make some noise!",
    clapPrompt: "Clap 3 times",
    clapCount: "박수",
    clapPenalty: "실패: -10초",
    landing: "Landing...",
    landed: "달 착륙!",
    failed: "시간 종료",
    micStatus: "마이크를 허용하면 실제 소리로 플레이할 수 있습니다.",
    speechUnsupported: "Speech Recognition is not available in this browser.",
  },
  en: {
    title: "Shout Out to the Moon",
    subtitle: "Say Launch, then use your voice volume to fly to the moon.",
    current: "Current",
    max: "Max",
    test: "Test dB",
    timer: "Timer",
    waitingLaunch: "Say “Launch”",
    flying: "Make some noise!",
    clapPrompt: "Clap 3 times",
    clapCount: "Claps",
    clapPenalty: "Failed: -10s",
    landing: "Landing...",
    landed: "Moon landing!",
    failed: "Time up",
    micStatus: "Allow microphone access to play with real sound.",
    speechUnsupported: "Speech Recognition is not available in this browser.",
  },
};

const state = {
  language: getLanguage(),
  phase: "waitingLaunch",
  db: 0,
  maxDb: 0,
  progress: 0,
  timeLeftMs: GAME_SECONDS * 1000,
  lastTick: Date.now(),
  lastDbInputAt: Date.now(),
  manualModeUntil: 0,
  lastButtonActionAt: 0,
  clapCount: 0,
  clapStartedAt: 0,
  lastClapAt: 0,
  status: "",
  speechStatus: "",
};

const root = document.getElementById("root");
state.status = STRINGS[state.language].micStatus;

function clampDb(db) {
  return Math.max(0, Math.min(110, Math.round(db)));
}

function getRange(db) {
  return DB_RANGES.find((range) => db >= range.min && db < range.max) ?? DB_RANGES[0];
}

function randomDb(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getLanguage() {
  const saved = localStorage.getItem("settings.language");
  if (saved === "ko" || saved === "en") {
    return saved;
  }
  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function flameLevel(db) {
  if (db < 40) return 1;
  if (db < 60) return 2;
  if (db < 80) return 3;
  if (db < 100) return 4;
  return 5;
}

function getFlameAsset(db) {
  return `/public/assets/240px_level${flameLevel(db)}.png`;
}

function startGame() {
  if (state.phase !== "waitingLaunch") {
    return;
  }
  state.phase = "flying";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.timeLeftMs = GAME_SECONDS * 1000;
  state.lastTick = Date.now();
  state.lastDbInputAt = Date.now();
  updateUi();
}

function beginClapChallenge() {
  state.phase = "clapPrompt";
  state.db = 0;
  state.clapCount = 0;
  state.clapStartedAt = Date.now();
  state.lastClapAt = 0;
  updateUi();
}

function failClapChallenge() {
  const text = STRINGS[state.language];
  state.timeLeftMs = Math.max(0, state.timeLeftMs - 10000);
  state.status = text.clapPenalty;
  state.clapCount = 0;
  state.clapStartedAt = Date.now();
  state.lastClapAt = 0;
  if (state.timeLeftMs <= 0) {
    state.phase = "failed";
  }
  updateUi();
}

function completeClapChallenge() {
  state.phase = "landing";
  state.db = 0;
  state.progress = CLAP_START_PROGRESS;
  updateUi();
}

function setMeasuredDb(value, isManualInput = true) {
  if (state.phase !== "flying") {
    return;
  }

  const now = Date.now();
  if (!isManualInput && now < state.manualModeUntil) {
    return;
  }

  state.db = clampDb(value);
  state.maxDb = Math.max(state.maxDb, state.db);
  state.lastDbInputAt = now;
  if (isManualInput) {
    state.manualModeUntil = now + 30000;
  }
  updateUi();
}

function registerClap(db) {
  if (state.phase !== "clapPrompt") {
    return;
  }

  const now = Date.now();
  if (db < CLAP_DB_THRESHOLD || now - state.lastClapAt < CLAP_MIN_GAP_MS) {
    return;
  }

  state.lastClapAt = now;
  state.clapCount += 1;
  if (state.clapCount >= 3) {
    completeClapChallenge();
  } else {
    updateUi();
  }
}

function reset() {
  state.phase = "waitingLaunch";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.timeLeftMs = GAME_SECONDS * 1000;
  state.lastTick = Date.now();
  state.lastDbInputAt = Date.now();
  state.manualModeUntil = 0;
  state.clapCount = 0;
  state.clapStartedAt = 0;
  state.lastClapAt = 0;
  state.status = STRINGS[state.language].micStatus;
  updateUi();
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

  if (target.dataset.action === "debug-clap") {
    registerClap(90);
    return true;
  }

  if (target.dataset.min && target.dataset.max) {
    setMeasuredDb(randomDb(Number(target.dataset.min), Number(target.dataset.max)));
    return true;
  }

  return false;
}

function getBoardSize() {
  const maxWidth = Math.min(window.innerWidth - 32, 520);
  const maxHeight = Math.max(window.innerHeight - 168, 560);
  const width = Math.min(maxWidth, maxHeight * BASE_RATIO);
  return { width, height: width / BASE_RATIO };
}

function render() {
  const text = STRINGS[state.language];
  const board = getBoardSize();

  root.innerHTML = `
    <main class="app">
      <header class="top">
        <h1>${text.title}</h1>
        <p>${text.subtitle}</p>
      </header>
      <section class="phone" style="width:${board.width}px;height:${board.height}px">
        <div class="sky">
          <div class="hud">
            <span class="timer"></span>
          </div>
          <div class="stage-grid">
            ${STAGES.map((stage) => `
              <div class="stage-row">
                <span class="stage-letter">${stage.key}</span>
                <span class="stage-name">${stage.name}</span>
              </div>
            `).join("")}
          </div>
          <div class="cloud cloud-one"></div>
          <div class="cloud cloud-two"></div>
          <img class="moon" src="/public/assets/24px_moon.png" alt="" />
          <img class="landing-scene" src="/public/assets/240px_landing.png" alt="" />
          <div class="center-message"></div>
          <div class="rocket">
            <img class="rocket-art" src="/public/assets/24px_rocket.png" alt="" />
            <img class="flame" src="/public/assets/240px_level1.png" alt="" />
          </div>
        </div>
        <button class="meter" type="button" data-action="reset">
          <strong></strong>
          <span></span>
        </button>
        <div class="test-label">${text.test}</div>
        <div class="buttons">
          ${DB_RANGES.map((item) => `
            <button type="button" data-range-id="${item.id}" data-min="${item.min}" data-max="${item.max}">
              <span>${item.label[0]}</span><span>${item.label[1]}</span>
            </button>
          `).join("")}
        </div>
      </section>
      <footer class="bottom">
        <button type="button" data-action="debug-launch">Launch</button>
        <button type="button" data-action="debug-clap">Clap</button>
        <select data-action="language">
          <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
          <option value="ko" ${state.language === "ko" ? "selected" : ""}>Korean</option>
        </select>
        <p></p>
      </footer>
    </main>
  `;
  updateUi();
}

function updateUi() {
  const text = STRINGS[state.language];
  const board = getBoardSize();
  const skyHeight = board.height - 162;
  const rocketBottom = 32 + state.progress * (skyHeight - 104);
  const displayedDb = state.phase === "flying" ? Math.round(state.db) : 0;
  const range = getRange(state.db);

  const timer = root.querySelector(".timer");
  if (timer) timer.textContent = `${text.timer}: ${formatTime(state.timeLeftMs)}`;

  const phase = root.querySelector(".phase");
  if (phase) phase.textContent = getPhaseLabel(text);

  const centerMessage = root.querySelector(".center-message");
  if (centerMessage) centerMessage.textContent = getCenterMessage(text);

  const rocket = root.querySelector(".rocket");
  if (rocket) {
    rocket.style.bottom = `${rocketBottom}px`;
    rocket.classList.toggle("hidden", state.phase === "landing" || state.phase === "landed");
  }

  const flame = root.querySelector(".flame");
  if (flame) flame.src = getFlameAsset(state.db);

  const moon = root.querySelector(".moon");
  if (moon) moon.classList.toggle("hidden", state.phase === "landing" || state.phase === "landed");

  const landingScene = root.querySelector(".landing-scene");
  if (landingScene) {
    landingScene.classList.toggle("visible", state.phase === "landing" || state.phase === "landed");
  }

  const currentDb = root.querySelector(".meter strong");
  const maxDb = root.querySelector(".meter span");
  if (currentDb) currentDb.textContent = `${text.current}: ${displayedDb} dB`;
  if (maxDb) maxDb.textContent = `${text.max}: ${state.maxDb} dB`;

  const footerStatus = root.querySelector(".bottom p");
  if (footerStatus) footerStatus.textContent = [state.status, state.speechStatus].filter(Boolean).join(" ");

  root.querySelectorAll(".buttons button").forEach((button) => {
    button.classList.toggle("active", state.phase === "flying" && button.dataset.rangeId === range.id);
  });
}

function getPhaseLabel(text) {
  if (state.phase === "waitingLaunch") return text.waitingLaunch;
  if (state.phase === "flying") return text.flying;
  if (state.phase === "clapPrompt") return `${text.clapPrompt} (${state.clapCount}/3)`;
  if (state.phase === "landing") return text.landing;
  if (state.phase === "landed") return text.landed;
  return text.failed;
}

function getCenterMessage(text) {
  if (state.phase === "waitingLaunch") return text.waitingLaunch;
  if (state.phase === "clapPrompt") return `${text.clapPrompt}: ${state.clapCount}/3`;
  if (state.phase === "landing") return text.landing;
  if (state.phase === "landed") return text.landed;
  if (state.phase === "failed") return text.failed;
  return text.flying;
}

root.addEventListener("pointerdown", (event) => {
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
  if (
    target.dataset.action ||
    (target.dataset.min && target.dataset.max)
  ) {
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
  localStorage.setItem("settings.language", state.language);
  state.status = STRINGS[state.language].micStatus;
  render();
});

window.addEventListener("resize", render);

window.setInterval(() => {
  const now = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;

  if (state.phase === "flying" || state.phase === "clapPrompt" || state.phase === "landing") {
    state.timeLeftMs = Math.max(0, state.timeLeftMs - delta);
    if (state.timeLeftMs <= 0) {
      state.phase = "failed";
      state.db = 0;
      updateUi();
      return;
    }
  }

  if (state.phase === "flying") {
    const speed = 0.000012 + state.db * 0.0000005;
    state.progress = Math.min(CLAP_START_PROGRESS, state.progress + speed * delta);
    if (state.progress >= CLAP_START_PROGRESS) {
      beginClapChallenge();
      return;
    }
  }

  if (state.phase === "clapPrompt" && Date.now() - state.clapStartedAt > CLAP_WINDOW_MS) {
    failClapChallenge();
    return;
  }

  if (state.phase === "landing") {
    state.progress = Math.min(1, state.progress + delta * 0.00006);
    if (state.progress >= 1) {
      state.phase = "landed";
      state.db = 0;
    }
  }

  updateUi();
}, 50);

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const text = STRINGS[state.language];
  if (!SpeechRecognition) {
    state.speechStatus = text.speechUnsupported;
    updateUi();
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const latest = event.results[event.results.length - 1]?.[0]?.transcript ?? "";
    if (latest.trim().toLowerCase().includes("launch")) {
      startGame();
    }
  };
  recognition.onerror = () => {
    state.speechStatus = "Speech recognition error.";
    updateUi();
  };
  recognition.onend = () => {
    try {
      recognition.start();
    } catch {
      state.speechStatus = "Speech recognition stopped.";
      updateUi();
    }
  };

  try {
    recognition.start();
  } catch {
    state.speechStatus = "Speech recognition could not start.";
  }
}

async function startMeter() {
  if (!navigator.mediaDevices?.getUserMedia) {
    state.status = "Browser microphone API is not available.";
    render();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
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

render();
startSpeechRecognition();
startMeter();
