import "i18next";
import type fi from "./locales/fi.json";

// Finnish is the source of truth for translation keys; t() calls are type-checked against it.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof fi };
  }
}
