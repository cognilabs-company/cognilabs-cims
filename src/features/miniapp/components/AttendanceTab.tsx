import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CrosshairIcon,
  GearSixIcon,
  MapPinIcon,
  MapPinLineIcon,
  SignInIcon,
  SignOutIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { getApiErrorMessage, getApiErrorStatus } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { miniApi, type GeoFix, type LocationsPayload, type Presence } from '../lib/api'
import { distanceMeters, formatMeters, getFix, openLocationSettings, type GeoError } from '../lib/geo'
import { haptic, type TgWebApp } from '../lib/telegram'

type Props = {
  active: boolean
  /** The Mini App is on screen (positions are sent only then). */
  appVisible: boolean
  initData: string
  webApp: TgWebApp
  /** The bottom tab bar is shown (the action button sits above it). */
  withTabBar?: boolean
}

const POSITION_EVERY_MS = 25_000
const FRESH_FIX_MS = 30_000

/** 422 details may be a string or an object with the measured distance — show both. */
function backendDetail(cause: unknown, fallback: string) {
  const details = (cause as { details?: unknown } | null)?.details
  const detail = details && typeof details === 'object' ? (details as { detail?: unknown }).detail : null
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const data = detail as Record<string, unknown>
    const text = String(data.message ?? data.detail ?? data.error ?? '').trim()
    const distance = Number(data.distance_meters ?? data.distance ?? NaN)
    return [text || fallback, Number.isFinite(distance) ? `(${formatMeters(distance)})` : ''].filter(Boolean).join(' ')
  }
  return fallback
}

