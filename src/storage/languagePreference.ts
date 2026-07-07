import AsyncStorage from "@react-native-async-storage/async-storage";

import { LanguageCode } from "../i18n/languages";

const LANGUAGE_KEY = "settings.language";
const VALID_LANGUAGES = new Set(["ko", "en", "ja", "zh-Hans", "zh-Hant"]);

export async function loadSavedLanguage(): Promise<LanguageCode | null> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (saved && VALID_LANGUAGES.has(saved)) {
    return saved as LanguageCode;
  }
  return null;
}

export async function saveLanguage(language: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}
