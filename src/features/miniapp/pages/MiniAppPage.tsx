import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { MapPinIcon, PhoneIcon, TelegramLogoIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { TelephonyLead } from '../../../shared/api/services/telephony.service'
import { getApiErrorMessage, getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { renewMemorySession, setMemoryAccessToken, startMemorySession } from '../../../shared/lib/session'
import { TelephonyEngine } from '../../telephony/TelephonyProvider'
import { useTelephony } from '../../telephony/TelephonyContext'
import { AttendanceTab } from '../components/AttendanceTab'
import { CallScreen } from '../components/CallScreen'
import { PhoneTab } from '../components/PhoneTab'
import { miniApi, type CallsCapability, type MiniUser } from '../lib/api'
import { telephonyService } from '../../../shared/api/services/telephony.service'
import { haptic, loadTelegramSdk, type TgWebApp } from '../lib/telegram'

type Boot =
  | { phase: 'loading' }
  | { phase: 'outside' }
  | { phase: 'error'; message: string; code: number | null }
  | { phase: 'ready'; user: MiniUser; initData: string; webApp: TgWebApp; expiresIn: number; calls: CallsCapability }

type Tab = 'phone' | 'attendance'

const TAB_KEY = 'cims.miniapp.tab'
const LANG_FLAG = 'cims.miniapp.lang-v2'

/* Visible = the page is shown and Telegram has not put the Mini App in the background. */
let telegramActive = true
const visibilityListeners = new Set<() => void>()
function subscribeVisible(listener: () => void) {
  visibilityListeners.add(listener)
  document.addEventListener('visibilitychange', listener)
  return () => { visibilityListeners.delete(listener); document.removeEventListener('visibilitychange', listener) }
}
const readVisible = () => document.visibilityState === 'visible' && telegramActive

function applyTelegramTheme(webApp: TgWebApp) {
  const root = document.documentElement
  root.dataset.theme = webApp.colorScheme === 'dark' ? 'dark' : 'light'
  root.style.colorScheme = root.dataset.theme
  const background = getComputedStyle(document.body).backgroundColor
  const match = background.match(/\d+/g)
  if (match && match.length >= 3) {
    const hex = `#${match.slice(0, 3).map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`
    try { webApp.setHeaderColor?.(hex); webApp.setBackgroundColor?.(hex); webApp.setBottomBarColor?.(hex) } catch { /* old clients */ }
  }
}

function readTab(): Tab {
  try { return sessionStorage.getItem(TAB_KEY) === 'phone' ? 'phone' : 'attendance' } catch { return 'attendance' }
}

/** /miniapp — Telegram Mini App: Phone (WebRTC calls) and Attendance (location check-in / check-out). */
export function MiniAppPage() {
  const { t, locale, setLocale } = useLocale()
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    void (async () => {
      const webApp = await loadTelegramSdk()
      if (!alive) return
      if (!webApp?.initData) { setBoot({ phase: 'outside' }); return }
      try { webApp.ready(); webApp.expand(); webApp.disableVerticalSwipes?.() } catch { /* old clients */ }
      applyTelegramTheme(webApp)
      const initData = webApp.initData
      // The JWT lives in memory only; when it expires a new session is made from initData.
      startMemorySession(async () => {
        try { return (await miniApi.session(initData)).access_token || null } catch { return null }
      })
      try {
        const session = await miniApi.session(initData)
        setMemoryAccessToken(session.access_token)
        if (alive) setBoot({ phase: 'ready', user: session.user, initData, webApp, expiresIn: session.expires_in, calls: session.calls })
      } catch (cause) {
        if (alive) setBoot({ phase: 'error', message: getApiErrorMessage(cause), code: getApiErrorStatus(cause) })
      }
    })()
    return () => { alive = false }
  }, [attempt])

  // The Mini App opens in Uzbek (a language switch is in the header); applied once per device.
  useEffect(() => {
    let applied = true
    try { applied = localStorage.getItem(LANG_FLAG) === '1'; localStorage.setItem(LANG_FLAG, '1') } catch { /* ignore */ }
    if (!applied && locale !== 'uz') setLocale('uz')
  }, [locale, setLocale])

  // Theme follows Telegram; the Mini App going to the background stops location updates.
  useEffect(() => {
    if (boot.phase !== 'ready') return
    const { webApp } = boot
    const onTheme = () => applyTelegramTheme(webApp)
    const onActive = () => { telegramActive = true; visibilityListeners.forEach((listener) => listener()) }
    const onInactive = () => { telegramActive = false; visibilityListeners.forEach((listener) => listener()) }
    webApp.onEvent('themeChanged', onTheme)
    webApp.onEvent('activated', onActive)
    webApp.onEvent('deactivated', onInactive)
    return () => {
      webApp.offEvent('themeChanged', onTheme)
      webApp.offEvent('activated', onActive)
      webApp.offEvent('deactivated', onInactive)
    }
  }, [boot])

  // Renew the session a little before it expires.
  useEffect(() => {
    if (boot.phase !== 'ready') return
    const every = Math.max(60, boot.expiresIn - 120) * 1000
    const timer = window.setInterval(() => { void renewMemorySession() }, every)
    return () => window.clearInterval(timer)
  }, [boot])

  if (boot.phase === 'loading') {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[var(--app-canvas)]">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    )
  }

  if (boot.phase === 'outside' || boot.phase === 'error') {
    const outside = boot.phase === 'outside'
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[var(--app-canvas)] px-6">
        <div className="mini-in max-w-sm text-center">
          <span className={cn('mx-auto grid h-16 w-16 place-items-center rounded-full', outside ? 'bg-[var(--blue-dim)] text-[var(--primary)]' : 'bg-[var(--danger-dim)] text-[var(--danger-text)]')}>
            {outside ? <TelegramLogoIcon size={34} weight="duotone" /> : <WarningCircleIcon size={34} weight="duotone" />}
          </span>
          <p className="mt-4 text-[20px] font-bold text-[var(--foreground)]">
            {outside
              ? t('miniapp.outside.title', 'Open in Telegram')
              : boot.code === 401 || boot.code === 403 || boot.code === 404
                ? t('miniapp.error.not_linked', 'Your Telegram is not linked to CIMS')
                : t('miniapp.error.title', 'Could not sign in')}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted-strong)]">
            {outside ? t('miniapp.outside.text', 'This page works inside the CIMS bot in Telegram.') : boot.message}
          </p>
          {!outside ? (
            <button type="button" onClick={() => { setBoot({ phase: 'loading' }); setAttempt((value) => value + 1) }} className="mt-5 h-11 rounded-[14px] bg-[var(--primary)] px-5 text-[15px] font-semibold text-white">
              {t('miniapp.retry', 'Try again')}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return <ReadyApp user={boot.user} initData={boot.initData} webApp={boot.webApp} sessionCalls={boot.calls} />
}

type PhoneAccess = { state: 'checking' } | { state: 'denied' } | { state: 'allowed'; canCall: boolean; canEdit: boolean }

/**
 * Calls follow capabilities.calls from /miniapp/session and /miniapp/me: no `view` → the whole calls section
 * is hidden and the SIP line is not even started; `create` is needed to dial, `edit` for call settings.
 * Older backends without capabilities fall back to the RBAC "calls" module.
 */
function ReadyApp({ user, initData, webApp, sessionCalls }: { user: MiniUser; initData: string; webApp: TgWebApp; sessionCalls: CallsCapability }) {
  const [access, setAccess] = useState<PhoneAccess>({ state: 'checking' })

  useEffect(() => {
    let alive = true
    void (async () => {
      const calls = (await miniApi.callsCapability(initData)) ?? sessionCalls
      if (!alive) return
      if (calls) {
        if (!calls.view) { setAccess({ state: 'denied' }); return }
        // The phone line itself (SIP account) still has to exist.
        try {
          await telephonyService.config()
          if (alive) setAccess({ state: 'allowed', canCall: calls.create, canEdit: calls.edit })
        } catch {
          if (alive) setAccess({ state: 'denied' })
        }
        return
      }
      const [config, rbac] = await Promise.allSettled([telephonyService.config(), miniApi.callsAccess()])
      if (!alive) return
      const rights = rbac.status === 'fulfilled' ? rbac.value : null
      if (config.status === 'rejected') {
        const code = getApiErrorStatus(config.reason)
        // 401 / 403 / 404: this employee has no phone line.
        if (code === 401 || code === 403 || code === 404 || rights?.view === false) { setAccess({ state: 'denied' }); return }
        setAccess({ state: 'allowed', canCall: rights?.create ?? true, canEdit: rights?.edit ?? false })
        return
      }
      if (rights && !rights.view) { setAccess({ state: 'denied' }); return }
      setAccess({ state: 'allowed', canCall: rights?.create ?? true, canEdit: rights?.edit ?? false })
    })()
    return () => { alive = false }
  }, [initData, sessionCalls])

  const phoneAllowed = access.state === 'allowed'
  return (
    <TelephonyEngine userId={user.id} allowed={phoneAllowed} canPlaceCalls={phoneAllowed && access.canCall} webrtcOnly panel={false}>
      <MiniShell user={user} initData={initData} webApp={webApp} access={access} />
    </TelephonyEngine>
  )
}

function MiniShell({ user, initData, webApp, access }: { user: MiniUser; initData: string; webApp: TgWebApp; access: PhoneAccess }) {
  const { t, locale, setLocale } = useLocale()
  const phone = useTelephony()
  const [tab, setTab] = useState<Tab>(readTab)
  const [opened, setOpened] = useState<Record<Tab, boolean>>(() => ({ phone: readTab() === 'phone', attendance: readTab() === 'attendance' }))
  const [dialed, setDialed] = useState<string | null>(null)
  const appVisible = useSyncExternalStore(subscribeVisible, readVisible, () => true)

  const switchTab = useCallback((next: Tab) => {
    haptic('select')
    setTab(next)
    setOpened((current) => (current[next] ? current : { ...current, [next]: true }))
    try { sessionStorage.setItem(TAB_KEY, next) } catch { /* ignore */ }
  }, [])

  const dial = useCallback((number: string, lead?: TelephonyLead | null) => {
    setDialed(number)
    phone.dial(number, lead)
  }, [phone])

  const fullName = [user.name, user.surname].filter(Boolean).join(' ') || t('miniapp.employee', 'Employee')
  const initials = ((user.name?.[0] ?? '') + (user.surname?.[0] ?? '')).toUpperCase() || 'C'
  const ready = phone.connection === 'Ready'
  const phoneAllowed = access.state === 'allowed'
  // Without telephony the app is Attendance only (no tab bar).
  const current: Tab = phoneAllowed ? tab : 'attendance'
  const nextLocale = locale === 'uz' ? 'ru' : locale === 'ru' ? 'en' : 'uz'

  return (
    <div className="mini-app min-h-[100dvh] bg-[var(--app-canvas)] text-[var(--foreground)]">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[var(--app-canvas)]/90 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--blue-dim)] text-[15px] font-bold text-[var(--primary)]" data-i18n-skip="true">
          {initials}
          {phoneAllowed ? <span className={cn('absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[var(--app-canvas)]', ready ? 'bg-[var(--success)]' : 'bg-[var(--warning)]')} title={phone.connection} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold" data-i18n-skip="true">{fullName}</p>
          <p className="truncate text-[12.5px] text-[var(--muted)]">{user.role_name || 'CIMS'}</p>
        </div>
        <button
          type="button"
          onClick={() => { haptic('select'); setLocale(nextLocale) }}
          aria-label={t('miniapp.language', 'Language')}
          className="mini-key h-9 shrink-0 rounded-full bg-[var(--muted-surface)] px-3 text-[12.5px] font-bold tracking-wide text-[var(--muted-strong)] uppercase"
        >
          {locale}
        </button>
      </header>

      {/* Both sections stay mounted (the line keeps ringing, location keeps updating while open). */}
      <main className={phoneAllowed ? 'pb-[calc(76px+env(safe-area-inset-bottom))]' : 'pb-[env(safe-area-inset-bottom)]'}>
        {phoneAllowed ? (
          <div className={current === 'phone' ? 'block' : 'hidden'}>
            {opened.phone ? <PhoneTab active={current === 'phone'} onDial={dial} canCall={access.canCall} /> : null}
          </div>
        ) : null}
        <div className={current === 'attendance' ? 'block' : 'hidden'}>
          {opened.attendance || current === 'attendance' ? <AttendanceTab active={current === 'attendance'} appVisible={appVisible} initData={initData} webApp={webApp} withTabBar={phoneAllowed} /> : null}
        </div>
      </main>

      {/* Two big tabs at the bottom — reachable with one thumb (only when the phone is available) */}
      {phoneAllowed ? <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="relative mx-auto grid max-w-md grid-cols-2 gap-2">
          <span aria-hidden="true" className="mini-tab-indicator absolute inset-y-0 w-[calc(50%-4px)] rounded-[16px] bg-[var(--blue-dim)]" style={{ transform: current === 'phone' ? 'translateX(0)' : 'translateX(calc(100% + 8px))' }} />
          {([
            ['phone', PhoneIcon, t('miniapp.tab.phone', 'Phone')],
            ['attendance', MapPinIcon, t('miniapp.tab.attendance', 'Attendance')],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchTab(value)}
              aria-current={current === value ? 'page' : undefined}
              className={cn('relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[12.5px] font-semibold transition-colors', current === value ? 'text-[var(--primary)]' : 'text-[var(--muted-strong)]')}
            >
              <Icon size={24} weight={current === value ? 'duotone' : 'regular'} />
              {label}
            </button>
          ))}
        </div>
      </nav> : null}

      {phoneAllowed ? <CallScreen dialed={dialed} /> : null}
    </div>
  )
}
