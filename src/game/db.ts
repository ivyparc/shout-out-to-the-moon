import { DB_RANGES } from "../constants/layout";

export type DbRange = (typeof DB_RANGES)[number];

export function clampDb(db: number): number {
  return Math.max(0, Math.min(110, Math.round(db)));
}

export function getDbRange(db: number): DbRange {
  const clamped = clampDb(db);
  return DB_RANGES.find((range) => clamped >= range.min && clamped < range.max) ?? DB_RANGES[4];
}

export function getRandomDbInRange(range: DbRange): number {
  const max = range.max - 1;
  return Math.floor(range.min + Math.random() * (max - range.min + 1));
}

export function getRocketProgress(
  currentProgress: number,
  db: number,
  deltaMs: number,
  isDbDecaying = false,
  decaySeconds = 0,
): number {
  if (isDbDecaying) {
    const dropSpeed = 0.00006 + Math.min(decaySeconds, 6) * 0.000022;
    return Math.max(0, currentProgress - deltaMs * dropSpeed);
  }

  if (db < 20) {
    return Math.max(0, currentProgress - deltaMs * 0.000045);
  }

  const speed = 0.000018 + db * 0.00000043;
  return Math.min(1, currentProgress + speed * deltaMs);
}

export function getDecayedDb(db: number, deltaMs: number, decaySeconds = 0): number {
  const decayPerSecond = 10 + Math.min(decaySeconds, 6) * 3;
  return Math.max(0, Math.min(110, db - (decayPerSecond * deltaMs) / 1000));
}

export function getFlameLevel(db: number): number {
  if (db < 20) {
    return 1;
  }
  if (db < 40) {
    return 2;
  }
  if (db < 60) {
    return 3;
  }
  if (db < 80) {
    return 4;
  }
  return 5;
}
