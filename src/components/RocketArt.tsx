import { StyleSheet, View } from "react-native";

type Props = {
  flameLevel: number;
};

export function RocketArt({ flameLevel }: Props) {
  const flameHeight = 18 + flameLevel * 7;

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={styles.nose} />
      <View style={styles.body}>
        <View style={styles.window} />
      </View>
      <View style={styles.leftFin} />
      <View style={styles.rightFin} />
      <View style={[styles.flameOuter, { height: flameHeight }]}>
        <View style={styles.flameInner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 78,
    height: 176,
    alignItems: "center",
    transform: [{ scale: 0.1 }],
  },
  nose: {
    width: 48,
    height: 52,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#ef3d68",
    borderWidth: 2,
    borderColor: "#cb254e",
  },
  body: {
    width: 56,
    height: 86,
    marginTop: -4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff0be",
    borderColor: "#d9bb72",
    borderWidth: 2,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  window: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#a18df0",
    borderWidth: 4,
    borderColor: "#ded9ff",
    transform: [{ rotate: "45deg" }],
  },
  leftFin: {
    position: "absolute",
    left: 0,
    bottom: 34,
    width: 26,
    height: 52,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 14,
    backgroundColor: "#ff315d",
    transform: [{ rotate: "20deg" }],
  },
  rightFin: {
    position: "absolute",
    right: 0,
    bottom: 34,
    width: 26,
    height: 52,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 14,
    backgroundColor: "#ff315d",
    transform: [{ rotate: "-20deg" }],
  },
  flameOuter: {
    width: 26,
    minHeight: 20,
    marginTop: -2,
    alignItems: "center",
    backgroundColor: "#ff7a18",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  flameInner: {
    width: 12,
    height: "72%",
    backgroundColor: "#ffd84d",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
});
