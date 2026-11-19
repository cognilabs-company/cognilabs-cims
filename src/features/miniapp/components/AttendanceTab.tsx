import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwiseIcon,
  CalendarBlankIcon,
  CameraIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockCountdownIcon,
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
import { miniApi, type DaySummary, type GeoFix, type LocationsPayload, type Presence } from '../lib/api'
import { dayEndAfter, dayTitle, formatTimer, shiftDay, tashkentClock } from '../lib/attendanceDay'
import { PhotoPrepError, preparePhoto } from '../lib/photo'
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

const clockOf = tashkentClock

type Step = 'locating' | 'photo' | 'sending'

/**
 * Attendance section: state with a live work timer, the day's summary, GPS, assigned locations with
 * distance, and Keldim / Ketdim — with a photo first (optional; "Continue without photo" is always there).
 */
export function AttendanceTab({ active, appVisible, initData, webApp, withTabBar = true }: Props) {
  const { t, locale } = useLocale()
  const [data, setData] = useState<LocationsPayload | null>(null)
  const [presence, setPresence] = useState<Presence | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fix, setFix] = useState<(GeoFix & { at: number }) | null>(null)
  const [geoError, setGeoError] = useState<GeoError | null>(null)
  const [locating, setLocating] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const busy = step !== null
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string; photo?: string } | null>(null)
  const [now, setNow] = useState(() => new Date().getTime())
  const [today, setToday] = useState<DaySummary | null>(null)
  /** The day shown in the summary card; null = the current attendance day. */
  const [viewDay, setViewDay] = useState<string | null>(null)
  const [pastDay, setPastDay] = useState<DaySummary | null>(null)
  const startedRef = useRef(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const closedReloadRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [payload, state, summary] = await Promise.all([
        miniApi.locations(initData),
        miniApi.state(initData).catch(() => null),
        miniApi.summary(initData).catch(() => null),
      ])
      setData(payload)
      setPresence(state ?? payload.presence)
      if (summary) setToday(summary)
      setLoadError(null)
    } catch (cause) {
      setLoadError(getApiErrorMessage(cause))
    }
  }, [initData])

  // A past day in the summary card.
  useEffect(() => {
    if (!viewDay) return
    let alive = true
    miniApi.summary(initData, viewDay)
      .then((summary) => { if (alive) setPastDay(summary) })
      .catch(() => { if (alive) setPastDay({ attendance_date: viewDay, record: null }) })
    return () => { alive = false }
  }, [initData, viewDay])

  // The last action's photo preview lives in memory only.
  useEffect(() => {
    const url = result?.photo
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [result])

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

  const checkedIn = presence?.state === 'checked_in'

  // A live work timer ticks every second while checked in (every 30 s otherwise).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), checkedIn && active ? 1000 : 30_000)
    return () => window.clearInterval(timer)
  }, [checkedIn, active])

  // An open session is closed by the backend at the next 03:00: stop the timer there and reload once.
  const checkedInAt = checkedIn && presence?.checked_in_at ? new Date(presence.checked_in_at).getTime() : null
  const closesAt = checkedInAt !== null && !Number.isNaN(checkedInAt) ? dayEndAfter(checkedInAt) : null
  const pastClose = closesAt !== null && now >= closesAt
  useEffect(() => {
    if (!pastClose || closesAt === null || closedReloadRef.current === closesAt) return
    closedReloadRef.current = closesAt
    const timer = window.setTimeout(() => { void load() }, 1500)
    return () => window.clearTimeout(timer)
  }, [pastClose, closesAt, load])

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

  /** Keldim / Ketdim; with `photoFile` the photo is uploaded first and attached to the event. */
  async function act(photoFile?: File) {
    if (!selected || !presence) return
    const leaving = checkedIn
    setStep('locating')
    setResult(null)
    let preview: string | undefined
    try {
      const current = fix && new Date().getTime() - fix.at < FRESH_FIX_MS ? fix : await locate(false)
      if (!current) throw new Error(t('miniapp.att.no_gps', 'Could not get your location.'))
      let photoId: string | null = null
      if (photoFile) {
        setStep('photo')
        const photo = await preparePhoto(photoFile)
        photoId = (await miniApi.uploadPhoto(initData, photo)).photo_id
        preview = URL.createObjectURL(photo)
      }
      setStep('sending')
      const body = { latitude: current.latitude, longitude: current.longitude, accuracy_meters: current.accuracy_meters }
      if (leaving) await miniApi.checkOut(initData, selected.id, body, photoId)
      else await miniApi.checkIn(initData, selected.id, body, photoId)
      haptic('success')
      setResult({ tone: 'success', text: leaving ? t('miniapp.att.done_out', 'Checked out. See you!') : t('miniapp.att.done_in', 'Checked in. Have a good day!'), photo: preview })
      preview = undefined
      setViewDay(null)
      await load()
    } catch (cause) {
      haptic('error')
      const code = getApiErrorStatus(cause)
      if (code === 409) {
        // Actions alternate: the same action twice in a row is refused.
        setResult({ tone: 'error', text: leaving ? t('miniapp.att.already_out', 'You have already checked out — refreshed.') : t('miniapp.att.already_in', 'You have already checked in — refreshed.') })
        await load()
      } else if (cause instanceof PhotoPrepError || code === 413) {
        setResult({ tone: 'error', text: cause instanceof PhotoPrepError && cause.code === 'unsupported' ? t('miniapp.att.photo_unsupported', 'This photo format is not supported. Take it again or continue without a photo.') : t('miniapp.att.photo_too_large', 'The photo is larger than 10 MB. Take it again or continue without a photo.') })
      } else {
        setResult({ tone: 'error', text: cause instanceof Error && !('status' in cause) ? cause.message : backendDetail(cause, getApiErrorMessage(cause)) })
      }
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      setStep(null)
    }
  }

  function takePhoto() {
    if (!canAct) return
    haptic('tap')
    photoInputRef.current?.click()
  }

  // Worked today = completed intervals + the open one (until now, or the 03:00 close).
  const completedMinutes = presence?.worked_minutes ?? today?.record?.worked_minutes ?? 0
  const openSeconds = checkedInAt !== null && !Number.isNaN(checkedInAt) ? Math.max(0, (Math.min(now, closesAt ?? now) - checkedInAt) / 1000) : 0
  const workedSeconds = completedMinutes * 60 + (checkedIn ? openSeconds : 0)
  const autoClosed = !checkedIn && Boolean(presence?.auto_closed)
  const fixAge = fix ? Math.max(0, Math.round((now - fix.at) / 1000)) : null
  const hoursText = (minutes: number) => t('miniapp.att.hours_minutes', '{{h}} h {{m}} min', { h: Math.floor(minutes / 60), m: minutes % 60 })
  const stepText = step === 'photo' ? t('miniapp.att.step_photo', 'Uploading the photo…') : step === 'locating' ? t('miniapp.att.step_locating', 'Checking your location…') : t('miniapp.att.step_sending', 'Saving…')

  const shownDay = viewDay ? pastDay : today
  const currentDay = today?.attendance_date ?? null
  const dayLabel = !shownDay?.attendance_date
    ? ''
    : shownDay.attendance_date === currentDay
      ? t('miniapp.att.today', 'Today')
      : currentDay && shownDay.attendance_date === shiftDay(currentDay, -1)
        ? t('miniapp.att.yesterday', 'Yesterday')
        : dayTitle(shownDay.attendance_date, locale)

  return (
    <div className={cn('flex min-h-full flex-col px-4 pt-1', withTabBar ? 'pb-44' : 'pb-40')}>
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
                ? [presence?.location_name, presence?.checked_in_at ? t('miniapp.att.since', 'since {{time}}', { time: clockOf(presence.checked_in_at) }) : null].filter(Boolean).join(' · ')
                : autoClosed
                  ? t('miniapp.att.auto_closed', 'Automatically closed at 03:00')
                  : presence?.checked_out_at ? t('miniapp.att.left_at', 'Left at {{time}}', { time: clockOf(presence.checked_out_at) }) : t('miniapp.att.tap_when_arrive', 'Press “I’m here” when you arrive')}
            </p>
          </div>
        </div>
        {presence && (checkedIn || workedSeconds > 0) ? (
          <div className={cn('mt-3 flex items-end justify-between gap-3 rounded-[16px] px-3.5 py-2.5', checkedIn ? 'bg-[var(--surface)]' : 'bg-[var(--muted-surface)]')}>
            <span className="text-[12.5px] font-medium text-[var(--muted-strong)]">
              {checkedIn ? t('miniapp.att.worked_live', 'Worked today') : t('miniapp.att.worked_today', 'Worked today')}
              <span className="block text-[11px] text-[var(--muted)]">{t('miniapp.att.worked_hint', 'Only time between check-in and check-out counts')}</span>
            </span>
            <span className={cn('text-[24px] leading-none font-bold tabular-nums', checkedIn ? 'text-[var(--success-text)]' : 'text-[var(--foreground)]')}>{formatTimer(workedSeconds)}</span>
          </div>
        ) : null}
        {autoClosed ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-[12px] bg-[var(--warning-dim)] px-3 py-2 text-[12px] leading-snug text-[var(--warning-text)]">
            <ClockCountdownIcon size={15} weight="bold" className="mt-px shrink-0" />
            {t('miniapp.att.auto_closed_hint', 'You did not check out, so the day was closed at 03:00. This is not your real leaving time.')}
          </p>
        ) : null}
      </section>

      {/* Day summary (03:00 → 03:00) */}
      {today ? (
        <section className="mini-in mt-3 rounded-[18px] bg-[var(--surface)] px-3.5 py-3 ring-1 ring-[var(--border)]" style={{ animationDelay: '40ms' }}>
          <div className="flex items-center gap-2">
            <CalendarBlankIcon size={17} weight="duotone" className="shrink-0 text-[var(--primary)]" />
            <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--foreground)]">{dayLabel}</p>
            <button
              type="button"
              onClick={() => { haptic('select'); setViewDay(shiftDay(shownDay?.attendance_date ?? currentDay ?? '', -1)) }}
              disabled={!shownDay?.attendance_date}
              aria-label={t('miniapp.att.prev_day', 'Previous day')}
              className="mini-key grid h-8 w-8 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)] disabled:opacity-40"
            >
              <CaretLeftIcon size={15} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('select')
                const next = shiftDay(shownDay?.attendance_date ?? '', 1)
                setViewDay(!currentDay || next >= currentDay ? null : next)
              }}
              disabled={!viewDay}
              aria-label={t('miniapp.att.next_day', 'Next day')}
              className="mini-key grid h-8 w-8 place-items-center rounded-full bg-[var(--muted-surface)] text-[var(--foreground)] disabled:opacity-40"
            >
              <CaretRightIcon size={15} weight="bold" />
            </button>
          </div>
          {viewDay && (!pastDay || pastDay.attendance_date !== viewDay) ? (
            <span className="skeleton mt-2.5 block h-[52px] rounded-[12px]" />
          ) : shownDay?.record ? (
            <>
              <div className="mt-2.5 grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] gap-2">
                {[
                  [t('miniapp.att.first_in', 'Came'), clockOf(shownDay.record.check_in_at) || '—'],
                  [t('miniapp.att.last_out', 'Left'), shownDay.record.check_out_at ? clockOf(shownDay.record.check_out_at) : (shownDay.attendance_date === currentDay && checkedIn ? t('miniapp.att.still_here', 'at work') : '—')],
                  [t('miniapp.att.worked', 'Worked'), hoursText(shownDay.attendance_date === currentDay && checkedIn ? Math.floor(workedSeconds / 60) : shownDay.record.worked_minutes)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[12px] bg-[var(--muted-surface)] px-2.5 py-2">
                    <p className="text-[11px] text-[var(--muted)]">{label}</p>
                    <p className="truncate text-[14px] font-semibold text-[var(--foreground)] tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              {shownDay.record.auto_closed ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--warning-dim)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--warning-text)]">
                  <ClockCountdownIcon size={13} weight="bold" /> {t('miniapp.att.auto_closed', 'Automatically closed at 03:00')}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[13px] text-[var(--muted)]">{t('miniapp.att.no_record', 'No attendance on this day')}</p>
          )}
        </section>
      ) : null}

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
        <div className={cn('mini-in mt-4 flex items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-[13.5px] leading-snug', result.tone === 'success' ? 'bg-[var(--success-dim)] text-[var(--success-text)]' : 'bg-[var(--danger-dim)] text-[var(--danger-text)]')}>
          {result.photo ? (
            <img src={result.photo} alt="" className="h-11 w-11 shrink-0 rounded-[10px] object-cover ring-2 ring-white/70" />
          ) : result.tone === 'success' ? <CheckCircleIcon size={18} weight="fill" className="shrink-0" /> : <WarningCircleIcon size={18} weight="fill" className="shrink-0" />}
          <span className="min-w-0 flex-1">{result.text}</span>
        </div>
      ) : null}

      {/* Main action — above the tab bar, reachable with the thumb */}
      <div className={cn('fixed inset-x-0 z-30 mx-auto max-w-md px-4', withTabBar ? 'bottom-[calc(74px+max(8px,env(safe-area-inset-bottom)))]' : 'bottom-[max(14px,env(safe-area-inset-bottom))]')}>
        {!canAct && !busy && reason ? <p className="mini-in mb-2 rounded-[12px] bg-[var(--surface)]/95 px-3 py-2 text-center text-[12.5px] leading-snug text-[var(--muted-strong)] shadow-[0_6px_18px_-12px_rgba(14,21,37,0.4)] backdrop-blur">{reason}</p> : null}
        {/* Camera only — the photo is optional, so the input is never required. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void act(file)
          }}
        />
        <button
          type="button"
          onClick={takePhoto}
          disabled={!canAct}
          className={cn(
            'mini-key flex h-14 w-full items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-bold text-white transition-[background-color,opacity] disabled:opacity-45',
            checkedIn ? 'bg-[var(--danger)] shadow-[0_14px_28px_-16px_var(--danger)]' : 'bg-[var(--success)] shadow-[0_14px_28px_-16px_var(--success)]',
          )}
        >
          {busy ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <span className="text-[15px]">{stepText}</span>
            </>
          ) : (
            <>
              <CameraIcon size={22} weight="bold" />
              {checkedIn ? t('miniapp.att.photo_check_out', 'Take photo · Ketdim') : t('miniapp.att.photo_check_in', 'Take photo · Keldim')}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => { haptic('tap'); void act() }}
          disabled={!canAct}
          className="mini-key mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--surface)] text-[14.5px] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] transition-opacity disabled:opacity-45"
        >
          {checkedIn ? <SignOutIcon size={17} weight="bold" /> : <SignInIcon size={17} weight="bold" />}
          {t('miniapp.att.no_photo', 'Continue without photo')}
        </button>
      </div>
    </div>
  )
}
