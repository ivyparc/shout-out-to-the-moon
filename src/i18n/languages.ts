export type LanguageCode = "ko" | "en" | "ja" | "zh-Hans" | "zh-Hant";

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: "ko", label: "Korean" },
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "zh-Hans", label: "Chinese Simplified" },
  { code: "zh-Hant", label: "Chinese Traditional" },
];

export function mapLocaleToLanguage(locale: string | null | undefined): LanguageCode {
  if (!locale) {
    return "en";
  }

  const normalized = locale.replace("_", "-");
  const lower = normalized.toLowerCase();

  if (lower.startsWith("ko")) {
    return "ko";
  }
  if (lower.startsWith("en")) {
    return "en";
  }
  if (lower.startsWith("ja")) {
    return "ja";
  }
  if (
    lower === "zh-hant" ||
    lower.startsWith("zh-hant-") ||
    lower === "zh-tw" ||
    lower === "zh-hk" ||
    lower === "zh-mo"
  ) {
    return "zh-Hant";
  }
  if (lower === "zh" || lower === "zh-hans" || lower.startsWith("zh-hans-")) {
    return "zh-Hans";
  }

  return "en";
}

export function getInitialLanguage(): LanguageCode {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return mapLocaleToLanguage(locale);
}
