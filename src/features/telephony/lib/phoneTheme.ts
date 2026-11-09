import { useSyncExternalStore } from 'react'

/** Light / dark choice for the phone UI (Calls page). "auto" follows the system. */
export type PhoneTheme = 'auto' | 'light' | 'dark'

const KEY = 'cims-phone-theme'
const listeners = new Set<() => void>()

function read(): PhoneTheme {
  try {
    const value = window.localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export function setPhoneTheme(theme: PhoneTheme) {
  try { window.localStorage.setItem(KEY, theme) } catch { /* private mode */ }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function usePhoneTheme(): PhoneTheme {
  return useSyncExternalStore(subscribe, read, () => 'auto')
}

/** Value for the `data-phone-theme` attribute ("auto" leaves the system in charge). */
export function phoneThemeAttr(theme: PhoneTheme) {
  return theme === 'auto' ? undefined : theme
}
