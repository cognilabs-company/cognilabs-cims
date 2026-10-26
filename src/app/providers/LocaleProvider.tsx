import { useCallback, useEffect, useMemo, type PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { observeDomTranslations } from '../../shared/i18n/dom'
import { getStoredLocale, setCurrentLocale, type AppLocale, type TranslationParams } from '../../shared/i18n/translations'
import { LocaleContext } from './LocaleContext'

export function LocaleProvider({ children }: PropsWithChildren) {
  const { i18n, t } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? getStoredLocale()) as AppLocale

  const setLocale = useCallback((nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      return
    }

    setCurrentLocale(nextLocale)
    void i18n.changeLanguage(nextLocale)
  }, [i18n, locale])

  useEffect(() => {
    setCurrentLocale(locale)
    window.localStorage.setItem('cims-locale', locale)
    document.documentElement.lang = locale

    return observeDomTranslations(locale)
  }, [locale])

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: (key: string, fallback?: string, params?: TranslationParams) => {
      const translated = t(key, {
        defaultValue: fallback ?? key,
        ...params,
      })

      return typeof translated === 'string' ? translated : String(translated)
    },
  }), [locale, setLocale, t])

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}
