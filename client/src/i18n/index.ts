import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fi from "./locales/fi.json";

export const SUPPORTED_LANGUAGES = ["fi", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fi: { translation: fi },
      en: { translation: en },
    },
    // Finnish first: the browser language is deliberately ignored. The user's
    // choice is remembered, and ?lng=en overrides it for testing.
    fallbackLng: "fi",
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ["querystring", "localStorage"],
      lookupQuerystring: "lng",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
