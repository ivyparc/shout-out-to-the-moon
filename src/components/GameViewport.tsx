import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { BASE_ASPECT_RATIO } from "../constants/layout";
import { clampDb, getDbRange, getFlameLevel, getRocketProgress } from "../game/db";
import { GameCopy } from "../i18n/strings";
import { startMicrophoneMeter } from "../services/microphoneMeter";
import { AppText } from "./AppText";
import { MoonArt } from "./MoonArt";
import { RocketArt } from "./RocketArt";
import { TestDbControls } from "./TestDbControls";

type Props = {
  copy: GameCopy;
};

export function GameViewport({ copy }: Props) {
  const { width, height } = useWindowDimensions();
  const [countdown, setCountdown] = useState(3);
  const [currentDb, setCurrentDb] = useState(0);
  const [maxDb, setMaxDb] = useState(0);
  const [progress, setProgress] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const progressRef = useRef(0);
  const dbRef = useRef(0);
  const lastTickRef = useRef(Date.now());

  const maxBoardWidth = Math.min(Math.max(width - 32, 260), 520);
  const maxBoardHeight = Math.max(height - 210, 560);
  const boardWidth = Math.min(maxBoardWidth, maxBoardHeight * BASE_ASPECT_RATIO);
  const boardHeight = boardWidth / BASE_ASPECT_RATIO;
  const range = getDbRange(currentDb);
  const flameLevel = getFlameLevel(currentDb);
  const isLanded = progress >= 1;

  const resetGame = useCallback(() => {
    setCountdown(3);
    setCurrentDb(0);
    setMaxDb(0);
    setProgress(0);
    progressRef.current = 0;
    dbRef.current = 0;
    lastTickRef.current = Date.now();
  }, []);

  const setMeasuredDb = useCallback((db: number) => {
    const clamped = clampDb(db);
    dbRef.current = clamped;
    setCurrentDb(clamped);
    setMaxDb((previous) => Math.max(previous, clamped));
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    let stopMeter: (() => void) | null = null;
    let disposed = false;

    async function start() {
      try {
        stopMeter = await startMicrophoneMeter(setMeasuredDb);
      } catch (error) {
        if (!disposed) {
          setMicError(error instanceof Error ? error.message : copy.micUnavailable);
        }
      }
    }

    start();

    return () => {
      disposed = true;
      stopMeter?.();
    };
  }, [copy.micUnavailable, setMeasuredDb]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (countdown > 0 || progressRef.current >= 1) {
        lastTickRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      const nextProgress = getRocketProgress(progressRef.current, dbRef.current, delta);
      progressRef.current = nextProgress;
      setProgress(nextProgress);
    }, 50);

    return () => clearInterval(timer);
  }, [countdown]);

  const rocketBottom = 136 + progress * (boardHeight - 270);
  const cloudOffset = progress * 220;

  return (
    <View style={[styles.board, { width: boardWidth, height: boardHeight }]}>
      <View style={styles.sky}>
        <View style={[styles.cloud, styles.cloudOne, { transform: [{ translateY: cloudOffset }] }]} />
        <View style={[styles.cloud, styles.cloudTwo, { transform: [{ translateY: cloudOffset * 0.8 }] }]} />
        <View style={[styles.cloud, styles.cloudThree, { transform: [{ translateY: cloudOffset * 1.1 }] }]} />
        <View style={styles.moonPosition}>
          <MoonArt />
        </View>
        {countdown > 0 ? (
          <AppText style={styles.countdown}>{countdown}</AppText>
        ) : (
          <AppText style={styles.prompt}>{isLanded ? copy.landed : copy.countdownDone}</AppText>
        )}
        <View style={[styles.rocketPosition, { bottom: rocketBottom }]}>
          <RocketArt flameLevel={flameLevel} />
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={resetGame} style={styles.meterBar}>
        <AppText style={styles.dbText}>
          {copy.currentDb}: {currentDb} dB
        </AppText>
        <AppText style={styles.maxText}>
          {copy.maxDb}: {maxDb} dB
        </AppText>
      </Pressable>
      <TestDbControls activeRangeId={range.id} copy={copy} onPickDb={setMeasuredDb} />
      {micError ? (
        <View style={styles.errorOverlay}>
          <AppText style={styles.errorText}>{micError}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#4f5763",
    backgroundColor: "#ffffff",
  },
  sky: {
    flex: 1,
    backgroundColor: "#66a5ff",
  },
  moonPosition: {
    position: "absolute",
    top: "4%",
    alignSelf: "center",
  },
  countdown: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    color: "#5a5f68",
    fontSize: 76,
    fontWeight: "800",
  },
  prompt: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    color: "#101317",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  rocketPosition: {
    position: "absolute",
    alignSelf: "center",
  },
  cloud: {
    position: "absolute",
    width: 140,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  cloudOne: {
    top: "19%",
    left: "-9%",
  },
  cloudTwo: {
    top: "47%",
    right: "-8%",
    width: 178,
  },
  cloudThree: {
    bottom: "9%",
    left: "7%",
    width: 92,
  },
  meterBar: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#d8edff",
    borderTopWidth: 2,
    borderColor: "#a8a69c",
    paddingHorizontal: 14,
  },
  dbText: {
    color: "#555d68",
    fontSize: 22,
    fontWeight: "900",
  },
  maxText: {
    color: "#555d68",
    fontSize: 17,
    fontWeight: "700",
  },
  errorOverlay: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 8,
  },
  errorText: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
