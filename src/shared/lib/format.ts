import { getIntlLocale, getStoredLocale, type AppLocale } from '../i18n/translations'

const localizedMonthNames: Record<AppLocale, string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  uz: [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ],
  ru: [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ],
}

const localizedShortMonthNames: Record<AppLocale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
}

const localizedShortWeekdayNames: Record<AppLocale, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  uz: ['Yak', 'Dus', 'Ses', 'Cho', 'Pay', 'Jum', 'Sha'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
}

function parseDateInput(date?: string | null) {
  if (!date) {
    return null
  }

  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getLocalizedMonthName(month: number, locale: AppLocale = getStoredLocale()) {
  const index = Math.trunc(month) - 1

  if (index < 0 || index >= 12) {
    return ''
  }

  // Some browsers can return month codes like "M04" for month-only Intl formatting in Uzbek.
  return localizedMonthNames[locale][index]
}

export function getLocalizedShortMonthName(month: number, locale: AppLocale = getStoredLocale()) {
  const index = Math.trunc(month) - 1

  if (index < 0 || index >= 12) {
    return ''
  }

  return localizedShortMonthNames[locale][index]
}

export function getLocalizedShortWeekdayName(dayIndex: number, locale: AppLocale = getStoredLocale()) {
  if (dayIndex < 0 || dayIndex >= 7) {
    return ''
  }

  return localizedShortWeekdayNames[locale][dayIndex]
}

export function formatCurrency(value: number, currency = 'UZS') {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(getIntlLocale(), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatShortMonthDay(date?: string | null, locale: AppLocale = getStoredLocale()) {
  const parsed = parseDateInput(date)

  if (!parsed) {
    return '-'
  }

  const day = padDatePart(parsed.getDate())
  const month = getLocalizedShortMonthName(parsed.getMonth() + 1, locale)

  if (locale === 'en') {
    return `${month} ${parsed.getDate()}`
  }

  return `${day} ${month}`
}

export function formatShortDate(date?: string | null, locale: AppLocale = getStoredLocale()) {
  const parsed = parseDateInput(date)

  if (!parsed) {
    return '-'
  }

  const day = padDatePart(parsed.getDate())
  const month = getLocalizedShortMonthName(parsed.getMonth() + 1, locale)
  const year = parsed.getFullYear()

  if (locale === 'en') {
    return `${month} ${parsed.getDate()}, ${year}`
  }

  return `${day} ${month} ${year}`
}

function formatTimePart(date: Date, locale: AppLocale = getStoredLocale()) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatShortDateTime(date?: string | null, locale: AppLocale = getStoredLocale()) {
  const parsed = parseDateInput(date)

  if (!parsed) {
    return '-'
  }

  return `${formatShortDate(date, locale)} ${formatTimePart(parsed, locale)}`
}

export function formatShortMonthDayTime(date?: string | null, locale: AppLocale = getStoredLocale()) {
  const parsed = parseDateInput(date)

  if (!parsed) {
    return '-'
  }

  return `${formatShortMonthDay(date, locale)} ${formatTimePart(parsed, locale)}`
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

export function formatNumericDate(date?: string | null) {
  if (!date) {
    return '-'
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return `${parsed.getFullYear()} ${padDatePart(parsed.getMonth() + 1)} ${padDatePart(parsed.getDate())}`
}

export function formatNumericDateTime(date?: string | null) {
  if (!date) {
    return '-'
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return `${formatNumericDate(date)} ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`
}
