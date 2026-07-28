import pl from "./pl.json";
import en from "./en.json";

export type Locale = "pl" | "en";
export type Dict = typeof pl;
export type TranslationKey = keyof Dict;

const dictionaries: Record<Locale, Dict> = { pl, en };

const SUPPORTED_LOCALES: Locale[] = ["pl", "en"];
export const DEFAULT_LOCALE: Locale = "pl";

/** Flat-key i18n lookup with `{placeholder}` interpolation. No heavy i18n lib needed for this slice. */
export function t(key: TranslationKey, locale: Locale, vars?: Record<string, string | number>): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  let str: string = (dict as Record<string, string>)[key] ?? (dictionaries[DEFAULT_LOCALE] as Record<string, string>)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && SUPPORTED_LOCALES.includes(value as Locale);
}

/** Resolves a request locale from `?lang=`, then `Accept-Language`, then the default. */
export function resolveLocale(opts: { queryLang?: string | null; acceptLanguage?: string | null }): Locale {
  if (isSupportedLocale(opts.queryLang)) return opts.queryLang;
  const header = opts.acceptLanguage ?? "";
  for (const part of header.split(",")) {
    const lang = part.trim().split(";")[0]?.slice(0, 2).toLowerCase();
    if (isSupportedLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}
