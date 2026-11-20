/* Telegram Mini App SDK (https://core.telegram.org/bots/webapps) — only the parts CIMS uses. */

import { useEffect, useRef } from 'react'

export type TgLocationData = {
  latitude: number
  longitude: number
  horizontal_accuracy?: number | null
}

export type TgLocationManager = {
  isInited: boolean
  isLocationAvailable: boolean
  isAccessRequested: boolean
  isAccessGranted: boolean
  init: (callback?: () => void) => void
  getLocation: (callback: (data: TgLocationData | null) => void) => void
  openSettings: () => void
}

export type TgWebApp = {
  initData: string
  initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; language_code?: string } }
  colorScheme: 'light' | 'dark'
  version: string
  platform: string
  ready: () => void
  expand: () => void
  close: () => void
  isVersionAtLeast: (version: string) => boolean
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  onEvent: (event: string, handler: () => void) => void
  offEvent: (event: string, handler: () => void) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  LocationManager?: TgLocationManager
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (handler: () => void) => void
    offClick: (handler: () => void) => void
  }
}

type TelegramWindow = Window & { Telegram?: { WebApp?: TgWebApp } }

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'

function current() {
  return (window as TelegramWindow).Telegram?.WebApp ?? null
}

/** Loads the official SDK once (only on /miniapp) and resolves the WebApp object, or null outside Telegram. */
export function loadTelegramSdk(timeoutMs = 8000): Promise<TgWebApp | null> {
  const existing = current()
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
    const done = () => resolve(current())
    const timer = window.setTimeout(done, timeoutMs)
    const finish = () => { window.clearTimeout(timer); done() }
    if (!script) {
      script = document.createElement('script')
      script.src = SDK_URL
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', finish, { once: true })
  })
}

export function telegram() {
  return current()
}

/** Light tactile feedback; silently does nothing outside Telegram. */
export function haptic(kind: 'tap' | 'success' | 'error' | 'warning' | 'select') {
  const feedback = current()?.HapticFeedback
  if (!feedback) return
  try {
    if (kind === 'tap') feedback.impactOccurred('light')
    else if (kind === 'select') feedback.selectionChanged()
    else feedback.notificationOccurred(kind)
  } catch { /* old clients */ }
}

/** While `active`, Telegram's own Back button (top-left) runs `onBack` — closes sheets and the camera. */
export function useTelegramBack(active: boolean, onBack: () => void) {
  const handlerRef = useRef(onBack)
  useEffect(() => {
    handlerRef.current = onBack
  })
  useEffect(() => {
    const button = current()?.BackButton
    if (!active || !button) return
    const handler = () => handlerRef.current()
    try { button.onClick(handler); button.show() } catch { /* old clients */ }
    return () => {
      try { button.offClick(handler); button.hide() } catch { /* old clients */ }
    }
  }, [active])
}
