import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type CSSProperties } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { TelephonyLead } from '../../../shared/api/services/telephony.service'
import { getApiErrorMessage, getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { renewMemorySession, setMemoryAccessToken, startMemorySession } from '../../../shared/lib/session'
import { TelephonyEngine } from '../../telephony/TelephonyProvider'
import { useTelephony } from '../../telephony/TelephonyContext'
import { AttendanceTab } from '../components/AttendanceTab'
import { CallScreen } from '../components/CallScreen'
import { MapTab } from '../components/MapTab'
import { PhoneTab } from '../components/PhoneTab'
import { miniApi, type MiniCapabilities, type MiniUser } from '../lib/api'
import { telephonyService } from '../../../shared/api/services/telephony.service'
import { haptic, loadTelegramSdk, type TgWebApp } from '../lib/telegram'
import { IcGlobe, IcMap, IcPhone, IcPin, IcRefresh, IcSend, IcWarning, type IconProps } from '../ui/icons'
import { OrbitLoader } from '../ui/motion'
import '../miniapp.css'

type Boot =
  | { phase: 'loading' }
  | { phase: 'outside' }
  | { phase: 'error'; message: string; code: number | null }
  | { phase: 'ready'; user: MiniUser; initData: string; webApp: TgWebApp; expiresIn: number; capabilities: MiniCapabilities }

type Tab = 'phone' | 'attendance' | 'map'

const TAB_KEY = 'cims.miniapp.tab'
const LANG_FLAG = 'cims.miniapp.lang-v2'
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700&display=swap'

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

/** The Mini App look (fonts + scoped tokens) is on only while this page is mounted. */
function useMiniLook() {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('mini-root')
    if (!document.querySelector(`link[href="${FONTS_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONTS_URL
      document.head.appendChild(link)
    }
    return () => root.classList.remove('mini-root')
  }, [])
}

function readTab(): Tab {
  try {
    const value = sessionStorage.getItem(TAB_KEY)
    return value === 'phone' || value === 'map' ? value : 'attendance'
  } catch { return 'attendance' }
}

/** Morning / day / evening / night in Tashkent. */
function greetingOf(t: ReturnType<typeof useLocale>['t']) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Tashkent' }).format(new Date())) % 24
  if (hour >= 5 && hour < 12) return t('miniapp.hello.morning', 'Good morning')
  if (hour >= 12 && hour < 18) return t('miniapp.hello.day', 'Good afternoon')
  if (hour >= 18 && hour < 23) return t('miniapp.hello.evening', 'Good evening')
  return t('miniapp.hello.night', 'Good night')
}

/** /miniapp — Telegram Mini App: Phone (WebRTC calls) and Attendance (location check-in / check-out). */
export function MiniAppPage() {
  const { t, locale, setLocale } = useLocale()
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useMiniLook()

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
        if (alive) setBoot({ phase: 'ready', user: session.user, initData, webApp, expiresIn: session.expires_in, capabilities: session.capabilities })
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
      <div className="m-app grid min-h-[100dvh] place-items-center">
        <div className="m-fade"><OrbitLoader label={t('miniapp.loading', 'Loading…')} /></div>
      </div>
    )
  }

  if (boot.phase === 'outside' || boot.phase === 'error') {
    const outside = boot.phase === 'outside'
    return (
      <div className="m-app grid min-h-[100dvh] place-items-center px-6">
        <div className="m-rise flex max-w-sm flex-col items-center text-center">
          <span className="relative grid h-28 w-28 place-items-center">
            <span className="absolute inset-1 rotate-[12deg] rounded-[34px] border-2 border-[var(--primary)]/40" />
            <span className={cn('absolute inset-1 -rotate-[9deg] rounded-[34px] border-2', outside ? 'border-[var(--m-lime)]' : 'border-[var(--m-coral)]/60')} />
            <span className={cn('relative grid h-[88px] w-[88px] place-items-center rounded-[30px] bg-[var(--m-hero)] shadow-[var(--m-shadow-lift)]', outside ? 'text-[var(--m-lime)]' : 'text-[var(--m-coral)]')}>
              {outside ? <IcSend size={40} duo={0.25} /> : <IcWarning size={40} duo={0.25} />}
            </span>
          </span>
          <p className="mt-6 text-[22px] leading-tight font-extrabold text-[var(--foreground)]">
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
            <button type="button" onClick={() => { setBoot({ phase: 'loading' }); setAttempt((value) => value + 1) }} className="m-press mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--foreground)] px-6 text-[15px] font-bold text-[var(--app-canvas)]">
              <IcRefresh size={18} /> {t('miniapp.retry', 'Try again')}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return <ReadyApp user={boot.user} initData={boot.initData} webApp={boot.webApp} sessionCapabilities={boot.capabilities} />
}

type PhoneAccess = { state: 'checking' } | { state: 'denied' } | { state: 'allowed'; canCall: boolean; canEdit: boolean }

/**
 * Calls follow capabilities.calls from /miniapp/session and /miniapp/me: no `view` → the whole calls section
 * is hidden and the SIP line is not even started; `create` is needed to dial, `edit` for call settings.
 * Older backends without capabilities fall back to the RBAC "calls" module.
 */
function ReadyApp({ user, initData, webApp, sessionCapabilities }: { user: MiniUser; initData: string; webApp: TgWebApp; sessionCapabilities: MiniCapabilities }) {
  const [access, setAccess] = useState<PhoneAccess>({ state: 'checking' })
  // Live employee map: only with capabilities.live_location.view (its socket never opens otherwise).
  const [mapAllowed, setMapAllowed] = useState(sessionCapabilities.liveLocation?.view === true)

  useEffect(() => {
    let alive = true
    void (async () => {
      const fresh = await miniApi.capabilities(initData)
      if (!alive) return
      const live = fresh?.liveLocation ?? sessionCapabilities.liveLocation
      setMapAllowed(live?.view === true)
      const calls = fresh?.calls ?? sessionCapabilities.calls
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
  }, [initData, sessionCapabilities])

  const phoneAllowed = access.state === 'allowed'
  return (
    <TelephonyEngine userId={user.id} allowed={phoneAllowed} canPlaceCalls={phoneAllowed && access.canCall} webrtcOnly panel={false}>
      <MiniShell user={user} initData={initData} webApp={webApp} access={access} mapAllowed={mapAllowed} />
    </TelephonyEngine>
  )
}

function MiniShell({ user, initData, webApp, access, mapAllowed }: { user: MiniUser; initData: string; webApp: TgWebApp; access: PhoneAccess; mapAllowed: boolean }) {
  const { t, locale, setLocale } = useLocale()
  const phone = useTelephony()
  const [tab, setTab] = useState<Tab>(readTab)
  const [opened, setOpened] = useState<Record<Tab, boolean>>(() => ({ phone: readTab() === 'phone', attendance: readTab() === 'attendance', map: readTab() === 'map' }))
  const [direction, setDirection] = useState<1 | -1>(1)
  const [dialed, setDialed] = useState<string | null>(null)
  const appVisible = useSyncExternalStore(subscribeVisible, readVisible, () => true)

  const fullName = [user.name, user.surname].filter(Boolean).join(' ') || t('miniapp.employee', 'Employee')
  const initials = ((user.name?.[0] ?? '') + (user.surname?.[0] ?? '')).toUpperCase() || 'C'
  const ready = phone.connection === 'Ready'
  const phoneAllowed = access.state === 'allowed'
  // Only the sections this employee may use; a single section means no tab bar.
  const tabs = ([
    ...(phoneAllowed ? [['phone', IcPhone, t('miniapp.tab.phone', 'Phone')]] : []),
    ['attendance', IcPin, t('miniapp.tab.attendance', 'Attendance')],
    ...(mapAllowed ? [['map', IcMap, t('miniapp.tab.map', 'Map')]] : []),
  ] as Array<[Tab, ComponentType<IconProps>, string]>)
  const current: Tab = tabs.some(([value]) => value === tab) ? tab : 'attendance'
  const withTabBar = tabs.length > 1
  const currentIndex = Math.max(0, tabs.findIndex(([value]) => value === current))
  const nextLocale = locale === 'uz' ? 'ru' : locale === 'ru' ? 'en' : 'uz'

  // Each section keeps its own scroll position.
  const scrollRef = useRef<Partial<Record<Tab, number>>>({})
  useLayoutEffect(() => {
    window.scrollTo(0, scrollRef.current[current] ?? 0)
  }, [current])

  const switchTab = useCallback((next: Tab, nextIndex: number) => {
    if (next === current) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    haptic('select')
    scrollRef.current[current] = window.scrollY
    setDirection(nextIndex >= currentIndex ? 1 : -1)
    setTab(next)
    setOpened((value) => (value[next] ? value : { ...value, [next]: true }))
    try { sessionStorage.setItem(TAB_KEY, next) } catch { /* ignore */ }
  }, [current, currentIndex])

  const dial = useCallback((number: string, lead?: TelephonyLead | null) => {
    setDialed(number)
    phone.dial(number, lead)
  }, [phone])

  const shellStyle = {
    '--m-tabbar': withTabBar ? 'calc(74px + max(10px, env(safe-area-inset-bottom)))' : 'max(14px, env(safe-area-inset-bottom))',
  } as CSSProperties
  const swapStyle = { '--dx': `${direction * 24}px` } as CSSProperties

  return (
    <div className="m-app min-h-[100dvh]" style={shellStyle}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--app-canvas)] px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        {/* Content scrolls softly under the header. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full h-4" style={{ background: 'linear-gradient(var(--app-canvas), color-mix(in srgb, var(--app-canvas) 0%, transparent))' }} />
        <div className="m-rise flex items-center gap-3">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[18px]" style={{ background: 'conic-gradient(from 210deg, var(--primary), var(--m-lime), var(--primary))' }} data-i18n-skip="true">
            <span className="m-display grid h-[42px] w-[42px] place-items-center rounded-[15px] bg-[var(--m-hero)] text-[14px] font-semibold text-[var(--m-lime)]">{initials}</span>
            {phoneAllowed ? (
              <span className={cn('absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full border-[3px] border-[var(--app-canvas)]', ready ? 'bg-[var(--success)]' : 'bg-[var(--warning)]')} title={phone.connection}>
                {ready ? null : <span className="m-breathe block h-1 w-1 rounded-full bg-white" />}
              </span>
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[var(--muted)]">
              {greetingOf(t)}{user.role_name ? <span className="text-[var(--caption)]"> · {user.role_name}</span> : null}
            </p>
            <p className="truncate text-[17px] leading-tight font-extrabold text-[var(--foreground)]" data-i18n-skip="true">{fullName}</p>
          </div>
          <button
            type="button"
            onClick={() => { haptic('select'); setLocale(nextLocale) }}
            aria-label={t('miniapp.language', 'Language')}
            className="m-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)] pr-3.5 pl-2.5 text-[12.5px] font-extrabold tracking-wide text-[var(--foreground)] uppercase shadow-[var(--m-shadow)]"
          >
            <IcGlobe size={17} className="text-[var(--primary)]" />
            <span key={locale} className="m-pop">{locale}</span>
          </button>
        </div>
      </header>

      {/* Sections stay mounted (the line keeps ringing, location keeps updating while open). */}
      <main style={{ paddingBottom: withTabBar ? 'calc(var(--m-tabbar) + 8px)' : 'var(--m-tabbar)' }}>
        {phoneAllowed ? (
          <div className={current === 'phone' ? 'm-swap block' : 'hidden'} style={swapStyle}>
            {opened.phone || current === 'phone' ? <PhoneTab active={current === 'phone'} onDial={dial} canCall={access.canCall} canEdit={access.canEdit} userId={user.id} /> : null}
          </div>
        ) : null}
        <div className={current === 'attendance' ? 'm-swap block' : 'hidden'} style={swapStyle}>
          {opened.attendance || current === 'attendance' ? <AttendanceTab active={current === 'attendance'} appVisible={appVisible} initData={initData} webApp={webApp} withTabBar={withTabBar} /> : null}
        </div>
        {/* The live map (and its socket) starts only once the tab is opened, and only with the permission. */}
        {mapAllowed && (opened.map || current === 'map') ? (
          <div className={current === 'map' ? 'm-swap block' : 'hidden'} style={swapStyle}>
            <MapTab active={current === 'map'} withTabBar={withTabBar} />
          </div>
        ) : null}
      </main>

      {/* Floating dock — reachable with one thumb */}
      {withTabBar ? (
        <nav className="fixed inset-x-3 z-40 mx-auto max-w-md" style={{ bottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <div className="m-dock relative grid h-16 p-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            <span
              aria-hidden="true"
              className="m-dock-pill absolute inset-y-1.5 left-1.5"
              style={{ width: `calc((100% - 12px) / ${tabs.length})`, transform: `translateX(${currentIndex * 100}%)` }}
            />
            {tabs.map(([value, Icon, label], index) => {
              const on = current === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchTab(value, index)}
                  aria-current={on ? 'page' : undefined}
                  className={cn('m-press relative z-10 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11.5px] font-bold transition-colors duration-300', on ? 'text-[var(--m-pill-fg)]' : 'text-[var(--muted-strong)]')}
                >
                  <Icon size={22} duo={on ? 0.35 : 0.12} className={cn('transition-transform duration-500', on && '-translate-y-px scale-110')} />
                  <span className="max-w-full truncate px-1">{label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      ) : null}

      {phoneAllowed ? <CallScreen dialed={dialed} /> : null}
    </div>
  )
}