function clockOf(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Attendance section: state, GPS, assigned locations with distance, Keldim / Ketdim. */
export function AttendanceTab({ active, appVisible, initData, webApp, withTabBar = true }: Props) {
  const { t } = useLocale()
  const [data, setData] = useState<LocationsPayload | null>(null)
  const [presence, setPresence] = useState<Presence | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fix, setFix] = useState<(GeoFix & { at: number }) | null>(null)
  const [geoError, setGeoError] = useState<GeoError | null>(null)
  const [locating, setLocating] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [now, setNow] = useState(() => new Date().getTime())
  const startedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const [payload, state] = await Promise.all([miniApi.locations(initData), miniApi.state(initData).catch(() => null)])
      setData(payload)
      setPresence(state ?? payload.presence)
      setLoadError(null)
    } catch (cause) {
      setLoadError(getApiErrorMessage(cause))
    }
  }, [initData])

  const locate = useCallback(async (report: boolean) => {
    setLocating(true)
    try {
      const next = await getFix(webApp)
      const stamped = { ...next, at: new Date().getTime() }
      setFix(stamped)
      setGeoError(null)
      if (report) void miniApi.position(initData, next).catch(() => {})
      return stamped
    } catch (cause) {
      setGeoError((typeof cause === 'string' ? cause : 'unavailable') as GeoError)
      return null
    } finally {
      setLocating(false)
    }
  }, [initData, webApp])

  // First open of the section: data + first position.
  useEffect(() => {
    if (!active || startedRef.current) return
    startedRef.current = true
    const timer = window.setTimeout(() => { void load(); void locate(true) }, 0)
    return () => window.clearTimeout(timer)
  }, [active, load, locate])

  // While the Mini App is visible: a fresh position every 25 s (never in the background).
  useEffect(() => {
    if (!appVisible || !startedRef.current || geoError === 'denied') return
    const timer = window.setInterval(() => { void locate(true) }, POSITION_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [appVisible, geoError, locate])

  // Back to the app → refresh state and position.
  useEffect(() => {
    if (!appVisible || !startedRef.current) return
    const timer = window.setTimeout(() => { void load(); void locate(true) }, 0)
    return () => window.clearTimeout(timer)
  }, [appVisible, load, locate])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const checkedIn = presence?.state === 'checked_in'
  const maxAccuracy = data?.maxAccuracy ?? 100
  const locations = useMemo(() => {
    const items = data?.items ?? []
    return items
      .map((item) => ({ ...item, distance: fix ? distanceMeters(fix, item) : null }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  }, [data, fix])

  // Checked in → the check-in location; otherwise the one the user picked, else the nearest.
  const selected = (checkedIn && presence?.location_id ? locations.find((item) => item.id === presence.location_id) : null)
    ?? locations.find((item) => item.id === pickedId)
    ?? locations[0]
    ?? null
  const accuracyOk = fix ? fix.accuracy_meters <= maxAccuracy : false
  const inside = Boolean(selected && selected.distance !== null && selected.distance <= selected.radius_meters)
  const canAct = Boolean(fix && accuracyOk && selected && inside && !busy && presence)

  let reason = ''
  if (!presence) reason = t('miniapp.att.loading_state', 'Loading your state…')
  else if (!locations.length) reason = t('miniapp.att.no_locations', 'No location is assigned to you yet. Ask the CEO.')
  else if (geoError === 'denied') reason = t('miniapp.att.geo_denied', 'Location access is off.')
  else if (!fix) reason = t('miniapp.att.waiting_gps', 'Waiting for GPS…')
  else if (!accuracyOk) reason = t('miniapp.att.low_accuracy', 'GPS accuracy is ±{{value}} m — needs ±{{max}} m or better. Step outside or wait a moment.', { value: Math.round(fix.accuracy_meters), max: maxAccuracy })
  else if (selected && !inside && selected.distance !== null) reason = t('miniapp.att.too_far', 'You are {{distance}} from “{{name}}” (allowed {{radius}} m).', { distance: formatMeters(selected.distance), name: selected.name, radius: selected.radius_meters })

  async function act() {
    if (!selected || !presence) return
    setBusy(true)
    setResult(null)
    try {
      const current = fix && new Date().getTime() - fix.at < FRESH_FIX_MS ? fix : await locate(false)
      if (!current) throw new Error(t('miniapp.att.no_gps', 'Could not get your location.'))
      const body = { latitude: current.latitude, longitude: current.longitude, accuracy_meters: current.accuracy_meters }
      if (checkedIn) await miniApi.checkOut(initData, selected.id, body)
      else await miniApi.checkIn(initData, selected.id, body)
      haptic('success')
      setResult({ tone: 'success', text: checkedIn ? t('miniapp.att.done_out', 'Checked out. See you!') : t('miniapp.att.done_in', 'Checked in. Have a good day!') })
      await load()
    } catch (cause) {
      haptic('error')
      const code = getApiErrorStatus(cause)
      if (code === 409) {
        setResult({ tone: 'error', text: t('miniapp.att.conflict', 'Your state has changed — refreshed.') })
        await load()
      } else {
        setResult({ tone: 'error', text: cause instanceof Error && !('status' in cause) ? cause.message : backendDetail(cause, getApiErrorMessage(cause)) })
      }
    } finally {
      setBusy(false)
    }
  }

  const since = presence?.since ? new Date(presence.since).getTime() : null
  const elapsedMin = checkedIn && since ? Math.max(0, Math.floor((now - since) / 60_000)) : null
  const fixAge = fix ? Math.max(0, Math.round((now - fix.at) / 1000)) : null

  return (
    <div className={cn('flex min-h-full flex-col px-4 pt-1', withTabBar ? 'pb-28' : 'pb-24')}>
      {/* State */}
      <section className={cn('mini-in rounded-[22px] p-4 ring-1', checkedIn ? 'bg-[var(--success-dim)] ring-[var(--success-border)]' : 'bg-[var(--surface)] ring-[var(--border)]')}>
        <div className="flex items-center gap-3">
          <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full', checkedIn ? 'bg-[var(--success)] text-white' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]')}>
            {checkedIn ? <CheckCircleIcon size={26} weight="fill" /> : <SignInIcon size={24} weight="duotone" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-[var(--foreground)]">
              {presence ? (checkedIn ? t('miniapp.att.at_work', 'You are at work') : t('miniapp.att.not_at_work', 'You are not at work')) : <span className="skeleton inline-block h-5 w-36 rounded-full" />}
            </p>
            <p className="truncate text-[13px] text-[var(--muted-strong)]">
              {checkedIn
                ? [presence?.location_name, presence?.since ? t('miniapp.att.since', 'since {{time}}', { time: clockOf(presence.since) }) : null].filter(Boolean).join(' · ')
                : presence?.checked_out_at ? t('miniapp.att.left_at', 'Left at {{time}}', { time: clockOf(presence.checked_out_at) }) : t('miniapp.att.tap_when_arrive', 'Press “I’m here” when you arrive')}
            </p>
          </div>
          {elapsedMin !== null ? (
            <span className="shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[13px] font-semibold text-[var(--success-text)] tabular-nums">
              {Math.floor(elapsedMin / 60)}:{String(elapsedMin % 60).padStart(2, '0')}
            </span>
          ) : null}
        </div>
      </section>

      {/* GPS */}
      <section className="mini-in mt-3 flex items-center gap-3 rounded-[18px] bg-[var(--surface)] px-3.5 py-3 ring-1 ring-[var(--border)]" style={{ animationDelay: '60ms' }}>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', geoError ? 'bg-[var(--danger-dim)] text-[var(--danger-text)]' : fix && accuracyOk ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--warning-dim)] text-[var(--warning-text)]')}>
          <CrosshairIcon size={20} weight="duotone" className={cn(locating && 'animate-spin [animation-duration:2.2s]')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--foreground)]">
            {geoError === 'denied'
              ? t('miniapp.att.geo_denied', 'Location access is off.')
              : geoError
                ? t('miniapp.att.geo_unavailable', 'Location is not available right now')
                : fix
                  ? t('miniapp.att.accuracy', 'GPS accuracy ±{{value}} m', { value: Math.round(fix.accuracy_meters) })
                  : t('miniapp.att.waiting_gps', 'Waiting for GPS…')}
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            {geoError === 'denied'
              ? t('miniapp.att.geo_denied_hint', 'Allow location for Telegram in your phone settings.')
              : fix && fixAge !== null
                ? t('miniapp.att.updated', 'Updated {{seconds}} s ago · sent while the app is open', { seconds: fixAge })
                : t('miniapp.att.only_open', 'Location is used only while the app is open')}
          </p>
        </div>
        {geoError === 'denied' ? (
          <button type="button" onClick={() => openLocationSettings(webApp)} className="mini-key grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)]" aria-label={t('miniapp.att.settings', 'Settings')}>
            <GearSixIcon size={19} />
          </button>
        ) : (
          <button type="button" onClick={() => { haptic('tap'); void locate(true) }} disabled={locating} className="mini-key grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)] disabled:opacity-50" aria-label={t('miniapp.att.refresh', 'Refresh location')}>
            <ArrowClockwiseIcon size={18} />
          </button>
        )}
      </section>

      {/* Locations */}
      <p className="mt-5 mb-2 px-1 text-[12px] font-semibold tracking-wide text-[var(--muted)] uppercase">{t('miniapp.att.locations', 'Your locations')}</p>
      {loadError ? (
        <div className="rounded-[16px] bg-[var(--danger-dim)] px-3.5 py-3 text-[13px] text-[var(--danger-text)]">
          {loadError}
          <button type="button" onClick={() => void load()} className="mt-2 block font-semibold underline">{t('miniapp.retry', 'Try again')}</button>
        </div>
      ) : !data ? (
        <div className="space-y-2">{Array.from({ length: 2 }, (_, index) => <span key={index} className="skeleton block h-[72px] rounded-[18px]" />)}</div>
      ) : locations.length === 0 ? (
        <div className="rounded-[18px] bg-[var(--surface)] px-4 py-8 text-center ring-1 ring-[var(--border)]">
          <MapPinLineIcon size={30} weight="duotone" className="mx-auto text-[var(--muted)]" />
          <p className="mt-2 text-[14px] text-[var(--muted-strong)]">{t('miniapp.att.no_locations', 'No location is assigned to you yet. Ask the CEO.')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {locations.map((item, index) => {
            const isSelected = selected?.id === item.id
            const within = item.distance !== null && item.distance <= item.radius_meters
            const locked = checkedIn && presence?.location_id !== null && presence?.location_id !== undefined
            return (
              <li key={item.id} className="mini-in" style={{ animationDelay: `${100 + index * 50}ms` }}>
                <button
                  type="button"
                  disabled={locked && !isSelected}
                  onClick={() => { haptic('select'); setPickedId(item.id) }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[18px] px-3.5 py-3 text-left ring-1 transition-[box-shadow,background-color] duration-200 disabled:opacity-50',
                    isSelected ? 'bg-[var(--surface)] shadow-[0_0_0_2px_var(--primary)] ring-transparent' : 'bg-[var(--surface)] ring-[var(--border)]',
                  )}
                >
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', within ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--blue-dim)] text-[var(--primary)]')}>
                    <MapPinIcon size={20} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-[var(--foreground)]">{item.name}</span>
                    <span className="block truncate text-[12px] text-[var(--muted)]">{item.address || t('miniapp.att.radius', 'Radius {{value}} m', { value: item.radius_meters })}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums', item.distance === null ? 'bg-[var(--muted-surface)] text-[var(--muted)]' : within ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--muted-surface)] text-[var(--muted-strong)]')}>
                    {item.distance === null ? '—' : within ? t('miniapp.att.inside', 'Inside') : formatMeters(item.distance)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {result ? (
        <p className={cn('mini-in mt-4 flex items-start gap-2 rounded-[16px] px-3.5 py-3 text-[13.5px] leading-snug', result.tone === 'success' ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--danger-dim)] text-[var(--danger-text)]')}>
          {result.tone === 'success' ? <CheckCircleIcon size={18} weight="fill" className="mt-px shrink-0" /> : <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0" />}
          {result.text}
        </p>
      ) : null}

      {/* Main action — above the tab bar, reachable with the thumb */}
      <div className={cn('fixed inset-x-0 z-30 mx-auto max-w-md px-4', withTabBar ? 'bottom-[calc(74px+max(8px,env(safe-area-inset-bottom)))]' : 'bottom-[max(14px,env(safe-area-inset-bottom))]')}>
        {!canAct && reason ? <p className="mini-in mb-2 rounded-[12px] bg-[var(--surface)]/95 px-3 py-2 text-center text-[12.5px] leading-snug text-[var(--muted-strong)] shadow-[0_6px_18px_-12px_rgba(14,21,37,0.4)] backdrop-blur">{reason}</p> : null}
        <button
          type="button"
          onClick={() => void act()}
          disabled={!canAct}
          className={cn(
            'mini-key flex h-14 w-full items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-bold text-white transition-[background-color,opacity] disabled:opacity-45',
            checkedIn ? 'bg-[var(--danger)] shadow-[0_14px_28px_-16px_var(--danger)]' : 'bg-[var(--success)] shadow-[0_14px_28px_-16px_var(--success)]',
          )}
        >
          {busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : checkedIn ? <SignOutIcon size={22} weight="bold" /> : <SignInIcon size={22} weight="bold" />}
          {checkedIn ? t('miniapp.att.check_out', 'Ketdim') : t('miniapp.att.check_in', 'Keldim')}
        </button>
      </div>
    </div>
  )
}
