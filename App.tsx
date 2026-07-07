import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, SafeAreaView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AppText } from "./src/components/AppText";
import { GameViewport } from "./src/components/GameViewport";
import { LanguageSettings } from "./src/components/LanguageSettings";
import { getInitialLanguage, LanguageCode } from "./src/i18n/languages";
import { strings } from "./src/i18n/strings";
import { loadSavedLanguage, saveLanguage } from "./src/storage/languagePreference";
import { requestTrackingPermission } from "./src/services/trackingPermission";

export default function App() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [trackingStatus, setTrackingStatus] = useState<string>("not-requested");

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      const savedLanguage = await loadSavedLanguage();
      if (isMounted) {
        setLanguage(savedLanguage ?? getInitialLanguage());
      }
    }

    boot();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    async function requestWhenActive() {
      if (AppState.currentState !== "active") {
        return;
      }
      const status = await requestTrackingPermission();
      setTrackingStatus(status);
    }

    requestWhenActive();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        requestWhenActive();
      }
    });

    return () => subscription.remove();
  }, []);

  const copy = strings[language];

  const handleLanguageChange = useCallback(async (nextLanguage: LanguageCode) => {
    await saveLanguage(nextLanguage);
    setLanguage(nextLanguage);
  }, []);

  const appInfo = useMemo(
    () => `${copy.tracking}: ${trackingStatus}`,
    [copy.tracking, trackingStatus],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <AppText style={styles.title}>{copy.title}</AppText>
          <AppText style={styles.subtitle}>{copy.subtitle}</AppText>
        </View>
        <GameViewport copy={copy} />
        <View style={styles.footer}>
          <LanguageSettings
            language={language}
            onChangeLanguage={handleLanguageChange}
            copy={copy}
          />
          <AppText style={styles.status}>{appInfo}</AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  shell: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  header: {
    width: "100%",
    maxWidth: 760,
    gap: 4,
  },
  title: {
    color: "#2e3747",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#536072",
    fontSize: 13,
    textAlign: "center",
  },
  footer: {
    width: "100%",
    maxWidth: 760,
    gap: 8,
  },
  status: {
    color: "#6d7788",
    fontSize: 12,
    textAlign: "center",
  },
});
