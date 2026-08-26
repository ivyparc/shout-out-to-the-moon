import React from "react";
import { registerRootComponent } from "expo";
import { Text, View } from "react-native";

let startupError = null;

const previousGlobalHandler = global.ErrorUtils?.getGlobalHandler?.();

global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  startupError = error;
  console.error("Unhandled JS error", error, { isFatal });

  if (__DEV__ && previousGlobalHandler) {
    previousGlobalHandler(error, isFatal);
  }
});

function StartupErrorScreen() {
  const message =
    startupError instanceof Error
      ? startupError.message
      : "The app could not start. Check the device log for details.";

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f7fb",
        padding: 24,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: "#b42318",
          fontSize: 22,
          fontWeight: "900",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        App Error
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          color: "#2e3747",
          fontSize: 14,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </View>
  );
}

let App = StartupErrorScreen;

try {
  App = require("./App").default;
} catch (error) {
  startupError = error;
  console.error("Failed to load App", error);
}

registerRootComponent(App);
