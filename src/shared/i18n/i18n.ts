import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from '../../locales/en/common.json'
import enLiteral from '../../locales/en/literal.json'
import enLiteralOverrides from '../../locales/en/literal.overrides.json'
import ruCommon from '../../locales/ru/common.json'
import ruLiteral from '../../locales/ru/literal.json'
import ruLiteralOverrides from '../../locales/ru/literal.overrides.json'
import uzCommon from '../../locales/uz/common.json'
import uzLiteral from '../../locales/uz/literal.json'
import uzLiteralOverrides from '../../locales/uz/literal.overrides.json'

const literalResources = {
  en: { ...enLiteral, ...enLiteralOverrides },
  uz: { ...uzLiteral, ...uzLiteralOverrides },
  ru: { ...ruLiteral, ...ruLiteralOverrides },
} as const

const STORAGE_KEY = 'cims-locale'
const DEFAULT_LANGUAGE = 'en'
const SUPPORTED_LANGUAGES = new Set(['en', 'uz', 'ru'])
const isDev = import.meta.env.DEV

function resolveInitialLanguage() {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const storedLanguage = window.localStorage.getItem(STORAGE_KEY)

  if (storedLanguage && SUPPORTED_LANGUAGES.has(storedLanguage)) {
    return storedLanguage
  }

  const browserLanguage = window.navigator.language?.toLowerCase()

  if (browserLanguage?.startsWith('uz')) {
    return 'uz'
  }

  if (browserLanguage?.startsWith('ru')) {
    return 'ru'
  }

  return DEFAULT_LANGUAGE
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, literal: literalResources.en },
      uz: { common: uzCommon, literal: literalResources.uz },
      ru: { common: ruCommon, literal: literalResources.ru },
    },
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: 'common',
    ns: ['common', 'literal'],
    interpolation: {
      escapeValue: false,
    },
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    debug: false,
    saveMissing: isDev,
    missingKeyHandler: isDev
      ? (_languages, _namespace, key) => {
        console.warn(`[i18n] Missing translation key: ${String(key)}`)
      }
      : undefined,
    react: {
      useSuspense: false,
    },
  })

export default i18n
