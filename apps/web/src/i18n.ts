import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

// Type definitions for locale messages
export interface LocaleMessages {
  [key: string]: string | LocaleMessages
}

// Supported locales
export const supportedLocales = ['en', 'zh'] as const
export type SupportedLocale = typeof supportedLocales[number]

// Default locale
const defaultLocale: SupportedLocale = 'en'

// Get browser locale or fallback to default
function getBrowserLocale(): SupportedLocale {
  const navigatorLocale = navigator.language.split('-')[0] as SupportedLocale
  return supportedLocales.includes(navigatorLocale) ? navigatorLocale : defaultLocale
}

// Create i18n instance
export const i18n = createI18n({
  legacy: false,
  locale: getBrowserLocale(),
  fallbackLocale: defaultLocale,
  messages: {
    en,
    zh,
  },
  datetimeFormats: {
    en: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
      },
    },
    zh: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
      },
    },
  },
})

// Export for use in components
export function useI18n() {
  return i18n.global
}
