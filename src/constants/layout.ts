export const BASE_WIDTH = 1179;
export const BASE_HEIGHT = 2556;
export const BASE_ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;
export const TARGET_SECONDS = 45;

export const DB_RANGES = [
  { id: "0-20", min: 0, max: 20, label: "20\n40" },
  { id: "20-40", min: 20, max: 40, label: "40\n60" },
  { id: "40-60", min: 40, max: 60, label: "60\n80" },
  { id: "60-80", min: 60, max: 80, label: "80\n100" },
  { id: "80+", min: 80, max: 110, label: "100\n+" },
] as const;
