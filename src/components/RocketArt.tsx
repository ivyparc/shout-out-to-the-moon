import { Image, StyleSheet, View } from "react-native";

const FLAMES = [
  require("../../public/assets/Flame_Lv1.png"),
  require("../../public/assets/Flame_Lv2.png"),
  require("../../public/assets/Flame_Lv3.png"),
  require("../../public/assets/Flame_Lv4.png"),
  require("../../public/assets/Flame_Lv5.png"),
];

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
      <Image
        source={FLAMES[Math.max(0, Math.min(4, flameLevel - 1))]}
        style={{ width: flameHeight, height: flameHeight, marginTop: -2 }}
        resizeMode="contain"
      />
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
});
