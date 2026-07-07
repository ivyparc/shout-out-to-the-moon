import { Pressable, StyleSheet, View } from "react-native";

import { DB_RANGES } from "../constants/layout";
import { getRandomDbInRange } from "../game/db";
import { GameCopy } from "../i18n/strings";
import { AppText } from "./AppText";

type Props = {
  activeRangeId: string;
  copy: GameCopy;
  onPickDb: (db: number) => void;
};

export function TestDbControls({ activeRangeId, copy, onPickDb }: Props) {
  return (
    <View style={styles.wrapper}>
      <AppText style={styles.label}>{copy.testOnly}</AppText>
      <View style={styles.row}>
        {DB_RANGES.map((range) => {
          const isActive = range.id === activeRangeId;
          return (
            <Pressable
              key={range.id}
              accessibilityRole="button"
              onPress={() => onPickDb(getRandomDbInRange(range))}
              style={[styles.button, isActive && styles.activeButton]}
            >
              <AppText style={styles.buttonText}>{range.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#fff4c9",
    borderTopWidth: 2,
    borderColor: "#a8a69c",
  },
  label: {
    height: 24,
    color: "#5f6470",
    fontSize: 12,
    lineHeight: 24,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    height: 76,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: "#a8a69c",
  },
  activeButton: {
    backgroundColor: "#fff900",
  },
  buttonText: {
    color: "#101317",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
    textAlign: "center",
  },
});
