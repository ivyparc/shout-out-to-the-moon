import { Component, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AppState, SafeAreaView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AppText } from "./src/components/AppText";
import { GameViewport } from "./src/components/GameViewport";
import { LanguageSettings } from "./src/components/LanguageSettings";
import { getInitialLanguage, LanguageCode } from "./src/i18n/languages";
import { strings } from "./src/i18n/strings";
import { loadSavedLanguage, saveLanguage } from "./src/storage/languagePreference";
import { requestTrackingPermission } from "./src/services/trackingPermission";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorScreen}>
            <AppText style={styles.errorTitle}>App Error</AppText>
            <AppText style={styles.errorMessage}>{this.state.error.message}</AppText>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

function RootApp() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [trackingStatus, setTrackingStatus] = useState<string>("not-requested");
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const savedLanguage = await loadSavedLanguage();
        if (isMounted) {
          setLanguage(savedLanguage ?? getInitialLanguage());
        }
      } catch (error) {
        if (isMounted) {
          setBootError(error instanceof Error ? error.message : "Failed to initialize app.");
        }
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
      try {
        const status = await requestTrackingPermission();
        setTrackingStatus(status);
      } catch (error) {
        setTrackingStatus(error instanceof Error ? `error: ${error.message}` : "error");
      }
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
        {bootError ? (
          <View style={styles.inlineError}>
            <AppText style={styles.inlineErrorText}>{bootError}</AppText>
          </View>
        ) : null}
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

export default function App() {
  return (
    <AppErrorBoundary>
      <RootApp />
    </AppErrorBoundary>
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
  inlineError: {
    width: "100%",
    maxWidth: 760,
    borderRadius: 6,
    backgroundColor: "#fff2f0",
    padding: 8,
  },
  inlineErrorText: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  errorScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f7fb",
  },
  errorTitle: {
    color: "#b42318",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  errorMessage: {
    color: "#2e3747",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
