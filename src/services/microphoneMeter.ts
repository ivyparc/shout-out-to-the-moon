import { Platform } from "react-native";

type StopMeter = () => void;
type DbListener = (db: number) => void;

type WebWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export async function startMicrophoneMeter(onDb: DbListener): Promise<StopMeter> {
  if (Platform.OS !== "web") {
    onDb(0);
    throw new Error("Native microphone dB measurement is not implemented in this POC.");
  }

  const webWindow = window as WebWindow;
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw new Error("Browser microphone API is not available.");
  }

  const stream = await mediaDevices.getUserMedia({ audio: true });
  const AudioContextClass = webWindow.AudioContext ?? webWindow.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;
  let stopped = false;

  function tick() {
    if (stopped) {
      return;
    }

    analyser.getByteTimeDomainData(samples);
    let total = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      total += normalized * normalized;
    }

    const rms = Math.sqrt(total / samples.length);
    const db = Math.max(0, Math.min(110, Math.round(20 * Math.log10(rms + 0.00001) + 96)));
    onDb(db);
    frame = requestAnimationFrame(tick);
  }

  tick();

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    stream.getTracks().forEach((track) => track.stop());
    audioContext.close();
  };
}
