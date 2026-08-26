import { Component, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";

import { AppText } from "./src/components/AppText";
import { GameViewport } from "./src/components/GameViewport";
import { LanguageSettings } from "./src/components/LanguageSettings";
import { getInitialLanguage, LanguageCode } from "./src/i18n/languages";
import { strings } from "./src/i18n/strings";

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
  const [language, setLanguage] = useState<LanguageCode>(() => getInitialLanguage());
  const [trackingStatus] = useState("not requested on startup");
  const copy = useMemo(() => strings[language], [language]);

  useEffect(() => {
    StatusBar.setBarStyle("dark-content");
  }, []);

  const handleChangeLanguage = useCallback((nextLanguage: LanguageCode) => {
    setLanguage(nextLanguage);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <AppText style={styles.title}>{copy.title}</AppText>
          <AppText style={styles.subtitle}>{copy.subtitle}</AppText>
        </View>
        <GameViewport copy={copy} />
        <View style={styles.footer}>
          <LanguageSettings language={language} copy={copy} onChangeLanguage={handleChangeLanguage} />
          <AppText style={styles.trackingText}>
            {copy.tracking}: {trackingStatus}
          </AppText>
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
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  title: {
    color: "#172033",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#5c6778",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    gap: 8,
  },
  trackingText: {
    color: "#6b7280",
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
