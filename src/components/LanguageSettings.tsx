import { Pressable, StyleSheet, View } from "react-native";

import { LANGUAGE_OPTIONS, LanguageCode } from "../i18n/languages";
import { GameCopy } from "../i18n/strings";
import { AppText } from "./AppText";

type Props = {
  language: LanguageCode;
  copy: GameCopy;
  onChangeLanguage: (language: LanguageCode) => void;
};

export function LanguageSettings({ language, copy, onChangeLanguage }: Props) {
  return (
    <View style={styles.wrapper}>
      <AppText style={styles.label}>{copy.language}</AppText>
      <View style={styles.options}>
        {LANGUAGE_OPTIONS.map((option) => {
          const isActive = option.code === language;
          return (
            <Pressable
              key={option.code}
              accessibilityRole="button"
              onPress={() => onChangeLanguage(option.code)}
              style={[styles.option, isActive && styles.activeOption]}
            >
              <AppText style={[styles.optionText, isActive && styles.activeOptionText]}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: "#4b5565",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  option: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cfd6e1",
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  activeOption: {
    borderColor: "#2877ff",
    backgroundColor: "#e7f0ff",
  },
  optionText: {
    color: "#4d5868",
    fontSize: 12,
    fontWeight: "700",
  },
  activeOptionText: {
    color: "#1656c7",
  },
});
