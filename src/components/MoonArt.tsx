import { StyleSheet, View } from "react-native";

export function MoonArt() {
  return (
    <View style={styles.moon}>
      <View style={[styles.crater, styles.craterOne]} />
      <View style={[styles.crater, styles.craterTwo]} />
      <View style={[styles.crater, styles.craterThree]} />
      <View style={[styles.crater, styles.craterFour]} />
    </View>
  );
}

const styles = StyleSheet.create({
  moon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#e9edf1",
    borderWidth: 3,
    borderColor: "#aeb5bd",
  },
  crater: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#c9cfd6",
    borderWidth: 1,
    borderColor: "#9fa7b0",
  },
  craterOne: {
    top: 10,
    left: 16,
    width: 10,
    height: 10,
  },
  craterTwo: {
    top: 22,
    right: 10,
    width: 12,
    height: 12,
  },
  craterThree: {
    bottom: 12,
    left: 12,
    width: 14,
    height: 14,
  },
  craterFour: {
    bottom: 8,
    right: 18,
    width: 6,
    height: 6,
  },
});
