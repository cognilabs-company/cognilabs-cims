import { useSyncExternalStore } from 'react'

/**
 * App-wide light / dark theme.
 *  - "auto" follows the operating system (macOS Light / Dark) and updates live;
 *  - "light" / "dark" override it and are remembered per browser.
 * The resolved theme is written to <html data-theme="light|dark">; CSS tokens in
 * index.css switch on it. index.html applies the same logic before first paint.
 */
export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'cims-theme'
const LEGACY_KEY = 'cims-phone-theme' // the Calls-only switch used this before the theme went app-wide
const listeners = new Set<() => void>()

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export function resolveTheme(preference: ThemePreference = readThemePreference()): ResolvedTheme {
  if (preference === 'auto') return systemDark() ? 'dark' : 'light'
  return preference
}

function applyTheme() {
  const resolved = resolveTheme()
  const root = document.documentElement
  if (root.dataset.theme === resolved) return
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

function notify() {
  listeners.forEach((listener) => listener())
}

/** Switch theme; crossfades with the View Transitions API when available. */
export function setThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(KEY, preference)
    window.localStorage.removeItem(LEGACY_KEY)
  } catch { /* private mode: still switch for this session */ }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const changes = resolveTheme(preference) !== document.documentElement.dataset.theme
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown }
  if (changes && !reduceMotion && typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => applyTheme())
  } else {
    applyTheme()
  }
  notify()
}

let started = false

/** Call once at startup: applies the theme and follows OS / other-tab changes. */
export function initTheme() {
  if (started || typeof window === 'undefined') return
  started = true
  applyTheme()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readThemePreference() === 'auto') applyTheme()
    notify()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    applyTheme()
    notify()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => 'auto')
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, () => resolveTheme(), () => 'light')
}
