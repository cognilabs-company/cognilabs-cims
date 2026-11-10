import type { AppLocale } from '../i18n/translations'

/** Month / weekday names for pickers. Uzbek is spelled out (browser ICU data for uz is patchy). */
const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
const UZ_WEEKDAYS_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
const INTL: Record<Exclude<AppLocale, 'uz'>, string> = { ru: 'ru-RU', en: 'en-US' }

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1)

export function monthName(locale: AppLocale, monthIndex: number) {
  if (locale === 'uz') return UZ_MONTHS[monthIndex]
  return capitalize(new Intl.DateTimeFormat(INTL[locale], { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, monthIndex, 1)))
}

export function monthShort(locale: AppLocale, monthIndex: number) {
  if (locale === 'uz') return UZ_MONTHS[monthIndex].slice(0, 3)
  return capitalize(new Intl.DateTimeFormat(INTL[locale], { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, monthIndex, 1)).replace('.', ''))
}

/** Monday-first short weekday names. */
export function weekdayShortNames(locale: AppLocale) {
  if (locale === 'uz') return UZ_WEEKDAYS_SHORT
  const format = new Intl.DateTimeFormat(INTL[locale], { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, index) => capitalize(format.format(Date.UTC(2024, 0, 1 + index)).replace('.', '')))
}

/** "12 noy 2026" · "12 нояб. 2026" · "Nov 12, 2026" */
export function formatShortDay(locale: AppLocale, date: Date) {
  if (locale === 'uz') return `${date.getDate()} ${UZ_MONTHS[date.getMonth()].slice(0, 3).toLowerCase()} ${date.getFullYear()}`
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
