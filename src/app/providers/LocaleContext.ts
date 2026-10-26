import { createContext } from 'react'
import type { AppLocale, TranslationParams } from '../../shared/i18n/translations'

export type LocaleContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: string, fallback?: string, params?: TranslationParams) => string
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)
