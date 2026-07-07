import { LanguageCode } from "./languages";

export type GameCopy = {
  title: string;
  subtitle: string;
  countdownDone: string;
  countdownPrompt: string;
  currentDb: string;
  maxDb: string;
  language: string;
  restart: string;
  landed: string;
  micUnavailable: string;
  micPermissionNeeded: string;
  testOnly: string;
  tracking: string;
};

export const strings: Record<LanguageCode, GameCopy> = {
  ko: {
    title: "Shout Out to the Moon",
    subtitle: "소리 dB가 로켓 속도와 불꽃 세기를 결정합니다.",
    countdownDone: "Make some noise!",
    countdownPrompt: "달까지 외쳐보세요",
    currentDb: "현재",
    maxDb: "최대",
    language: "언어",
    restart: "다시 시작",
    landed: "달 착륙!",
    micUnavailable: "마이크 dB 측정을 사용할 수 없습니다.",
    micPermissionNeeded: "마이크 권한이 필요합니다.",
    testOnly: "테스트 dB",
    tracking: "추적 권한",
  },
  en: {
    title: "Shout Out to the Moon",
    subtitle: "Your dB controls rocket speed and flame strength.",
    countdownDone: "Make some noise!",
    countdownPrompt: "Shout to reach the moon",
    currentDb: "Current",
    maxDb: "Max",
    language: "Language",
    restart: "Restart",
    landed: "Moon landing!",
    micUnavailable: "Microphone dB measurement is not available.",
    micPermissionNeeded: "Microphone permission is required.",
    testOnly: "Test dB",
    tracking: "Tracking permission",
  },
  ja: {
    title: "Shout Out to the Moon",
    subtitle: "声のdBでロケットの速度と炎が変わります。",
    countdownDone: "Make some noise!",
    countdownPrompt: "月まで叫ぼう",
    currentDb: "現在",
    maxDb: "最大",
    language: "言語",
    restart: "再開",
    landed: "月面着陸!",
    micUnavailable: "マイクのdB測定を使用できません。",
    micPermissionNeeded: "マイク権限が必要です。",
    testOnly: "テストdB",
    tracking: "トラッキング権限",
  },
  "zh-Hans": {
    title: "Shout Out to the Moon",
    subtitle: "声音 dB 决定火箭速度和火焰强度。",
    countdownDone: "Make some noise!",
    countdownPrompt: "喊到月球",
    currentDb: "当前",
    maxDb: "最大",
    language: "语言",
    restart: "重新开始",
    landed: "登月成功!",
    micUnavailable: "无法使用麦克风 dB 测量。",
    micPermissionNeeded: "需要麦克风权限。",
    testOnly: "测试 dB",
    tracking: "跟踪权限",
  },
  "zh-Hant": {
    title: "Shout Out to the Moon",
    subtitle: "聲音 dB 決定火箭速度和火焰強度。",
    countdownDone: "Make some noise!",
    countdownPrompt: "喊到月球",
    currentDb: "目前",
    maxDb: "最大",
    language: "語言",
    restart: "重新開始",
    landed: "登月成功!",
    micUnavailable: "無法使用麥克風 dB 測量。",
    micPermissionNeeded: "需要麥克風權限。",
    testOnly: "測試 dB",
    tracking: "追蹤權限",
  },
};
